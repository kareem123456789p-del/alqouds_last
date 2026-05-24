const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'medical_inventory',
    port: parseInt(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 30000,
    charset: 'utf8mb4',
    ssl: process.env.DB_HOST && process.env.DB_HOST !== 'localhost'
        ? { rejectUnauthorized: false }
        : undefined
});

const promisePool = pool.promise();
module.exports = promisePool;

// Non-fatal startup connectivity check — logs result but never crashes the process
promisePool.query('SELECT 1')
    .then(() => {
        console.log('✅ تم الاتصال بقاعدة البيانات (Pool) بنجاح!');
    })
    .catch((err) => {
        console.error('⚠️  DB connectivity check failed (server will still start):');
        console.error('   Code:', err.code);
        console.error('   Message:', err.message);
    });