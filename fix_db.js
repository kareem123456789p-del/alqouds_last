const db = require('./db');

async function fixDb() {
    try {
        console.log('Fixing branches and admin user...');

        // 1. Fix Branches (ID 1 = القدس 1, ID 2 = القدس 2)
        await db.execute(`
            INSERT INTO branches (id, name, is_active) 
            VALUES (1, 'القدس 1', true), (2, 'القدس 2', true)
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
        `);

        // Wait, branches PK might not be set to ON CONFLICT id because it's SERIAL.
        // Let's do an UPDATE or INSERT.
        await db.execute(`UPDATE branches SET name = 'القدس 1' WHERE id = 1`);
        await db.execute(`UPDATE branches SET name = 'القدس 2' WHERE id = 2`);
        
        const [b] = await db.query('SELECT count(*) as cnt FROM branches WHERE id = 2');
        if (b[0].cnt == 0) {
            await db.execute(`INSERT INTO branches (id, name, is_active) VALUES (2, 'القدس 2', true)`);
        }

        // 2. Set Admin
        await db.execute(`
            UPDATE staff 
            SET role = 'ADMIN', branch_id = 1 
            WHERE registration_number = '1101'
        `);

        console.log('DB fixed.');
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
fixDb();
