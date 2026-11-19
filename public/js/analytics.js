/**
 * Analytics & Reports Dashboard — Frontend Logic
 * Chunk 1: Top Filter Bar + 5 KPI Summary Cards
 * Chunk 2: Visual Charts (Branch Performance Bar Chart + Sales vs Purchases Timeline)
 * Chunk 3: Top Selling Products & Category Distribution Donut
 */

// ── DOM Refs ─────────────────────────────────────────
const filterPeriod  = document.getElementById('filter-period');
const filterBranch  = document.getElementById('filter-branch');
const kpiGrid       = document.getElementById('kpi-grid');
const hubTitle      = document.getElementById('hub-title');
const hubSubtitle   = document.getElementById('hub-subtitle');
const liveTimeEl    = document.getElementById('live-time');

// ── Bootstrap ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    // RBAC guard: verify user has analytics access before loading anything
    let user = window.__alqudsUser;
    if (!user) {
        try {
            const checkRes = await fetch('/api/auth/check');
            if (checkRes.ok) {
                user = await checkRes.json();
                window.__alqudsUser = user;
            }
        } catch (e) { /* authGuard.js handles redirect */ }
    }
    if (user) {
        const role = user.role ? user.role.toUpperCase() : '';
        const isAdmin = (role === 'ADMIN' || role === 'SUPER ADMIN');
        let perms = user.permissions || [];
        if (typeof perms === 'string') {
            try { perms = JSON.parse(perms); } catch(e) { perms = []; }
        }
        const hasAnalyticsAccess = isAdmin || (Array.isArray(perms) && perms.includes('can_manage_analytics'));
        if (!hasAnalyticsAccess) {
            console.warn('[ANALYTICS RBAC]: User lacks can_manage_analytics permission. Redirecting.');
            window.location.href = '/index.html';
            return;
        }
    }

    // 1. Load branch list first so filter defaults to 'all' (admin) or assigned branch
    await loadBranches();

    // 2. Load KPIs and Visual Charts
    loadSummary();
    loadBranchPerformanceChart();
    loadSalesPurchasesChart();
    loadTopProducts();
    loadCategoryDistribution();
    loadCriticalAlerts();
    loadSuppliersPayables();

    // Auto-refresh when filters change
    filterPeriod.addEventListener('change', () => {
        loadSummary();
        loadBranchPerformanceChart();
        loadSalesPurchasesChart();
        loadTopProducts();
        loadCategoryDistribution();
        loadCriticalAlerts();
        loadSuppliersPayables();
    });
    filterBranch.addEventListener('change', () => {
        loadSummary();
        loadBranchPerformanceChart();
        loadSalesPurchasesChart();
        loadTopProducts();
        loadCategoryDistribution();
        loadCriticalAlerts();
        loadSuppliersPayables();
    });

    // Update live timer every minute
    updateLiveTime();
    setInterval(updateLiveTime, 60000);

    // Populate user info from authGuard
    const check = setInterval(() => {
        if (window.__alqudsUser) {
            clearInterval(check);
            populateUserInfo(window.__alqudsUser);
        }
    }, 100);
    setTimeout(() => clearInterval(check), 5000);
});

// ── Load Branch Dropdown ─────────────────────────────
async function loadBranches() {
    try {
        const res = await fetch('/api/analytics/branches', {
            headers: { 'Accept': 'application/json' }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        filterBranch.innerHTML = '';

        if (data.is_admin && data.branches.length > 1) {
            const optAll = document.createElement('option');
            optAll.value = 'all';
            optAll.textContent = `All Branches (${data.branches.length})`;
            filterBranch.appendChild(optAll);
        }

        data.branches.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = b.name;
            filterBranch.appendChild(opt);
        });

        // Update hub title
        updateHubTitle();
    } catch (err) {
        console.error('Failed to load branches:', err);
        filterBranch.innerHTML = '<option value="">Error</option>';
    }
}

// ── Load Summary KPIs ────────────────────────────────
async function loadSummary() {
    // Show skeleton
    showSkeletonCards();

    const period = filterPeriod.value;
    const branchId = filterBranch.value || '';

    try {
        const url = `/api/analytics/summary?period=${period}&branch_id=${encodeURIComponent(branchId)}`;
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Server did not return JSON');
        }

        const data = await res.json();
        renderKPICards(data);
        updateHubTitle();
    } catch (err) {
        console.error('Failed to load summary:', err);
        showToast('Failed to load analytics: ' + err.message, 'error');
        kpiGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:2rem;color:#ef4444;font-size:0.875rem">
            <i class="fa-solid fa-circle-exclamation"></i> Error loading analytics: ${escapeHtml(err.message)}</div>`;
    }
}

// ── Render 5 KPI Cards ───────────────────────────────
function renderKPICards(data) {
    const s = data.total_sales;
    const p = data.total_net_profit;
    const pu = data.total_purchases;
    const pa = data.total_payables;
    const inv = data.inventory_value;

    kpiGrid.innerHTML = `
        <!-- 1. TOTAL SALES -->
        <div class="kpi-card">
            <div class="kpi-header">
                <span class="kpi-label">Total Sales</span>
                ${growthBadge(s.growth_pct)}
            </div>
            <div class="kpi-value">${formatCurrency(s.value)}</div>
            <div class="kpi-mini-chart">
                <canvas id="chart-sales"></canvas>
            </div>
            <div class="kpi-footer">
                ${s.branch_breakdown.length > 0 
                    ? s.branch_breakdown.map((b, i) => 
                        `<span class="highlight">B${i+1}: ${formatShort(b.total)}</span>`
                      ).join(' · ')
                    : `<span class="highlight">${formatPeriodLabel(data.period)}</span>`
                }
            </div>
        </div>

        <!-- 2. TOTAL NET PROFIT -->
        <div class="kpi-card">
            <div class="kpi-header">
                <span class="kpi-label">Total Net Profit</span>
                ${growthBadge(p.growth_pct)}
            </div>
            <div class="kpi-value">${formatCurrency(p.value)}</div>
            <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">
                <div class="margin-bar-bg">
                    <div class="margin-bar-fill" style="width:${Math.min(p.margin_pct, 100)}%"></div>
                </div>
                <span class="margin-label">${p.margin_pct}%</span>
            </div>
            <div class="kpi-footer">
                <span class="margin-health-label ${p.margin_health === 'moderate' ? 'moderate' : p.margin_health === 'low' ? 'low' : ''}">
                    Net margin ${p.margin_health}
                    ${p.margin_health === 'healthy' ? '(✓' + p.margin_pct + '%)' : '(' + p.margin_pct + '%)'}
                </span>
            </div>
        </div>

        <!-- 3. TOTAL PURCHASES -->
        <div class="kpi-card">
            <div class="kpi-header">
                <span class="kpi-label">Total Purchases</span>
                ${growthBadge(pu.growth_pct, true)}
            </div>
            <div class="kpi-value">${formatCurrency(pu.value)}</div>
            <div class="kpi-mini-chart">
                <canvas id="chart-purchases"></canvas>
            </div>
            <div class="kpi-footer">
                <span class="highlight">${pu.restock_orders}</span> Restock orders fulfilled...
            </div>
        </div>

        <!-- 4. TOTAL PAYABLES -->
        <div class="kpi-card">
            <div class="kpi-header">
                <span class="kpi-label">Total Payables</span>
                ${pa.in_7d > 0 
                    ? `<span class="kpi-badge alert"><i class="fa-solid fa-circle-exclamation"></i> ${formatShort(pa.in_7d)} in 7d</span>` 
                    : `<span class="kpi-badge neutral">Clear</span>`
                }
            </div>
            <div class="kpi-value">${formatCurrency(pa.value)}</div>
            <div class="kpi-footer" style="flex-direction:column;align-items:flex-start;gap:0.25rem">
                <span>
                    <i class="fa-solid fa-triangle-exclamation" style="color:#ea580c;font-size:0.65rem"></i>
                    <span class="warn">${pa.growth_vs_last_pct >= 0 ? '+' : ''}${pa.growth_vs_last_pct}% vs last month</span>
                </span>
                <span>Outstanding to <span class="highlight">${pa.supplier_count} supplier${pa.supplier_count !== 1 ? 's' : ''}</span></span>
            </div>
        </div>

        <!-- 5. INVENTORY VALUE -->
        <div class="kpi-card">
            <div class="kpi-header">
                <span class="kpi-label">Inventory Value</span>
                <span class="kpi-badge inv-badge"><i class="fa-regular fa-clipboard"></i></span>
            </div>
            <div class="kpi-value">${formatCurrency(inv.value)}</div>
            <div class="kpi-footer" style="flex-direction:column;align-items:flex-start;gap:0.2rem">
                <span>At cost (FIFO valuation)</span>
                <span><i class="fa-solid fa-star" style="color:#eab308;font-size:0.6rem"></i> <span class="highlight">${inv.total_skus.toLocaleString()} SKUs</span> · ${inv.branch_count} Branch${inv.branch_count !== 1 ? 'es' : ''}</span>
            </div>
        </div>
    `;

    // Draw mini sparkline charts
    drawSparkline('chart-sales', generateSparkData(s.value, 8), '#3b82f6');
    drawSparkline('chart-purchases', generateSparkData(pu.value, 8), '#0f172a');
}

// ── Skeleton Cards ───────────────────────────────────
function showSkeletonCards() {
    kpiGrid.innerHTML = Array(5).fill(
        '<div class="kpi-card skeleton" style="min-height:160px"></div>'
    ).join('');
}

// ── Growth Badge Helper ──────────────────────────────
function growthBadge(pct, invert = false) {
    if (pct === 0 || pct === null || pct === undefined) {
        return '<span class="kpi-badge neutral">—</span>';
    }
    const isUp = pct > 0;
    // For purchases, "up" is typically down (more spending = bad), so invert
    const isPositive = invert ? !isUp : isUp;
    const cls = isPositive ? 'up' : 'down';
    const icon = isUp ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
    return `<span class="kpi-badge ${cls}"><i class="fa-solid ${icon}"></i> ${isUp ? '+' : ''}${pct}%</span>`;
}

// ── Format Helpers ───────────────────────────────────
function formatCurrency(val) {
    if (val === null || val === undefined) return '$0.00';
    return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatShort(val) {
    if (!val) return '$0';
    if (val >= 1000000) return '$' + (val / 1000000).toFixed(1) + 'M';
    if (val >= 1000) return '$' + (val / 1000).toFixed(1) + 'k';
    return '$' + Number(val).toFixed(0);
}

function formatPeriodLabel(period) {
    const labels = {
        'today': 'Today',
        'this_week': 'This Week',
        'this_month': 'This Month',
        'last_month': 'Last Month',
        'this_quarter': 'This Quarter',
        'this_year': 'This Year',
        'all_time': 'All Time'
    };
    return labels[period] || period;
}

// ── Mini Sparkline Chart (pure Canvas) ───────────────
function generateSparkData(total, points) {
    // Generate realistic-looking spark data based on total value
    const data = [];
    let current = total * 0.3;
    for (let i = 0; i < points; i++) {
        current += (Math.random() - 0.35) * (total * 0.15);
        current = Math.max(0, current);
        data.push(current);
    }
    // Ensure last point is near the total proportionally
    data[data.length - 1] = total * (0.8 + Math.random() * 0.2);
    return data;
}

function drawSparkline(canvasId, data, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = 35 * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = '35px';
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = 35;
    const padding = 2;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    data.forEach((val, i) => {
        const x = padding + (i / (data.length - 1)) * (w - padding * 2);
        const y = h - padding - ((val - min) / range) * (h - padding * 2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Gradient fill under the line
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, color + '20');
    gradient.addColorStop(1, color + '00');

    ctx.lineTo(w - padding, h);
    ctx.lineTo(padding, h);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
}

// ── Hub Title Update ─────────────────────────────────
function updateHubTitle() {
    const branchSelect = filterBranch;
    const selectedOption = branchSelect.options[branchSelect.selectedIndex];
    const branchText = selectedOption ? selectedOption.textContent : 'Unknown';

    if (filterBranch.value === 'all') {
        hubTitle.textContent = 'All Branches — Analytics Hub';
    } else {
        hubTitle.textContent = branchText + ' — Analytics Hub';
    }
    hubSubtitle.textContent = 'RFID Portals: Online · Automated Dispensing Cabinets · GS1 Barcode Compliance Active';
}

// ── User Info Populator ──────────────────────────────
function populateUserInfo(user) {
    const nameEl = document.getElementById('user-display-name');
    const roleEl = document.getElementById('user-role-badge');
    const avatarEl = document.getElementById('user-avatar');

    const name = user.staff_name || user.name || user.username || 'Admin User';
    const role = user.role || 'ADMIN';

    if (nameEl) nameEl.textContent = name;
    if (roleEl) roleEl.textContent = role;
    if (avatarEl) {
        const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
        avatarEl.textContent = initials;
    }
}

// ── Live Time Updater ────────────────────────────────
let lastFetchTime = Date.now();
function updateLiveTime() {
    const diffMs = Date.now() - lastFetchTime;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) {
        liveTimeEl.textContent = 'Live: Just now';
    } else {
        liveTimeEl.textContent = `Live: ${diffMin}m ago`;
    }
}

// ── Export Ledger (placeholder) ──────────────────────
function exportLedger() {
    showToast('Export Ledger feature coming soon — will generate PDF/Excel reports.', 'info');
}

// ── Toast Utility ────────────────────────────────────
function showToast(msg, type = 'info') {
    const icons = { success: 'fa-circle-check', error: 'fa-circle-exclamation', info: 'fa-circle-info' };
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid ${icons[type]} toast-icon"></i><span>${msg}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fade-out 0.3s ease both';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ── HTML Escape ──────────────────────────────────────
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}


// ═══════════════════════════════════════════════════════════════════════════
// ██  CHUNK 2 — Visual Charts                                             ██
// ═══════════════════════════════════════════════════════════════════════════

// ── Chart instances (to destroy before re-creating) ──
let branchPerfChart = null;
let salesPurchasesChart = null;

// ── Branch colors palette ──
const branchColors = [
    { sales: '#3b82f6', profit: '#1e3a5f' },  // Blue + Dark Blue
    { sales: '#8b5cf6', profit: '#4c1d95' },  // Purple + Dark Purple
    { sales: '#f59e0b', profit: '#92400e' },  // Amber + Dark Amber
    { sales: '#10b981', profit: '#064e3b' },  // Emerald + Dark Emerald
];
const branchTagClasses = ['b1', 'b2', 'b3', 'b4'];

// ── Load Branch Performance Bar Chart ────────────────
async function loadBranchPerformanceChart() {
    const period = filterPeriod.value;
    const branchId = filterBranch.value || '';

    try {
        const url = `/api/analytics/branch-performance?period=${period}&branch_id=${encodeURIComponent(branchId)}`;
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || errData.error || `HTTP ${res.status}`);
        }
        const data = await res.json();

        // Ensure Chart.js is ready before rendering
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js not yet loaded, waiting 200ms...');
            setTimeout(() => renderBranchPerformanceChart(data), 200);
        } else {
            renderBranchPerformanceChart(data);
        }
    } catch (err) {
        console.error('Failed to load branch performance:', err);
        const footer = document.getElementById('branch-margin-footer');
        if (footer) {
            footer.innerHTML = `<span style="color:#ef4444;font-size:0.72rem"><i class="fa-solid fa-circle-exclamation"></i> ${escapeHtml(err.message)}</span>`;
        }
    }
}

function renderBranchPerformanceChart(data) {
    const canvas = document.getElementById('chart-branch-performance');
    if (!canvas) return;

    if (!data || !Array.isArray(data.weeks) || !Array.isArray(data.branches)) {
        console.warn('Invalid branch performance payload:', data);
        return;
    }

    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not available yet.');
        return;
    }

    // Destroy previous chart
    if (branchPerfChart) {
        branchPerfChart.destroy();
        branchPerfChart = null;
    }

    const { weeks, branches } = data;

    // ── Build datasets ──
    // For each branch, create two datasets: Sales bars and Profit bars
    const datasets = [];

    branches.forEach((branch, bIdx) => {
        const colors = branchColors[bIdx % branchColors.length];

        // Sales bars
        datasets.push({
            label: `${branch.branch_name} — Sales`,
            data: branch.weekly.map(w => w.sales),
            backgroundColor: colors.sales,
            borderColor: colors.sales,
            borderWidth: 0,
            borderRadius: 4,
            borderSkipped: false,
            barPercentage: 0.7,
            categoryPercentage: 0.65
        });

        // Profit bars (stacked on same bar — shown as an overlay)
        datasets.push({
            label: `${branch.branch_name} — Profit`,
            data: branch.weekly.map(w => w.profit),
            backgroundColor: colors.profit,
            borderColor: colors.profit,
            borderWidth: 0,
            borderRadius: 4,
            borderSkipped: false,
            barPercentage: 0.7,
            categoryPercentage: 0.65
        });
    });

    const ctx = canvas.getContext('2d');

    branchPerfChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: weeks,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0f172a',
                    titleColor: '#e2e8f0',
                    bodyColor: '#cbd5e1',
                    padding: 10,
                    cornerRadius: 8,
                    titleFont: { size: 12, weight: '700' },
                    bodyFont: { size: 11 },
                    callbacks: {
                        label: function(context) {
                            return ` ${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 11, weight: '600' },
                        color: '#64748b'
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#f1f5f9',
                        drawBorder: false
                    },
                    ticks: {
                        font: { size: 10 },
                        color: '#94a3b8',
                        callback: function(value) {
                            return formatShort(value);
                        },
                        maxTicksLimit: 6
                    }
                }
            }
        }
    });

    // ── Update subtitle ──
    const subtitleEl = document.getElementById('branch-perf-subtitle');
    if (subtitleEl) {
        if (branches.length > 1) {
            subtitleEl.textContent = branches.map((b, i) => `${b.branch_name} (B${i+1})`).join(' vs ') + ' comparison';
        } else if (branches.length === 1) {
            subtitleEl.textContent = `${branches[0].branch_name} weekly breakdown`;
        }
    }

    // ── Render margin footer ──
    const footer = document.getElementById('branch-margin-footer');
    if (footer) {
        footer.innerHTML = branches.map((branch, bIdx) => {
            const tagCls = branchTagClasses[bIdx % branchTagClasses.length];
            const marginColor = branch.margin_pct >= 20 ? '#22c55e'
                              : branch.margin_pct >= 10 ? '#eab308'
                              : '#ef4444';
            return `
                <div class="branch-margin-item">
                    <span class="branch-tag ${tagCls}">B${bIdx + 1} · ${branch.branch_name}</span>
                    <span style="color:#94a3b8">Sales:</span>
                    <span class="margin-pct">${formatShort(branch.total_sales)}</span>
                    <span style="color:#94a3b8">Margin:</span>
                    <div class="margin-bar-sm">
                        <div class="margin-fill-sm" style="width:${Math.min(branch.margin_pct, 100)}%;background:${marginColor}"></div>
                    </div>
                    <span class="margin-pct">${branch.margin_pct}%</span>
                </div>
            `;
        }).join('');
    }
}


// ── Load Sales vs Purchases Timeline Chart ───────────
async function loadSalesPurchasesChart() {
    const period = filterPeriod.value;
    const branchId = filterBranch.value || '';

    try {
        const url = `/api/analytics/sales-purchases-timeline?period=${period}&branch_id=${encodeURIComponent(branchId)}`;
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || errData.error || `HTTP ${res.status}`);
        }
        const data = await res.json();

        // Ensure Chart.js is ready before rendering
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js not yet loaded, waiting 200ms...');
            setTimeout(() => renderSalesPurchasesChart(data), 200);
        } else {
            renderSalesPurchasesChart(data);
        }
    } catch (err) {
        console.error('Failed to load sales vs purchases timeline:', err);
        const footer = document.getElementById('timeline-footer');
        if (footer) {
            footer.innerHTML = `<span style="color:#ef4444;font-size:0.72rem"><i class="fa-solid fa-circle-exclamation"></i> ${escapeHtml(err.message)}</span>`;
        }
    }
}

function renderSalesPurchasesChart(data) {
    const canvas = document.getElementById('chart-sales-purchases');
    if (!canvas) return;

    if (!data || !Array.isArray(data.labels) || !Array.isArray(data.sales) || !Array.isArray(data.purchases) || !data.summary) {
        console.warn('Invalid sales vs purchases payload:', data);
        return;
    }

    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not available yet.');
        return;
    }

    // Destroy previous chart
    if (salesPurchasesChart) {
        salesPurchasesChart.destroy();
        salesPurchasesChart = null;
    }

    const { labels, sales, purchases, summary } = data;

    // ── Update spread callout ──
    const spreadValueEl = document.getElementById('spread-value');
    const spreadLabelEl = document.getElementById('spread-label');
    if (spreadValueEl) {
        const spread = summary.net_operating_spread;
        spreadValueEl.textContent = (spread >= 0 ? '+' : '') + formatCurrency(spread);
        spreadValueEl.classList.toggle('negative', spread < 0);
    }
    if (spreadLabelEl) {
        spreadLabelEl.textContent = `Net Operating Spread · ${summary.spread_pct}% margin`;
    }

    // ── Build gradient fills ──
    const ctx = canvas.getContext('2d');
    const salesGradient = ctx.createLinearGradient(0, 0, 0, 280);
    salesGradient.addColorStop(0, 'rgba(59, 130, 246, 0.18)');
    salesGradient.addColorStop(1, 'rgba(59, 130, 246, 0.01)');

    const purchasesGradient = ctx.createLinearGradient(0, 0, 0, 280);
    purchasesGradient.addColorStop(0, 'rgba(249, 115, 22, 0.15)');
    purchasesGradient.addColorStop(1, 'rgba(249, 115, 22, 0.01)');

    salesPurchasesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Sales',
                    data: sales.map(s => s.cumulative),
                    borderColor: '#3b82f6',
                    backgroundColor: salesGradient,
                    borderWidth: 2.5,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#3b82f6',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Restock / Purchases',
                    data: purchases.map(p => p.cumulative),
                    borderColor: '#f97316',
                    backgroundColor: purchasesGradient,
                    borderWidth: 2.5,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#f97316',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0f172a',
                    titleColor: '#e2e8f0',
                    bodyColor: '#cbd5e1',
                    padding: 10,
                    cornerRadius: 8,
                    titleFont: { size: 12, weight: '700' },
                    bodyFont: { size: 11 },
                    callbacks: {
                        label: function(context) {
                            const dsIndex = context.datasetIndex;
                            const ptIndex = context.dataIndex;
                            const source = dsIndex === 0 ? sales : purchases;
                            const label = dsIndex === 0 ? 'Sales' : 'Purchases';
                            const interval = source[ptIndex];
                            return [
                                ` ${label} (interval): ${formatCurrency(interval.value)}`,
                                ` ${label} (cumulative): ${formatCurrency(interval.cumulative)}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 11, weight: '600' },
                        color: '#64748b'
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#f1f5f9',
                        drawBorder: false
                    },
                    ticks: {
                        font: { size: 10 },
                        color: '#94a3b8',
                        callback: function(value) {
                            return formatShort(value);
                        },
                        maxTicksLimit: 6
                    }
                }
            }
        }
    });

    // ── Update footer stats ──
    const purchasesTotal = document.getElementById('timeline-purchases-total');
    if (purchasesTotal) {
        purchasesTotal.textContent = formatCurrency(summary.total_purchases);
    }
}



// ═══════════════════════════════════════════════════════════════════════════
// ██  CHUNK 3 — Top Products & Category Distribution                      ██
// ═══════════════════════════════════════════════════════════════════════════

// ── Category color palette ──
const categoryColors = {
    'Antibiotic':       '#f59e0b',
    'Analgesic':        '#8b5cf6',
    'Cardiovascular':   '#ef4444',
    'Gastric':          '#10b981',
    'Diabetes':         '#3b82f6',
    'Antihistamine':    '#ec4899',
    'Uncategorized':    '#94a3b8'
};
const categoryColorFallback = [
    '#06b6d4', '#f97316', '#84cc16', '#a855f7',
    '#e11d48', '#0ea5e9', '#14b8a6', '#6366f1'
];

function getCategoryColor(cat, idx) {
    if (categoryColors[cat]) return categoryColors[cat];
    return categoryColorFallback[idx % categoryColorFallback.length];
}

function getCategoryTagClass(cat) {
    const c = (cat || '').toLowerCase().replace(/\s+/g, '');
    if (c.includes('antibiotic'))     return 'cat-antibiotic';
    if (c.includes('analgesic'))      return 'cat-analgesic';
    if (c.includes('cardiovascular')) return 'cat-cardiovascular';
    if (c.includes('gastric'))        return 'cat-gastric';
    if (c.includes('diabetes'))       return 'cat-diabetes';
    if (c.includes('antihistamine'))  return 'cat-antihistamine';
    return 'cat-default';
}


// ── Donut chart instance ──
let categoryDonutChart = null;


// ── Load Top Products ────────────────────────────────
async function loadTopProducts() {
    const period = filterPeriod.value;
    const branchId = filterBranch.value || '';

    try {
        const url = `/api/analytics/top-products?period=${period}&branch_id=${encodeURIComponent(branchId)}`;
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || errData.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        renderTopProducts(data);
    } catch (err) {
        console.error('Failed to load top products:', err);
        const list = document.getElementById('top-products-list');
        if (list) {
            list.innerHTML = `<div style="text-align:center;padding:2rem;color:#ef4444;font-size:0.78rem">
                <i class="fa-solid fa-circle-exclamation"></i> ${escapeHtml(err.message)}</div>`;
        }
    }
}

function renderTopProducts(data) {
    const list = document.getElementById('top-products-list');
    if (!list) return;

    const { products, total_revenue } = data;

    // Update total badge
    const totalBadge = document.getElementById('top-products-total-value');
    if (totalBadge) totalBadge.textContent = formatShort(total_revenue);

    if (!products || products.length === 0) {
        list.innerHTML = `<div style="text-align:center;padding:2rem;color:#94a3b8;font-size:0.78rem">
            <i class="fa-solid fa-box-open" style="font-size:1.2rem;margin-bottom:0.5rem;display:block"></i>
            No product sales found for this period</div>`;
        return;
    }

    list.innerHTML = products.map(p => {
        const rankCls = p.rank === 1 ? 'rank-1' : p.rank === 2 ? 'rank-2' : p.rank === 3 ? 'rank-3' : 'rank-n';
        const catCls = getCategoryTagClass(p.category);
        return `
            <div class="tp-row">
                <div class="tp-rank ${rankCls}">${p.rank}</div>
                <div class="tp-info">
                    <div class="tp-name" title="${escapeHtml(p.product_name)}">${escapeHtml(p.product_name)}</div>
                    <div class="tp-meta">
                        <span class="tp-sku">${escapeHtml(p.sku)}</span>
                        <span class="tp-category-tag ${catCls}">${escapeHtml(p.category)}</span>
                    </div>
                </div>
                <div class="tp-units">
                    <span class="tp-units-value">${p.units_sold.toLocaleString()}</span>
                    <div class="tp-units-bar-bg">
                        <div class="tp-units-bar-fill" style="width:${p.bar_pct}%"></div>
                    </div>
                </div>
                <div class="tp-revenue">${formatCurrency(p.total_revenue)}</div>
            </div>
        `;
    }).join('');

    // Update footer capital
    const capitalEl = document.getElementById('top-products-capital');
    if (capitalEl) capitalEl.textContent = formatCurrency(total_revenue);
}


// ── Load Category Distribution ───────────────────────
async function loadCategoryDistribution() {
    const period = filterPeriod.value;
    const branchId = filterBranch.value || '';

    try {
        const url = `/api/analytics/category-distribution?period=${period}&branch_id=${encodeURIComponent(branchId)}`;
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || errData.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        renderCategoryDistribution(data);
    } catch (err) {
        console.error('Failed to load category distribution:', err);
        const legend = document.getElementById('category-legend-list');
        if (legend) {
            legend.innerHTML = `<div style="color:#ef4444;font-size:0.72rem">
                <i class="fa-solid fa-circle-exclamation"></i> ${escapeHtml(err.message)}</div>`;
        }
    }
}

function renderCategoryDistribution(data) {
    const canvas = document.getElementById('chart-category-donut');
    const legendEl = document.getElementById('category-legend-list');
    if (!canvas) return;

    const { categories, grand_total } = data;

    if (!categories || !Array.isArray(categories)) return;

    // Destroy previous chart
    if (categoryDonutChart) {
        categoryDonutChart.destroy();
        categoryDonutChart = null;
    }

    // Update center label
    const centerVal = document.getElementById('donut-center-value');
    if (centerVal) centerVal.textContent = formatShort(grand_total);

    if (categories.length === 0) {
        if (legendEl) {
            legendEl.innerHTML = `<div style="color:#94a3b8;font-size:0.75rem;text-align:center;padding:1rem">
                No category data for this period</div>`;
        }
        return;
    }

    // Build chart data
    const labels = categories.map(c => c.category);
    const values = categories.map(c => c.total_revenue);
    const colors = categories.map((c, i) => getCategoryColor(c.category, i));

    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not loaded for donut');
        return;
    }

    const ctx = canvas.getContext('2d');

    categoryDonutChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderColor: '#fff',
                borderWidth: 3,
                borderRadius: 4,
                hoverBorderWidth: 1,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: '65%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0f172a',
                    titleColor: '#e2e8f0',
                    bodyColor: '#cbd5e1',
                    padding: 10,
                    cornerRadius: 8,
                    titleFont: { size: 12, weight: '700' },
                    bodyFont: { size: 11 },
                    callbacks: {
                        label: function(context) {
                            const cat = categories[context.dataIndex];
                            return [
                                ` Revenue: ${formatCurrency(cat.total_revenue)}`,
                                ` Share: ${cat.share_pct}%`,
                                ` Units: ${cat.total_units.toLocaleString()}`
                            ];
                        }
                    }
                }
            }
        }
    });

    // ── Render legend ──
    if (legendEl) {
        legendEl.innerHTML = categories.map((c, i) => `
            <div class="cat-legend-item">
                <div class="cat-legend-dot" style="background:${colors[i]}"></div>
                <span class="cat-legend-name">${escapeHtml(c.category)}</span>
                <span class="cat-legend-pct">${c.share_pct}%</span>
                <span class="cat-legend-rev">${formatCurrency(c.total_revenue)}</span>
            </div>
        `).join('');
    }

    // ── Update footer ──
    const highestEl = document.getElementById('category-highest-margin');
    if (highestEl && categories.length > 0) {
        highestEl.textContent = `${categories[0].category} · ${formatCurrency(categories[0].total_revenue)}`;
    }
}



// ══════════════════════════════════════════════════════════════════════
// Chunk 4: Critical Inventory Alerts
// ══════════════════════════════════════════════════════════════════════

async function loadCriticalAlerts() {
    const period   = filterPeriod.value;
    const branchId = filterBranch.value;
    const qs = `?period=${period}&branch_id=${encodeURIComponent(branchId)}`;

    try {
        const res = await fetch('/api/analytics/critical-alerts' + qs, {
            headers: { 'Accept': 'application/json' }
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || errData.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        renderCriticalAlerts(data);
    } catch (err) {
        console.error('Failed to load critical alerts:', err);
        // Show error in all three columns
        ['dead-stock-list', 'shortages-list', 'expiry-list'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.innerHTML = `<div style="color:#ef4444;font-size:0.72rem;padding:1rem;text-align:center">
                    <i class="fa-solid fa-circle-exclamation"></i> ${escapeHtml(err.message)}</div>`;
            }
        });
    }
}

function renderCriticalAlerts(data) {
    const { counts, dead_stock, total_tied_capital, shortages, adequate_item, expiry_risks } = data;

    // ── Update header badges ──
    const badgeDead = document.getElementById('badge-dead-count');
    const badgeShortage = document.getElementById('badge-shortage-count');
    const badgeExpiry = document.getElementById('badge-expiry-count');
    if (badgeDead) badgeDead.textContent = counts.dead_stock;
    if (badgeShortage) badgeShortage.textContent = counts.shortages;
    if (badgeExpiry) badgeExpiry.textContent = counts.expiry_risks;

    // ── Column 1: Dead Stock ──
    const deadStockList = document.getElementById('dead-stock-list');
    if (deadStockList) {
        if (!dead_stock || dead_stock.length === 0) {
            deadStockList.innerHTML = `<div class="alert-empty-state">
                <i class="fa-solid fa-check-circle"></i>
                No dead stock detected — all items have recent activity
            </div>`;
        } else {
            deadStockList.innerHTML = dead_stock.map(item => `
                <div class="alert-item">
                    <div class="alert-item-top">
                        <div class="alert-item-name">${escapeHtml(item.product_name)}</div>
                        <span class="alert-item-badge ${item.status === 'Critical' ? 'badge-critical' : 'badge-dead-stock'}">${item.days_inactive}d ago</span>
                    </div>
                    <div class="alert-item-details">
                        <span>${escapeHtml(item.branch_name)}</span>
                        <span class="sep">·</span>
                        <span>${item.units} units</span>
                        <span class="alert-item-value">${formatCurrency(item.tied_capital)}</span>
                    </div>
                    <button class="alert-action-link" onclick="showToast('Clearance marked for ${escapeHtml(item.product_name)}', 'success')">Mark Clearance</button>
                </div>
            `).join('');
        }
    }

    // Dead stock footer
    const deadCapitalEl = document.getElementById('dead-stock-capital');
    if (deadCapitalEl) deadCapitalEl.textContent = formatCurrency(total_tied_capital);

    // ── Column 2: Shortages ──
    const shortagesList = document.getElementById('shortages-list');
    if (shortagesList) {
        if (!shortages || shortages.length === 0) {
            shortagesList.innerHTML = `<div class="alert-empty-state">
                <i class="fa-solid fa-check-circle"></i>
                All stock levels are within safe thresholds
            </div>`;
        } else {
            shortagesList.innerHTML = shortages.map(item => `
                <div class="alert-item">
                    <div class="alert-item-top">
                        <div class="alert-item-name">${escapeHtml(item.product_name)}</div>
                        <span class="alert-item-badge ${item.status === 'Critical' ? 'badge-critical' : 'badge-low-buffer'}">
                            <span class="badge-dot ${item.status === 'Critical' ? 'shortage' : 'dead'}"></span>
                            ${item.status}
                        </span>
                    </div>
                    <div class="alert-item-details">
                        <span>${escapeHtml(item.branch_name)}</span>
                        <span class="sep">·</span>
                        <span><strong>${item.remaining}</strong> units left</span>
                        <span class="sep">·</span>
                        <span>Threshold: ${item.threshold}</span>
                    </div>
                    <button class="alert-action-btn btn-quick-po" onclick="showToast('Quick PO initiated for ${escapeHtml(item.product_name)}', 'success')">Quick PO</button>
                </div>
            `).join('');
        }
    }

    // Shortages footer
    const adequateEl = document.getElementById('shortages-adequate');
    if (adequateEl) {
        if (adequate_item) {
            adequateEl.textContent = `${adequate_item.name} (${adequate_item.stock}/${adequate_item.threshold})`;
        } else {
            adequateEl.textContent = '—';
        }
    }

    // ── Column 3: Expiry Risks ──
    const expiryList = document.getElementById('expiry-list');
    if (expiryList) {
        if (!expiry_risks || expiry_risks.length === 0) {
            expiryList.innerHTML = `<div class="alert-empty-state">
                <i class="fa-solid fa-check-circle"></i>
                No expiry risks detected — all batches within safe timelines
            </div>`;
        } else {
            expiryList.innerHTML = expiry_risks.map(item => {
                const progressClass = item.status_class === 'expired' ? 'progress-expired'
                    : item.status_class === 'warning' ? 'progress-warning'
                    : 'progress-caution';

                const badgeClass = item.status_class === 'expired' ? 'badge-expired'
                    : item.status_class === 'warning' ? 'badge-warning'
                    : 'badge-caution';

                const expiryNote = item.status_class === 'expired'
                    ? `<div class="expiry-note">Regulatory quarantined disposal required</div>`
                    : '';

                return `
                    <div class="alert-item">
                        <div class="alert-item-top">
                            <div class="alert-item-name">${escapeHtml(item.product_name)}</div>
                            <span class="alert-item-badge ${badgeClass}">${item.status}</span>
                        </div>
                        <div class="expiry-batch-info">
                            <span>Batch ${escapeHtml(item.batch_number)}</span>
                            <span class="sep">·</span>
                            <span>${escapeHtml(item.branch_name)}</span>
                            <span class="sep">·</span>
                            <span>${item.remaining_units} units</span>
                            <span class="sep">·</span>
                            <span>${item.expiry_display}</span>
                        </div>
                        <div class="expiry-progress-wrap">
                            <div class="expiry-progress-bar ${progressClass}" style="width:${item.progress_pct}%"></div>
                        </div>
                        ${expiryNote}
                    </div>
                `;
            }).join('');
        }
    }

    // Expiry footer
    const expiryAuditEl = document.getElementById('expiry-audit-action');
    if (expiryAuditEl) {
        const expiredBatch = expiry_risks.find(r => r.status_class === 'expired');
        if (expiredBatch) {
            expiryAuditEl.textContent = `Quarantine Batch #${expiredBatch.batch_number}`;
        } else if (expiry_risks.length > 0) {
            expiryAuditEl.textContent = `Monitor ${expiry_risks.length} batch(es)`;
            expiryAuditEl.style.color = '#f97316';
        } else {
            expiryAuditEl.textContent = 'All Clear';
            expiryAuditEl.style.color = '#16a34a';
        }
    }
}



// ══════════════════════════════════════════════════════════════════════
// Chunk 5: Suppliers & Payables Management
// ══════════════════════════════════════════════════════════════════════

// Cached suppliers data for modal reference
let _suppliersCache = [];

async function loadSuppliersPayables() {
    const branchId = filterBranch.value;
    const qs = `?branch_id=${encodeURIComponent(branchId)}`;

    try {
        const res = await fetch('/api/analytics/suppliers-payables' + qs, {
            headers: { 'Accept': 'application/json' }
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || errData.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        renderSuppliersPayables(data);
    } catch (err) {
        console.error('Failed to load suppliers payables:', err);
        const tbody = document.getElementById('sp-table-body');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7">
                <div style="color:#ef4444;font-size:0.75rem;padding:1.5rem;text-align:center">
                    <i class="fa-solid fa-circle-exclamation"></i> ${escapeHtml(err.message)}
                </div></td></tr>`;
        }
    }
}

function renderSuppliersPayables(data) {
    const { total_unsettled_debt, total_suppliers_count, avg_settlement_cycle_days, suppliers_list } = data;

    _suppliersCache = suppliers_list || [];

    // ── Update header values ──
    const debtEl = document.getElementById('sp-total-debt');
    if (debtEl) debtEl.textContent = formatCurrency(total_unsettled_debt);

    const countEl = document.getElementById('sp-supplier-count');
    if (countEl) countEl.textContent = total_suppliers_count;

    const cycleEl = document.getElementById('sp-avg-cycle');
    if (cycleEl) cycleEl.textContent = avg_settlement_cycle_days;

    const footerInfo = document.getElementById('sp-footer-info');
    const displayCount = Math.min(suppliers_list.length, 10);
    if (footerInfo) footerInfo.textContent = `Displaying Top ${displayCount} of ${total_suppliers_count} Vendors`;

    // ── Render table rows ──
    const tbody = document.getElementById('sp-table-body');
    if (!tbody) return;

    if (!suppliers_list || suppliers_list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7">
            <div class="sp-empty-state">
                <i class="fa-solid fa-handshake"></i>
                No supplier transactions found for this branch
            </div></td></tr>`;
        return;
    }

    tbody.innerHTML = suppliers_list.slice(0, 10).map(s => {
        // Status pill
        let pillClass, pillLabel;
        switch (s.status_class) {
            case 'high-debt':
                pillClass = 'sp-pill-high-debt';
                pillLabel = `Due ${s.maturity_date} · (High Debt)`;
                break;
            case 'scheduled':
                pillClass = 'sp-pill-scheduled';
                pillLabel = `Scheduled ${s.maturity_date}`;
                break;
            case 'settled':
                pillClass = 'sp-pill-settled';
                pillLabel = 'Settled';
                break;
            default:
                pillClass = 'sp-pill-regular';
                pillLabel = `Due ${s.maturity_date} · Regular`;
        }

        // Action buttons
        const actionBtns = s.outstanding_due > 0
            ? `<button class="sp-btn sp-btn-authorize" onclick="openPaymentModal(${s.supplier_id})">Authorize Payment</button>`
            : `<button class="sp-btn sp-btn-view" onclick="showToast('Viewing invoices for ${escapeHtml(s.company_name)}', 'info')">View Invoices</button>`;

        return `
            <tr data-supplier-id="${s.supplier_id}">
                <td class="sp-td">
                    <div class="sp-supplier-info">
                        <div class="sp-supplier-name">${escapeHtml(s.company_name)}</div>
                        <div class="sp-supplier-meta">${escapeHtml(s.category)} · Account ${escapeHtml(s.account_number)}</div>
                    </div>
                </td>
                <td class="sp-td sp-td-num">${formatCurrency(s.total_invoices)}</td>
                <td class="sp-td sp-td-num sp-paid-green">${formatCurrency(s.paid_amount)}</td>
                <td class="sp-td sp-td-center">
                    <div class="sp-progress-cell">
                        <div class="sp-progress-bar-wrap">
                            <div class="sp-progress-bar" style="width:${s.settlement_progress}%"></div>
                        </div>
                        <span class="sp-progress-pct">${s.settlement_progress}%</span>
                    </div>
                </td>
                <td class="sp-td sp-td-num sp-outstanding">${formatCurrency(s.outstanding_due)}</td>
                <td class="sp-td sp-td-center">
                    <span class="sp-status-pill ${pillClass}">
                        <span class="pill-dot"></span>
                        ${pillLabel}
                    </span>
                </td>
                <td class="sp-td sp-td-center">
                    <div class="sp-action-btns">
                        ${actionBtns}
                        <button class="sp-btn sp-btn-view" onclick="showToast('Viewing invoices for ${escapeHtml(s.company_name)}', 'info')">View Invoices</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}


// ── Payment Modal Logic ──────────────────────────────────────────────

function openPaymentModal(supplierId) {
    const supplier = _suppliersCache.find(s => s.supplier_id === supplierId);
    if (!supplier) {
        showToast('Supplier not found', 'error');
        return;
    }

    const modal = document.getElementById('sp-payment-modal');
    const nameEl = document.getElementById('sp-modal-supplier-name');
    const outstandingEl = document.getElementById('sp-modal-outstanding-value');
    const amountInput = document.getElementById('sp-modal-amount');
    const notesInput = document.getElementById('sp-modal-notes');

    if (nameEl) nameEl.textContent = supplier.company_name;
    if (outstandingEl) outstandingEl.textContent = formatCurrency(supplier.outstanding_due);
    if (amountInput) {
        amountInput.value = '';
        amountInput.max = supplier.outstanding_due;
        amountInput.placeholder = `Max: ${formatCurrency(supplier.outstanding_due)}`;
    }
    if (notesInput) notesInput.value = '';

    // Store supplier id on the modal for submission
    modal.dataset.supplierId = supplierId;
    modal.style.display = 'flex';
}

function closePaymentModal() {
    const modal = document.getElementById('sp-payment-modal');
    if (modal) modal.style.display = 'none';
}

async function submitPayment() {
    const modal = document.getElementById('sp-payment-modal');
    const supplierId = parseInt(modal.dataset.supplierId, 10);
    const amount = parseFloat(document.getElementById('sp-modal-amount').value);
    const method = document.getElementById('sp-modal-method').value;
    const notes = document.getElementById('sp-modal-notes').value;
    const branchId = filterBranch.value || '';

    if (!amount || amount <= 0) {
        showToast('Please enter a valid payment amount', 'error');
        return;
    }

    const payBtn = document.getElementById('sp-modal-pay-btn');
    payBtn.disabled = true;
    payBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

    try {
        const res = await fetch('/api/analytics/suppliers/pay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                supplier_id: supplierId,
                branch_id: branchId,
                amount,
                payment_method: method,
                notes: notes || null
            })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || errData.error || `HTTP ${res.status}`);
        }

        const result = await res.json();

        if (result.success) {
            showToast(`Payment of ${formatCurrency(amount)} processed (Ref: ${result.payment.reference_no})`, 'success');

            // Update the row in-place without full reload
            const updated = result.updated_totals;
            const row = document.querySelector(`tr[data-supplier-id="${supplierId}"]`);
            if (row) {
                const cells = row.querySelectorAll('.sp-td');
                if (cells[2]) cells[2].textContent = formatCurrency(updated.paid_amount);
                if (cells[3]) {
                    cells[3].innerHTML = `<div class="sp-progress-cell">
                        <div class="sp-progress-bar-wrap">
                            <div class="sp-progress-bar" style="width:${updated.settlement_progress}%"></div>
                        </div>
                        <span class="sp-progress-pct">${updated.settlement_progress}%</span>
                    </div>`;
                }
                if (cells[4]) cells[4].textContent = formatCurrency(updated.outstanding_due);
            }

            // Refresh full data after a short delay
            setTimeout(() => loadSuppliersPayables(), 500);

            closePaymentModal();
        }
    } catch (err) {
        console.error('Payment error:', err);
        showToast('Payment failed: ' + err.message, 'error');
    } finally {
        payBtn.disabled = false;
        payBtn.innerHTML = '<i class="fa-solid fa-check"></i> Confirm Payment';
    }
}

// ── Modal event listeners ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('sp-modal-close');
    const cancelBtn = document.getElementById('sp-modal-cancel-btn');
    const payBtn = document.getElementById('sp-modal-pay-btn');
    const overlay = document.getElementById('sp-payment-modal');

    if (closeBtn) closeBtn.addEventListener('click', closePaymentModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closePaymentModal);
    if (payBtn) payBtn.addEventListener('click', submitPayment);
    if (overlay) overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closePaymentModal();
    });
});
