USE alquods_db;

CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT DEFAULT NULL COMMENT 'References doctors(id)',
    pharmacy_id INT DEFAULT NULL COMMENT 'References pharmacies(id)',
    amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(50) DEFAULT 'Cash',
    reference_no VARCHAR(100) DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES doctors(id) ON DELETE SET NULL,
    FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id) ON DELETE SET NULL
);
