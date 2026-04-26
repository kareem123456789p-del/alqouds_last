const https = require('https');
const fs = require('fs');

https.get("https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Amiri-Regular.ttf", (res) => {
    let chunks = [];
    res.on('data', chunk => chunks.push(chunk));
    res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const b64 = buffer.toString('base64');
        const fileContent = `window.AmiriBase64 = "${b64}";`;
        fs.writeFileSync('./public/js/amiri_font.js', fileContent);
        console.log("Written " + b64.length + " bytes of base64 to amiri_font.js");
    });
}).on('error', console.error);
