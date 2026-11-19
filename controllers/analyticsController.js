const pool = require('../db');

/**
 * GET /api/analytics/summary
 * 
 * Query params:
 *   - period: 'today' | 'this_week' | 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'all_time'
 *   - branch_id: number | 'all'   (overrides session branchId when admin selects "All Branches")
 *
 * Returns JSON with 5 KPI values + metadata for card badges.
 */
const getSummary = async (req, res, next) => {
    try {
        // ── Determine effective branch filter ──────────────────────────────
        const role = (req.user.role || '').toUpperCase();
        const isAdmin = (role === 'ADMIN' || role === 'SUPER ADMIN');
        
        let branchFilter = '';
        let branchParams = [];
        const requestedBranch = req.query.branch_id;

        if (requestedBranch === 'all' && isAdmin) {
            // Admin selected "All Branches" → no branch filter
            branchFilter = '';
            branchParams = [];
        } else if (requestedBranch && requestedBranch !== 'all' && isAdmin) {
            branchFilter = 'branch_id = $1';
            branchParams = [parseInt(requestedBranch, 10)];
        } else {
            branchFilter = 'branch_id = $1';
            branchParams = [req.branchId];
        }

        // ── Determine date range ──────────────────────────────────────────
        const period = req.query.period || 'this_month';
        const { dateFilter: currentDateFilter, dateParams: currentDateParams, startDate, endDate } = buildDateRange(period, branchParams.length);
        const { dateFilter: prevDateFilter, dateParams: prevDateParams } = buildPreviousPeriodRange(period, branchParams.length);

        // Helper to build a WHERE clause
        const where = (tableAlias, extraDateFilter, extraDateParams, entityType = 'general') => {
            const parts = [];
            const params = [...branchParams];

            if (branchFilter) {
                if (entityType === 'orders') {
                    parts.push(`(${tableAlias ? tableAlias + '.' : ''}branch_id = $1 OR ${tableAlias ? tableAlias + '.' : ''}warehouse_id IN (SELECT id FROM warehouses WHERE branch_id = $1))`);
                } else if (entityType === 'retail_sales') {
                    parts.push(`(${tableAlias ? tableAlias + '.' : ''}branch_id = $1 OR ${tableAlias ? tableAlias + '.' : ''}id IN (SELECT sale_id FROM retail_sale_items WHERE branch_id = $1))`);
                } else if (entityType === 'order_items') {
                    parts.push(`(o.branch_id = $1 OR o.warehouse_id IN (SELECT id FROM warehouses WHERE branch_id = $1) OR oi.branch_id = $1)`);
                } else if (entityType === 'returns') {
                    parts.push(`${tableAlias ? tableAlias + '.' : ''}branch_id = $1`);
                } else {
                    parts.push(`${tableAlias ? tableAlias + '.' : ''}${branchFilter}`);
                }
            }
            if (extraDateFilter) {
                parts.push(extraDateFilter);
                params.push(...extraDateParams);
            }

            return {
                clause: parts.length > 0 ? 'WHERE ' + parts.join(' AND ') : '',
                params
            };
        };

        // ── 1. TOTAL SALES (Orders + Retail POS Sales - Returns) ─────────────
        const salesStatusCond = "LOWER(o.status) IN ('completed', 'dispatched', 'paid', 'approved', 'confirmed', 'delivered')";
        
        // 1a. Order-based sales (wholesale / customer orders)
        const currentSalesWhere = where('o', currentDateFilter ? `o.created_at ${currentDateFilter}` : null, currentDateParams, 'orders');
        const [currentSalesRows] = await pool.execute(
            `SELECT COALESCE(SUM(o.total_amount), 0) AS total
             FROM orders o
             ${currentSalesWhere.clause}${currentSalesWhere.clause ? ' AND' : ' WHERE'} ${salesStatusCond}`,
            currentSalesWhere.params
        );
        let totalSales = parseFloat(currentSalesRows[0].total || 0);

        // 1b. Retail POS sales
        const retailSalesCurrentWhere = where('rs', currentDateFilter ? `rs.created_at ${currentDateFilter}` : null, currentDateParams, 'retail_sales');
        const [retailSalesRows] = await pool.execute(
            `SELECT COALESCE(SUM(rs.total_amount), 0) AS total
             FROM retail_sales rs
             ${retailSalesCurrentWhere.clause}`,
            retailSalesCurrentWhere.params
        );
        totalSales += parseFloat(retailSalesRows[0].total || 0);

        // 1c. Returns deduction (Real-time deduction from Analytics/Sales)
        const returnsCurrentWhere = where('r', currentDateFilter ? `r.created_at ${currentDateFilter}` : null, currentDateParams, 'returns');
        const [currentReturnsRows] = await pool.execute(
            `SELECT COALESCE(SUM(r.total_amount), 0) AS total_returned,
                    COALESCE(SUM(r.total_profit), 0) AS profit_returned
             FROM returns r
             ${returnsCurrentWhere.clause}`,
            returnsCurrentWhere.params
        );
        const currentReturnsTotal = parseFloat(currentReturnsRows[0]?.total_returned || 0);
        const currentReturnsProfit = parseFloat(currentReturnsRows[0]?.profit_returned || 0);
        totalSales = Math.max(0, totalSales - currentReturnsTotal);

        // Previous period sales for growth %
        const prevSalesWhere = where('o', prevDateFilter ? `o.created_at ${prevDateFilter}` : null, prevDateParams, 'orders');
        const [prevSalesRows] = await pool.execute(
            `SELECT COALESCE(SUM(o.total_amount), 0) AS total
             FROM orders o
             ${prevSalesWhere.clause}${prevSalesWhere.clause ? ' AND' : ' WHERE'} ${salesStatusCond}`,
            prevSalesWhere.params
        );
        let prevSales = parseFloat(prevSalesRows[0].total || 0);

        // Previous period retail sales
        const retailSalesPrevWhere = where('rs', prevDateFilter ? `rs.created_at ${prevDateFilter}` : null, prevDateParams, 'retail_sales');
        const [prevRetailSalesRows] = await pool.execute(
            `SELECT COALESCE(SUM(rs.total_amount), 0) AS total
             FROM retail_sales rs
             ${retailSalesPrevWhere.clause}`,
            retailSalesPrevWhere.params
        );
        prevSales += parseFloat(prevRetailSalesRows[0].total || 0);

        // Previous period returns deduction
        const returnsPrevWhere = where('r', prevDateFilter ? `r.created_at ${prevDateFilter}` : null, prevDateParams, 'returns');
        const [prevReturnsRows] = await pool.execute(
            `SELECT COALESCE(SUM(r.total_amount), 0) AS total_returned,
                    COALESCE(SUM(r.total_profit), 0) AS profit_returned
             FROM returns r
             ${returnsPrevWhere.clause}`,
            returnsPrevWhere.params
        );
        const prevReturnsTotal = parseFloat(prevReturnsRows[0]?.total_returned || 0);
        const prevReturnsProfit = parseFloat(prevReturnsRows[0]?.profit_returned || 0);
        prevSales = Math.max(0, prevSales - prevReturnsTotal);

        const salesGrowth = prevSales > 0 ? ((totalSales - prevSales) / prevSales * 100) : 0;

        // Per-branch breakdown (for the B1/B2 sub-labels)
        const branchBreakdown = [];
        if (requestedBranch === 'all' && isAdmin) {
            // Combine orders + retail_sales - returns per branch using UNION ALL
            const [brRows] = await pool.execute(
                `SELECT b.name, GREATEST(0, COALESCE(SUM(s.amount), 0)) AS total
                 FROM branches b
                 LEFT JOIN (
                     SELECT COALESCE(o.branch_id, w.branch_id) as branch_id, o.total_amount AS amount 
                     FROM orders o
                     LEFT JOIN warehouses w ON o.warehouse_id = w.id
                     WHERE ${salesStatusCond}
                     ${currentDateFilter ? 'AND o.created_at ' + currentDateFilter : ''}
                     UNION ALL
                     SELECT rs.branch_id, rs.total_amount AS amount 
                     FROM retail_sales rs
                     ${currentDateFilter ? 'WHERE rs.created_at ' + currentDateFilter : ''}
                     UNION ALL
                     SELECT r.branch_id, -r.total_amount AS amount
                     FROM returns r
                     ${currentDateFilter ? 'WHERE r.created_at ' + currentDateFilter : ''}
                 ) s ON s.branch_id = b.id
                 GROUP BY b.id, b.name ORDER BY b.id`,
                currentDateParams
            );
            brRows.forEach(r => branchBreakdown.push({ name: r.name, total: parseFloat(r.total) }));
        }

        // ── 2. TOTAL NET PROFIT (from order_items profit margin + retail profit - returns profit) ──
        const profitCurrentWhere = where('o', currentDateFilter ? `o.created_at ${currentDateFilter}` : null, currentDateParams, 'order_items');
        const [profitRows] = await pool.execute(
            `SELECT COALESCE(SUM(
                CASE 
                    WHEN oi.base_price > 0 THEN (oi.unit_price - oi.base_price) * oi.qty
                    WHEN oi.profit_margin > 0 AND oi.profit_margin < 1 THEN (oi.unit_price * oi.profit_margin) * oi.qty
                    ELSE oi.profit_margin * oi.qty
                END
             ), 0) AS order_profit
             FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             ${profitCurrentWhere.clause}${profitCurrentWhere.clause ? ' AND' : ' WHERE'} ${salesStatusCond}`,
            profitCurrentWhere.params
        );
        let totalNetProfit = parseFloat(profitRows[0].order_profit || 0);

        // Add retail profit
        const retailProfitWhere = where('rs', currentDateFilter ? `rs.created_at ${currentDateFilter}` : null, currentDateParams, 'retail_sales');
        const [retailProfitRows] = await pool.execute(
            `SELECT COALESCE(SUM(rs.profit_amount), 0) AS retail_profit
             FROM retail_sales rs
             ${retailProfitWhere.clause}`,
            retailProfitWhere.params
        );
        totalNetProfit += parseFloat(retailProfitRows[0].retail_profit || 0);

        // Deduct returns profit
        totalNetProfit = Math.max(0, totalNetProfit - currentReturnsProfit);

        // Profit margin percentage
        const profitMarginPct = totalSales > 0 ? (totalNetProfit / totalSales * 100) : 0;

        // Previous period profit for growth
        const profitPrevWhere = where('o', prevDateFilter ? `o.created_at ${prevDateFilter}` : null, prevDateParams, 'order_items');
        const [prevProfitRows] = await pool.execute(
            `SELECT COALESCE(SUM(
                CASE 
                    WHEN oi.base_price > 0 THEN (oi.unit_price - oi.base_price) * oi.qty
                    WHEN oi.profit_margin > 0 AND oi.profit_margin < 1 THEN (oi.unit_price * oi.profit_margin) * oi.qty
                    ELSE oi.profit_margin * oi.qty
                END
             ), 0) AS order_profit
             FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             ${profitPrevWhere.clause}${profitPrevWhere.clause ? ' AND' : ' WHERE'} ${salesStatusCond}`,
            profitPrevWhere.params
        );
        let prevNetProfit = parseFloat(prevProfitRows[0].order_profit || 0);

        // Previous period retail profit
        const retailProfitPrevWhere = where('rs', prevDateFilter ? `rs.created_at ${prevDateFilter}` : null, prevDateParams, 'retail_sales');
        const [prevRetailProfitRows] = await pool.execute(
            `SELECT COALESCE(SUM(rs.profit_amount), 0) AS retail_profit
             FROM retail_sales rs
             ${retailProfitPrevWhere.clause}`,
            retailProfitPrevWhere.params
        );
        prevNetProfit += parseFloat(prevRetailProfitRows[0].retail_profit || 0);

        // Deduct prev returns profit
        prevNetProfit = Math.max(0, prevNetProfit - prevReturnsProfit);

        const profitGrowth = prevNetProfit > 0 ? ((totalNetProfit - prevNetProfit) / prevNetProfit * 100) : 0;

        // ── 3. TOTAL PURCHASES (import_logs total cost) ──
        const purchaseCurrentWhere = where('il', currentDateFilter ? `il.created_at ${currentDateFilter}` : null, currentDateParams);
        const [purchaseRows] = await pool.execute(
            `SELECT COALESCE(SUM(il.quantity * il.unit_price), 0) AS total,
                    COUNT(*) AS restock_count
             FROM import_logs il
             ${purchaseCurrentWhere.clause}`,
            purchaseCurrentWhere.params
        );
        const totalPurchases = parseFloat(purchaseRows[0].total || 0);
        const restockCount = parseInt(purchaseRows[0].restock_count || 0, 10);

        // Previous period purchases for growth
        const purchasePrevWhere = where('il', prevDateFilter ? `il.created_at ${prevDateFilter}` : null, prevDateParams);
        const [prevPurchaseRows] = await pool.execute(
            `SELECT COALESCE(SUM(il.quantity * il.unit_price), 0) AS total
             FROM import_logs il
             ${purchasePrevWhere.clause}`,
            purchasePrevWhere.params
        );
        const prevPurchases = parseFloat(prevPurchaseRows[0].total || 0);
        const purchasesGrowth = prevPurchases > 0 ? ((totalPurchases - prevPurchases) / prevPurchases * 100) : 0;

        // ── 4. TOTAL PAYABLES (outstanding supplier debt) ──
        const payablesWhere = where('st', null, []);
        const [payablesRows] = await pool.execute(
            `SELECT COALESCE(SUM(st.total_amount), 0) AS total,
                    COUNT(DISTINCT st.supplier_id) AS supplier_count
             FROM supplier_transactions st
             ${payablesWhere.clause}`,
            payablesWhere.params
        );
        const totalPayables = parseFloat(payablesRows[0].total || 0);
        const supplierCount = parseInt(payablesRows[0].supplier_count || 0, 10);

        // Payables in the next 7 days (recent imports to highlight urgency)
        const [recentPayableRows] = await pool.execute(
            `SELECT COALESCE(SUM(st.total_amount), 0) AS recent_total
             FROM supplier_transactions st
             ${payablesWhere.clause}${payablesWhere.clause ? ' AND' : ' WHERE'} st.created_at >= NOW() - INTERVAL '7 days'`,
            payablesWhere.params
        );
        const payablesIn7d = parseFloat(recentPayableRows[0].recent_total || 0);

        // Previous month payables growth
        const payablesPrevWhere = where('st', prevDateFilter ? `st.created_at ${prevDateFilter}` : null, prevDateParams);
        const [prevPayablesRows] = await pool.execute(
            `SELECT COALESCE(SUM(st.total_amount), 0) AS total
             FROM supplier_transactions st
             ${payablesPrevWhere.clause}`,
            payablesPrevWhere.params
        );
        const prevPayables = parseFloat(prevPayablesRows[0].total || 0);
        const payablesGrowthVsLast = prevPayables > 0 ? ((totalPayables - prevPayables) / prevPayables * 100) : 0;

        // ── 5. INVENTORY VALUE (current stock × unit_price / purchase_price) ──
        const invWhere = where('wi', null, []);
        const [invRows] = await pool.execute(
            `SELECT 
                COALESCE(SUM(wi.current_stock * COALESCE(wi.unit_price, p.purchase_price, p.price)), 0) AS total_value,
                COUNT(DISTINCT wi.product_id) AS total_skus
             FROM warehouse_inventory wi
             JOIN products p ON p.id = wi.product_id
             ${invWhere.clause}${invWhere.clause ? ' AND' : ' WHERE'} wi.current_stock > 0 AND p.is_active = 1 AND p.is_deleted = 0`,
            invWhere.params
        );
        const inventoryValue = parseFloat(invRows[0].total_value || 0);
        const totalSKUs = parseInt(invRows[0].total_skus || 0, 10);

        // Branch count for inventory display
        const [branchCountRows] = await pool.execute(
            `SELECT COUNT(DISTINCT wi.branch_id) AS branch_count
             FROM warehouse_inventory wi
             WHERE wi.current_stock > 0`
        );
        const branchCount = parseInt(branchCountRows[0].branch_count || 0, 10);

        // ── Build response ────────────────────────────────────────────────
        res.json({
            period,
            date_range: { start: startDate, end: endDate },
            total_sales: {
                value: totalSales,
                growth_pct: Math.round(salesGrowth * 10) / 10,
                branch_breakdown: branchBreakdown
            },
            total_net_profit: {
                value: totalNetProfit,
                growth_pct: Math.round(profitGrowth * 10) / 10,
                margin_pct: Math.round(profitMarginPct * 10) / 10,
                margin_health: profitMarginPct >= 20 ? 'healthy' : profitMarginPct >= 10 ? 'moderate' : 'low'
            },
            total_purchases: {
                value: totalPurchases,
                growth_pct: Math.round(purchasesGrowth * 10) / 10,
                restock_orders: restockCount
            },
            total_payables: {
                value: totalPayables,
                in_7d: payablesIn7d,
                growth_vs_last_pct: Math.round(payablesGrowthVsLast * 10) / 10,
                supplier_count: supplierCount
            },
            inventory_value: {
                value: inventoryValue,
                total_skus: totalSKUs,
                branch_count: branchCount
            }
        });
    } catch (err) {
        console.error('Analytics summary error:', err);
        next(err);
    }
};

/**
 * GET /api/analytics/branches
 * Returns list of branches for the filter dropdown (admin only sees all, staff sees own)
 */
const getBranches = async (req, res, next) => {
    try {
        const role = (req.user.role || '').toUpperCase();
        const isAdmin = (role === 'ADMIN' || role === 'SUPER ADMIN');

        if (isAdmin) {
            const [rows] = await pool.execute(
                "SELECT id, name FROM branches WHERE is_active = true ORDER BY id"
            );
            res.json({ branches: rows, is_admin: true });
        } else {
            const [rows] = await pool.execute(
                "SELECT id, name FROM branches WHERE id = $1",
                [req.branchId]
            );
            res.json({ branches: rows, is_admin: false });
        }
    } catch (err) {
        next(err);
    }
};


// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build date range filter based on period name.
 * Returns { dateFilter, dateParams, startDate, endDate }
 * dateFilter is like "BETWEEN $N AND $M" to be appended to a column reference.
 */
function buildDateRange(period, paramOffset = 0) {
    const now = new Date();
    let startDate, endDate;

    switch (period) {
        case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
            break;
        case 'this_week': {
            const dayOfWeek = now.getDay(); // 0 = Sunday
            startDate = new Date(now);
            startDate.setDate(now.getDate() - dayOfWeek);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
            break;
        }
        case 'this_month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            break;
        case 'last_month':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
            break;
        case 'this_quarter': {
            const q = Math.floor(now.getMonth() / 3);
            startDate = new Date(now.getFullYear(), q * 3, 1);
            endDate = new Date(now.getFullYear(), (q + 1) * 3, 0, 23, 59, 59, 999);
            break;
        }
        case 'this_year':
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
            break;
        case 'all_time':
        default:
            return { dateFilter: null, dateParams: [], startDate: null, endDate: null };
    }

    const p1 = paramOffset + 1;
    const p2 = paramOffset + 2;
    const pad = (n) => String(n).padStart(2, '0');
    return {
        dateFilter: `BETWEEN $${p1} AND $${p2}`,
        dateParams: [startDate.toISOString(), endDate.toISOString()],
        startDate: `${startDate.getFullYear()}-${pad(startDate.getMonth()+1)}-${pad(startDate.getDate())}`,
        endDate: `${endDate.getFullYear()}-${pad(endDate.getMonth()+1)}-${pad(endDate.getDate())}`
    };
}

/**
 * Build the "previous period" date range for growth comparison.
 */
function buildPreviousPeriodRange(period, paramOffset = 0) {
    const now = new Date();
    let startDate, endDate;

    switch (period) {
        case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
            break;
        case 'this_week': {
            const dayOfWeek = now.getDay();
            startDate = new Date(now);
            startDate.setDate(now.getDate() - dayOfWeek - 7);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now);
            endDate.setDate(now.getDate() - dayOfWeek - 1);
            endDate.setHours(23, 59, 59, 999);
            break;
        }
        case 'this_month':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
            break;
        case 'last_month':
            startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
            endDate = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999);
            break;
        case 'this_quarter': {
            const q = Math.floor(now.getMonth() / 3);
            startDate = new Date(now.getFullYear(), (q - 1) * 3, 1);
            endDate = new Date(now.getFullYear(), q * 3, 0, 23, 59, 59, 999);
            break;
        }
        case 'this_year':
            startDate = new Date(now.getFullYear() - 1, 0, 1);
            endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
            break;
        case 'all_time':
        default:
            return { dateFilter: null, dateParams: [] };
    }

    const p1 = paramOffset + 1;
    const p2 = paramOffset + 2;
    return {
        dateFilter: `BETWEEN $${p1} AND $${p2}`,
        dateParams: [startDate.toISOString(), endDate.toISOString()]
    };
}


/**
 * GET /api/analytics/branch-performance
 * 
 * Query params:
 *   - period: 'today' | 'this_week' | 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'all_time'
 *   - branch_id: number | 'all'
 *
 * Returns branch-level sales & profit grouped by weekly intervals (W1–W4)
 * for the bar chart, plus per-branch margin summaries.
 */
const getBranchPerformance = async (req, res, next) => {
    try {
        const role = (req.user?.role || '').toUpperCase();
        const isAdmin = (role === 'ADMIN' || role === 'SUPER ADMIN');

        const requestedBranch = req.query.branch_id;
        const period = req.query.period || 'this_month';
        const { dateParams, startDate: rawStart, endDate: rawEnd } = buildDateRange(period, 0);

        // Determine effective start/end dates
        let start, end;
        if (dateParams && dateParams.length === 2) {
            start = new Date(dateParams[0]);
            end = new Date(dateParams[1]);
        } else {
            const now = new Date();
            end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
            start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), 0, 0, 0, 0);
        }

        const periodStart = rawStart || start.toISOString().slice(0, 10);
        const periodEnd = rawEnd || end.toISOString().slice(0, 10);

        // ── Determine which branches to compare ─────────────────────────
        // For admin, if branch_id is 'all', omitted, empty, or '0', return all active branches
        const isAllBranches = isAdmin && (!requestedBranch || requestedBranch === 'all' || requestedBranch === '' || requestedBranch === '0');

        let branches = [];
        if (isAllBranches) {
            const [brRows] = await pool.execute(
                "SELECT id, name FROM branches WHERE is_active = true OR is_active IS NULL ORDER BY id"
            );
            branches = brRows;
        } else {
            const bId = (requestedBranch && requestedBranch !== 'all' && requestedBranch !== '' && isAdmin)
                ? parseInt(requestedBranch, 10)
                : (req.branchId || 1);

            const [brRows] = await pool.execute(
                "SELECT id, name FROM branches WHERE id = $1", [bId]
            );
            branches = brRows;
        }

        // If still no branches found, fallback to active branches
        if (!branches || branches.length === 0) {
            const [fallbackRows] = await pool.execute(
                "SELECT id, name FROM branches ORDER BY id LIMIT 2"
            );
            branches = fallbackRows;
        }

        const salesStatusCond = "(LOWER(o.status) IN ('completed', 'dispatched', 'paid', 'approved', 'confirmed', 'delivered') OR o.status IS NULL)";

        // ── Weekly breakdown per branch (W1 – W4) ───────────────────────
        const totalMs = Math.max(end.getTime() - start.getTime(), 1000 * 60 * 60 * 24);
        const weekCount = 4;
        const weekMs = totalMs / weekCount;

        const weeks = [];
        for (let i = 0; i < weekCount; i++) {
            const wStart = new Date(start.getTime() + i * weekMs);
            const wEnd = new Date(start.getTime() + (i + 1) * weekMs);
            weeks.push({
                label: `W${i + 1}`,
                start: wStart.toISOString(),
                end: wEnd.toISOString()
            });
        }

        // For each branch, get sales & profit per week
        const branchData = [];
        for (const branch of branches) {
            const weeklyData = [];
            let branchTotalSales = 0;
            let branchTotalProfit = 0;

            for (const week of weeks) {
                // 1. Order sales
                const [orderSalesRows] = await pool.execute(
                    `SELECT COALESCE(SUM(o.total_amount), 0) AS total
                     FROM orders o
                     LEFT JOIN warehouses w ON o.warehouse_id = w.id
                     WHERE ${salesStatusCond}
                       AND (o.branch_id = $1 OR w.branch_id = $1)
                       AND o.created_at BETWEEN $2 AND $3`,
                    [branch.id, week.start, week.end]
                );
                let weekSales = parseFloat(orderSalesRows[0]?.total || 0);

                // 2. Retail sales
                const [retailSalesRows] = await pool.execute(
                    `SELECT COALESCE(SUM(rs.total_amount), 0) AS total
                     FROM retail_sales rs
                     WHERE rs.branch_id = $1
                       AND rs.created_at BETWEEN $2 AND $3`,
                    [branch.id, week.start, week.end]
                );
                weekSales += parseFloat(retailSalesRows[0]?.total || 0);

                // 3. Order profit
                const [orderProfitRows] = await pool.execute(
                    `SELECT COALESCE(SUM(
                        CASE 
                            WHEN COALESCE(oi.base_price, 0) > 0 THEN (COALESCE(oi.unit_price, 0) - COALESCE(oi.base_price, 0)) * COALESCE(oi.qty, 1)
                            WHEN COALESCE(oi.profit_margin, 0) > 0 AND oi.profit_margin < 1 THEN (COALESCE(oi.unit_price, 0) * oi.profit_margin) * COALESCE(oi.qty, 1)
                            WHEN COALESCE(oi.profit_margin, 0) >= 1 THEN oi.profit_margin * COALESCE(oi.qty, 1)
                            ELSE 0
                        END
                     ), 0) AS profit
                     FROM order_items oi
                     JOIN orders o ON oi.order_id = o.id
                     LEFT JOIN warehouses w ON o.warehouse_id = w.id
                     WHERE ${salesStatusCond}
                       AND (o.branch_id = $1 OR w.branch_id = $1 OR oi.branch_id = $1)
                       AND o.created_at BETWEEN $2 AND $3`,
                    [branch.id, week.start, week.end]
                );
                let weekProfit = parseFloat(orderProfitRows[0]?.profit || 0);

                // 4. Retail profit
                const [retailProfitRows] = await pool.execute(
                    `SELECT COALESCE(SUM(COALESCE(rs.profit_amount, 0)), 0) AS profit
                     FROM retail_sales rs
                     WHERE rs.branch_id = $1
                       AND rs.created_at BETWEEN $2 AND $3`,
                    [branch.id, week.start, week.end]
                );
                weekProfit += parseFloat(retailProfitRows[0]?.profit || 0);

                // 5. Returns deduction for this week & branch
                const [returnRows] = await pool.execute(
                    `SELECT COALESCE(SUM(r.total_amount), 0) AS total_returned,
                            COALESCE(SUM(r.total_profit), 0) AS profit_returned
                     FROM returns r
                     WHERE r.branch_id = $1
                       AND r.created_at BETWEEN $2 AND $3`,
                    [branch.id, week.start, week.end]
                );
                const weekReturns = parseFloat(returnRows[0]?.total_returned || 0);
                const weekReturnsProfit = parseFloat(returnRows[0]?.profit_returned || 0);

                weekSales = Math.max(0, weekSales - weekReturns);
                weekProfit = Math.max(0, weekProfit - weekReturnsProfit);

                weeklyData.push({
                    week: week.label,
                    sales: Math.round(weekSales * 100) / 100,
                    profit: Math.round(weekProfit * 100) / 100
                });

                branchTotalSales += weekSales;
                branchTotalProfit += weekProfit;
            }

            const marginPct = branchTotalSales > 0
                ? Math.round((branchTotalProfit / branchTotalSales) * 1000) / 10
                : 0;

            branchData.push({
                branch_id: branch.id,
                branch_name: branch.name,
                total_sales: Math.round(branchTotalSales * 100) / 100,
                total_profit: Math.round(branchTotalProfit * 100) / 100,
                margin_pct: marginPct,
                weekly: weeklyData
            });
        }

        res.json({
            period,
            date_range: { start: periodStart, end: periodEnd },
            weeks: weeks.map(w => w.label),
            branches: branchData
        });
    } catch (err) {
        console.error('❌ Analytics Branch Performance Error:', err);
        res.status(500).json({
            error: 'Failed to calculate branch performance',
            message: err.message
        });
    }
};


/**
 * GET /api/analytics/sales-purchases-timeline
 * 
 * Query params:
 *   - period: 'today' | 'this_week' | 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'all_time'
 *   - branch_id: number | 'all'
 *
 * Returns cumulative sales vs. purchases (restock costs) over weekly/monthly
 * intervals, plus the net operating spread.
 */
const getSalesPurchasesTimeline = async (req, res, next) => {
    try {
        const role = (req.user?.role || '').toUpperCase();
        const isAdmin = (role === 'ADMIN' || role === 'SUPER ADMIN');

        const requestedBranch = req.query.branch_id;
        const period = req.query.period || 'this_month';
        const { dateParams, startDate: rawStart, endDate: rawEnd } = buildDateRange(period, 0);

        let start, end;
        if (dateParams && dateParams.length === 2) {
            start = new Date(dateParams[0]);
            end = new Date(dateParams[1]);
        } else {
            const now = new Date();
            end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
            start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), 0, 0, 0, 0);
        }

        const periodStart = rawStart || start.toISOString().slice(0, 10);
        const periodEnd = rawEnd || end.toISOString().slice(0, 10);

        // ── Branch filter logic ──────────────────────────────────────────
        const isAllBranches = isAdmin && (!requestedBranch || requestedBranch === 'all' || requestedBranch === '' || requestedBranch === '0');

        let branchFilterOrders = '';
        let branchFilterImports = '';
        let branchFilterRetail = '';
        let branchFilterReturns = '';
        let branchParams = [];

        if (!isAllBranches) {
            const bId = (requestedBranch && requestedBranch !== 'all' && requestedBranch !== '' && isAdmin)
                ? parseInt(requestedBranch, 10)
                : (req.branchId || 1);
            branchParams = [bId];
            branchFilterOrders = 'AND (o.branch_id = $3 OR w.branch_id = $3)';
            branchFilterImports = 'AND il.branch_id = $3';
            branchFilterRetail = 'AND rs.branch_id = $3';
            branchFilterReturns = 'AND r.branch_id = $3';
        }

        const salesStatusCond = "(LOWER(o.status) IN ('completed', 'dispatched', 'paid', 'approved', 'confirmed', 'delivered') OR o.status IS NULL)";

        // ── Determine interval count & labels ────────────────────────────
        const totalMs = Math.max(end.getTime() - start.getTime(), 1000 * 60 * 60 * 24);
        const totalDays = totalMs / (1000 * 60 * 60 * 24);
        let intervals = [];

        if (totalDays <= 31) {
            // Weekly intervals (W1–W4)
            const weekCount = 4;
            const weekMs = totalMs / weekCount;
            for (let i = 0; i < weekCount; i++) {
                intervals.push({
                    label: `W${i + 1}`,
                    start: new Date(start.getTime() + i * weekMs).toISOString(),
                    end: new Date(start.getTime() + (i + 1) * weekMs).toISOString()
                });
            }
        } else if (totalDays <= 100) {
            // Weekly intervals (W1–W8)
            const weekCount = Math.min(Math.ceil(totalDays / 7), 12);
            const weekMs = totalMs / weekCount;
            for (let i = 0; i < weekCount; i++) {
                intervals.push({
                    label: `W${i + 1}`,
                    start: new Date(start.getTime() + i * weekMs).toISOString(),
                    end: new Date(start.getTime() + (i + 1) * weekMs).toISOString()
                });
            }
        } else {
            // Monthly intervals
            let current = new Date(start);
            let idx = 0;
            while (current < end) {
                const mStart = new Date(current);
                const mEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59, 999);
                const cappedEnd = mEnd > end ? end : mEnd;
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                intervals.push({
                    label: monthNames[mStart.getMonth()],
                    start: mStart.toISOString(),
                    end: cappedEnd.toISOString()
                });
                current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
                idx++;
                if (idx > 24) break;
            }
        }

        // ── Aggregate per interval ───────────────────────────────────────
        const salesData = [];
        const purchasesData = [];
        let cumulativeSales = 0;
        let cumulativePurchases = 0;

        for (const interval of intervals) {
            const dateParams = [interval.start, interval.end];
            const allParams = [...dateParams, ...branchParams];

            // 1. Order-based sales
            const [orderSalesRows] = await pool.execute(
                `SELECT COALESCE(SUM(o.total_amount), 0) AS total
                 FROM orders o
                 LEFT JOIN warehouses w ON o.warehouse_id = w.id
                 WHERE ${salesStatusCond}
                   AND o.created_at BETWEEN $1 AND $2
                   ${branchFilterOrders}`,
                allParams
            );
            let intervalSales = parseFloat(orderSalesRows[0]?.total || 0);

            // 2. Retail sales
            const [retailRows] = await pool.execute(
                `SELECT COALESCE(SUM(rs.total_amount), 0) AS total
                 FROM retail_sales rs
                 WHERE rs.created_at BETWEEN $1 AND $2
                   ${branchFilterRetail}`,
                allParams
            );
            intervalSales += parseFloat(retailRows[0]?.total || 0);

            // 2b. Returns deduction
            const [returnRows] = await pool.execute(
                `SELECT COALESCE(SUM(r.total_amount), 0) AS total
                 FROM returns r
                 WHERE r.created_at BETWEEN $1 AND $2
                   ${branchFilterReturns}`,
                allParams
            );
            const intervalReturns = parseFloat(returnRows[0]?.total || 0);
            intervalSales = Math.max(0, intervalSales - intervalReturns);

            // 3. Purchases (import_logs = restock)
            const [importRows] = await pool.execute(
                `SELECT COALESCE(SUM(COALESCE(il.quantity, 0) * COALESCE(il.unit_price, 0)), 0) AS total
                 FROM import_logs il
                 WHERE il.created_at BETWEEN $1 AND $2
                   ${branchFilterImports}`,
                allParams
            );
            const intervalPurchases = parseFloat(importRows[0]?.total || 0);

            cumulativeSales += intervalSales;
            cumulativePurchases += intervalPurchases;

            salesData.push({
                label: interval.label,
                value: Math.round(intervalSales * 100) / 100,
                cumulative: Math.round(cumulativeSales * 100) / 100
            });
            purchasesData.push({
                label: interval.label,
                value: Math.round(intervalPurchases * 100) / 100,
                cumulative: Math.round(cumulativePurchases * 100) / 100
            });
        }

        const totalSales = cumulativeSales;
        const totalPurchases = cumulativePurchases;
        const cashSpread = totalSales - totalPurchases;
        const spreadPct = totalSales > 0
            ? Math.round((cashSpread / totalSales) * 1000) / 10
            : 0;

        res.json({
            period,
            date_range: { start: periodStart, end: periodEnd },
            labels: intervals.map(i => i.label),
            sales: salesData,
            purchases: purchasesData,
            summary: {
                total_sales: Math.round(totalSales * 100) / 100,
                total_purchases: Math.round(totalPurchases * 100) / 100,
                net_operating_spread: Math.round(cashSpread * 100) / 100,
                spread_pct: spreadPct
            }
        });
    } catch (err) {
        console.error('❌ Analytics Sales-Purchases Timeline Error:', err);
        res.status(500).json({
            error: 'Failed to calculate sales vs purchases timeline',
            message: err.message
        });
    }
};


/**
 * GET /api/analytics/top-products
 *
 * Query params:
 *   - period: 'today' | 'this_week' | 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'all_time'
 *   - branch_id: number | 'all'
 *
 * Returns top-selling products ranked by units sold, with revenue.
 * STRICT branch isolation: when a specific branch is selected, only that branch's data is returned.
 */
const getTopProducts = async (req, res, next) => {
    try {
        const role = (req.user?.role || '').toUpperCase();
        const isAdmin = (role === 'ADMIN' || role === 'SUPER ADMIN');

        const requestedBranch = req.query.branch_id;
        const period = req.query.period || 'this_month';
        const { dateParams: rangeDates } = buildDateRange(period, 0);

        // Date bounds
        let startISO, endISO;
        if (rangeDates && rangeDates.length === 2) {
            startISO = rangeDates[0];
            endISO = rangeDates[1];
        } else {
            const now = new Date();
            endISO = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
            startISO = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString();
        }

        // ── Branch isolation ────────────────────────────────────────────
        const isAllBranches = isAdmin && (!requestedBranch || requestedBranch === 'all' || requestedBranch === '' || requestedBranch === '0');

        let branchId = null;
        if (!isAllBranches) {
            branchId = (requestedBranch && requestedBranch !== 'all' && requestedBranch !== '' && isAdmin)
                ? parseInt(requestedBranch, 10)
                : (req.branchId || 1);
        }

        const salesStatusCond = "(LOWER(o.status) IN ('completed','dispatched','paid','approved','confirmed','delivered') OR o.status IS NULL)";

        // ── Aggregate units sold from order_items + retail_sale_items ──
        // We'll use UNION ALL to combine both sales channels, then group by product.
        let sql, params;

        if (branchId) {
            // STRICT per-branch isolation
            sql = `
                SELECT
                    p.id AS product_id,
                    p.name AS product_name,
                    p.sku,
                    COALESCE(p.category, 'Uncategorized') AS category,
                    GREATEST(0, COALESCE(SUM(combined.qty), 0)) AS units_sold,
                    GREATEST(0, COALESCE(SUM(combined.revenue), 0)) AS total_revenue
                FROM (
                    SELECT oi.product_id,
                           COALESCE(oi.qty, 0) AS qty,
                           COALESCE(oi.subtotal, oi.unit_price * oi.qty, 0) AS revenue
                    FROM order_items oi
                    JOIN orders o ON oi.order_id = o.id
                    WHERE ${salesStatusCond}
                      AND o.created_at BETWEEN $1 AND $2
                      AND oi.branch_id = $3

                    UNION ALL

                    SELECT rsi.product_id,
                           COALESCE(rsi.qty, 0) AS qty,
                           COALESCE(rsi.selling_price * rsi.qty, 0) AS revenue
                    FROM retail_sale_items rsi
                    JOIN retail_sales rs ON rsi.sale_id = rs.id
                    WHERE rs.created_at BETWEEN $1 AND $2
                      AND rsi.branch_id = $3

                    UNION ALL

                    SELECT ri.product_id,
                           -COALESCE(ri.qty, 0) AS qty,
                           -COALESCE(ri.total, ri.unit_price * ri.qty, 0) AS revenue
                    FROM return_items ri
                    JOIN returns r ON ri.return_id = r.id
                    WHERE r.created_at BETWEEN $1 AND $2
                      AND ri.branch_id = $3
                ) combined
                JOIN products p ON p.id = combined.product_id
                WHERE p.is_deleted = 0
                GROUP BY p.id, p.name, p.sku, p.category
                HAVING SUM(combined.qty) > 0
                ORDER BY units_sold DESC, total_revenue DESC
                LIMIT 10
            `;
            params = [startISO, endISO, branchId];
        } else {
            // All branches (admin)
            sql = `
                SELECT
                    p.id AS product_id,
                    p.name AS product_name,
                    p.sku,
                    COALESCE(p.category, 'Uncategorized') AS category,
                    GREATEST(0, COALESCE(SUM(combined.qty), 0)) AS units_sold,
                    GREATEST(0, COALESCE(SUM(combined.revenue), 0)) AS total_revenue
                FROM (
                    SELECT oi.product_id,
                           COALESCE(oi.qty, 0) AS qty,
                           COALESCE(oi.subtotal, oi.unit_price * oi.qty, 0) AS revenue
                    FROM order_items oi
                    JOIN orders o ON oi.order_id = o.id
                    WHERE ${salesStatusCond}
                      AND o.created_at BETWEEN $1 AND $2

                    UNION ALL

                    SELECT rsi.product_id,
                           COALESCE(rsi.qty, 0) AS qty,
                           COALESCE(rsi.selling_price * rsi.qty, 0) AS revenue
                    FROM retail_sale_items rsi
                    JOIN retail_sales rs ON rsi.sale_id = rs.id
                    WHERE rs.created_at BETWEEN $1 AND $2

                    UNION ALL

                    SELECT ri.product_id,
                           -COALESCE(ri.qty, 0) AS qty,
                           -COALESCE(ri.total, ri.unit_price * ri.qty, 0) AS revenue
                    FROM return_items ri
                    JOIN returns r ON ri.return_id = r.id
                    WHERE r.created_at BETWEEN $1 AND $2
                ) combined
                JOIN products p ON p.id = combined.product_id
                WHERE p.is_deleted = 0
                GROUP BY p.id, p.name, p.sku, p.category
                HAVING SUM(combined.qty) > 0
                ORDER BY units_sold DESC, total_revenue DESC
                LIMIT 10
            `;
            params = [startISO, endISO];
        }

        const [rows] = await pool.execute(sql, params);

        // Find the max units_sold for relative bar widths in the UI
        const maxUnits = rows.length > 0 ? Math.max(...rows.map(r => parseInt(r.units_sold) || 1)) : 1;

        const products = rows.map((r, idx) => ({
            rank: idx + 1,
            product_id: r.product_id,
            product_name: r.product_name,
            sku: r.sku || '—',
            category: r.category,
            units_sold: parseInt(r.units_sold) || 0,
            total_revenue: Math.round(parseFloat(r.total_revenue || 0) * 100) / 100,
            bar_pct: Math.round((parseInt(r.units_sold) || 0) / maxUnits * 100)
        }));

        // Grand total for the section header
        const totalRevenue = products.reduce((s, p) => s + p.total_revenue, 0);

        res.json({
            period,
            branch_id: branchId || 'all',
            total_revenue: Math.round(totalRevenue * 100) / 100,
            products
        });
    } catch (err) {
        console.error('❌ Analytics Top Products Error:', err);
        res.status(500).json({ error: 'Failed to fetch top products', message: err.message });
    }
};


/**
 * GET /api/analytics/category-distribution
 *
 * Query params:
 *   - period: 'today' | 'this_week' | 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'all_time'
 *   - branch_id: number | 'all'
 *
 * Returns sales distribution grouped by product category for the donut chart.
 * STRICT branch isolation.
 */
const getCategoryDistribution = async (req, res, next) => {
    try {
        const role = (req.user?.role || '').toUpperCase();
        const isAdmin = (role === 'ADMIN' || role === 'SUPER ADMIN');

        const requestedBranch = req.query.branch_id;
        const period = req.query.period || 'this_month';
        const { dateParams: rangeDates } = buildDateRange(period, 0);

        let startISO, endISO;
        if (rangeDates && rangeDates.length === 2) {
            startISO = rangeDates[0];
            endISO = rangeDates[1];
        } else {
            const now = new Date();
            endISO = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
            startISO = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString();
        }

        const isAllBranches = isAdmin && (!requestedBranch || requestedBranch === 'all' || requestedBranch === '' || requestedBranch === '0');

        let branchId = null;
        if (!isAllBranches) {
            branchId = (requestedBranch && requestedBranch !== 'all' && requestedBranch !== '' && isAdmin)
                ? parseInt(requestedBranch, 10)
                : (req.branchId || 1);
        }

        const salesStatusCond = "(LOWER(o.status) IN ('completed','dispatched','paid','approved','confirmed','delivered') OR o.status IS NULL)";

        let sql, params;

        if (branchId) {
            sql = `
                SELECT
                    COALESCE(p.category, 'Uncategorized') AS category,
                    GREATEST(0, COALESCE(SUM(combined.revenue), 0)) AS total_revenue,
                    GREATEST(0, COALESCE(SUM(combined.qty), 0)) AS total_units
                FROM (
                    SELECT oi.product_id,
                           COALESCE(oi.qty, 0) AS qty,
                           COALESCE(oi.subtotal, oi.unit_price * oi.qty, 0) AS revenue
                    FROM order_items oi
                    JOIN orders o ON oi.order_id = o.id
                    WHERE ${salesStatusCond}
                      AND o.created_at BETWEEN $1 AND $2
                      AND oi.branch_id = $3

                    UNION ALL

                    SELECT rsi.product_id,
                           COALESCE(rsi.qty, 0) AS qty,
                           COALESCE(rsi.selling_price * rsi.qty, 0) AS revenue
                    FROM retail_sale_items rsi
                    JOIN retail_sales rs ON rsi.sale_id = rs.id
                    WHERE rs.created_at BETWEEN $1 AND $2
                      AND rsi.branch_id = $3

                    UNION ALL

                    SELECT ri.product_id,
                           -COALESCE(ri.qty, 0) AS qty,
                           -COALESCE(ri.total, ri.unit_price * ri.qty, 0) AS revenue
                    FROM return_items ri
                    JOIN returns r ON ri.return_id = r.id
                    WHERE r.created_at BETWEEN $1 AND $2
                      AND ri.branch_id = $3
                ) combined
                JOIN products p ON p.id = combined.product_id
                WHERE p.is_deleted = 0
                GROUP BY p.category
                HAVING SUM(combined.revenue) > 0
                ORDER BY total_revenue DESC
            `;
            params = [startISO, endISO, branchId];
        } else {
            sql = `
                SELECT
                    COALESCE(p.category, 'Uncategorized') AS category,
                    GREATEST(0, COALESCE(SUM(combined.revenue), 0)) AS total_revenue,
                    GREATEST(0, COALESCE(SUM(combined.qty), 0)) AS total_units
                FROM (
                    SELECT oi.product_id,
                           COALESCE(oi.qty, 0) AS qty,
                           COALESCE(oi.subtotal, oi.unit_price * oi.qty, 0) AS revenue
                    FROM order_items oi
                    JOIN orders o ON oi.order_id = o.id
                    WHERE ${salesStatusCond}
                      AND o.created_at BETWEEN $1 AND $2

                    UNION ALL

                    SELECT rsi.product_id,
                           COALESCE(rsi.qty, 0) AS qty,
                           COALESCE(rsi.selling_price * rsi.qty, 0) AS revenue
                    FROM retail_sale_items rsi
                    JOIN retail_sales rs ON rsi.sale_id = rs.id
                    WHERE rs.created_at BETWEEN $1 AND $2

                    UNION ALL

                    SELECT ri.product_id,
                           -COALESCE(ri.qty, 0) AS qty,
                           -COALESCE(ri.total, ri.unit_price * ri.qty, 0) AS revenue
                    FROM return_items ri
                    JOIN returns r ON ri.return_id = r.id
                    WHERE r.created_at BETWEEN $1 AND $2
                ) combined
                JOIN products p ON p.id = combined.product_id
                WHERE p.is_deleted = 0
                GROUP BY p.category
                HAVING SUM(combined.revenue) > 0
                ORDER BY total_revenue DESC
            `;
            params = [startISO, endISO];
        }

        const [rows] = await pool.execute(sql, params);

        const grandTotal = rows.reduce((s, r) => s + parseFloat(r.total_revenue || 0), 0);

        const categories = rows.map(r => {
            const rev = Math.round(parseFloat(r.total_revenue || 0) * 100) / 100;
            return {
                category: r.category,
                total_revenue: rev,
                total_units: parseInt(r.total_units) || 0,
                share_pct: grandTotal > 0 ? Math.round(rev / grandTotal * 1000) / 10 : 0
            };
        });

        res.json({
            period,
            branch_id: branchId || 'all',
            grand_total: Math.round(grandTotal * 100) / 100,
            categories
        });
    } catch (err) {
        console.error('❌ Analytics Category Distribution Error:', err);
        res.status(500).json({ error: 'Failed to fetch category distribution', message: err.message });
    }
};


/**
 * GET /api/analytics/critical-alerts
 *
 * Query params:
 *   - period: 'today' | 'this_week' | 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'all_time'
 *   - branch_id: number | 'all'
 *
 * Returns consolidated JSON with three arrays:
 *   dead_stock  – items with no sales in 60+ days
 *   shortages   – items where current_stock <= qty_threshold
 *   expiry_risks – batches approaching or past expiry date
 *
 * STRICT branch isolation: when a specific branch is selected, only that branch's data is returned.
 */
const getCriticalAlerts = async (req, res, next) => {
    try {
        const role = (req.user?.role || '').toUpperCase();
        const isAdmin = (role === 'ADMIN' || role === 'SUPER ADMIN');

        const requestedBranch = req.query.branch_id;
        const period = req.query.period || 'this_month';

        // ── Branch isolation ────────────────────────────────────────────
        const isAllBranches = isAdmin && (!requestedBranch || requestedBranch === 'all' || requestedBranch === '' || requestedBranch === '0');

        let branchId = null;
        if (!isAllBranches) {
            branchId = (requestedBranch && requestedBranch !== 'all' && requestedBranch !== '' && isAdmin)
                ? parseInt(requestedBranch, 10)
                : (req.branchId || 1);
        }

        const branchCondWI = branchId ? 'AND wi.branch_id = $1' : '';
        const branchParams = branchId ? [branchId] : [];

        // ═══════════════════════════════════════════════════════════════
        // 1. DEAD STOCK — items with stock > 0 and no sales in 60+ days
        // ═══════════════════════════════════════════════════════════════
        const deadStockSQL = `
            SELECT
                wi.id AS inventory_id,
                p.name AS product_name,
                p.sku,
                b.name AS branch_name,
                wi.current_stock AS units,
                COALESCE(wi.unit_price, p.purchase_price, p.price, 0) AS unit_price,
                wi.current_stock * COALESCE(wi.unit_price, p.purchase_price, p.price, 0) AS tied_capital,
                COALESCE(
                    (SELECT MAX(o.created_at)
                    FROM order_items oi
                    JOIN orders o ON oi.order_id = o.id
                    WHERE oi.product_id = wi.product_id
                      AND (oi.branch_id = wi.branch_id OR o.branch_id = wi.branch_id)
                    ),
                    (SELECT MAX(rs.created_at)
                     FROM retail_sale_items rsi
                     JOIN retail_sales rs ON rsi.sale_id = rs.id
                     WHERE rsi.product_id = wi.product_id
                       AND rsi.branch_id = wi.branch_id
                    )
                ) AS last_sale_date
            FROM warehouse_inventory wi
            JOIN products p ON p.id = wi.product_id
            JOIN branches b ON b.id = wi.branch_id
            WHERE wi.current_stock > 0
              AND p.is_deleted = 0
              ${branchCondWI}
            ORDER BY tied_capital DESC
        `;

        const [deadStockRows] = await pool.execute(deadStockSQL, branchParams);

        const now = new Date();
        const deadStock = [];
        let totalTiedCapital = 0;

        for (const row of deadStockRows) {
            const lastSale = row.last_sale_date ? new Date(row.last_sale_date) : null;
            const daysInactive = lastSale
                ? Math.floor((now - lastSale) / (1000 * 60 * 60 * 24))
                : 999; // Never sold → treat as very inactive

            if (daysInactive >= 60) {
                const tiedCapital = parseFloat(row.tied_capital || 0);
                totalTiedCapital += tiedCapital;
                deadStock.push({
                    inventory_id: row.inventory_id,
                    product_name: row.product_name,
                    sku: row.sku || '—',
                    branch_name: row.branch_name,
                    units: parseInt(row.units) || 0,
                    unit_price: parseFloat(row.unit_price || 0),
                    tied_capital: Math.round(tiedCapital * 100) / 100,
                    days_inactive: daysInactive,
                    status: daysInactive >= 120 ? 'Critical' : 'Dead Stock'
                });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // 2. SHORTAGES — items where current_stock <= qty_threshold
        // ═══════════════════════════════════════════════════════════════
        const shortagesSQL = `
            SELECT
                wi.id AS inventory_id,
                p.name AS product_name,
                p.sku,
                b.name AS branch_name,
                wi.current_stock AS remaining,
                wi.qty_threshold AS threshold,
                COALESCE(wi.unit_price, p.purchase_price, p.price, 0) AS unit_price
            FROM warehouse_inventory wi
            JOIN products p ON p.id = wi.product_id
            JOIN branches b ON b.id = wi.branch_id
            WHERE wi.current_stock > 0
              AND wi.qty_threshold > 0
              AND wi.current_stock <= wi.qty_threshold
              AND p.is_deleted = 0
              ${branchCondWI}
            ORDER BY (wi.current_stock::float / NULLIF(wi.qty_threshold, 0)) ASC
        `;

        const [shortageRows] = await pool.execute(shortagesSQL, branchParams);

        const shortages = shortageRows.map(row => {
            const remaining = parseInt(row.remaining) || 0;
            const threshold = parseInt(row.threshold) || 1;
            const ratio = remaining / threshold;
            return {
                inventory_id: row.inventory_id,
                product_name: row.product_name,
                sku: row.sku || '—',
                branch_name: row.branch_name,
                remaining,
                threshold,
                unit_price: parseFloat(row.unit_price || 0),
                status: ratio <= 0.5 ? 'Critical' : 'Low Buffer',
                fill_pct: Math.round(ratio * 100)
            };
        });

        // Find one "adequate stock" item for footer display
        const adequateSQL = `
            SELECT p.name AS product_name, wi.current_stock, wi.qty_threshold
            FROM warehouse_inventory wi
            JOIN products p ON p.id = wi.product_id
            WHERE wi.current_stock > 0
              AND wi.qty_threshold > 0
              AND wi.current_stock > wi.qty_threshold
              AND p.is_deleted = 0
              ${branchCondWI}
            ORDER BY wi.current_stock DESC
            LIMIT 1
        `;
        const [adequateRows] = await pool.execute(adequateSQL, branchParams);
        const adequateItem = adequateRows.length > 0
            ? { name: adequateRows[0].product_name, stock: parseInt(adequateRows[0].current_stock), threshold: parseInt(adequateRows[0].qty_threshold) }
            : null;

        // ═══════════════════════════════════════════════════════════════
        // 3. EXPIRY RISKS — batches approaching or past expiry
        // ═══════════════════════════════════════════════════════════════
        const expirySQL = `
            SELECT
                wi.id AS inventory_id,
                p.name AS product_name,
                p.sku,
                b.name AS branch_name,
                wi.batch_number,
                wi.expiry_date,
                wi.current_stock AS remaining_units,
                COALESCE(wi.unit_price, p.purchase_price, p.price, 0) AS unit_price
            FROM warehouse_inventory wi
            JOIN products p ON p.id = wi.product_id
            JOIN branches b ON b.id = wi.branch_id
            WHERE wi.current_stock > 0
              AND wi.expiry_date IS NOT NULL
              AND p.is_deleted = 0
              ${branchCondWI}
            ORDER BY wi.expiry_date ASC
        `;

        const [expiryRows] = await pool.execute(expirySQL, branchParams);

        const expiryRisks = [];
        for (const row of expiryRows) {
            const expiryDate = new Date(row.expiry_date);
            const daysUntilExpiry = Math.floor((expiryDate - now) / (1000 * 60 * 60 * 24));

            let status, statusClass;
            if (daysUntilExpiry < 0) {
                status = 'EXPIRED';
                statusClass = 'expired';
            } else if (daysUntilExpiry <= 90) {
                status = '< 3 Months';
                statusClass = 'warning';
            } else if (daysUntilExpiry <= 180) {
                status = '< 6 Months';
                statusClass = 'caution';
            } else {
                continue; // Skip items with > 6 months until expiry
            }

            // Calculate progress bar percentage (how much time has passed of shelf life)
            const progressPct = daysUntilExpiry < 0
                ? 100
                : Math.max(0, Math.min(100, Math.round(100 - (daysUntilExpiry / 180) * 100)));

            expiryRisks.push({
                inventory_id: row.inventory_id,
                product_name: row.product_name,
                sku: row.sku || '—',
                branch_name: row.branch_name,
                batch_number: row.batch_number || '—',
                expiry_date: expiryDate.toISOString().slice(0, 10),
                expiry_display: expiryDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
                remaining_units: parseInt(row.remaining_units) || 0,
                days_until_expiry: daysUntilExpiry,
                status,
                status_class: statusClass,
                progress_pct: progressPct,
                unit_price: parseFloat(row.unit_price || 0)
            });
        }

        // ── Build response ──────────────────────────────────────────────
        res.json({
            period,
            branch_id: branchId || 'all',
            counts: {
                dead_stock: deadStock.length,
                shortages: shortages.length,
                expiry_risks: expiryRisks.length
            },
            dead_stock: deadStock,
            total_tied_capital: Math.round(totalTiedCapital * 100) / 100,
            shortages,
            adequate_item: adequateItem,
            expiry_risks: expiryRisks
        });
    } catch (err) {
        console.error('❌ Analytics Critical Alerts Error:', err);
        res.status(500).json({ error: 'Failed to fetch critical alerts', message: err.message });
    }
};


/**
 * GET /api/analytics/suppliers-payables
 *
 * Query params:
 *   - branch_id: number | 'all'
 *
 * Returns supplier ledger with invoice totals, payments, settlement progress,
 * outstanding debt, and maturity/status for each supplier.
 * STRICT branch isolation.
 */
const getSuppliersPayables = async (req, res, next) => {
    try {
        const role = (req.user?.role || '').toUpperCase();
        const isAdmin = (role === 'ADMIN' || role === 'SUPER ADMIN');

        const requestedBranch = req.query.branch_id;

        // ── Branch isolation ────────────────────────────────────────────
        const isAllBranches = isAdmin && (!requestedBranch || requestedBranch === 'all' || requestedBranch === '' || requestedBranch === '0');

        let branchId = null;
        if (!isAllBranches) {
            branchId = (requestedBranch && requestedBranch !== 'all' && requestedBranch !== '' && isAdmin)
                ? parseInt(requestedBranch, 10)
                : (req.branchId || 1);
        }

        const branchCondST = branchId ? 'AND st.branch_id = $1' : '';
        const branchCondSP = branchId ? 'AND sp.branch_id = $1' : '';
        const branchCondIL = branchId ? 'AND il.branch_id = $1' : '';
        const branchParams = branchId ? [branchId] : [];

        // ── Get all suppliers that have transactions ────────────────────
        // We union local_suppliers data with supplier_transactions to capture
        // even suppliers with NULL supplier_id (legacy imports with no supplier link)
        const suppliersSQL = `
            SELECT
                COALESCE(ls.id, st.supplier_id) AS supplier_id,
                COALESCE(ls.company_name, 'Unknown Supplier #' || COALESCE(st.supplier_id::text, 'N/A')) AS company_name,
                COALESCE(ls.supplier_code, '') AS supplier_code,
                COALESCE(ls.contact_person, '') AS contact_person,
                COALESCE(ls.city_area, '') AS category,
                COALESCE(SUM(st.total_amount), 0) AS total_invoices,
                MIN(st.created_at) AS first_invoice_date,
                MAX(st.created_at) AS last_invoice_date,
                COUNT(st.id) AS invoice_count
            FROM supplier_transactions st
            LEFT JOIN local_suppliers ls ON ls.id = st.supplier_id
            WHERE st.transaction_type = 'IMPORT_CHARGE'
              ${branchCondST}
            GROUP BY COALESCE(ls.id, st.supplier_id), ls.company_name, ls.supplier_code, ls.contact_person, ls.city_area, st.supplier_id
            ORDER BY total_invoices DESC
        `;

        const [supplierRows] = await pool.execute(suppliersSQL, branchParams);

        // ── Get payments per supplier ────────────────────────────────────
        const paymentsSQL = `
            SELECT
                supplier_id,
                COALESCE(SUM(amount), 0) AS total_paid,
                MAX(created_at) AS last_payment_date,
                COUNT(*) AS payment_count
            FROM supplier_payments
            WHERE 1=1
              ${branchCondSP.replace('sp.', '')}
            GROUP BY supplier_id
        `;
        const [paymentRows] = await pool.execute(paymentsSQL, branchParams);

        // Build a map: supplier_id → payment info
        const paymentMap = {};
        paymentRows.forEach(p => {
            paymentMap[p.supplier_id] = {
                total_paid: parseFloat(p.total_paid || 0),
                last_payment_date: p.last_payment_date,
                payment_count: parseInt(p.payment_count || 0)
            };
        });

        // ── Build supplier list ──────────────────────────────────────────
        let totalUnsettledDebt = 0;
        const now = new Date();

        const suppliersList = supplierRows.map(row => {
            const suppId = row.supplier_id;
            const totalInvoices = parseFloat(row.total_invoices || 0);
            const payInfo = paymentMap[suppId] || { total_paid: 0, last_payment_date: null, payment_count: 0 };
            const paidAmount = payInfo.total_paid;
            const outstandingDue = Math.max(0, totalInvoices - paidAmount);
            const settlementProgress = totalInvoices > 0
                ? Math.round((paidAmount / totalInvoices) * 100)
                : 100;

            totalUnsettledDebt += outstandingDue;

            // Calculate maturity date (estimate: last_invoice + 30 days)
            const lastInvoice = row.last_invoice_date ? new Date(row.last_invoice_date) : null;
            const maturityDate = lastInvoice
                ? new Date(lastInvoice.getTime() + 30 * 24 * 60 * 60 * 1000)
                : null;

            const maturityDisplay = maturityDate
                ? maturityDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
                : '—';

            // Determine status
            let status, statusClass;
            if (outstandingDue <= 0) {
                status = 'Settled';
                statusClass = 'settled';
            } else if (maturityDate && maturityDate < now) {
                status = 'High Debt';
                statusClass = 'high-debt';
            } else if (payInfo.payment_count > 0) {
                status = 'Scheduled';
                statusClass = 'scheduled';
            } else {
                status = 'Regular';
                statusClass = 'regular';
            }

            // Account number from supplier_code or generate one
            const accountNumber = row.supplier_code
                ? '#' + row.supplier_code
                : (suppId ? '#SUP-' + String(suppId).padStart(4, '0') : '#N/A');

            return {
                supplier_id: suppId,
                company_name: row.company_name,
                category: row.category || 'General',
                account_number: accountNumber,
                contact_person: row.contact_person,
                total_invoices: Math.round(totalInvoices * 100) / 100,
                paid_amount: Math.round(paidAmount * 100) / 100,
                settlement_progress: settlementProgress,
                outstanding_due: Math.round(outstandingDue * 100) / 100,
                maturity_date: maturityDisplay,
                status,
                status_class: statusClass,
                invoice_count: parseInt(row.invoice_count || 0),
                first_invoice_date: row.first_invoice_date,
                last_invoice_date: row.last_invoice_date
            };
        });

        // ── Calculate average settlement cycle ───────────────────────────
        // Average days between first invoice and last payment (or now)
        let totalCycleDays = 0;
        let cycleCount = 0;
        suppliersList.forEach(s => {
            if (s.first_invoice_date) {
                const firstInv = new Date(s.first_invoice_date);
                const payInfo = paymentMap[s.supplier_id];
                const endDate = payInfo && payInfo.last_payment_date
                    ? new Date(payInfo.last_payment_date)
                    : now;
                const days = Math.floor((endDate - firstInv) / (1000 * 60 * 60 * 24));
                if (days > 0) {
                    totalCycleDays += days;
                    cycleCount++;
                }
            }
        });
        const avgSettlementCycle = cycleCount > 0
            ? Math.round((totalCycleDays / cycleCount) * 10) / 10
            : 0;

        res.json({
            branch_id: branchId || 'all',
            total_unsettled_debt: Math.round(totalUnsettledDebt * 100) / 100,
            total_suppliers_count: suppliersList.length,
            avg_settlement_cycle_days: avgSettlementCycle,
            suppliers: suppliersList,
            suppliers_list: suppliersList
        });
    } catch (err) {
        console.error('❌ Analytics Suppliers Payables Error:', err);
        res.status(500).json({ error: 'Failed to fetch suppliers payables', message: err.message });
    }
};


/**
 * POST /api/suppliers/pay
 *
 * Payload: { supplier_id, branch_id, amount, payment_method, notes }
 *
 * Processes a payment to a supplier:
 *   1. Inserts record into supplier_payments
 *   2. Returns updated totals for real-time UI update
 */
const processSupplierPayment = async (req, res, next) => {
    try {
        const role = (req.user?.role || '').toUpperCase();
        const isAdmin = (role === 'ADMIN' || role === 'SUPER ADMIN');
        const { supplier_id, branch_id, amount, payment_method, notes } = req.body;

        // Validation
        if (!supplier_id || !amount || amount <= 0) {
            return res.status(400).json({ error: 'supplier_id and a positive amount are required' });
        }

        const effectiveBranch = isAdmin ? (branch_id || req.branchId || 1) : (req.branchId || 1);
        const method = payment_method || 'cash';
        const refNo = 'PAY-' + Date.now().toString(36).toUpperCase();

        // ── Insert payment record ────────────────────────────────────────
        const insertSQL = `
            INSERT INTO supplier_payments (supplier_id, amount, payment_method, reference_no, notes, branch_id, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING id, created_at
        `;
        const [insertRows] = await pool.execute(insertSQL, [
            parseInt(supplier_id, 10),
            parseFloat(amount),
            method,
            refNo,
            notes || null,
            parseInt(effectiveBranch, 10)
        ]);

        const paymentId = insertRows[0].id;
        const createdAt = insertRows[0].created_at;

        // ── Recalculate updated totals for this supplier ─────────────────
        const [invoiceTotalRows] = await pool.execute(
            `SELECT COALESCE(SUM(total_amount), 0) AS total_invoices
             FROM supplier_transactions
             WHERE supplier_id = $1 AND transaction_type = 'IMPORT_CHARGE'`,
            [parseInt(supplier_id, 10)]
        );
        const totalInvoices = parseFloat(invoiceTotalRows[0].total_invoices || 0);

        const [paidTotalRows] = await pool.execute(
            `SELECT COALESCE(SUM(amount), 0) AS total_paid
             FROM supplier_payments
             WHERE supplier_id = $1`,
            [parseInt(supplier_id, 10)]
        );
        const totalPaid = parseFloat(paidTotalRows[0].total_paid || 0);
        const outstandingDue = Math.max(0, totalInvoices - totalPaid);
        const settlementProgress = totalInvoices > 0
            ? Math.round((totalPaid / totalInvoices) * 100)
            : 100;

        res.json({
            success: true,
            payment: {
                id: paymentId,
                reference_no: refNo,
                amount: parseFloat(amount),
                payment_method: method,
                created_at: createdAt
            },
            updated_totals: {
                supplier_id: parseInt(supplier_id, 10),
                total_invoices: Math.round(totalInvoices * 100) / 100,
                paid_amount: Math.round(totalPaid * 100) / 100,
                outstanding_due: Math.round(outstandingDue * 100) / 100,
                settlement_progress: settlementProgress
            }
        });
    } catch (err) {
        console.error('❌ Supplier Payment Error:', err);
        res.status(500).json({ error: 'Failed to process payment', message: err.message });
    }
};


module.exports = { getSummary, getBranches, getBranchPerformance, getSalesPurchasesTimeline, getTopProducts, getCategoryDistribution, getCriticalAlerts, getSuppliersPayables, processSupplierPayment };
