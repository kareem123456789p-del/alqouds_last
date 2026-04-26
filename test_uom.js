function formatUoM(totalBaseQty, baseUoM, bulkUoM, conversionFactor) {
    if (!totalBaseQty && totalBaseQty !== 0) return `0 ${baseUoM || 'Units'}`;
    totalBaseQty = parseInt(totalBaseQty);
    baseUoM = baseUoM || 'Units';
    
    if (!bulkUoM || !conversionFactor || conversionFactor <= 1) {
        return `${totalBaseQty.toLocaleString()} ${baseUoM}`;
    }
    
    const factor = parseInt(conversionFactor);
    const bulkQty = Math.floor(totalBaseQty / factor);
    const remainingBaseQty = totalBaseQty % factor;
    
    let result = [];
    if (bulkQty > 0) {
        const bulkName = (bulkQty > 1 && !bulkUoM.endsWith('s')) ? bulkUoM + 's' : bulkUoM;
        result.push(`${bulkQty.toLocaleString()} ${bulkName}`);
    }
    if (remainingBaseQty > 0 || bulkQty === 0) {
        const baseName = (remainingBaseQty > 1 && !baseUoM.endsWith('s')) ? baseUoM + 's' : baseUoM;
        result.push(`${remainingBaseQty.toLocaleString()} ${baseName}`);
    }
    
    return result.join(', ');
}

console.log(formatUoM(29, 'Piece', 'Box', 12)); // 2 Boxes, 5 Pieces
console.log(formatUoM(24, 'Piece', 'Box', 12)); // 2 Boxes
console.log(formatUoM(5, 'Piece', 'Box', 12)); // 5 Pieces
console.log(formatUoM(0, 'Piece', 'Box', 12)); // 0 Pieces
console.log(formatUoM(100, undefined, undefined, null)); // 100 Units
