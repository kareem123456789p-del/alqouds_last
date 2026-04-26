/**
 * Formats a given base quantity into a readable string using bulk and base UoM.
 * Example: 29 pieces, 12 pieces/box -> "2 Boxes, 5 Pieces"
 */
function formatUoM(totalBaseQty, baseUoM, bulkUoM, conversionFactor) {
    if (!totalBaseQty && totalBaseQty !== 0) return `0 ${baseUoM || 'Piece'}`;
    totalBaseQty = parseInt(totalBaseQty);
    baseUoM = baseUoM || 'Piece';
    
    if (!bulkUoM || !conversionFactor || conversionFactor <= 1) {
        return `${totalBaseQty.toLocaleString()} ${baseUoM}`;
    }
    
    const factor = parseInt(conversionFactor);
    const bulkQty = Math.floor(totalBaseQty / factor);
    const remainingBaseQty = totalBaseQty % factor;
    
    let result = [];
    if (bulkQty > 0) {
        // Pluralize naively if not ends with s
        const bulkName = (bulkQty > 1 && !bulkUoM.endsWith('s')) ? bulkUoM + 's' : bulkUoM;
        result.push(`${bulkQty.toLocaleString()} ${bulkName}`);
    }
    if (remainingBaseQty > 0 || bulkQty === 0) {
        const baseName = (remainingBaseQty > 1 && !baseUoM.endsWith('s')) ? baseUoM + 's' : baseUoM;
        result.push(`${remainingBaseQty.toLocaleString()} ${baseName}`);
    }
    
    return result.join(', ');
}
