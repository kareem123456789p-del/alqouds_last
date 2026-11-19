'use strict';
/**
 * Inter-Branch Stock Transfers — Golden Rule 5 state machine.
 *
 *   PENDING --ship(source)--> IN_TRANSIT --receive(dest)--> COMPLETED
 *      \                       |
 *       -------- cancel-------'
 *
 * No stock moves at create time; ship decrements the source exactly once;
 * receive increments/merges the destination; cancelling IN_TRANSIT restores.
 */

const { resetDatabase, q, one, scalar, stockSum, warehouseStock } = require('../../helpers/db');
const { loginAs, clearSessions } = require('../../helpers/auth');

beforeEach(resetDatabase);
afterAll(clearSessions);

async function findBatch(productId, branchId, batchNumber) {
  return one(
    'SELECT * FROM warehouse_inventory WHERE product_id = $1 AND branch_id = $2 AND batch_number = $3',
    [productId, branchId, batchNumber],
  );
}

/** Create a valid branch-1 → branch-2 transfer and return the response + source batch. */
async function createTransfer(agent, overrides = {}) {
  const batchNumber = overrides.batch_number || 'B-P2-FAR';
  const src = await findBatch(2, 1, batchNumber);
  const body = {
    destination_branch_id: 2,
    items: [{ item_id: 2, batch_id: src.id, quantity: 5 }],
    notes: 'qa',
  };

  if (overrides.items) {
    body.items = overrides.items;
  } else if (overrides.item !== undefined || overrides.quantity !== undefined) {
    body.items = [{
      item_id: overrides.item !== undefined ? overrides.item : 2,
      batch_id: overrides.batch_id !== undefined ? overrides.batch_id : src.id,
      quantity: overrides.quantity !== undefined ? overrides.quantity : 5,
    }];
  }

  const payload = { ...body, ...overrides };
  delete payload.item;
  delete payload.quantity;
  delete payload.batch_number;
  delete payload.batch_id;

  return { res: await agent.post('/api/transfers').send(payload), src };
}

async function createCompletedMergeTransfer(agents) {
  // Source batch in branch 1.
  const src = await findBatch(2, 1, 'B-P2-FAR');
  // Pre-create the matching destination batch so COMPLETED takes the merge path.
  const dest = (await q(
    `INSERT INTO warehouse_inventory
       (warehouse_id, product_id, batch_number, expiry_date, current_stock,
        qty_threshold, expiry_month_threshold, unit_price, branch_id)
     VALUES (3, 2, $1, $2, 7, 20, 3, $3, 2) RETURNING *`,
    [src.batch_number, src.expiry_date, src.unit_price],
  ))[0];
  const totalAfterSetup = await stockSum(2);

  const { res } = await createTransfer(agents.emp1);
  expect(res.status).toBe(200);
  const transferId = res.body.transfer_id;

  const shipped = await agents.emp1.patch(`/api/transfers/${transferId}/status`).send({ status: 'IN_TRANSIT' });
  expect(shipped.status).toBe(200);

  const received = await agents.emp2.patch(`/api/transfers/${transferId}/status`).send({ status: 'COMPLETED' });
  return { src, dest, transferId, received, totalAfterSetup };
}

describe('POST /api/transfers — validation', () => {
  test('uses req.branchId as the source and ignores a body source_branch_id', async () => {
    const emp = await loginAs('emp1');
    const src = await findBatch(2, 1, 'B-P2-FAR');
    const res = await emp.post('/api/transfers').send({
      source_branch_id: 2,
      destination_branch_id: 1,
      items: [{ item_id: 2, batch_id: src.id, quantity: 1 }],
    });
    // Body source 2 would make this valid; req.branchId (1) makes it same-branch.
    expect(res.status).toBe(400);
    expect(await scalar('SELECT COUNT(*) FROM stock_transfers')).toBe('0');
  });

  test('rejects an empty items array', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.post('/api/transfers').send({ destination_branch_id: 2, items: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/items/i);
  });

  test('rejects a missing destination branch', async () => {
    const emp = await loginAs('emp1');
    const src = await findBatch(2, 1, 'B-P2-FAR');
    const res = await emp.post('/api/transfers').send({
      items: [{ item_id: 2, batch_id: src.id, quantity: 1 }],
    });
    expect(res.status).toBe(400);
  });

  test.failing(
    'rejects a negative or zero quantity with 400 @known-bug B-BUG-8',
    async () => {
      const emp = await loginAs('emp1');
      for (const quantity of [-5, 0]) {
        const { res } = await createTransfer(emp, { quantity });
        // actual: 500 — stock check passes for negatives, then the DB CHECK
        // (quantity > 0) aborts the INSERT and the handler maps it to 500.
        expect(res.status).toBe(400);
      }
    },
  );

  test.failing(
    'reports insufficient, missing and foreign batches as 400, not 500 @known-bug B-BUG-9',
    async () => {
      const emp = await loginAs('emp1');
      const foreign = await findBatch(1, 2, 'B2-P1');
      const cases = [
        { name: 'insufficient', item_id: 2, batch_id: (await findBatch(2, 1, 'B-P2-FAR')).id, quantity: 999999 },
        { name: 'missing batch', item_id: 2, batch_id: 999999, quantity: 1 },
        { name: 'foreign batch', item_id: 1, batch_id: foreign.id, quantity: 1 },
      ];
      for (const c of cases) {
        const { res } = await createTransfer(emp, { items: [c] });
        // actual: 500 {"error":"Insufficient stock for batch ..."}
        expect(res.status).toBe(400);
      }
      expect(Number(await scalar('SELECT COUNT(*) FROM stock_transfers'))).toBe(0);
    },
  );

  test.failing(
    'rejects an item_id that does not belong to the batch product @known-bug B-BUG-10',
    async () => {
      const emp = await loginAs('emp1');
      // Batch belongs to product 2 but the line claims product 3.
      const { res } = await createTransfer(emp, { item: 3, quantity: 2 });
      // actual: 200 — transfer created; receiving would stock the wrong product.
      expect(res.status).toBe(400);
    },
  );

  test.failing(
    'validates that the destination branch exists @known-bug B-BUG-14',
    async () => {
      const emp = await loginAs('emp1');
      const { res } = await createTransfer(emp, { destination_branch_id: 99 });
      // actual: 500 foreign-key violation on stock_transfers_destination_branch_id_fkey
      expect(res.status).toBe(400);
    },
  );
});

describe('POST /api/transfers — persistence', () => {
  test('creates a PENDING transfer with items and leaves source stock untouched', async () => {
    const emp = await loginAs('emp1');
    const { res, src } = await createTransfer(emp);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.transfer_code).toMatch(/^TR-\d{4}-\d{4}$/);

    const transfer = await one('SELECT * FROM stock_transfers WHERE id = $1', [res.body.transfer_id]);
    expect(transfer.status).toBe('PENDING');
    expect(Number(transfer.source_branch_id)).toBe(1);
    expect(Number(transfer.destination_branch_id)).toBe(2);

    const items = await q('SELECT * FROM stock_transfer_items WHERE transfer_id = $1', [transfer.id]);
    expect(items).toHaveLength(1);
    expect(Number(items[0].item_id)).toBe(2);
    expect(Number(items[0].batch_id)).toBe(src.id);
    expect(Number(items[0].quantity)).toBe(5);

    expect(await warehouseStock(2, 1)).toBe(40); // 15 + 25, unchanged
  });
});

describe('GET /api/transfers and scoped lookup routes', () => {
  test('lists transfers where the caller is source or destination', async () => {
    const emp1 = await loginAs('emp1');
    const emp2 = await loginAs('emp2');
    const { res } = await createTransfer(emp1);
    const code = res.body.transfer_code;

    const r1 = await emp1.get('/api/transfers');
    expect(r1.status).toBe(200);
    expect(r1.body.transfers.some(t => t.transfer_code === code)).toBe(true);

    const r2 = await emp2.get('/api/transfers');
    expect(r2.status).toBe(200);
    expect(r2.body.transfers.some(t => t.transfer_code === code)).toBe(true);
    const row = r2.body.transfers.find(t => t.transfer_code === code);
    expect(row.source_name).toEqual(expect.any(String));
    expect(row.dest_name).toEqual(expect.any(String));
    expect(row.creator_name).toEqual(expect.any(String));
  });

  test('/warehouses only exposes the caller branch', async () => {
    const emp1 = await loginAs('emp1');
    const emp2 = await loginAs('emp2');

    const r1 = await emp1.get('/api/transfers/warehouses');
    expect(r1.status).toBe(200);
    expect(r1.body.map(w => Number(w.id))).toEqual([1, 2]);

    const r2 = await emp2.get('/api/transfers/warehouses');
    expect(r2.status).toBe(200);
    expect(r2.body.map(w => Number(w.id))).toEqual([3]);
    const expectedStock = await scalar(
      `SELECT COALESCE(SUM(CASE WHEN p.is_active = 1 AND p.is_deleted = 0 THEN wi.current_stock ELSE 0 END), 0)
         FROM warehouse_inventory wi JOIN products p ON p.id = wi.product_id
        WHERE wi.warehouse_id = 3 AND wi.branch_id = 2`,
    );
    expect(Number(r2.body[0].total_stock)).toBe(Number(expectedStock));
  });

  test('/products/:warehouseId only exposes the caller branch and positive stock', async () => {
    const emp1 = await loginAs('emp1');
    const emp2 = await loginAs('emp2');

    const r1 = await emp1.get('/api/transfers/products/1');
    expect(r1.status).toBe(200);
    expect(r1.body.length).toBeGreaterThan(0);
    expect(r1.body.every(p => Number(p.available_qty) > 0)).toBe(true);

    const foreign = await emp2.get('/api/transfers/products/1');
    expect(foreign.status).toBe(200);
    expect(foreign.body).toEqual([]);

    const r2 = await emp2.get('/api/transfers/products/3');
    expect(r2.status).toBe(200);
    expect(r2.body.length).toBeGreaterThan(0);
    expect(r2.body.map(p => p.id)).toEqual(expect.arrayContaining([1, 2, 6, 7, 8]));
  });
});

describe('PATCH /api/transfers/:id/status — ship', () => {
  test('rejects an unknown status and changes nothing', async () => {
    const emp = await loginAs('emp1');
    const { res, src } = await createTransfer(emp);
    const bad = await emp.patch(`/api/transfers/${res.body.transfer_id}/status`).send({ status: 'BOGUS' });
    expect(bad.status).toBe(400);
    expect((await one('SELECT status FROM stock_transfers WHERE id = $1', [res.body.transfer_id])).status).toBe('PENDING');
    expect(Number((await one('SELECT current_stock FROM warehouse_inventory WHERE id = $1', [src.id])).current_stock)).toBe(25);
  });

  test('only the source branch may ship', async () => {
    const emp1 = await loginAs('emp1');
    const emp2 = await loginAs('emp2');
    const { res, src } = await createTransfer(emp1);

    const denied = await emp2.patch(`/api/transfers/${res.body.transfer_id}/status`).send({ status: 'IN_TRANSIT' });
    expect(denied.status).toBe(400);
    expect((await one('SELECT status FROM stock_transfers WHERE id = $1', [res.body.transfer_id])).status).toBe('PENDING');
    expect(Number((await one('SELECT current_stock FROM warehouse_inventory WHERE id = $1', [src.id])).current_stock)).toBe(25);
  });

  test('shipping deducts exactly the quantity and writes a negative TRANSFER_OUT audit row', async () => {
    const emp = await loginAs('emp1');
    const { res, src } = await createTransfer(emp);

    const shipped = await emp.patch(`/api/transfers/${res.body.transfer_id}/status`).send({ status: 'IN_TRANSIT' });
    expect(shipped.status).toBe(200);
    expect((await one('SELECT status FROM stock_transfers WHERE id = $1', [res.body.transfer_id])).status).toBe('IN_TRANSIT');
    expect(Number((await one('SELECT current_stock FROM warehouse_inventory WHERE id = $1', [src.id])).current_stock)).toBe(20);

    const audit = await one(
      "SELECT * FROM stock_audit_logs WHERE action_type = 'TRANSFER_OUT' AND batch_id = $1",
      [src.id],
    );
    expect(Number(audit.quantity_changed)).toBe(-5);
    expect(Number(audit.item_id)).toBe(2);
    expect(Number(audit.branch_id)).toBe(1);
  });

  test('a second ship is rejected and does not deduct again', async () => {
    const emp = await loginAs('emp1');
    const { res, src } = await createTransfer(emp);
    await emp.patch(`/api/transfers/${res.body.transfer_id}/status`).send({ status: 'IN_TRANSIT' });

    const again = await emp.patch(`/api/transfers/${res.body.transfer_id}/status`).send({ status: 'IN_TRANSIT' });
    expect(again.status).toBe(400);
    expect(Number((await one('SELECT current_stock FROM warehouse_inventory WHERE id = $1', [src.id])).current_stock)).toBe(20);
  });
});

describe('PATCH /api/transfers/:id/status — receive', () => {
  test('only the destination branch may receive', async () => {
    const emp1 = await loginAs('emp1');
    const emp2 = await loginAs('emp2');
    const { res, src } = await createTransfer(emp1);
    await emp1.patch(`/api/transfers/${res.body.transfer_id}/status`).send({ status: 'IN_TRANSIT' });

    const denied = await emp1.patch(`/api/transfers/${res.body.transfer_id}/status`).send({ status: 'COMPLETED' });
    expect(denied.status).toBe(400);
    expect((await one('SELECT status FROM stock_transfers WHERE id = $1', [res.body.transfer_id])).status).toBe('IN_TRANSIT');
    expect(await warehouseStock(2, 3)).toBe(10);
    expect(Number((await one('SELECT current_stock FROM warehouse_inventory WHERE id = $1', [src.id])).current_stock)).toBe(20);
  });

  test('receiving merges into an existing destination batch and conserves total stock', async () => {
    const emp1 = await loginAs('emp1');
    const emp2 = await loginAs('emp2');

    const { src, dest, transferId, received, totalAfterSetup } = await createCompletedMergeTransfer({ emp1, emp2 });
    expect(received.status).toBe(200);
    expect((await one('SELECT status FROM stock_transfers WHERE id = $1', [transferId])).status).toBe('COMPLETED');

    const destAfter = await one('SELECT * FROM warehouse_inventory WHERE id = $1', [dest.id]);
    expect(Number(destAfter.current_stock)).toBe(12);
    expect(await warehouseStock(2, 1)).toBe(35); // 40 - 5
    expect(await stockSum(2)).toBe(totalAfterSetup);

    const audit = await one(
      "SELECT * FROM stock_audit_logs WHERE action_type = 'TRANSFER_IN' AND batch_id = $1",
      [dest.id],
    );
    expect(Number(audit.quantity_changed)).toBe(5);
    expect(Number(audit.branch_id)).toBe(2);
    expect(Number(audit.item_id)).toBe(2);
  });

  test.failing(
    'receiving with no matching destination batch must create one and succeed @known-bug B-BUG-11',
    async () => {
      const emp1 = await loginAs('emp1');
      const emp2 = await loginAs('emp2');
      const { res } = await createTransfer(emp1, { batch_number: 'B-P2-NEAR', quantity: 3 });
      const shipped = await emp1.patch(`/api/transfers/${res.body.transfer_id}/status`).send({ status: 'IN_TRANSIT' });
      expect(shipped.status).toBe(200);

      const received = await emp2.patch(`/api/transfers/${res.body.transfer_id}/status`).send({ status: 'COMPLETED' });
      // actual: 400 "null value in column \"warehouse_id\" ... violates not-null constraint"
      // — the new-batch INSERT never supplies warehouse_id, so the whole
      // transaction rolls back and destination stock never increases.
      expect(received.status).toBe(200);
      expect((await one('SELECT status FROM stock_transfers WHERE id = $1', [res.body.transfer_id])).status).toBe('COMPLETED');
    },
  );
});

describe('PATCH /api/transfers/:id/status — cancel', () => {
  test('cancelling PENDING by the source leaves stock unchanged', async () => {
    const emp = await loginAs('emp1');
    const { res, src } = await createTransfer(emp);
    const cancelled = await emp.patch(`/api/transfers/${res.body.transfer_id}/status`).send({ status: 'CANCELLED' });
    expect(cancelled.status).toBe(200);
    expect((await one('SELECT status FROM stock_transfers WHERE id = $1', [res.body.transfer_id])).status).toBe('CANCELLED');
    expect(Number((await one('SELECT current_stock FROM warehouse_inventory WHERE id = $1', [src.id])).current_stock)).toBe(25);
  });

  test('the destination branch cannot cancel', async () => {
    const emp1 = await loginAs('emp1');
    const emp2 = await loginAs('emp2');
    const { res } = await createTransfer(emp1);
    const denied = await emp2.patch(`/api/transfers/${res.body.transfer_id}/status`).send({ status: 'CANCELLED' });
    expect(denied.status).toBe(400);
    expect((await one('SELECT status FROM stock_transfers WHERE id = $1', [res.body.transfer_id])).status).toBe('PENDING');
  });

  test('cancelling IN_TRANSIT restores the source stock exactly', async () => {
    const emp = await loginAs('emp1');
    const { res, src } = await createTransfer(emp, { quantity: 4 });
    await emp.patch(`/api/transfers/${res.body.transfer_id}/status`).send({ status: 'IN_TRANSIT' });
    expect(Number((await one('SELECT current_stock FROM warehouse_inventory WHERE id = $1', [src.id])).current_stock)).toBe(21);

    const cancelled = await emp.patch(`/api/transfers/${res.body.transfer_id}/status`).send({ status: 'CANCELLED' });
    expect(cancelled.status).toBe(200);
    expect((await one('SELECT status FROM stock_transfers WHERE id = $1', [res.body.transfer_id])).status).toBe('CANCELLED');
    expect(Number((await one('SELECT current_stock FROM warehouse_inventory WHERE id = $1', [src.id])).current_stock)).toBe(25);
  });

  test('cancelling a COMPLETED transfer is rejected', async () => {
    const emp1 = await loginAs('emp1');
    const emp2 = await loginAs('emp2');
    const { transferId, dest } = await createCompletedMergeTransfer({ emp1, emp2 });

    const denied = await emp1.patch(`/api/transfers/${transferId}/status`).send({ status: 'CANCELLED' });
    expect(denied.status).toBe(400);
    expect((await one('SELECT status FROM stock_transfers WHERE id = $1', [transferId])).status).toBe('COMPLETED');
    expect(Number((await one('SELECT current_stock FROM warehouse_inventory WHERE id = $1', [dest.id])).current_stock)).toBe(12);
  });
});

describe('Cross-branch administration', () => {
  test.failing(
    'SUPER ADMIN may ship a transfer whose source is another branch @known-bug B-BUG-12',
    async () => {
      const emp2 = await loginAs('emp2');
      const superadmin = await loginAs('superadmin');
      const src = await findBatch(1, 2, 'B2-P1');
      const created = await emp2.post('/api/transfers').send({
        destination_branch_id: 1,
        items: [{ item_id: 1, batch_id: src.id, quantity: 2 }],
      });
      expect(created.status).toBe(200);

      const res = await superadmin.patch(`/api/transfers/${created.body.transfer_id}/status`).send({ status: 'IN_TRANSIT' });
      // actual: 400 "Only source branch can ship." — updateStatus computes isAdmin
      // from 'ADMIN'/'Admin'/'Super Admin' and never matches 'SUPER ADMIN'.
      expect(res.status).toBe(200);
    },
  );

  test('ADMIN may ship a transfer whose source is another branch', async () => {
    const emp2 = await loginAs('emp2');
    const admin = await loginAs('admin');
    const src = await findBatch(1, 2, 'B2-P1');
    const created = await emp2.post('/api/transfers').send({
      destination_branch_id: 1,
      items: [{ item_id: 1, batch_id: src.id, quantity: 2 }],
    });
    const res = await admin.patch(`/api/transfers/${created.body.transfer_id}/status`).send({ status: 'IN_TRANSIT' });
    expect(res.status).toBe(200);
    expect(Number((await one('SELECT current_stock FROM warehouse_inventory WHERE id = $1', [src.id])).current_stock)).toBe(3);
  });
});

describe('GET /api/transfers/audit-logs', () => {
  test('is branch-scoped: each branch sees only its own audit rows', async () => {
    const emp1 = await loginAs('emp1');
    const emp2 = await loginAs('emp2');
    const { res, src } = await createTransfer(emp1);
    await emp1.patch(`/api/transfers/${res.body.transfer_id}/status`).send({ status: 'IN_TRANSIT' });

    const r1 = await emp1.get('/api/transfers/audit-logs');
    expect(r1.status).toBe(200);
    expect(r1.body.logs.some(l => l.batch_id === src.id && l.action_type === 'TRANSFER_OUT')).toBe(true);

    const r2 = await emp2.get('/api/transfers/audit-logs');
    expect(r2.status).toBe(200);
    expect(r2.body.logs).toEqual([]);
    for (const log of r2.body.logs) {
      expect(Number(log.branch_id)).toBe(2);
    }
  });
});

describe('transfer_code generation', () => {
  test.failing(
    'must generate a unique code even when the COUNT-based sequence collides @known-bug B-BUG-13',
    async () => {
      const emp = await loginAs('emp1');
      const year = new Date().getFullYear();
      // Simulate a committed transfer whose code occupies the slot COUNT(*)+1.
      await q('DELETE FROM stock_transfers');
      await q(
        "INSERT INTO stock_transfers (transfer_code, source_branch_id, destination_branch_id, status) VALUES ($1, 1, 2, 'PENDING')",
        [`TR-${year}-0002`],
      );

      const { res } = await createTransfer(emp);
      // actual: 500 duplicate key on stock_transfers_transfer_code_key
      expect(res.status).toBe(200);
      const code = res.body.transfer_code;
      const rows = await q('SELECT transfer_code FROM stock_transfers ORDER BY id');
      const codes = rows.map(r => r.transfer_code);
      expect(new Set(codes).size).toBe(codes.length);
      expect(code).toMatch(/^TR-\d{4}-\d{4}$/);
    },
  );
});
