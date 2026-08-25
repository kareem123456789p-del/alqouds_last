-- =============================================================
-- ElQuodas Medical Inventory System — PostgreSQL Setup
-- Database  : alquods_db
-- =============================================================

-- Disable notices for dropping tables
SET client_min_messages = warning;

-- ──────────────────────────────────────────────────────────────
-- PASS 0 — Drop all tables (safe re-run)
-- ──────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS retail_sale_items CASCADE;
DROP TABLE IF EXISTS retail_sales CASCADE;
DROP TABLE IF EXISTS retail_shifts CASCADE;
DROP TABLE IF EXISTS supplier_transactions CASCADE;
DROP TABLE IF EXISTS import_logs CASCADE;
DROP TABLE IF EXISTS client_transactions CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS warehouse_inventory CASCADE;
DROP TABLE IF EXISTS employee_withdrawals CASCADE;
DROP TABLE IF EXISTS local_suppliers CASCADE;
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS pharmacies CASCADE;
DROP TABLE IF EXISTS doctors CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS warehouses CASCADE;
DROP TABLE IF EXISTS uom CASCADE;
DROP TABLE IF EXISTS transfer_logs CASCADE;

-- ══════════════════════════════════════════════════════════════
-- PASS 1 — Create all tables
-- ══════════════════════════════════════════════════════════════

CREATE TABLE uom (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE warehouses (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    location   VARCHAR(255)          DEFAULT NULL,
    capacity   INT          NOT NULL DEFAULT 10000,
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE doctors (
    id             SERIAL PRIMARY KEY,
    name           VARCHAR(255)  NOT NULL,
    specialty      VARCHAR(100)           DEFAULT NULL,
    phone          VARCHAR(50)            DEFAULT NULL,
    email          VARCHAR(255)           DEFAULT NULL,
    license_number VARCHAR(100)           DEFAULT NULL,
    status         VARCHAR(50)            DEFAULT 'active' CHECK (status IN ('active', 'away')),
    location       VARCHAR(255)           DEFAULT NULL,
    credit_limit   DECIMAL(10,2)          DEFAULT 60000.00,
    total_debt     DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pharmacies (
    id             SERIAL PRIMARY KEY,
    name           VARCHAR(255)  NOT NULL,
    license_number VARCHAR(100)           DEFAULT NULL,
    contact_person VARCHAR(100)           DEFAULT NULL,
    area           VARCHAR(100)           DEFAULT NULL,
    phone          VARCHAR(50)            DEFAULT NULL,
    email          VARCHAR(255)           DEFAULT NULL,
    status         VARCHAR(50)            DEFAULT 'active' CHECK (status IN ('active', 'pending', 'suspended')),
    credit_limit   DECIMAL(12,2)          DEFAULT 20000.00,
    total_debt     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE staff (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255)  NOT NULL,
    role        VARCHAR(100)  NOT NULL,
    phone       VARCHAR(50)            DEFAULT NULL,
    email       VARCHAR(255)           DEFAULT NULL,
    status      VARCHAR(50)            DEFAULT 'active' CHECK (status IN ('active', 'leave')),
    base_salary DECIMAL(10,2)          DEFAULT 0.00,
    created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE local_suppliers (
    id             SERIAL PRIMARY KEY,
    supplier_code  VARCHAR(20)           DEFAULT NULL,
    company_name   VARCHAR(150) NOT NULL,
    contact_person VARCHAR(100)          DEFAULT NULL,
    phone          VARCHAR(30)           DEFAULT NULL,
    city_area      VARCHAR(100)          DEFAULT NULL,
    notes          TEXT                  DEFAULT NULL,
    created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    id                SERIAL PRIMARY KEY,
    name              VARCHAR(255)  NOT NULL,
    sku               VARCHAR(50)            DEFAULT NULL,
    category          VARCHAR(100)           DEFAULT NULL,
    manufacturer      VARCHAR(100)           DEFAULT NULL,
    quantity          INT           NOT NULL DEFAULT 0,
    price             DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    purchase_price    DECIMAL(10,2)          DEFAULT 0.00,
    expiry_date       DATE                   DEFAULT NULL,
    image_url         VARCHAR(255)           DEFAULT NULL,
    base_uom_id       INT                    DEFAULT NULL REFERENCES uom(id) ON DELETE SET NULL,
    bulk_uom_id       INT                    DEFAULT NULL REFERENCES uom(id) ON DELETE SET NULL,
    conversion_factor DECIMAL(10,4)          DEFAULT 1.0000,
    is_deleted        SMALLINT      NOT NULL DEFAULT 0,
    is_active         SMALLINT      NOT NULL DEFAULT 1,
    created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE warehouse_inventory (
    id                     SERIAL PRIMARY KEY,
    warehouse_id           INT          NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    product_id             INT          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    batch_number           VARCHAR(100)          DEFAULT NULL,
    expiry_date            DATE                  DEFAULT NULL,
    current_stock          INT          NOT NULL DEFAULT 0,
    qty_threshold          INT          NOT NULL DEFAULT 20,
    expiry_month_threshold INT          NOT NULL DEFAULT 3,
    created_at             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    unit_price             DECIMAL(10,2)         DEFAULT 0.00
);

CREATE TABLE import_logs (
    id            SERIAL PRIMARY KEY,
    product_id    INT                    DEFAULT NULL REFERENCES products(id) ON DELETE SET NULL,
    warehouse_id  INT                    DEFAULT NULL REFERENCES warehouses(id) ON DELETE SET NULL,
    supplier_id   INT                    DEFAULT NULL REFERENCES local_suppliers(id) ON DELETE SET NULL,
    quantity      INT           NOT NULL DEFAULT 0,
    unit_price    DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    returned_qty  INT                    DEFAULT 0,
    return_reason VARCHAR(255)           DEFAULT NULL,
    status        VARCHAR(50)            DEFAULT 'Active',
    shipment_id   VARCHAR(100)           DEFAULT NULL,
    invoice_image VARCHAR(255)           DEFAULT NULL,
    created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    id                SERIAL PRIMARY KEY,
    order_number      VARCHAR(50)            DEFAULT NULL,
    client_id         INT                    DEFAULT NULL REFERENCES doctors(id) ON DELETE SET NULL,
    pharmacy_id       INT                    DEFAULT NULL REFERENCES pharmacies(id) ON DELETE SET NULL,
    warehouse_id      INT                    DEFAULT NULL REFERENCES warehouses(id) ON DELETE SET NULL,
    staff_id          INT                    DEFAULT NULL,
    expected_delivery DATE                   DEFAULT NULL,
    total_amount      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    status            VARCHAR(50)   NOT NULL DEFAULT 'Pending',
    created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    id            SERIAL PRIMARY KEY,
    order_id      INT           NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id    INT           NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id  INT                    DEFAULT NULL REFERENCES warehouses(id) ON DELETE SET NULL,
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
    subtotal      DECIMAL(12,2) NOT NULL DEFAULT 0.00
);

CREATE TABLE client_transactions (
    id           SERIAL PRIMARY KEY,
    client_id    INT                    DEFAULT NULL REFERENCES doctors(id) ON DELETE SET NULL,
    pharmacy_id  INT                    DEFAULT NULL REFERENCES pharmacies(id) ON DELETE SET NULL,
    type         VARCHAR(50)            DEFAULT NULL,
    amount       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    reference_id INT                    DEFAULT NULL,
    date         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE supplier_transactions (
    id               SERIAL PRIMARY KEY,
    supplier_id      INT                    DEFAULT NULL REFERENCES local_suppliers(id) ON DELETE SET NULL,
    import_log_id    INT                    DEFAULT NULL REFERENCES import_logs(id) ON DELETE SET NULL,
    total_amount     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    transaction_type VARCHAR(50)            DEFAULT NULL,
    created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE employee_withdrawals (
    id         SERIAL PRIMARY KEY,
    staff_id   INT           NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    amount     DECIMAL(10,2) NOT NULL,
    reason     VARCHAR(255)  NOT NULL,
    category   VARCHAR(50)            DEFAULT 'Personal',
    created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE transfer_logs (
    id SERIAL PRIMARY KEY,
    from_warehouse_id INT REFERENCES warehouses(id) ON DELETE SET NULL,
    to_warehouse_id INT REFERENCES warehouses(id) ON DELETE SET NULL,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INT NOT NULL,
    transferred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE retail_shifts (
    id SERIAL PRIMARY KEY,
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
    closed_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE retail_sales (
    id SERIAL PRIMARY KEY,
    shift_id INT NOT NULL REFERENCES retail_shifts(id) ON DELETE CASCADE,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    profit_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE retail_sale_items (
    id SERIAL PRIMARY KEY,
    sale_id INT NOT NULL REFERENCES retail_sales(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    qty INT NOT NULL,
    cost_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    selling_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    profit_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00
);

CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    client_id INT DEFAULT NULL REFERENCES doctors(id) ON DELETE SET NULL,
    pharmacy_id INT DEFAULT NULL REFERENCES pharmacies(id) ON DELETE SET NULL,
    amount DECIMAL(12,2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'Cash',
    reference_no VARCHAR(100) DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ══════════════════════════════════════════════════════════════
-- PASS 2 — Seed Data
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
SET quantity = wi.total
FROM (
    SELECT product_id, SUM(current_stock) AS total
    FROM warehouse_inventory
    GROUP BY product_id
) wi WHERE p.id = wi.product_id;

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
