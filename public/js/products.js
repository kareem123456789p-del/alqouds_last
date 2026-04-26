let allInventory = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Setup bulk uom toggle handler
    document.getElementById('has_bulk_uom').addEventListener('change', function() {
        document.getElementById('bulk-uom-group').style.display = this.checked ? 'flex' : 'none';
        
        // Ensure required fields logic applies
        const conversionInput = document.getElementById('conversion_factor');
        if (this.checked) {
            conversionInput.setAttribute('required', 'required');
        } else {
            conversionInput.removeAttribute('required');
        }
    });

    await fetchProducts();
});

async function fetchProducts() {
    const app = document.getElementById('app');
    app.innerHTML = '<p style="text-align: center; margin-top: 2rem; color: #64748b; font-size: 1.2rem;">جاري تحميل الكتالوج... <i class="fa-solid fa-spinner fa-spin"></i></p>';
    
    try {
        const response = await fetch('/api/products');
        if (!response.ok) throw new Error('Network response was not ok');
        
        allInventory = await response.json();
        renderCatalog();
    } catch (error) {
        console.error('Error loading product catalog:', error);
        app.innerHTML = `<div style="background: #fef2f2; color: #ef4444; padding: 20px; border-radius: 12px; text-align: center; margin-top: 20px;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; margin-bottom: 10px;"></i>
            <h3>فشل تحميل الكتالوج</h3>
            <p>${error.message}</p>
        </div>`;
    }
}

function renderCatalog() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div dir="ltr" style="text-align: left;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px;">
                <div>
                    <h1 style="font-size: 1.8rem; color: #1e293b; font-weight: 800; margin-bottom: 6px;">Product Catalog</h1>
                    <p style="color: #64748b; font-size: 0.95rem; margin: 0;">اللوازم الطبية — Master list for defining products before they enter any warehouse.</p>
                </div>
                <button onclick="openProductModal()" style="
                    background: #0ea5e9; color: white; border: none; padding: 12px 24px;
                    border-radius: 10px; font-weight: 700; cursor: pointer; display: inline-flex;
                    align-items: center; gap: 8px; font-size: 0.95rem; font-family: inherit;
                    box-shadow: 0 4px 6px rgba(14, 165, 233, 0.2); transition: all 0.2s ease;">
                    <i class="fa-solid fa-plus"></i> Add New Product
                </button>
            </div>

            <!-- Search Bar -->
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px;
                        display: flex; align-items: center; gap: 15px; margin-bottom: 24px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <i class="fa-solid fa-magnifying-glass" style="color: #94a3b8; font-size: 1.1rem;"></i>
                <input type="text" id="catalogSearch" placeholder="Search by name or category..."
                    oninput="filterInventory(this.value)"
                    style="border: none; outline: none; width: 100%; font-size: 1rem; color: #1e293b; font-family: inherit;">
            </div>

            <!-- Product Table -->
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                            <th style="padding: 16px 24px; text-align: left; font-size: 0.8rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">PRODUCT NAME</th>
                            <th style="padding: 16px 24px; text-align: left; font-size: 0.8rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">CATEGORY (MOCK)</th>
                            <th style="padding: 16px 24px; text-align: left; font-size: 0.8rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">BASE PRICE</th>
                        </tr>
                    </thead>
                    <tbody id="inventoryTableBody">
                        ${generateCatalogRows(allInventory)}
                    </tbody>
                </table>
                ${allInventory.length === 0 ? '<div style="text-align:center; padding: 4rem 2rem; color:#94a3b8;"><i class="fa-solid fa-box-open" style="font-size: 3rem; margin-bottom: 1rem; color: #cbd5e1; display: block;"></i> No products defined yet. Click "Add New Product" to get started.</div>' : ''}
            </div>
        </div>
    `;
}

function generateCatalogRows(items) {
    if (!items || items.length === 0) return '';

    const catPalette = [
        { bg: '#eff6ff', text: '#3b82f6', label: 'Antibiotics' },
        { bg: '#f0fdf4', text: '#16a34a', label: 'Analgesics' },
        { bg: '#faf5ff', text: '#a855f7', label: 'Blood Pressure' },
        { bg: '#fff7ed', text: '#ea580c', label: 'Diabetes' },
        { bg: '#fefce8', text: '#ca8a04', label: 'Supplements' },
    ];

    return items.map((item, i) => {
        const cat = catPalette[i % catPalette.length];
        const price = item.price != null && item.price !== undefined ? `$${Number(item.price).toFixed(2)}` : '<span style="color:#94a3b8;">Not Set</span>';
        const initial = item.name ? item.name[0].toUpperCase() : '?';
        const initBg = ['#eff6ff', '#fff7ed', '#f0fdf4', '#faf5ff', '#fefce8'][i % 5];
        const initColor = ['#3b82f6', '#ea580c', '#16a34a', '#a855f7', '#ca8a04'][i % 5];

        return `
            <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.2s ease;"
                onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <td style="padding: 16px 24px;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="width: 40px; height: 40px; border-radius: 10px; background: ${initBg}; color: ${initColor};
                                    display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.1rem; flex-shrink: 0;">
                            ${initial}
                        </div>
                        <span style="font-weight: 700; color: #1e293b; font-size: 1rem;">${item.name}</span>
                    </div>
                </td>
                <td style="padding: 16px 24px;">
                    <span style="background: ${cat.bg}; color: ${cat.text}; padding: 6px 14px; border-radius: 8px; font-size: 0.8rem; font-weight: 700;">
                        ${cat.label}
                    </span>
                </td>
                <td style="padding: 16px 24px; font-weight: 700; color: #334155; font-size: 1rem;">
                    ${price}
                </td>
            </tr>
        `;
    }).join('');
}

function filterInventory(query) {
    const lowerQuery = query.toLowerCase();
    const filtered = allInventory.filter(item =>
        item.name.toLowerCase().includes(lowerQuery) ||
        (item.category && item.category.toLowerCase().includes(lowerQuery))
    );
    document.getElementById('inventoryTableBody').innerHTML = generateCatalogRows(filtered);
}

// Modal Functions
function openProductModal() {
    document.getElementById('productModalTitle').innerHTML = '<i class="fa-solid fa-box-open"></i> إضافة منتج جديد';
    document.getElementById('productSubmitBtn').textContent = 'حفظ المنتج';
    document.getElementById('productId').value = '';
    document.getElementById('productForm').reset();
    document.getElementById('bulk-uom-group').style.display = 'none';
    document.getElementById('addProductModal').style.display = 'flex';
}

function closeProductModal() {
    document.getElementById('addProductModal').style.display = 'none';
}

async function submitProductForm(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    
    // We are only doing 'Add New' read-only conceptually, but the form could theoretically still edit if id exists
    const id = formData.get('id');

    const productData = { name: formData.get('name'), price: formData.get('price'), base_uom: formData.get('base_uom'), has_bulk: formData.get('has_bulk_uom') === 'on'
    };
    
    if (productData.has_bulk) {
        productData.bulk_uom = formData.get('bulk_uom');
        productData.conversion_factor = parseInt(formData.get('conversion_factor')) || null;
    }

    const url = id ? '/api/products/' + id : '/api/products';
    const method = id ? 'PUT' : 'POST';

    try {
        const productSubmitBtn = document.getElementById('productSubmitBtn');
        const originalText = productSubmitBtn.textContent;
        productSubmitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الحفظ...';
        productSubmitBtn.disabled = true;

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productData)
        });

        if (response.ok) {
            closeProductModal();
            await fetchProducts(); // Refresh list automatically
        } else {
            console.error('Error saving product');
            alert('Failed to save product');
        }
        
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to save product: ' + error.message);
    } finally {
        const productSubmitBtn = document.getElementById('productSubmitBtn');
        productSubmitBtn.textContent = 'حفظ المنتج';
        productSubmitBtn.disabled = false;
    }
}
