const pool = require('../db');

async function migrate() {
    try {
        console.log('🚀 Adding base_salary to staff table...');
        await pool.execute(`
            ALTER TABLE staff 
            ADD COLUMN base_salary DECIMAL(10,2) DEFAULT 0.00 AFTER status
        `);
        console.log('✅ base_salary column added');
        process.exit(0);
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME' || err.message.includes('Duplicate column')) {
            console.log('✅ Column already exists');
            process.exit(0);
        }
        console.error('❌ Failed:', err.message);
        process.exit(1);
    }
}
migrate();
