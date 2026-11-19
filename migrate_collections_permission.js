const db = require('./db');

async function migrate() {
    console.log('Starting Collections permissions migration...');
    try {
        const perms = [
            ['can_manage_collections', 'إدارة وتحصيل المديونيات (Collections Access)', 'Collections']
        ];

        for (const [key, description, category] of perms) {
            await db.query(`
                INSERT INTO permissions (key, description, category)
                VALUES ($1, $2, $3)
                ON CONFLICT (key) DO NOTHING
            `, [key, description, category]);
            console.log(`  ✅ ${key}`);
        }

        console.log('\n✅ Collections permission seeded successfully.');
    } catch (err) {
        console.error('Error inserting permissions:', err);
    }
    process.exit(0);
}

migrate();
