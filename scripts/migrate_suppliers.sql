-- ============================================================
-- Migration: Ensure local_suppliers table exists with city_area
-- ============================================================
USE alquods_db;

CREATE TABLE IF NOT EXISTS local_suppliers (
    id               INT          PRIMARY KEY AUTO_INCREMENT,
    supplier_code    VARCHAR(20)  NOT NULL UNIQUE,
    company_name     VARCHAR(150) NOT NULL,
    contact_person   VARCHAR(100) NOT NULL,
    phone            VARCHAR(30)  NOT NULL,
    city_area        VARCHAR(100) NOT NULL,
    notes            TEXT,
    created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Add city_area if the table existed before without it
ALTER TABLE local_suppliers
    ADD COLUMN IF NOT EXISTS city_area   VARCHAR(100) NOT NULL DEFAULT '' AFTER phone,
    ADD COLUMN IF NOT EXISTS created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Seed a few sample rows if the table is empty (optional demo data)
INSERT IGNORE INTO local_suppliers (supplier_code, company_name, contact_person, phone, city_area, notes)
SELECT 'LOC-0001','Al-Amal Medical Supplies','Ahmed Youssef','+20 100 123 4567','Cairo, Nasr City','Main consumables supplier'
WHERE NOT EXISTS (SELECT 1 FROM local_suppliers LIMIT 1);

SELECT 'Migration complete' AS status;
