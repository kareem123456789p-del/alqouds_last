const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'medical_inventory',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool.promise();

// اختبار الاتصال فور تشغيل السيرفر
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ فشل الاتصال بقاعدة البيانات.');
        console.error('Exact Error Code:', err.code);
        console.error('Error Message:', err.message);
        if (err.code === 'ECONNREFUSED') {
            console.error('💡 التلميح: تأكد من أن سيرفر MySQL/XAMPP يعمل على المنفذ الصحيح وكلمات المرور صحيحة.');
        }
    } else {
        console.log('✅ تم الاتصال بقاعدة البيانات (Pool) بنجاح!');
        connection.release(); // قفل القناة بعد الاختبار
    }
});