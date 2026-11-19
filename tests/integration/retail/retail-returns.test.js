'use strict';
/**
 * Worker D — POS / Retail domain tests: cashier return processing
 * (POST /api/retail/returns).
 *
 * Assigned route covered here:
 *   POST /api/retail/returns
 *
 * Spec (readme.md §8.5 + worker brief): a return must validate against
 *   sold_qty - already_returned_qty
 * for the original sale; over-returns, products not on the invoice and
 * nonexistent/foreign invoices must be rejected without any stock/cash movement.
 */

const { resetDatabase, q, one, scalar, count, stockSum, warehouseStock, productRow, clientLedgerSum, clientDebt, supplierBalance } = require('../../helpers/db');
const { anon, loginAs, loginAsRole, clearSessions } = require('../../helpers/auth');

beforeEach(async () => {
  await resetDatabase();
});

afterAll(() => {
  clearSessions();
});

describe('POST /api/retail/returns', () => {
  test('unauthenticated caller receives 401', async () => {
    const res = await anon().post('/api/retail/returns').send({
      warehouse_id: 1,
      original_sale_id: 1,
      items: [{ product_id: 1, return_qty: 1, unit_price: 5, cost_price: 2 }],
    });
    expect(res.status).toBe(401);
  });

  test('valid partial return restores stock and writes a negative return sale', async () => {
    const pos = await loginAs('pos1');
    const opened = await pos.post('/api/retail/shifts/open');
    const saleRes = await pos.post('/api/retail/sales').send({ warehouse_id: 1, items: [{ product_id: 1, qty: 3, unit_price: 5 }] });
    const saleId = saleRes.body.sale_id;
    const shiftId = opened.body.shift_id;

    const stockAfterSale = await stockSum(1, 1);
    const beforeProductsQty = Number((await productRow(1)).quantity);

    const res = await pos.post('/api/retail/returns').send({
      warehouse_id: 1,
      original_sale_id: saleId,
      items: [{ product_id: 1, return_qty: 2, unit_price: 5, cost_price: 2 }],
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Number(res.body.refund_total)).toBe(10);
    expect(res.body.return_sale_id).toEqual(expect.any(Number));

    // Stock + master quantity restored by the returned qty.
    expect(await stockSum(1, 1)).toBe(stockAfterSale + 2);
    expect(Number((await productRow(1)).quantity)).toBe(beforeProductsQty + 2);

    // Negative return sale record in the caller's branch.
    const returnSale = await one('SELECT * FROM retail_sales WHERE id = $1', [res.body.return_sale_id]);
    expect(Number(returnSale.total_amount)).toBe(-10);
    expect(Number(returnSale.branch_id)).toBe(1);
    expect(Number(returnSale.shift_id)).toBe(Number(shiftId));

    const returnItems = await q('SELECT * FROM retail_sale_items WHERE sale_id = $1', [res.body.return_sale_id]);
    expect(returnItems).toHaveLength(1);
    expect(Number(returnItems[0].qty)).toBe(-2);
  });

  test('retail return must validate against sold_qty - already_returned_qty (over-return -> 400) @known-bug D-BUG-1', async () => {
    const pos = await loginAs('pos1');
    const opened = await pos.post('/api/retail/shifts/open');
    const saleRes = await pos.post('/api/retail/sales').send({ warehouse_id: 1, items: [{ product_id: 1, qty: 3, unit_price: 5 }] });
    const saleId = saleRes.body.sale_id;

    const stockBefore = await stockSum(1, 1);
    const res = await pos.post('/api/retail/returns').send({
      warehouse_id: 1,
      original_sale_id: saleId,
      items: [{ product_id: 1, return_qty: 4, unit_price: 5, cost_price: 2 }],
    });
    expect(res.status).toBe(400);
    expect(await stockSum(1, 1)).toBe(stockBefore);
  });

  test('retail return must reject a product that is not on the original invoice @known-bug D-BUG-1', async () => {
    const pos = await loginAs('pos1');
    const opened = await pos.post('/api/retail/shifts/open');
    const saleRes = await pos.post('/api/retail/sales').send({ warehouse_id: 1, items: [{ product_id: 1, qty: 3, unit_price: 5 }] });
    const saleId = saleRes.body.sale_id;

    const stockBefore = await stockSum(1, 1);
    const res = await pos.post('/api/retail/returns').send({
      warehouse_id: 1,
      original_sale_id: saleId,
      items: [{ product_id: 2, return_qty: 1, unit_price: 12.5, cost_price: 7 }],
    });
    expect(res.status).toBe(400);
    expect(await stockSum(1, 1)).toBe(stockBefore);
  });

  test('retail return must reject a nonexistent original invoice @known-bug D-BUG-1', async () => {
    const pos = await loginAs('pos1');
    const opened = await pos.post('/api/retail/shifts/open');

    const stockBefore = await stockSum(1, 1);
    const res = await pos.post('/api/retail/returns').send({
      warehouse_id: 1,
      original_sale_id: 99999,
      items: [{ product_id: 1, return_qty: 1, unit_price: 5, cost_price: 2 }],
    });
    expect(res.status).toBe(400);
    expect(await stockSum(1, 1)).toBe(stockBefore);
  });
});
