const fs = require('fs');
let code = fs.readFileSync('public/js/orders.js', 'utf8');

// ── FIX 2: Inject cost-price fetch into handleProductSelect ──────────────────
const oldHandlerStart = [
    'async function handleProductSelect(productId) {\r\n',
    '    if (!productId) return;\r\n',
    '    const product = products.find(prod => prod.id == productId);\r\n',
    '    console.log(\'Selected Product Object in Orders:\', product);\r\n',
    '    const unitSelect = document.getElementById(\'order-unit\');'
].join('');

const newHandlerStart = [
    'async function handleProductSelect(productId) {\r\n',
    '    if (!productId) return;\r\n',
    '    const product = products.find(prod => prod.id == productId);\r\n',
    '    console.log(\'Selected Product Object in Orders:\', product);\r\n',
    '\r\n',
    '    // ── Fetch the supplier purchase_price from the DB ──────────────────────\r\n',
    '    currentCostPrice = 0; // reset before fetching\r\n',
    '    if (product) {\r\n',
    '        try {\r\n',
    '            const costRes = await fetch(`/api/orders/product/${product.id}/cost-price`);\r\n',
    '            if (costRes.ok) {\r\n',
    '                const costData = await costRes.json();\r\n',
    '                currentCostPrice = parseFloat(costData.cost_price) || 0;\r\n',
    '                console.log(`Cost price for "${product.name}": $${currentCostPrice}`);\r\n',
    '            } else {\r\n',
    '                console.warn(\'Could not fetch cost price, falling back to 0.\');\r\n',
    '            }\r\n',
    '        } catch (err) {\r\n',
    '            console.error(\'Cost price fetch error:\', err);\r\n',
    '        }\r\n',
    '    }\r\n',
    '\r\n',
    '    const unitSelect = document.getElementById(\'order-unit\');'
].join('');

let found2 = code.includes(oldHandlerStart);
console.log('Fix 2 trigger found:', found2);
if (found2) {
    code = code.replace(oldHandlerStart, newHandlerStart);
    console.log('Fix 2 applied.');
} else {
    console.error('FIX 2 FAILED — trigger not found!');
}

// ── FIX 3: Replace product.price with currentCostPrice as base ───────────────
const oldPriceLine = '    // Grab unit price from the product table join\r\n    const basePrice = parseFloat(product.price || 150.00) * factor; // Adjust price by factor\r\n    const unitPrice = basePrice * (1 + margin); // Final Unit Price';
const newPriceLine = [
    '    // Use the supplier COST price (purchase_price) fetched from the DB.\r\n',
    '    // currentCostPrice is populated by handleProductSelect via /api/orders/product/:id/cost-price.\r\n',
    '    // The margin is SNAPSHOTTED here \u2014 changing the input later will NOT change this row.\r\n',
    '    const basePrice = currentCostPrice * factor; // cost price, adjusted for bulk factor\r\n',
    '    const unitPrice = basePrice * (1 + margin);  // selling price = cost * (1 + margin%)'
].join('');

let found3 = code.includes(oldPriceLine);
console.log('Fix 3 trigger found:', found3);
if (found3) {
    code = code.replace(oldPriceLine, newPriceLine);
    console.log('Fix 3 applied.');
} else {
    console.error('FIX 3 FAILED — trigger not found!');
}

// ── FIX 4: Freeze existing row prices when merging qty ───────────────────────
const oldMerge = '        existing.profit_margin = margin;\r\n        existing.base_price = basePrice;\r\n        existing.unit_price = unitPrice;\r\n        existing.subtotal = existing.qty * existing.unit_price;';
const newMerge = [
    '        // Row prices are IMMUTABLE once added. Only quantity increases.\r\n',
    '        // Do NOT update profit_margin / base_price / unit_price here.\r\n',
    '        existing.subtotal = existing.qty * existing.unit_price;'
].join('');

let found4 = code.includes(oldMerge);
console.log('Fix 4 trigger found:', found4);
if (found4) {
    code = code.replace(oldMerge, newMerge);
    console.log('Fix 4 applied.');
} else {
    console.error('FIX 4 FAILED — trigger not found!');
}

// ── FIX 5: Make recalculateCart a no-op ──────────────────────────────────────
const oldRecalc = [
    'function recalculateCart() {\r\n',
    '    const marginInput = document.getElementById(\'profit-margin-input\');\r\n',
    '    let marginVal = parseFloat(marginInput.value);\r\n',
    '\r\n',
    '    if (isNaN(marginVal) || marginVal < 0) {\r\n',
    '        marginVal = 0;\r\n',
    '    }\r\n',
    '    const margin = marginVal / 100.0;\r\n',
    '\r\n',
    '    cart.forEach(item => {\r\n',
    '        item.profit_margin = margin;\r\n',
    '        item.unit_price = item.base_price * (1 + margin);\r\n',
    '        item.subtotal = item.qty * item.unit_price;\r\n',
    '    });\r\n',
    '\r\n',
    '    renderCart();\r\n',
    '}'
].join('');
const newRecalc = [
    '// recalculateCart is intentionally a no-op.\r\n',
    '// Cart rows are IMMUTABLE after being added \u2014 their price is frozen at add-time.\r\n',
    '// Changing the margin input only affects the NEXT product to be added.\r\n',
    'function recalculateCart() {\r\n',
    '    renderCart(); // re-render only, prices unchanged\r\n',
    '}'
].join('');

let found5 = code.includes(oldRecalc);
console.log('Fix 5 trigger found:', found5);
if (found5) {
    code = code.replace(oldRecalc, newRecalc);
    console.log('Fix 5 applied.');
} else {
    console.error('FIX 5 FAILED — trigger not found!');
}

fs.writeFileSync('public/js/orders.js', code);
console.log('\nAll fixes written to orders.js');
