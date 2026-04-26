const mysql = require('mysql2/promise');

async function check() {
    const db = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'alquods_db'
    });

    const [tables] = await db.query('SHOW TABLES');

    const fs = require('fs');
    let output = { tables: [] };

    for (const row of tables) {
        const tableName = Object.values(row)[0];
        const [columns] = await db.query(`DESCRIBE ${tableName}`);
        output.tables.push({ name: tableName, columns: columns.map(c => ({ field: c.Field, type: c.Type })) });
    }

    fs.writeFileSync('db_schema.json', JSON.stringify(output, null, 2));

    await db.end();
}

check().catch(console.error);
