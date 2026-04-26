const fs = require('fs');
const fontCode = fs.readFileSync('public/js/amiri_font.js', 'utf8');

['public/js/warehouse.js', 'public/js/orders.js', 'public/js/retail.js'].forEach(file => {
    let code = fs.readFileSync(file, 'utf8');
    if (!code.includes("window.AmiriBase64 = 'AAE")) {
        fs.writeFileSync(file, fontCode + '\n' + code);
        console.log("Inlined font into", file);
    } else {
        console.log("Font already inlined in", file);
    }
});
