'use strict';
/**
 * Deterministic fixtures for the Al-Quds QA suite.
 *
 * Design goals
 *  - Two branches, every role in both branches, a global ADMIN and a "SUPER ADMIN".
 *  - Products cover: bulk UOM conversion, zero purchase_price, multi-batch FEFO
 *    (expired / near-expiry / far), and cross-branch stock.
 *  - Doctors and pharmacies include clients exactly at their credit limit and
 *    0.01 below it, so the boundary can be tested without arithmetic drift.
 *  - Client debt always has a matching client_transactions row so the ledger
 *    invariant (total_debt === SUM(client_transactions.amount)) holds from t0.
 */

const bcrypt = require('bcrypt');

const PASSWORD = process.env.TEST_USER_PASSWORD || 'Passw0rd!';
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4);

const BRANCHES = [
  { id: 1, name: 'مركز القدس 1 للمستلزمات والاجهزة الطبية', address: 'اسوان - النفق - عمارة الدكتور عبد الحميد', phone: '01114459296 - 01152950806' },
  { id: 2, name: 'مركز القدس 2 للمستلزمات والأجهزة الطبية', address: 'اسوان - السيل - شارع المشرحة بجوار مستشفى اسوان الجامعي', phone: '01155675246 - 01221884709' },
];

const PERMISSIONS = [
  ['MANAGE_WAREHOUSES_ADD', 'Warehouses'],
  ['MANAGE_WAREHOUSES_EDIT', 'Warehouses'],
  ['MANAGE_WAREHOUSES_DELETE', 'Warehouses'],
  ['DOWNLOAD_INVENTORY_AUDIT', 'Warehouses'],
  ['PRINT_OFFICIAL_DECLARATION', 'Warehouses'],
  ['VIEW_STOCK_QUANTITY_AND_PRICES', 'Inventory'],
  ['VIEW_INVENTORY_CARD', 'Inventory'],
  ['inventory_edit', 'Inventory'],
  ['stock_transfer_approve', 'Transfers'],
  ['pos_access', 'POS'],
  ['CREATE_DOCTOR', 'Doctors'],
  ['EDIT_DOCTOR', 'Doctors'],
  ['DELETE_DOCTOR', 'Doctors'],
  ['CREATE_PHARMACY', 'Pharmacies'],
  ['EDIT_PHARMACY', 'Pharmacies'],
  ['DELETE_PHARMACY', 'Pharmacies'],
  ['can_manage_collections', 'Financials'],
  ['expenses_manage', 'Financials'],
  ['can_manage_analytics', 'Analytics'],
  ['reports_view', 'Analytics'],
  ['system_settings', 'Administration'],
];

const WAREHOUSE_PERMS = ['MANAGE_WAREHOUSES_ADD', 'MANAGE_WAREHOUSES_EDIT', 'MANAGE_WAREHOUSES_DELETE'];
const CRM_PERMS = ['CREATE_DOCTOR', 'EDIT_DOCTOR', 'DELETE_DOCTOR', 'CREATE_PHARMACY', 'EDIT_PHARMACY', 'DELETE_PHARMACY'];

/** role → { reg, branch, role, perms } */
const STAFF = [
  { id: 1, reg: 'admin', branch: 1, role: 'ADMIN', name: 'Global Admin', perms: [] },
  { id: 2, reg: 'bm1', branch: 1, role: 'BRANCH_MANAGER', name: 'Branch One Manager', perms: [] },
  { id: 3, reg: 'dm1', branch: 1, role: 'DEPUTY_MANAGER', name: 'Branch One Deputy', perms: [] },
  { id: 4, reg: 'am1', branch: 1, role: 'ASSISTANT_MANAGER', name: 'Branch One Assistant', perms: [] },
  { id: 5, reg: 'wm1', branch: 1, role: 'WAREHOUSE_MANAGER', name: 'Branch One Warehouse', perms: [] },
  { id: 6, reg: 'emp1', branch: 1, role: 'EMPLOYEE', name: 'Branch One Employee', perms: [] },
  { id: 7, reg: 'coll1', branch: 1, role: 'EMPLOYEE', name: 'Branch One Collector', perms: ['can_manage_collections'] },
  { id: 8, reg: 'ana1', branch: 1, role: 'EMPLOYEE', name: 'Branch One Analyst', perms: ['can_manage_analytics'] },
  { id: 9, reg: 'crm1', branch: 1, role: 'EMPLOYEE', name: 'Branch One CRM', perms: CRM_PERMS },
  { id: 10, reg: 'wh1', branch: 1, role: 'EMPLOYEE', name: 'Branch One Warehouse Admin', perms: WAREHOUSE_PERMS },
  { id: 11, reg: 'pos1', branch: 1, role: 'EMPLOYEE', name: 'Branch One Cashier', perms: ['pos_access'] },
  { id: 12, reg: 'bm2', branch: 2, role: 'BRANCH_MANAGER', name: 'Branch Two Manager', perms: [] },
  { id: 13, reg: 'emp2', branch: 2, role: 'EMPLOYEE', name: 'Branch Two Employee', perms: [] },
  { id: 14, reg: 'coll2', branch: 2, role: 'EMPLOYEE', name: 'Branch Two Collector', perms: ['can_manage_collections'] },
  { id: 15, reg: 'ana2', branch: 2, role: 'EMPLOYEE', name: 'Branch Two Analyst', perms: ['can_manage_analytics'] },
  { id: 16, reg: 'crm2', branch: 2, role: 'EMPLOYEE', name: 'Branch Two CRM', perms: CRM_PERMS },
  { id: 17, reg: 'wh2', branch: 2, role: 'EMPLOYEE', name: 'Branch Two Warehouse Admin', perms: WAREHOUSE_PERMS },
  { id: 18, reg: 'pos2', branch: 2, role: 'EMPLOYEE', name: 'Branch Two Cashier', perms: ['pos_access'] },
  { id: 19, reg: 'superadmin', branch: 1, role: 'SUPER ADMIN', name: 'Super Admin', perms: [] },
  { id: 20, reg: 'salary1', branch: 1, role: 'EMPLOYEE', name: 'Salaried Staff', perms: [], base_salary: 10000 },
];

const UOMS = [
  { id: 1, name: 'Tablet' },
  { id: 2, name: 'Box' },
  { id: 3, name: 'Piece' },
  { id: 4, name: 'Bottle' },
  { id: 5, name: 'Capsule' },
  { id: 6, name: 'Vial' },
  { id: 7, name: 'Strip' },
];

const PRODUCTS = [
  { id: 1, name: 'Paracetamol 500mg', sku: 'SKU-PARA', category: 'Analgesic', manufacturer: 'GenericCo', price: 5.00, purchase: 2.00, base: 1, bulk: 2, factor: 100, qty: 65 },
  { id: 2, name: 'Amoxicillin 250mg', sku: 'SKU-AMOX', category: 'Antibiotic', manufacturer: 'PharmaCo', price: 12.50, purchase: 7.00, base: 5, bulk: 2, factor: 24, qty: 50 },
  { id: 3, name: 'Insulin Glargine', sku: 'SKU-INSU', category: 'Diabetes', manufacturer: 'BioLabs', price: 150.00, purchase: 100.00, base: 6, bulk: null, factor: 1, qty: 8 },
  { id: 4, name: 'Surgical Gloves (Box)', sku: 'SKU-GLOV', category: 'Consumables', manufacturer: 'MedSupply', price: 80.00, purchase: 50.00, base: 3, bulk: 2, factor: 100, qty: 500 },
  { id: 5, name: 'Syringe 5ml', sku: 'SKU-SYR', category: 'Consumables', manufacturer: 'MedSupply', price: 3.00, purchase: 0, base: 3, bulk: null, factor: 1, qty: 30 },
  { id: 6, name: 'Normal Saline 0.9%', sku: 'SKU-SAL', category: 'IV Fluids', manufacturer: 'NilePharma', price: 25.00, purchase: 15.00, base: 4, bulk: null, factor: 1, qty: 16 },
  { id: 7, name: 'Face Mask', sku: 'SKU-MASK', category: 'Consumables', manufacturer: 'MedSupply', price: 2.00, purchase: 1.00, base: 3, bulk: 2, factor: 50, qty: 120 },
  { id: 8, name: 'Thermometer Digital', sku: 'SKU-THERM', category: 'Devices', manufacturer: 'DeviceWorks', price: 200.00, purchase: 120.00, base: 3, bulk: null, factor: 1, qty: 12 },
  { id: 9, name: 'Vitamin C 1000mg', sku: 'SKU-VITC', category: 'Supplements', manufacturer: 'HealthPlus', price: 30.00, purchase: 18.00, base: 1, bulk: 2, factor: 30, qty: 45 },
  { id: 10, name: 'Cotton Roll', sku: 'SKU-COT', category: 'Consumables', manufacturer: 'MedSupply', price: 15.00, purchase: 8.00, base: 3, bulk: null, factor: 1, qty: 25 },
  { id: 11, name: 'Alcohol 70%', sku: 'SKU-ALC', category: 'Disinfectant', manufacturer: 'CairoChem', price: 20.00, purchase: 11.00, base: 4, bulk: null, factor: 1, qty: 18 },
  { id: 12, name: 'Adhesive Bandage', sku: 'SKU-BAND', category: 'Consumables', manufacturer: 'MedSupply', price: 1.50, purchase: 0.75, base: 3, bulk: 2, factor: 20, qty: 60 },
];

const WAREHOUSES = [
  { id: 1, branch: 1, name: 'المخزن الرئيسي - فرع 1', location: 'الدور الأرضي', capacity: 10000 },
  { id: 2, branch: 1, name: 'مخزن الأدوية الباردة - فرع 1', location: 'غرفة التبريد', capacity: 2000 },
  { id: 3, branch: 2, name: 'المخزن الرئيسي - فرع 2', location: 'الطابق الأول', capacity: 8000 },
];

function isoDate(daysFromToday) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

/** [warehouse, product, batch, expiryOffsetDays, stock, unitPrice] */
const BATCHES = [
  // Branch 1, warehouse 1 — product 1 has expired, near-expiry and far batches for FEFO.
  [1, 1, 'B-P1-EXPIRED', -60, 10, 2.00],
  [1, 1, 'B-P1-NEAR', 20, 20, 2.00],
  [1, 1, 'B-P1-FAR', 400, 30, 2.00],
  [1, 2, 'B-P2-NEAR', 10, 15, 7.00],
  [1, 2, 'B-P2-FAR', 300, 25, 7.00],
  [1, 3, 'B-P3-COLD', 90, 8, 100.00],
  [1, 4, 'B-P4-BULK', 500, 500, 50.00],
  [1, 5, 'B-P5-NOCOST', 200, 30, 0],
  [1, 6, 'B-P6-IV', 45, 12, 15.00],
  [1, 7, 'B-P7-MASK', 600, 100, 1.00],
  [1, 8, 'B-P8-THERM', 800, 10, 120.00],
  [1, 9, 'B-P9-VITC', 120, 45, 18.00],
  [1, 10, 'B-P10-COT', 700, 25, 8.00],
  [1, 11, 'B-P11-ALC', 150, 18, 11.00],
  [1, 12, 'B-P12-BAND', 900, 60, 0.75],
  // Branch 2, warehouse 3 — a small mirror of stock, for isolation tests.
  [3, 1, 'B2-P1', 100, 5, 2.00],
  [3, 2, 'B2-P2', 200, 10, 7.00],
  [3, 6, 'B2-P6', 60, 4, 15.00],
  [3, 7, 'B2-P7', 500, 20, 1.00],
  [3, 8, 'B2-P8', 700, 2, 120.00],
];

const DOCTORS = [
  { id: 1, branch: 1, name: 'Dr. Ahmed Nour', specialty: 'General Practice', phone: '010-1000-0001', license: 'LIC-D-001', limit: 60000, debt: 0 },
  { id: 2, branch: 1, name: 'Dr. Salma Adel', specialty: 'Cardiology', phone: '010-1000-0002', license: 'LIC-D-002', limit: 60000, debt: 59999.99 },
  { id: 3, branch: 1, name: 'Dr. Karim Fathy', specialty: 'Dermatology', phone: '010-1000-0003', license: 'LIC-D-003', limit: 60000, debt: 60000.00 },
  { id: 4, branch: 2, name: 'Dr. Hana Youssef', specialty: 'Pediatrics', phone: '010-1000-0004', license: 'LIC-D-004', limit: 60000, debt: 5000.00 },
];

const PHARMACIES = [
  { id: 1, branch: 1, name: 'Al-Shifa Pharmacy', contact: 'Amr Khalil', area: 'Maadi', phone: '02-1234-5678', license: 'PH-001', limit: 20000, debt: 0 },
  { id: 2, branch: 1, name: 'Dar Al-Dawa', contact: 'Rania Fouad', area: 'Zamalek', phone: '02-8765-4321', license: 'PH-002', limit: 20000, debt: 20000.00 },
  { id: 3, branch: 1, name: 'El-Nour Pharmacy', contact: 'Hassan Ali', area: 'Nasr City', phone: '02-1111-2222', license: 'PH-003', limit: 20000, debt: 19999.99 },
  { id: 4, branch: 2, name: 'Cairo Care Pharmacy', contact: 'Mona Said', area: 'Heliopolis', phone: '02-3333-4444', license: 'PH-004', limit: 20000, debt: 3000.00 },
];

const SUPPLIERS = [
  { id: 1, branch: 1, code: 'LOC-0201', name: 'EgyptPharma Dist.', contact: 'Khaled Nour', phone: '02-2345-6789', city: 'Cairo - Nasr City', balance: 5000.00 },
  { id: 2, branch: 1, code: 'LOC-0202', name: 'CairoChem Trading', contact: 'Mona Samir', phone: '02-3456-7890', city: 'Cairo - Heliopolis', balance: 3000.00 },
  { id: 3, branch: 2, code: 'LOC-0203', name: 'NilePharma Imports', contact: 'Tamer Badawy', phone: '03-5678-9012', city: 'Alexandria', balance: 1000.00 },
];

/**
 * Insert every fixture. Assumes the tables are empty (resetDatabase truncates).
 * @param {import('pg').Client} client
 */
async function seed(client) {
  for (const b of BRANCHES) {
    await client.query(
      'INSERT INTO branches (id, name, address, phone, is_active) VALUES ($1,$2,$3,$4,true)',
      [b.id, b.name, b.address, b.phone]
    );
  }

  for (const [key, category] of PERMISSIONS) {
    await client.query(
      'INSERT INTO permissions (key, description, category, branch_id) VALUES ($1,$2,$3,1) ON CONFLICT (key) DO NOTHING',
      [key, key, category]
    );
  }

  for (const s of STAFF) {
    await client.query(
      `INSERT INTO staff (id, name, role, phone, email, status, base_salary, registration_number, password_hash, branch_id)
       VALUES ($1,$2,$3,$4,$5,'active',$6,$7,$8,$9)`,
      [s.id, s.name, s.role, `010-2000-${String(s.id).padStart(4, '0')}`, `${s.reg}@test.local`,
        s.base_salary || 6000, s.reg, PASSWORD_HASH, s.branch]
    );
    for (const key of s.perms) {
      await client.query(
        'INSERT INTO staff_permissions (staff_id, permission_key) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [s.id, key]
      );
    }
  }

  for (const u of UOMS) {
    await client.query('INSERT INTO uom (id, name) VALUES ($1,$2)', [u.id, u.name]);
  }

  for (const p of PRODUCTS) {
    await client.query(
      `INSERT INTO products
        (id, name, sku, category, manufacturer, quantity, price, purchase_price,
         base_uom_id, bulk_uom_id, conversion_factor, is_active, is_deleted)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,1,0)`,
      [p.id, p.name, p.sku, p.category, p.manufacturer, p.qty, p.price, p.purchase,
        p.base, p.bulk, p.factor]
    );
  }

  for (const w of WAREHOUSES) {
    await client.query(
      'INSERT INTO warehouses (id, name, location, capacity, branch_id) VALUES ($1,$2,$3,$4,$5)',
      [w.id, w.name, w.location, w.capacity, w.branch]
    );
  }

  for (const [warehouseId, productId, batch, offset, stock, price] of BATCHES) {
    const branchId = WAREHOUSES.find(w => w.id === warehouseId).branch;
    await client.query(
      `INSERT INTO warehouse_inventory
        (warehouse_id, product_id, batch_number, expiry_date, current_stock, qty_threshold,
         expiry_month_threshold, unit_price, branch_id)
       VALUES ($1,$2,$3,$4,$5,20,3,$6,$7)`,
      [warehouseId, productId, batch, isoDate(offset), stock, price, branchId]
    );
  }

  for (const d of DOCTORS) {
    await client.query(
      `INSERT INTO doctors (id, name, specialty, phone, email, license_number, status, location, credit_limit, total_debt, branch_id)
       VALUES ($1,$2,$3,$4,$5,$6,'active','Aswan',$7,$8,$9)`,
      [d.id, d.name, d.specialty, d.phone, `${d.license.toLowerCase()}@test.local`, d.license, d.limit, d.debt, d.branch]
    );
    if (d.debt > 0) {
      await client.query(
        `INSERT INTO client_transactions (client_id, type, amount, reference_id, branch_id)
         VALUES ($1,'ORDER',$2,NULL,$3)`,
        [d.id, d.debt, d.branch]
      );
    }
  }

  for (const p of PHARMACIES) {
    await client.query(
      `INSERT INTO pharmacies (id, name, license_number, contact_person, area, phone, email, status, credit_limit, total_debt, branch_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8,$9,$10)`,
      [p.id, p.name, p.license, p.contact, p.area, p.phone, `${p.license.toLowerCase()}@test.local`, p.limit, p.debt, p.branch]
    );
    if (p.debt > 0) {
      await client.query(
        `INSERT INTO client_transactions (pharmacy_id, type, amount, reference_id, branch_id)
         VALUES ($1,'ORDER',$2,NULL,$3)`,
        [p.id, p.debt, p.branch]
      );
    }
  }

  for (const s of SUPPLIERS) {
    await client.query(
      `INSERT INTO local_suppliers (id, supplier_code, company_name, contact_person, phone, city_area, notes, branch_id)
       VALUES ($1,$2,$3,$4,$5,$6,'seeded supplier',$7)`,
      [s.id, s.code, s.name, s.contact, s.phone, s.city, s.branch]
    );
    if (s.balance > 0) {
      await client.query(
        `INSERT INTO supplier_transactions (supplier_id, import_log_id, total_amount, transaction_type, branch_id)
         VALUES ($1,NULL,$2,'IMPORT_CHARGE',$3)`,
        [s.id, s.balance, s.branch]
      );
    }
  }

  // Initial seeded order in branch 1 for lifecycle / details inspection
  await client.query(
    `INSERT INTO orders (id, order_number, client_id, pharmacy_id, warehouse_id, total_amount, status, branch_id, created_by)
     VALUES (1, '#ORD-2026-1001', NULL, 2, 1, 100.00, 'Pending', 1, 1)`
  );
  await client.query(
    `INSERT INTO order_items (order_id, product_id, warehouse_id, qty, base_price, unit_price, subtotal, branch_id)
     VALUES (1, 1, 1, 10, 5.00, 10.00, 100.00, 1)`
  );

  // Keep sequences ahead of the explicit ids we inserted.
  const tables = ['branches', 'staff', 'uom', 'products', 'warehouses', 'doctors', 'pharmacies', 'local_suppliers', 'orders', 'order_items'];
  for (const table of tables) {
    await client.query(
      `SELECT setval(pg_get_serial_sequence('${table}','id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`
    );
  }
}

module.exports = {
  PASSWORD, PASSWORD_HASH, BRANCHES, PERMISSIONS, STAFF, UOMS, PRODUCTS,
  WAREHOUSES, BATCHES, DOCTORS, PHARMACIES, SUPPLIERS, seed, isoDate,
};
