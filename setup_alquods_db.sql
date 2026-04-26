-- =============================================================
-- ElQuodas Medical Inventory System — Full Database Setup
-- Database  : alquods_db   |   Port : 3307
-- MariaDB   : 10.4.x  (XAMPP)
-- Collation : utf8mb4_general_ci  (matches server default)
-- =============================================================

USE alquods_db;

-- Disable checks so we can drop in any order
SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;

-- ──────────────────────────────────────────────────────────────
-- PASS 0 — Drop all tables (safe re-run)
-- ──────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS supplier_transactions;
DROP TABLE IF EXISTS import_logs;
DROP TABLE IF EXISTS client_transactions;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS warehouse_inventory;
DROP TABLE IF EXISTS employee_withdrawals;
DROP TABLE IF EXISTS local_suppliers;
DROP TABLE IF EXISTS staff;
DROP TABLE IF EXISTS pharmacies;
DROP TABLE IF EXISTS doctors;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS warehouses;
DROP TABLE IF EXISTS uom;

-- ══════════════════════════════════════════════════════════════
-- PASS 1 — Create all tables WITHOUT foreign keys
--           (avoids MariaDB 10.4 errno:150 entirely)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE uom (
    id   INT         NOT NULL AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_uom_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE warehouses (
    id         INT          NOT NULL AUTO_INCREMENT,
    name       VARCHAR(100) NOT NULL,
    location   VARCHAR(255)          DEFAULT NULL,
    capacity   INT          NOT NULL DEFAULT 10000,
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE doctors (
    id             INT           NOT NULL AUTO_INCREMENT,
    name           VARCHAR(255)  NOT NULL,
    specialty      VARCHAR(100)           DEFAULT NULL,
    phone          VARCHAR(50)            DEFAULT NULL,
    email          VARCHAR(255)           DEFAULT NULL,
    license_number VARCHAR(100)           DEFAULT NULL,
    status         ENUM('active','away')  DEFAULT 'active',
    location       VARCHAR(255)           DEFAULT NULL,
    credit_limit   DECIMAL(10,2)          DEFAULT 60000.00,
    total_debt     DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE pharmacies (
    id             INT           NOT NULL AUTO_INCREMENT,
    name           VARCHAR(255)  NOT NULL,
    license_number VARCHAR(100)           DEFAULT NULL,
    contact_person VARCHAR(100)           DEFAULT NULL,
    area           VARCHAR(100)           DEFAULT NULL,
    phone          VARCHAR(50)            DEFAULT NULL,
    email          VARCHAR(255)           DEFAULT NULL,
    status         ENUM('active','pending','suspended') DEFAULT 'active',
    credit_limit   DECIMAL(12,2)          DEFAULT 20000.00,
    total_debt     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE staff (
    id          INT           NOT NULL AUTO_INCREMENT,
    name        VARCHAR(255)  NOT NULL,
    role        VARCHAR(100)  NOT NULL,
    phone       VARCHAR(50)            DEFAULT NULL,
    email       VARCHAR(255)           DEFAULT NULL,
    status      ENUM('active','leave') DEFAULT 'active',
    base_salary DECIMAL(10,2)          DEFAULT 0.00,
    created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE local_suppliers (
    id             INT          NOT NULL AUTO_INCREMENT,
    supplier_code  VARCHAR(20)           DEFAULT NULL,
    company_name   VARCHAR(150) NOT NULL,
    contact_person VARCHAR(100)          DEFAULT NULL,
    phone          VARCHAR(30)           DEFAULT NULL,
    city_area      VARCHAR(100)          DEFAULT NULL,
    notes          TEXT                  DEFAULT NULL,
    created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE products (
    id                INT           NOT NULL AUTO_INCREMENT,
    name              VARCHAR(255)  NOT NULL,
    sku               VARCHAR(50)            DEFAULT NULL,
    category          VARCHAR(100)           DEFAULT NULL,
    manufacturer      VARCHAR(100)           DEFAULT NULL,
    quantity          INT           NOT NULL DEFAULT 0,
    price             DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    purchase_price    DECIMAL(10,2)          DEFAULT 0.00,
    expiry_date       DATE                   DEFAULT NULL,
    image_url         VARCHAR(255)           DEFAULT NULL,
    base_uom_id       INT                    DEFAULT NULL,
    bulk_uom_id       INT                    DEFAULT NULL,
    conversion_factor DECIMAL(10,4)          DEFAULT 1.0000,
    is_deleted        TINYINT(1)    NOT NULL DEFAULT 0
                      COMMENT 'Legacy soft-delete flag (0=active, 1=deleted)',
    is_active         TINYINT(1)    NOT NULL DEFAULT 1
                      COMMENT 'Primary soft-delete flag (1=visible, 0=hidden). Inverse of is_deleted.',
    created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE warehouse_inventory (
    id                     INT          NOT NULL AUTO_INCREMENT,
    warehouse_id           INT          NOT NULL,
    product_id             INT          NOT NULL,
    batch_number           VARCHAR(100)          DEFAULT NULL,
    expiry_date            DATE                  DEFAULT NULL,
    current_stock          INT          NOT NULL DEFAULT 0,
    qty_threshold          INT          NOT NULL DEFAULT 20,
    expiry_month_threshold INT          NOT NULL DEFAULT 3,
    created_at             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE import_logs (
    id            INT           NOT NULL AUTO_INCREMENT,
    product_id    INT                    DEFAULT NULL,
    warehouse_id  INT                    DEFAULT NULL,
    supplier_id   INT                    DEFAULT NULL,
    quantity      INT           NOT NULL DEFAULT 0,
    unit_price    DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    returned_qty  INT                    DEFAULT 0,
    return_reason VARCHAR(255)           DEFAULT NULL,
    status        VARCHAR(50)            DEFAULT 'Active',
    created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE orders (
    id                INT           NOT NULL AUTO_INCREMENT,
    order_number      VARCHAR(50)            DEFAULT NULL,
    client_id         INT                    DEFAULT NULL,
    pharmacy_id       INT                    DEFAULT NULL,
    warehouse_id      INT                    DEFAULT NULL,
    staff_id          INT                    DEFAULT NULL,
    expected_delivery DATE                   DEFAULT NULL,
    total_amount      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    status            VARCHAR(50)   NOT NULL DEFAULT 'Pending',
    created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE order_items (
    id            INT           NOT NULL AUTO_INCREMENT,
    order_id      INT           NOT NULL,
    product_id    INT           NOT NULL,
    warehouse_id  INT                    DEFAULT NULL,
    inventory_id  INT                    DEFAULT NULL,
    batch_no      VARCHAR(100)           DEFAULT NULL,
    expiry_date   DATE                   DEFAULT NULL,
    qty           INT           NOT NULL DEFAULT 0,
    returned_qty  INT                    DEFAULT 0,
    return_reason VARCHAR(255)           DEFAULT NULL,
    base_price    DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    unit_price    DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    profit_margin DECIMAL(5,2)           DEFAULT 0.00,
    discount      DECIMAL(10,2)          DEFAULT 0.00,
    tax           DECIMAL(10,2)          DEFAULT 0.00,
    subtotal      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE client_transactions (
    id           INT           NOT NULL AUTO_INCREMENT,
    client_id    INT                    DEFAULT NULL,
    pharmacy_id  INT                    DEFAULT NULL,
    type         VARCHAR(50)            DEFAULT NULL,
    amount       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    reference_id INT                    DEFAULT NULL,
    date         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE supplier_transactions (
    id               INT           NOT NULL AUTO_INCREMENT,
    supplier_id      INT                    DEFAULT NULL,
    import_log_id    INT                    DEFAULT NULL,
    total_amount     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    transaction_type VARCHAR(50)            DEFAULT NULL,
    created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE employee_withdrawals (
    id         INT           NOT NULL AUTO_INCREMENT,
    staff_id   INT           NOT NULL,
    amount     DECIMAL(10,2) NOT NULL,
    reason     VARCHAR(255)  NOT NULL,
    category   VARCHAR(50)            DEFAULT 'Personal',
    created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE transfer_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    from_warehouse_id INT,
    to_warehouse_id INT,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    transferred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ══════════════════════════════════════════════════════════════
-- PASS 2 — Add all foreign key constraints via ALTER TABLE
--           Now that every referenced table exists, no errno:150
-- ══════════════════════════════════════════════════════════════

ALTER TABLE products
    ADD CONSTRAINT fk_prod_base_uom FOREIGN KEY (base_uom_id) REFERENCES uom (id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_prod_bulk_uom FOREIGN KEY (bulk_uom_id) REFERENCES uom (id) ON DELETE SET NULL;

ALTER TABLE warehouse_inventory
    ADD CONSTRAINT fk_wi_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses (id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_wi_product   FOREIGN KEY (product_id)   REFERENCES products (id)   ON DELETE CASCADE;

ALTER TABLE import_logs
    ADD CONSTRAINT fk_il_product   FOREIGN KEY (product_id)   REFERENCES products (id)        ON DELETE SET NULL,
    ADD CONSTRAINT fk_il_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses (id)      ON DELETE SET NULL,
    ADD CONSTRAINT fk_il_supplier  FOREIGN KEY (supplier_id)  REFERENCES local_suppliers (id) ON DELETE SET NULL;

ALTER TABLE transfer_logs
    ADD CONSTRAINT fk_tl_from_wh FOREIGN KEY (from_warehouse_id) REFERENCES warehouses (id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_tl_to_wh   FOREIGN KEY (to_warehouse_id)   REFERENCES warehouses (id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_tl_product FOREIGN KEY (product_id)        REFERENCES products (id)   ON DELETE CASCADE;

ALTER TABLE orders
    ADD CONSTRAINT fk_ord_pharmacy  FOREIGN KEY (pharmacy_id)  REFERENCES pharmacies (id)  ON DELETE SET NULL,
    ADD CONSTRAINT fk_ord_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses (id)  ON DELETE SET NULL,
    ADD CONSTRAINT fk_ord_doctor    FOREIGN KEY (client_id)    REFERENCES doctors (id)     ON DELETE SET NULL;

ALTER TABLE order_items
    ADD CONSTRAINT fk_oi_order     FOREIGN KEY (order_id)     REFERENCES orders (id)    ON DELETE CASCADE,
    ADD CONSTRAINT fk_oi_product   FOREIGN KEY (product_id)   REFERENCES products (id)  ON DELETE CASCADE,
    ADD CONSTRAINT fk_oi_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses (id) ON DELETE SET NULL;

ALTER TABLE client_transactions
    ADD CONSTRAINT fk_ct_pharmacy FOREIGN KEY (pharmacy_id) REFERENCES pharmacies (id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_ct_doctor   FOREIGN KEY (client_id)   REFERENCES doctors (id)   ON DELETE SET NULL;

ALTER TABLE supplier_transactions
    ADD CONSTRAINT fk_st_supplier  FOREIGN KEY (supplier_id)   REFERENCES local_suppliers (id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_st_importlog FOREIGN KEY (import_log_id) REFERENCES import_logs (id)     ON DELETE SET NULL;

ALTER TABLE employee_withdrawals
    ADD CONSTRAINT fk_ew_staff FOREIGN KEY (staff_id) REFERENCES staff (id) ON DELETE CASCADE;

-- Re-enable FK checks
SET FOREIGN_KEY_CHECKS = 1;

-- ══════════════════════════════════════════════════════════════
-- PASS 3 — Seed Data
-- ══════════════════════════════════════════════════════════════

-- Units of Measure
INSERT INTO uom (name) VALUES
    ('Tablet'),
    ('Box'),
    ('Bottle'),
    ('Vial'),
    ('Ampoule'),
    ('Strip'),
    ('Sachet');

-- Warehouses
INSERT INTO warehouses (name, location) VALUES
    ('Main Warehouse',   'Cairo — Zone A'),
    ('Cold Storage',     'Cairo — Zone B (Refrigerated)'),
    ('Branch Warehouse', 'Alexandria');

-- Medical Products (7 samples)
-- base_uom_id=1 (Tablet), bulk_uom_id=2 (Box), Strip=6
INSERT INTO products (name, sku, category, manufacturer, quantity, price, purchase_price, base_uom_id, bulk_uom_id, conversion_factor) VALUES
    ('Amoxicillin 500mg',   'AMX-500', 'Antibiotic',     'EgyptPharma',   0, 12.50,  8.00, 1, 2, 24),
    ('Paracetamol 500mg',   'PCM-500', 'Analgesic',      'CairoChem',     0,  5.00,  2.50, 1, 6, 10),
    ('Omeprazole 20mg',     'OMP-020', 'Gastric',        'MediBridge',    0, 18.00, 11.00, 1, 2, 28),
    ('Metformin 850mg',     'MET-850', 'Diabetes',       'NilePharma',    0, 22.00, 14.50, 1, 2, 30),
    ('Atorvastatin 40mg',   'ATV-040', 'Cardiovascular', 'HealthLine EG', 0, 35.00, 23.00, 1, 2, 28),
    ('Azithromycin 500mg',  'AZI-500', 'Antibiotic',     'EgyptPharma',   0, 45.00, 30.00, 1, 6,  6),
    ('Cetirizine 10mg',     'CTZ-010', 'Antihistamine',  'CairoChem',     0,  8.00,  4.00, 1, 6, 10);

-- Inventory batches in Main Warehouse (id=1)
INSERT INTO warehouse_inventory (warehouse_id, product_id, batch_number, expiry_date, current_stock, qty_threshold, expiry_month_threshold) VALUES
    (1, 1, 'BATCH-AMX-2024A', '2026-08-31',  480, 50, 3),
    (1, 2, 'BATCH-PCM-2024A', '2026-12-31', 1200,100, 3),
    (1, 3, 'BATCH-OMP-2024A', '2026-06-30',  336, 30, 3),
    (1, 4, 'BATCH-MET-2024A', '2026-09-30',  600, 60, 3),
    (1, 5, 'BATCH-ATV-2024A', '2026-07-31',  280, 28, 3),
    (1, 6, 'BATCH-AZI-2024A', '2026-05-31',   72, 10, 2),
    (1, 7, 'BATCH-CTZ-2024A', '2027-03-31',  500, 50, 3);

-- Sync product.quantity with warehouse totals
UPDATE products p
JOIN (
    SELECT product_id, SUM(current_stock) AS total
    FROM warehouse_inventory
    GROUP BY product_id
) wi ON p.id = wi.product_id
SET p.quantity = wi.total;

-- Staff
INSERT INTO staff (name, role, phone, email, status, base_salary) VALUES
    ('Ahmed Hassan',  'Warehouse Manager', '010-0001-0001', 'ahmed@alquodas.com', 'active', 8000.00),
    ('Sara Mahmoud',  'Sales Rep',         '010-0002-0002', 'sara@alquodas.com',  'active', 5500.00),
    ('Omar Farouk',   'Pharmacist',        '010-0003-0003', 'omar@alquodas.com',  'active', 7000.00);

-- Suppliers
INSERT INTO local_suppliers (supplier_code, company_name, contact_person, phone, city_area, notes) VALUES
    ('LOC-0201', 'EgyptPharma Dist.',  'Khaled Nour',  '02-2345-6789', 'Cairo - Nasr City',  'Main generic drug distributor'),
    ('LOC-0202', 'CairoChem Trading', 'Mona Samir',   '02-3456-7890', 'Cairo - Heliopolis', 'OTC and supplements'),
    ('LOC-0203', 'NilePharma Imports','Tamer Badawy', '03-5678-9012', 'Alexandria',         'Imports from EU manufacturers');

-- Doctors
INSERT INTO doctors (name, specialty, phone, license_number, status, location, credit_limit, total_debt) VALUES
    ('Dr. Mohamed Ali',   'General Practice', '010-1111-2222', 'LIC-GP-001', 'active', 'Cairo',      60000.00, 0.00),
    ('Dr. Laila Ibrahim', 'Cardiology',       '010-3333-4444', 'LIC-CD-002', 'active', 'Alexandria', 60000.00, 0.00);

-- Pharmacies
INSERT INTO pharmacies (name, license_number, contact_person, area, phone, status, credit_limit, total_debt) VALUES
    ('Al-Shifa Pharmacy', 'PH-LIC-001', 'Amr Khalil',  'Maadi',   '02-1234-5678', 'active', 20000.00, 0.00),
    ('Dar Al-Dawa',       'PH-LIC-002', 'Rania Fouad', 'Zamalek', '02-8765-4321', 'active', 20000.00, 0.00);

-- ══════════════════════════════════════════════════════════════
-- VERIFICATION — Copy/paste into phpMyAdmin to confirm import
-- ══════════════════════════════════════════════════════════════
SELECT 'uom'                 AS tbl, COUNT(*) AS rows FROM uom
UNION ALL SELECT 'products',           COUNT(*) FROM products
UNION ALL SELECT 'warehouses',         COUNT(*) FROM warehouses
UNION ALL SELECT 'warehouse_inventory',COUNT(*) FROM warehouse_inventory
UNION ALL SELECT 'staff',              COUNT(*) FROM staff
UNION ALL SELECT 'local_suppliers',    COUNT(*) FROM local_suppliers
UNION ALL SELECT 'doctors',            COUNT(*) FROM doctors
UNION ALL SELECT 'pharmacies',         COUNT(*) FROM pharmacies;
