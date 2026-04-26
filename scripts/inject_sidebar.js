const fs = require('fs');
const path = require('path');

const publicDir = path.join(process.cwd(), 'public');
const files = fs.readdirSync(publicDir).filter(f => f.endsWith('.html'));

const linkHtml = `
                <a class="nav-link" href="retail_sales.html" style="color:#0ea5e9; font-weight: bold;">
                    <i class="fa-solid fa-cash-register"></i> مبيعات الجمهور (POS)
                </a>`;

for(const file of files) {
    const p = path.join(publicDir, file);
    let content = fs.readFileSync(p, 'utf8');

    if(content.includes('<nav class="sidebar-nav">') && !content.includes('retail_sales.html')) {
        // Find the closing </nav> and inject before it
        content = content.replace(/(<\/nav>\s*(?:<!--.*?-->\s*)?<\/aside>|<\/nav>)/, (match) => {
            return linkHtml + '\n            ' + match;
        });
        fs.writeFileSync(p, content);
        console.log(`Updated sidebar in ${file}`);
    } else if (content.includes('class="sidebar"') && content.includes('<nav>') && !content.includes('retail_sales.html')) {
        // Alternative structure
        content = content.replace(/(<\/nav>)/, (match) => {
            return linkHtml + '\n            ' + match;
        });
        fs.writeFileSync(p, content);
        console.log(`Updated alternative sidebar in ${file}`);
    }
}
