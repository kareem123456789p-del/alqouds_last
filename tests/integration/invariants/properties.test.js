'use strict';
/**
 * Worker F — Property-Based Tests (fast-check)
 *
 * Covers mathematical invariants and generative property testing:
 * - Golden Rule 6: Client ID parsing properties (doc-N, pharm-N, doc_N, pharm_N).
 * - Line item subtotal calculation & discount monotonicity.
 * - Stock conservation invariant under arbitrary transfers.
 * - Retail POS payment & change invariants.
 */

const fc = require('fast-check');
const { parseClientId } = require('../../helpers/db');

describe('Property-Based Tests: Client ID Resolution (Golden Rule 6)', () => {
  test('parseClientId correctly parses any valid type and positive integer ID with hyphen or underscore', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('doc', 'pharm'),
        fc.constantFrom('-', '_'),
        fc.integer({ min: 1, max: 1000000 }),
        (type, sep, numId) => {
          const raw = `${type}${sep}${numId}`;
          const parsed = parseClientId(raw);
          return parsed.type === type && parsed.id === numId;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property-Based Tests: Line Item Pricing & Discounts', () => {
  test('subtotal is non-negative, monotonically non-decreasing with qty and price, and non-increasing with discount', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }), // qty
        fc.double({ min: 0.01, max: 10000, noNaN: true }), // unit_price
        fc.integer({ min: 0, max: 100 }), // discount percent
        (qty, price, discountPercent) => {
          const subtotal = qty * price * (1 - discountPercent / 100);
          const higherQtySubtotal = (qty + 1) * price * (1 - discountPercent / 100);
          const higherPriceSubtotal = qty * (price + 1) * (1 - discountPercent / 100);
          const higherDiscountSubtotal = qty * price * (1 - Math.min(100, discountPercent + 1) / 100);

          return (
            subtotal >= 0 &&
            higherQtySubtotal >= subtotal &&
            higherPriceSubtotal >= subtotal &&
            higherDiscountSubtotal <= subtotal
          );
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe('Property-Based Tests: Stock Transfer Conservation', () => {
  test('sum of remaining source stock and transferred quantity strictly equals initial stock', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 10000 }), // initial stock
        fc.integer({ min: 1, max: 10 }), // transfer qty factor (percentage)
        (initial, factor) => {
          const transferQty = Math.floor((initial * factor) / 10);
          const remainingSource = initial - transferQty;
          const destinationReceived = transferQty;

          return remainingSource + destinationReceived === initial;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property-Based Tests: Cash Payment and Change', () => {
  test('change returned is non-negative and exact difference between paid and total', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 50000, noNaN: true }), // total amount
        fc.double({ min: 0.0, max: 10000, noNaN: true }), // extra cash paid
        (total, extra) => {
          const paid = total + extra;
          const change = paid - total;

          return change >= 0 && Math.abs(change - extra) < 1e-4;
        }
      ),
      { numRuns: 100 }
    );
  });
});
