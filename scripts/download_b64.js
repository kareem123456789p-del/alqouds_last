const fs = require('fs');
const path = require('path');

const localTtf = path.join(__dirname, '../Amiri-Regular.ttf');
if (fs.existsSync(localTtf)) {
    const buffer = fs.readFileSync(localTtf);
    const b64 = buffer.toString('base64');
    const fileContent = `window.AmiriBase64 = "${b64}";\n`;
    fs.writeFileSync(path.join(__dirname, '../public/js/amiri_font.js'), fileContent);
    console.log("Written " + b64.length + " bytes of base64 to amiri_font.js from local TTF");
} else {
    console.error("Local Amiri-Regular.ttf not found at " + localTtf);
}
