const ArabicReshaper = require('arabic-reshaper');
const bidi = require('bidi-js');

window.ArabicReshaper = ArabicReshaper;
window.bidi = bidi;

window.fixArabic = function(text) {
    if (!text) return text;
    try {
        const bidiEngine = bidi();
        // 1. Reshape
        const reshaped = ArabicReshaper.convertArabic(String(text));
        // 2. Bidi reorder
        const out = bidiEngine.getReorderedString(reshaped, 'rtl');
        return out;
    } catch(e) {
        console.error('Arabic reshaper error:', e);
        return text;
    }
};
