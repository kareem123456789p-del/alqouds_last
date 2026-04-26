const pool = require('../db');

// GET /api/dashboard/stats
const getDashboardStats = async (req, res, next) => {
    try {
        // Run all queries concurrently for performance
        const [
            [pendingOrdersResult],
            [dispatchedFinancesResult],
            [inventoryResult],
            [clientsCountResult],
            [warehousesCountResult]
        ] = await Promise.all([
            pool.execute("SELECT COUNT(*) as count FROM orders WHERE status = 'Pending'"),
            pool.execute("SELECT SUM(total_amount) as total FROM orders WHERE status = 'Dispatched'"),
            pool.execute("SELECT IFNULL(SUM(w.current_stock * p.price), 0) as total_value, IFNULL(SUM(w.current_stock), 0) as total_items FROM warehouse_inventory w JOIN products p ON w.product_id = p.id"),
            pool.execute("SELECT COUNT(*) as count FROM doctors"),
            pool.execute("SELECT COUNT(*) as count FROM warehouses")
        ]);

        const stats = {
            pending_orders: pendingOrdersResult[0].count,
            dispatched_total: dispatchedFinancesResult[0].total || 0,
            inventory_total: inventoryResult[0].total_items,
            inventory_value: inventoryResult[0].total_value,
            registered_clients: clientsCountResult[0].count,
            active_warehouses: warehousesCountResult[0].count
        };

        res.json(stats);
    } catch (err) {
        next(err);
    }
};

module.exports = { getDashboardStats };
