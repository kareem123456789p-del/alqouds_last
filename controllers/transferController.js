const db = require('../db');

exports.createTransfer = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const { destination_branch_id, items, notes } = req.body;
        const source_branch_id = req.branchId;

        if (!destination_branch_id || destination_branch_id == source_branch_id) {
            return res.status(400).json({ error: 'Invalid destination branch.' });
        }
        if (!items || !items.length) {
            return res.status(400).json({ error: 'Transfer must contain items.' });
        }

        await conn.beginTransaction();

        // Generate transfer_code
        const year = new Date().getFullYear();
        const codeResult = await conn.execute('SELECT COUNT(*) as count FROM stock_transfers');
        const count = parseInt(codeResult[0][0].count) || 0;
        const transfer_code = 'TR-' + year + '-' + (count + 1).toString().padStart(4, '0');

        const [insertRes] = await conn.execute(
            'INSERT INTO stock_transfers (transfer_code, source_branch_id, destination_branch_id, status, notes, created_by_staff_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [transfer_code, source_branch_id, destination_branch_id, 'PENDING', notes || '', req.user.userId]
        );

        const transfer_id = insertRes.insertId || insertRes[0]?.id;

        for (const item of items) {
            // Verify source batch has enough stock
            const [batchRows] = await conn.execute(
                'SELECT current_stock FROM warehouse_inventory WHERE id = $1 AND branch_id = $2',
                [item.batch_id, source_branch_id]
            );
            if (!batchRows.length || batchRows[0].current_stock < item.quantity) {
                throw new Error('Insufficient stock for batch ' + item.batch_id);
            }
            await conn.execute(
                'INSERT INTO stock_transfer_items (transfer_id, item_id, batch_id, quantity) VALUES ($1, $2, $3, $4)',
                [transfer_id, item.item_id, item.batch_id, item.quantity]
            );
        }

        await conn.commit();
        res.json({ success: true, transfer_id, transfer_code });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ error: err.message || 'Server error' });
    } finally {
        conn.release();
    }
};

exports.getTransfers = async (req, res) => {
    try {
        let query = 'SELECT t.*, sb.name as source_name, db.name as dest_name, c.name as creator_name, p.name as processor_name FROM stock_transfers t JOIN branches sb ON t.source_branch_id = sb.id JOIN branches db ON t.destination_branch_id = db.id LEFT JOIN staff c ON t.created_by_staff_id = c.id LEFT JOIN staff p ON t.processed_by_staff_id = p.id';
        let params = [];

        const isAdmin = (req.user.role === 'ADMIN' || req.user.role === 'Admin' || req.user.role === 'Super Admin');
        if (!isAdmin) {
            query += ' WHERE t.source_branch_id = $1 OR t.destination_branch_id = $2';
            params = [req.branchId, req.branchId];
        }

        query += ' ORDER BY t.id DESC';

        const [transfers] = await db.query(query, params);
        res.json({ success: true, transfers });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.updateStatus = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const { status } = req.body;
        const transfer_id = req.params.id;
        const isAdmin = (req.user.role === 'ADMIN' || req.user.role === 'Admin' || req.user.role === 'Super Admin');

        if (!['IN_TRANSIT', 'COMPLETED', 'CANCELLED'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        await conn.beginTransaction();

        const [transferRows] = await conn.execute('SELECT * FROM stock_transfers WHERE id = $1', [transfer_id]);
        if (!transferRows.length) throw new Error('Transfer not found');
        const transfer = transferRows[0];

        // Authorization & State Machine
        if (status === 'IN_TRANSIT') {
            if (!isAdmin && req.branchId !== transfer.source_branch_id) {
                throw new Error('Only source branch can ship.');
            }
            if (transfer.status !== 'PENDING') throw new Error('Can only ship PENDING transfers.');

            const [items] = await conn.execute('SELECT * FROM stock_transfer_items WHERE transfer_id = $1', [transfer_id]);
            for (const item of items) {
                const [resUpdate] = await conn.execute(
                    'UPDATE warehouse_inventory SET current_stock = current_stock - $1 WHERE id = $2 AND current_stock >= $1',
                    [item.quantity, item.batch_id]
                );
                if (resUpdate.affectedRows === 0) throw new Error('Insufficient stock for batch ' + item.batch_id + ' during shipping.');

                await conn.execute(
                    'INSERT INTO stock_audit_logs (branch_id, staff_id, action_type, item_id, batch_id, quantity_changed, notes) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                    [transfer.source_branch_id, req.user.userId, 'TRANSFER_OUT', item.item_id, item.batch_id, -item.quantity, 'Shipped transfer ' + transfer.transfer_code]
                );
            }

        } else if (status === 'COMPLETED') {
            if (!isAdmin && req.branchId !== transfer.destination_branch_id) {
                throw new Error('Only destination branch can receive.');
            }
            if (transfer.status !== 'IN_TRANSIT') throw new Error('Can only receive IN_TRANSIT transfers.');

            const [items] = await conn.execute('SELECT * FROM stock_transfer_items WHERE transfer_id = $1', [transfer_id]);
            for (const item of items) {
                const [srcBatch] = await conn.execute('SELECT * FROM warehouse_inventory WHERE id = $1', [item.batch_id]);
                if (!srcBatch.length) throw new Error('Source batch missing');

                const [existing] = await conn.execute(
                    'SELECT id FROM warehouse_inventory WHERE product_id = $1 AND branch_id = $2 AND batch_number = $3',
                    [item.item_id, transfer.destination_branch_id, srcBatch[0].batch_number]
                );

                let destBatchId;
                if (existing.length) {
                    destBatchId = existing[0].id;
                    await conn.execute('UPDATE warehouse_inventory SET current_stock = current_stock + $1 WHERE id = $2', [item.quantity, destBatchId]);
                } else {
                    const [newBatch] = await conn.execute(
                        'INSERT INTO warehouse_inventory (product_id, batch_number, expiry_date, current_stock, unit_price, branch_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                        [item.item_id, srcBatch[0].batch_number, srcBatch[0].expiry_date, item.quantity, srcBatch[0].unit_price, transfer.destination_branch_id]
                    );
                    destBatchId = newBatch.insertId || newBatch[0]?.id;
                }

                await conn.execute(
                    'INSERT INTO stock_audit_logs (branch_id, staff_id, action_type, item_id, batch_id, quantity_changed, notes) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                    [transfer.destination_branch_id, req.user.userId, 'TRANSFER_IN', item.item_id, destBatchId, item.quantity, 'Received transfer ' + transfer.transfer_code]
                );
            }

        } else if (status === 'CANCELLED') {
            if (!isAdmin && req.branchId !== transfer.source_branch_id) {
                throw new Error('Only Admin or source branch can cancel.');
            }
            if (transfer.status === 'COMPLETED') throw new Error('Cannot cancel completed transfers.');

            if (transfer.status === 'IN_TRANSIT') {
                const [items] = await conn.execute('SELECT * FROM stock_transfer_items WHERE transfer_id = $1', [transfer_id]);
                for (const item of items) {
                    await conn.execute('UPDATE warehouse_inventory SET current_stock = current_stock + $1 WHERE id = $2', [item.quantity, item.batch_id]);
                    await conn.execute(
                        'INSERT INTO stock_audit_logs (branch_id, staff_id, action_type, item_id, batch_id, quantity_changed, notes) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                        [transfer.source_branch_id, req.user.userId, 'TRANSFER_IN', item.item_id, item.batch_id, item.quantity, 'Cancelled transfer ' + transfer.transfer_code]
                    );
                }
            }
        }

        await conn.execute(
            'UPDATE stock_transfers SET status = $1, processed_by_staff_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
            [status, req.user.userId, transfer_id]
        );

        await conn.commit();
        res.json({ success: true, message: 'Transfer updated successfully.' });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(400).json({ error: err.message || 'Server error' });
    } finally {
        conn.release();
    }
};

exports.getAuditLogs = async (req, res) => {
    try {
        const isAdmin = (req.user.role === 'ADMIN' || req.user.role === 'Admin' || req.user.role === 'Super Admin');
        let query = 'SELECT l.*, s.name as staff_name, p.name as item_name FROM stock_audit_logs l LEFT JOIN staff s ON l.staff_id = s.id LEFT JOIN products p ON l.item_id = p.id';
        let params = [];

        if (!isAdmin) {
            query += ' WHERE l.branch_id = $1';
            params = [req.branchId];
        }

        query += ' ORDER BY l.id DESC LIMIT 50';

        const [logs] = await db.query(query, params);
        res.json({ success: true, logs });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};
