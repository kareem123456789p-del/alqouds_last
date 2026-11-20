#!/usr/bin/env bash
# ==============================================================================
# Al-Quds Medical ERP — Launch & Service Manager
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$SCRIPT_DIR"

PGDATA="$HOME/.local/share/alquds-qa/pgdata"
PGLOG="$HOME/.local/share/alquds-qa/pg.log"
APP_PID_FILE="$SCRIPT_DIR/.app.pid"
APP_LOG="$SCRIPT_DIR/app.log"
PG_PORT=5433
APP_PORT=3000

# Color helpers
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_err()   { echo -e "${RED}[ERROR]${NC} $1"; }

ensure_env() {
    if [ ! -f .env ]; then
        log_warn "Missing .env file. Generating default configuration..."
        cat << 'EOF' > .env
PORT=3000
DATABASE_URL=postgresql://postgres@127.0.0.1:5433/alquods_db
NODE_ENV=development
EOF
        log_ok "Created .env successfully."
    fi
}

start_postgres() {
    mkdir -p /tmp/opencode
    mkdir -p "$(dirname "$PGLOG")"

    if pg_isready -h 127.0.0.1 -p "$PG_PORT" -q 2>/dev/null; then
        log_ok "PostgreSQL is already running on port $PG_PORT."
        return 0
    fi

    log_info "Starting PostgreSQL cluster on port $PG_PORT..."

    # If postmaster.pid exists but process isn't running, pg_ctl might need help
    if [ -f "$PGDATA/postmaster.pid" ]; then
        PID=$(head -n 1 "$PGDATA/postmaster.pid" || true)
        if ! ps -p "$PID" > /dev/null 2>&1; then
            log_warn "Cleaning stale postmaster.pid (PID $PID)..."
            rm -f "$PGDATA/postmaster.pid"
        fi
    fi

    pg_ctl -D "$PGDATA" -l "$PGLOG" -o "-p $PG_PORT -k /tmp/opencode" start >/dev/null 2>&1 || true

    # Wait for PostgreSQL to become ready
    local retries=15
    while [ $retries -gt 0 ]; do
        if pg_isready -h 127.0.0.1 -p "$PG_PORT" -q 2>/dev/null; then
            log_ok "PostgreSQL is ready and accepting connections on port $PG_PORT."
            return 0
        fi
        sleep 0.5
        retries=$((retries - 1))
    done

    log_err "Failed to start PostgreSQL on port $PG_PORT. Check $PGLOG for details."
    exit 1
}

ensure_database() {
    # Check if alquods_db has tables initialized
    if ! psql -h 127.0.0.1 -p "$PG_PORT" -U postgres -d alquods_db -c "SELECT 1 FROM staff LIMIT 1;" >/dev/null 2>&1; then
        log_info "Database 'alquods_db' is not initialized. Running setup_pg.js..."
        node setup_pg.js
        log_ok "Database schema, migrations, and seed data applied successfully."
    else
        log_ok "Database 'alquods_db' is already provisioned and healthy."
    fi
}

stop_services() {
    log_info "Stopping application services..."

    # Stop node web server
    if [ -f "$APP_PID_FILE" ]; then
        local pid
        pid=$(cat "$APP_PID_FILE" 2>/dev/null || true)
        if [ -n "$pid" ] && ps -p "$pid" >/dev/null 2>&1; then
            kill "$pid" 2>/dev/null || true
            log_ok "Stopped Node.js app (PID $pid)."
        fi
        rm -f "$APP_PID_FILE"
    fi

    # Kill anything else still binding the port
    if command -v fuser >/dev/null 2>&1; then
        fuser -k "${APP_PORT}/tcp" >/dev/null 2>&1 || true
    fi

    # Stop PostgreSQL
    if pg_isready -h 127.0.0.1 -p "$PG_PORT" -q 2>/dev/null; then
        pg_ctl -D "$PGDATA" stop -m fast >/dev/null 2>&1 || true
        log_ok "Stopped PostgreSQL."
    fi

    log_ok "All services stopped."
}

show_status() {
    echo "=========================================================="
    echo " Al-Quds Medical ERP — System Status"
    echo "=========================================================="

    if pg_isready -h 127.0.0.1 -p "$PG_PORT" -q 2>/dev/null; then
        echo -e "PostgreSQL (Port $PG_PORT): ${GREEN}RUNNING${NC}"
    else
        echo -e "PostgreSQL (Port $PG_PORT): ${RED}STOPPED${NC}"
    fi

    if curl -s -f http://127.0.0.1:${APP_PORT}/ >/dev/null 2>&1; then
        echo -e "Web Server (Port $APP_PORT): ${GREEN}RUNNING (HTTP 200)${NC}"
        echo -e "URL: ${BLUE}http://localhost:${APP_PORT}${NC}"
    else
        echo -e "Web Server (Port $APP_PORT): ${RED}NOT RESPONDING${NC}"
    fi
    echo "=========================================================="
}

start_app() {
    local mode="${1:-daemon}"

    ensure_env
    start_postgres
    ensure_database

    # Check if app is already running on port
    if curl -s -f http://127.0.0.1:${APP_PORT}/ >/dev/null 2>&1; then
        log_warn "Application is already responding at http://localhost:${APP_PORT}"
        show_credentials
        return 0
    fi

    # Clear port if occupied by dead or unmanaged process
    if command -v fuser >/dev/null 2>&1; then
        fuser -k "${APP_PORT}/tcp" >/dev/null 2>&1 || true
    fi

    if [ "$mode" == "dev" ]; then
        log_info "Starting app in development mode with nodemon..."
        exec npm run dev
    elif [ "$mode" == "foreground" ]; then
        log_info "Starting app in foreground (Ctrl+C to exit)..."
        exec node app.js
    else
        log_info "Starting app in background..."
        nohup node app.js > "$APP_LOG" 2>&1 &
        local app_pid=$!
        echo "$app_pid" > "$APP_PID_FILE"

        # Wait up to 10 seconds for HTTP server to respond
        local retries=20
        while [ $retries -gt 0 ]; do
            if curl -s -f "http://127.0.0.1:${APP_PORT}/" >/dev/null 2>&1; then
                log_ok "Web server successfully launched (PID $app_pid)!"
                show_credentials
                return 0
            fi
            sleep 0.5
            retries=$((retries - 1))
        done

        log_err "Application started (PID $app_pid) but did not respond on port ${APP_PORT} in time."
        log_info "Last 20 lines of $APP_LOG:"
        tail -n 20 "$APP_LOG"
        exit 1
    fi
}

show_credentials() {
    echo ""
    echo -e "${GREEN}==========================================================${NC}"
    echo -e "${GREEN}  AL-QUDS MEDICAL ERP IS READY${NC}"
    echo -e "${GREEN}==========================================================${NC}"
    echo -e "Portal URL: ${BLUE}http://localhost:${APP_PORT}${NC}"
    echo ""
    echo "Available Accounts (Password for all: Passw0rd!):"
    echo "  • Admin:            registration_number: admin   -> /dashboard"
    echo "  • Branch Manager:   registration_number: bm1     -> /index.html"
    echo "  • POS Cashier:      registration_number: pos1    -> /pos"
    echo "  • Regular Employee: registration_number: emp1    -> /index.html"
    echo ""
    echo "Commands:"
    echo "  ./launch.sh --status   Check status of all services"
    echo "  ./launch.sh --stop     Stop web app and PostgreSQL"
    echo "  ./launch.sh --restart  Restart all services"
    echo "  ./launch.sh --dev      Run in dev mode (hot reload)"
    echo -e "${GREEN}==========================================================${NC}"
}

# Command dispatch
case "${1:-start}" in
    start)
        start_app "daemon"
        ;;
    --dev|-d)
        start_app "dev"
        ;;
    --foreground|-f)
        start_app "foreground"
        ;;
    --stop|stop)
        stop_services
        ;;
    --restart|restart)
        stop_services
        sleep 1
        start_app "daemon"
        ;;
    --status|status)
        show_status
        ;;
    --help|-h)
        echo "Usage: ./launch.sh [start|--dev|--foreground|--stop|--restart|--status]"
        ;;
    *)
        log_err "Unknown option: $1"
        echo "Usage: ./launch.sh [start|--dev|--foreground|--stop|--restart|--status]"
        exit 1
        ;;
esac
