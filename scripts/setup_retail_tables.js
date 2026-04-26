const pool = require('../db');

async function setupTables() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS retail_shifts (
                id INT PRIMARY KEY AUTO_INCREMENT,
                opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                closed_at TIMESTAMP NULL,
                status ENUM('OPEN', 'CLOSED') DEFAULT 'OPEN'
            );
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS retail_sales (
                id INT PRIMARY KEY AUTO_INCREMENT,
                shift_id INT NOT NULL,
                total_amount DECIMAL(10,2) DEFAULT 0.00,
                profit_amount DECIMAL(10,2) DEFAULT 0.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (shift_id) REFERENCES retail_shifts(id)
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS retail_sale_items (
                id INT PRIMARY KEY AUTO_INCREMENT,
                sale_id INT NOT NULL,
                product_id INT NOT NULL,
                qty INT NOT NULL,
                cost_price DECIMAL(10,2) NOT NULL,
                selling_price DECIMAL(10,2) NOT NULL,
                profit_amount DECIMAL(10,2) NOT NULL,
                FOREIGN KEY (sale_id) REFERENCES retail_sales(id),
                FOREIGN KEY (product_id) REFERENCES products(id)
            );
        `);
        console.log('Tables created successfully!');
    } catch (e) {
        console.error(e);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

setupTables();
