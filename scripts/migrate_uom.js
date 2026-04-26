const pool = require('../db');

async function migrate_uom() {
    try {
        console.log('Starting UoM migration...');

        // 1. Create uom table
        console.log('Creating uom table...');
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS uom (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(50) NOT NULL UNIQUE
            )
        `);

        // Insert default UoMs
        const defaultUoMs = ['Piece', 'Box', 'Carton', 'Strip', 'Pack', 'Bottle'];
        for (const uom of defaultUoMs) {
            try {
                await pool.execute('INSERT IGNORE INTO uom (name) VALUES (?)', [uom]);
            } catch (err) {
                // Ignore unique constraint errors
            }
        }
        console.log('UoM table created and populated.');

        // 2. Add columns to products table
        console.log('Adding UoM columns to products table...');
        
        const addColumn = async (colDef) => {
            try {
                await pool.execute(`ALTER TABLE products ADD COLUMN ${colDef}`);
            } catch (err) {
                if (err.code !== 'ER_DUP_FIELDNAME') {
                    console.error(`Error adding column ${colDef}:`, err.message);
                } else {
                    console.log(`Column ${colDef} already exists.`);
                }
            }
        };

        await addColumn('base_uom_id INT NULL');
        await addColumn('bulk_uom_id INT NULL');
        await addColumn('conversion_factor INT DEFAULT 1');

        res = await pool.execute('SELECT id FROM uom WHERE name = "Piece"');
        let pieceId = res[0][0]?.id || 1;

        console.log('Setting default base_uom_id to Piece for existing products...');
        await pool.execute('UPDATE products SET base_uom_id = ? WHERE base_uom_id IS NULL', [pieceId]);

        // Add foreign keys
        const addFK = async (fkName, colName) => {
             try {
                 await pool.execute(`ALTER TABLE products ADD CONSTRAINT ${fkName} FOREIGN KEY (${colName}) REFERENCES uom(id) ON DELETE SET NULL`);
             } catch (err) {
                 if (err.code !== 'ER_DUP_KEY' && err.code !== 'ER_FK_DUP_NAME' && err.code !== 'ER_CANT_DROP_FIELD_OR_KEY') {
                     console.error(`Error adding FK ${fkName}:`, err.message);
                 } else {
                     console.log(`FK ${fkName} already exists.`);
                 }
             }
        };

        await addFK('fk_product_base_uom', 'base_uom_id');
        await addFK('fk_product_bulk_uom', 'bulk_uom_id');

        console.log('Migration completed successfully.');
    } catch (e) {
        console.error("Critical Migration Error:", e);
    } finally {
        process.exit();
    }
}

migrate_uom();
