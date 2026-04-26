const mysql = require('mysql2/promise');
require('dotenv').config();

async function initDB() {
  // ⚠️ ركز هنا: غير الرقم 3306 للرقم اللي مكتوب عندك في XAMPP بالظبط
  const TARGET_PORT = process.env.DB_PORT || 3306;

  try {
    console.log(`🚀 Trying to connect to MySQL on port: ${TARGET_PORT}...`);

    const connection = await mysql.createConnection({
      host: '127.0.0.1', // أضمن من localhost
      user: 'root',
      password: '',
      port: TARGET_PORT
    });

    console.log('✅ Connection Established!');

    // 1. إنشاء قاعدة البيانات
    await connection.query(`CREATE DATABASE IF NOT EXISTS alquods_db;`);
    console.log('✅ Database "alquods_db" is ready!');

    await connection.query(`USE alquods_db;`);

    // 2. إنشاء جدول الأدوية
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        quantity INT DEFAULT 0,
        price DECIMAL(10, 2),
        expiry_date DATE DEFAULT NULL
      );`;

    await connection.query(createTableQuery);
    console.log('✅ Tables created successfully!');

    // 3. إضافة بيانات تجريبية
    await connection.query(`INSERT IGNORE INTO products (name, quantity, price) VALUES ('Panadol', 50, 20.00), ('Vitamin C', 100, 15.00);`);
    console.log('✅ Sample data added!');

    await connection.end();
    console.log('🎉 SUCCESS! Everything is ready. Now you can run "node app.js"');

  } catch (err) {
    console.error('❌ Error during setup:');
    console.error('---');
    console.error(`Message: ${err.message}`);
    console.error(`Code: ${err.code}`);
    console.error(`Port used: ${TARGET_PORT}`);
    console.error('---');
    console.log('💡 TIP: Make sure the port number above matches the one in XAMPP (next to MySQL).');
  }
}

initDB();