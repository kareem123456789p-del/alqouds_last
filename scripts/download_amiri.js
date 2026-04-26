const https = require('https');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../public', 'fonts');
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

const file = fs.createWriteStream(path.join(dir, 'Amiri-Regular.ttf'));
https.get("https://raw.githubusercontent.com/aliftype/amiri/master/Amiri-Regular.ttf", function (response) {
    response.pipe(file);
    file.on("finish", () => {
        file.close();
        console.log("Download Completed in " + dir);
    });
}).on("error", (err) => {
    fs.unlink(path.join(dir, 'Amiri-Regular.ttf'), () => { });
    console.error("Error: ", err.message);
});
