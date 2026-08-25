const db = require('./db');
async function getCols() {
  const [wi] = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'warehouse_inventory'`);
  console.log('warehouse_inventory cols:', wi.map(r=>r.column_name));
  
  const [p] = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'products'`);
  console.log('products cols:', p.map(r=>r.column_name));
  
  const [tr] = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_transfers'`);
  console.log('stock_transfers cols:', tr.map(r=>r.column_name));

  process.exit();
}
getCols();
