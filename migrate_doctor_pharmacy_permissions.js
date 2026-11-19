const db = require('./db');

async function migrate() {
    console.log('Starting Doctor & Pharmacy permissions migration...');
    try {
        const perms = [
            ['CREATE_DOCTOR', 'إضافة طبيب جديد', 'Doctors'],
            ['EDIT_DOCTOR', 'تعديل بيانات طبيب', 'Doctors'],
            ['DELETE_DOCTOR', 'حذف طبيب', 'Doctors'],
            ['CREATE_PHARMACY', 'إضافة صيدلية جديدة', 'Pharmacies'],
            ['EDIT_PHARMACY', 'تعديل بيانات صيدلية', 'Pharmacies'],
            ['DELETE_PHARMACY', 'حذف صيدلية', 'Pharmacies']
        ];

        for (const [key, description, category] of perms) {
            await db.query(`
                INSERT INTO permissions (key, description, category)
                VALUES ($1, $2, $3)
                ON CONFLICT (key) DO NOTHING
            `, [key, description, category]);
            console.log(`  ✅ ${key}`);
        }

        console.log('\n✅ All Doctor & Pharmacy permissions seeded successfully.');
    } catch (err) {
        console.error('Error inserting permissions:', err);
    }
    process.exit(0);
}

migrate();
