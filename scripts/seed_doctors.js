const db = require('../config/db');

async function seed() {
    try {
        console.log("Creating doctors table...");
        await db.query(`
            CREATE TABLE IF NOT EXISTS doctors (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                specialty VARCHAR(100) NOT NULL,
                phone VARCHAR(50),
                email VARCHAR(255),
                license_number VARCHAR(100),
                status ENUM('active', 'away') DEFAULT 'active',
                location VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Doctors table created/verified.");

        console.log("Inserting doctors data...");
        await db.query(`
            INSERT INTO doctors (id, name, specialty, phone, status, location) VALUES 
            (1, 'د. أحمد ياسين', 'جراحة عامة', '+970 599-123-456', 'active', 'الجناح الشرقي'),
            (2, 'د. سارة خليل', 'طب أطفال', '+970 598-765-432', 'active', 'الجناح الغربي'),
            (3, 'د. عمر فاروق', 'طب أسنان', '+970 597-111-222', 'away', 'العيادات الخارجية'),
            (4, 'د. ليلى حسن', 'قلب وأوعية', '+970 595-444-555', 'active', 'مبنى القلب'),
            (5, 'د. رامي منصور', 'عظام', '+970 592-998-877', 'active', 'الجناح الشرقي'),
            (6, 'د. سامر عودة', 'أشعة', '+970 591-222-333', 'away', 'قسم الأشعة')
            ON DUPLICATE KEY UPDATE name=name;
        `);
        console.log("Doctors data inserted successfully.");
        process.exit(0);
    } catch (err) {
        console.error("Error seeding doctors:", err);
        process.exit(1);
    }
}

seed();
