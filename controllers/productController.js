const db = require('../config/db');

// Get all products (active only)
exports.getAllProducts = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT p.*,
                   bu.name   AS base_uom_name,
                   blku.name AS bulk_uom_name
            FROM products p
            LEFT JOIN uom bu   ON p.base_uom_id = bu.id
            LEFT JOIN uom blku ON p.bulk_uom_id  = blku.id
            WHERE p.is_active = 1
        `);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).json({ error: 'Fails to fetch products' });
    }
};

async function getOrCreateUomId(unitName) {
    if (!unitName) return null;
    try {
        const [rows] = await db.query('SELECT id FROM uom WHERE name = ?', [unitName]);
        if (rows.length > 0) return rows[0].id;
        const [res] = await db.query('INSERT INTO uom (name) VALUES (?)', [unitName]);
        return res.insertId;
    } catch(e) {
        console.error("Error with UOM:", e);
        return null;
    }
}

// Create a new product
exports.createProduct = async (req, res) => {
    const { name, base_uom, has_bulk, bulk_uom, conversion_factor } = req.body;

    // Basic validation
    if (!name) {
        return res.status(400).json({ error: 'Product name is required' });
    }

    try {
        const baseUomId = await getOrCreateUomId(base_uom);
        const bulkUomId = has_bulk ? await getOrCreateUomId(bulk_uom) : null;
        const factor = has_bulk ? (conversion_factor || 1) : 1;

        const [result] = await db.query(
            `INSERT INTO products 
            (name, quantity, price, expiry_date, base_uom_id, bulk_uom_id, conversion_factor) 
            VALUES (?, 0, 0, NULL, ?, ?, ?)`,
            [name, baseUomId, bulkUomId, factor]
        );

        res.status(201).json({
            message: 'Product added successfully',
            product: {
                id: result.insertId,
                name,
                base_uom,
                bulk_uom: has_bulk ? bulk_uom : null,
                conversion_factor: factor
            }
        });
    } catch (err) {
        console.error("Error creating product:", err);
        res.status(500).json({ error: 'Failed to add product' });
    }
};

// Update a product
exports.updateProduct = async (req, res) => {
    const { id } = req.params;
    const { name, base_uom, has_bulk, bulk_uom, conversion_factor, price } = req.body;

    try {
        const baseUomId = await getOrCreateUomId(base_uom);
        const bulkUomId = has_bulk ? await getOrCreateUomId(bulk_uom) : null;
        const factor = has_bulk ? (conversion_factor || 1) : 1;
        const unitPrice = parseFloat(price) || 0;

        await db.query(
            'UPDATE products SET name = ?, base_uom_id = ?, bulk_uom_id = ?, conversion_factor = ?, price = ? WHERE id = ?',
            [name, baseUomId, bulkUomId, factor, unitPrice, id]
        );
        res.json({ message: 'Product updated successfully' });
    } catch (err) {
        console.error("Error updating product:", err);
        res.status(500).json({ error: 'Failed to update product' });
    }
};


// Soft-delete a product (internal use — primary path is via inventoryController)
exports.deleteProduct = async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.query(
            'UPDATE products SET is_active = 0, is_deleted = 1 WHERE id = ?',
            [id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json({ message: 'Product deactivated successfully' });
    } catch (err) {
        console.error('Error deleting product:', err);
        res.status(500).json({ error: 'Failed to delete product' });
    }
};
