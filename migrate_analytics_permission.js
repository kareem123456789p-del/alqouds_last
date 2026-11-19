/**
 * Migration: Seed 'can_manage_analytics' permission into the permissions table.
 * Category: Analytics
 * Description: عرض وإدارة التقارير والتحليلات (Analytics Access)
 */
const db = require('./db');

(async () => {
    try {
        await db.query(
            `INSERT INTO permissions (key, description, category)
             VALUES ($1, $2, $3)
             ON CONFLICT (key) DO NOTHING`,
            ['can_manage_analytics', 'عرض وإدارة التقارير والتحليلات (Analytics Access)', 'Analytics']
        );
        const [rows] = await db.query(`SELECT * FROM permissions WHERE key = $1`, ['can_manage_analytics']);
        console.log('✅ Permission seeded:', rows[0]);
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration error:', err);
        process.exit(1);
    }
})();
