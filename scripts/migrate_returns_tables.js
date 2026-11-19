const pool = require('../db');

async function migrate() {
    console.log('Running migration for returns tables...');
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS returns (
                id SERIAL PRIMARY KEY,
                return_number VARCHAR(50) UNIQUE,
                order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
                retail_sale_id INTEGER REFERENCES retail_sales(id) ON DELETE SET NULL,
                branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
                client_id INTEGER,
                pharmacy_id INTEGER,
                total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
                total_profit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
                return_reason TEXT,
                created_by INTEGER,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS return_items (
                id SERIAL PRIMARY KEY,
                return_id INTEGER NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
                order_item_id INTEGER,
                retail_sale_item_id INTEGER,
                product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                batch_id INTEGER,
                qty INTEGER NOT NULL CHECK (qty > 0),
                unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
                cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
                total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
                profit_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
                branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_returns_branch ON returns(branch_id);
            CREATE INDEX IF NOT EXISTS idx_returns_created_at ON returns(created_at);
            CREATE INDEX IF NOT EXISTS idx_returns_order ON returns(order_id);
            CREATE INDEX IF NOT EXISTS idx_return_items_product ON return_items(product_id);
            CREATE INDEX IF NOT EXISTS idx_return_items_return_id ON return_items(return_id);

            ALTER TABLE retail_sale_items ADD COLUMN IF NOT EXISTS returned_qty INTEGER DEFAULT 0;
            ALTER TABLE order_items ADD COLUMN IF NOT EXISTS returned_qty INTEGER DEFAULT 0;
        `);
        console.log('✅ Returns tables created / verified successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

migrate();
