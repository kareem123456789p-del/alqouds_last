const fs = require('fs');
let code = fs.readFileSync('controllers/orderController.js', 'utf8');

// Replace SELECT * FROM orders WHERE 1=1 (usually in getAll)
// Wait, I need to know what queries are there. Let me fetch the queries first.
console.log('Query matches:');
console.log(code.match(/SELECT \* FROM orders[^`'"]*/g));
console.log(code.match(/INSERT INTO orders[^`'"]*/g));
