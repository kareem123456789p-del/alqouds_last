document.addEventListener('DOMContentLoaded', () => {
    loadSuppliers();
    loadProducts();
    loadWarehouses();
    loadLogs();

    const form = document.getElementById('import-form');
    form.addEventListener('submit', handleImportSubmit);

    // Setup event listener for item selection to show stock
    const itemSelect = document.getElementById('imp-item');
    if (itemSelect) {
        itemSelect.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            const stockDisplay = document.getElementById('item-stock-display');
            const unitSelect = document.getElementById('imp-unit');
            console.log('Selected product dataset:', selectedOption ? selectedOption.dataset : 'None');
            if (stockDisplay && selectedOption && selectedOption.value) {
                const stock = selectedOption.dataset.stock || 0;
                // HTML5 dataset parses data-base-uom-name into dataset.baseUomName natively 
                const baseName = selectedOption.dataset.baseUomName || 'Piece';
                const bulkName = selectedOption.dataset.bulkUomName;
                const factor = parseInt(selectedOption.dataset.conversionFactor) || 1;
                
                stockDisplay.textContent = `In-Stock: ${typeof formatUoM === 'function' ? formatUoM(stock, baseName, bulkName, factor) : stock}`;
                if (unitSelect) {
                    unitSelect.innerHTML = ''; // explicitly clear
                    unitSelect.add(new Option(baseName, 'BASE'));
                    if (bulkName && factor > 1) {
                        unitSelect.add(new Option(bulkName, 'BULK'));
                    }
                    unitSelect.value = 'BASE'; // force selection
                }
            } else {
                if (stockDisplay) stockDisplay.textContent = '';
                if (unitSelect) unitSelect.innerHTML = '<option value="BASE">Select Product First...</option>';
            }
        });
    }
});

// Toast Notifications
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fa-solid fa-${type === 'success' ? 'circle-check' : 'circle-exclamation'}"></i>
        <span>${message}</span>
    `;
    container.appendChild(toast);

    // trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

let itemChoices;

// Fetch Products
async function loadProducts() {
    try {
        const res = await fetch('/api/products', {
            headers: {
                'Accept': 'application/json'
            }
        });
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Failed to fetch products: ${res.status} ${res.statusText} - ${errorText}`);
        }
        const products = await res.json();

        const selectEl = document.getElementById('imp-item');
        
        if (itemChoices) {
            itemChoices.destroy();
        }

        selectEl.innerHTML = '<option value="">اختر صنف...</option>';

        products.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.sku || p.id} - ${p.name}`;
            opt.dataset.stock = p.quantity || 0;
            opt.dataset.baseUomName = p.base_uom_name || 'Piece';
            opt.dataset.bulkUomName = p.bulk_uom_name || '';
            opt.dataset.conversionFactor = p.conversion_factor || 1;
            selectEl.appendChild(opt);
        });

        // Initialize Choices.js
        itemChoices = new Choices(selectEl, {
            searchEnabled: true,
            itemSelectText: '',
            shouldSort: false,
            searchPlaceholderValue: 'بحث عن صنف...',
            noResultsText: 'لا توجد نتائج',
            noChoicesText: 'لا توجد أصناف للاختيار'
        });

    } catch (e) {
        console.error(e);
        showToast('Error loading products', 'error');
    }
}

// Fetch Warehouses
async function loadWarehouses() {
    try {
        const res = await fetch('/api/warehouse/list');
        if (!res.ok) throw new Error('Failed to fetch warehouses');
        const warehouses = await res.json();

        const selectEl = document.getElementById('imp-warehouse');
        selectEl.innerHTML = '<option value="">Select warehouse...</option>';

        warehouses.forEach(w => {
            const opt = document.createElement('option');
            opt.value = w.id;
            opt.textContent = w.name;
            selectEl.appendChild(opt);
        });
    } catch (e) {
        console.error(e);
        showToast('Error loading warehouses', 'error');
    }
}

// 1. Fetch Active Suppliers
async function loadSuppliers() {
    try {
        const res = await fetch('/api/imports/suppliers');
        if (!res.ok) throw new Error('Failed to fetch suppliers');
        const suppliers = await res.json();

        const listEl = document.getElementById('active-suppliers-list');
        const selectEl = document.getElementById('imp-supplier');

        listEl.innerHTML = '';
        selectEl.innerHTML = '<option value="">Select from list...</option>';

        if (suppliers.length === 0) {
            listEl.innerHTML = '<div style="color:#64748b; font-size:0.875rem;">No active suppliers found.</div>';
            return;
        }

        const colors = ['bg-slate-800', 'green-bg']; // Alternating colors for avatar

        suppliers.forEach((sup, idx) => {
            // Populate Dropdown
            const opt = document.createElement('option');
            opt.value = sup.id;
            opt.textContent = sup.company_name;
            selectEl.appendChild(opt);

            // Populate Sidebar List
            const avatarColorClass = (idx % 2 !== 0) ? 'green-bg' : '';
            const initial = sup.company_name.substring(0, 2).toUpperCase();

            listEl.insertAdjacentHTML('beforeend', `
                <div class="supplier-card">
                    <div class="sup-card-left">
                        <div class="sup-avatar ${avatarColorClass}">${initial}</div>
                        <div class="sup-details">
                            <h4>${sup.company_name}</h4>
                            <p>${sup.contact_person || 'Logistics Partner'}</p>
                        </div>
                    </div>
                    <i class="fa-solid fa-chevron-right"></i>
                </div>
            `);
        });

    } catch (e) {
        console.error(e);
        showToast('Error loading suppliers', 'error');
    }
}

// 2. Fetch Import Logs
async function loadLogs() {
    const tbody = document.getElementById('import-log-body');
    try {
        const res = await fetch('/api/imports');
        if (!res.ok) throw new Error('Failed to fetch import logs');
        const logs = await res.json();

        tbody.innerHTML = '';

        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#64748b;">No recent imports found.</td></tr>';
            document.getElementById('stat-incoming').innerHTML = '0 <span>units</span>';
            document.getElementById('stat-value').innerHTML = '$0.00';
            document.getElementById('stat-pending').innerHTML = '0 <span>shipments</span>';
            return;
        }

        let totalUnits = 0;
        let totalValue = 0;
        let pendingCount = 0;

        logs.forEach(log => {
            totalUnits += Number(log.quantity);
            const lineTotal = Number(log.quantity) * Number(log.unit_price);
            totalValue += lineTotal;
            if (log.status.toLowerCase() !== 'received') {
                pendingCount++;
            }

            const tr = document.createElement('tr');

            // Status visual mapping
            let statusClass = 'received';
            let statusText = log.status || 'Received';
            if (statusText.toLowerCase() === 'in transit') statusClass = 'in-transit';
            if (statusText.toLowerCase() === 'inspection') statusClass = 'inspection';

            // Icon mapping (simple cyclic logic for visual variety)
            const iconIndex = log.id % 3;
            let iconClass = 'blue', iconName = 'notes-medical';
            if (iconIndex === 1) { iconClass = 'green'; iconName = 'mask-ventilator'; }
            if (iconIndex === 2) { iconClass = 'orange'; iconName = 'box-open'; }

            // Format date 
            const dateStr = new Date(log.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

            tr.innerHTML = `
                <td>
                    <div class="item-cell">
                        <div class="item-icon ${iconClass}"><i class="fa-solid fa-${iconName}"></i></div>
                        <div class="item-info">
                            <h4>${log.item_description}</h4>
                            <p>Batch: #${log.sku} • ${log.supplier_name}</p>
                        </div>
                    </div>
                </td>
                <td class="qty-cell">
                    <div class="qty">${typeof formatUoM === 'function' ? formatUoM(log.quantity, log.base_uom_name, log.bulk_uom_name, log.conversion_factor) : Number(log.quantity).toLocaleString() + ' Units'}</div>
                    <div class="price">$${lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} Total</div>
                </td>
                <td>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="icon-btn-outline" style="border:none; width:auto; padding: 0 8px;" title="More options"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                        ${(Number(log.quantity) - Number(log.returned_qty || 0)) > 0 ? `
                        <button class="icon-btn-outline" onclick="openImportReturnModal(${log.id}, ${log.quantity}, ${log.returned_qty || 0})" style="border:none; width:auto; padding: 0 8px; color: #ef4444;" title="Return to Supplier">
                            <i class="fa-solid fa-rotate-left"></i>
                        </button>
                        ` : ''}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Update top stats
        document.getElementById('stat-incoming').innerHTML = `${totalUnits.toLocaleString()} <span>units</span>`;
        if (totalValue >= 1000) {
            document.getElementById('stat-value').innerHTML = '$' + (totalValue / 1000).toFixed(1) + 'k';
        } else {
            document.getElementById('stat-value').innerHTML = '$' + totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 });
        }
        document.getElementById('stat-pending').innerHTML = `${pendingCount} <span>shipments</span>`;

        document.getElementById('table-entries-info').textContent = `Showing 1-${logs.length} of ${logs.length} entries`;

    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#ef4444;">Error loading data.</td></tr>';
        showToast('Error loading logs', 'error');
    }
}

// 3. Handle Form Submit (Batch processing)
let shipmentItems = [];

function renderStagingTable() {
    const tbody = document.getElementById('staging-table-body');
    const confirmBtn = document.getElementById('btn-confirm-shipment');
    const totalDisplay = document.getElementById('staging-total-value');
    
    tbody.innerHTML = '';
    
    if (shipmentItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #64748b;">لا توجد منتجات مضافة بعد</td></tr>';
        confirmBtn.style.display = 'none';
        totalDisplay.textContent = '$0.00';
        return;
    }
    
    let totalValue = 0;
    
    shipmentItems.forEach((item, index) => {
        const subtotal = item.quantity * item.unit_price;
        totalValue += subtotal;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.product_name}</td>
            <td>${item.warehouse_name}</td>
            <td>${item.original_qty_str}</td>
            <td>$${Number(item.original_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td>$${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td>
                <div style="display:flex; justify-content:center;">
                    <button type="button" class="icon-btn-outline" onclick="removeStagedItem(${index})" style="border:none; color: #ef4444;" title="Remove">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    totalDisplay.textContent = '$' + totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 });
    confirmBtn.style.display = 'inline-flex';
}

function removeStagedItem(idx) {
    shipmentItems.splice(idx, 1);
    renderStagingTable();
}

function handleImportSubmit(e) {
    e.preventDefault();

    const selectedOption = document.getElementById('imp-item').options[document.getElementById('imp-item').selectedIndex];
    const unitSelect = document.getElementById('imp-unit');
    const warehouseSelect = document.getElementById('imp-warehouse').options[document.getElementById('imp-warehouse').selectedIndex];
    let factor = 1;
    if (unitSelect && unitSelect.value === 'BULK') {
        factor = parseInt(selectedOption.dataset.conversion_factor) || 1;
    }
    
    const submittedQty = parseInt(document.getElementById('imp-qty').value) || 0;
    const submittedPrice = parseFloat(document.getElementById('imp-price').value) || 0.0;
    
    const originalQtyStr = submittedQty + " " + (unitSelect && unitSelect.options[unitSelect.selectedIndex] ? unitSelect.options[unitSelect.selectedIndex].text : '');

    const payload = {
        product_id: document.getElementById('imp-item').value,
        product_name: selectedOption.text.split(' - ').slice(1).join(' - ') || selectedOption.text,
        warehouse_id: document.getElementById('imp-warehouse').value,
        warehouse_name: warehouseSelect.text,
        supplier_id: document.getElementById('imp-supplier').value,
        quantity: submittedQty * factor,
        unit_price: submittedPrice / factor,
        original_price: submittedPrice,
        original_qty_str: originalQtyStr,
        batch_number: document.getElementById('imp-batch').value,
        expiry_date: document.getElementById('imp-expiry').value,
        qty_threshold: parseInt(document.getElementById('imp-qty-threshold').value) || 20,
        expiry_month_threshold: parseInt(document.getElementById('imp-expiry-threshold').value) || 3
    };

    shipmentItems.push(payload);
    renderStagingTable();

    // Reset some inputs, keep supplier and warehouse for rapid entry
    if (itemChoices) {
        itemChoices.setChoiceByValue("");
    } else {
        document.getElementById('imp-item').value = "";
    }
    document.getElementById('imp-qty').value = "";
    document.getElementById('imp-price').value = "";
    document.getElementById('imp-batch').value = "";
    document.getElementById('imp-expiry').value = "";
    const stockDisplay = document.getElementById('item-stock-display');
    if (stockDisplay) stockDisplay.textContent = '';
    
    showToast('تمت الإضافة إلى القائمة', 'success');
}

async function submitShipment() {
    if (shipmentItems.length === 0) return;

    const btn = document.getElementById('btn-confirm-shipment');
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الحفظ...';

    try {
        // ── Build FormData so we can send the optional invoice image ──
        const fd = new FormData();

        // Items array sent as a JSON string field
        fd.append('items', JSON.stringify(shipmentItems));

        // Attach invoice image if the user selected one
        const fileInput = document.getElementById('invoice-image-input');
        if (fileInput && fileInput.files && fileInput.files[0]) {
            fd.append('invoiceImage', fileInput.files[0]);
        }

        // NOTE: Do NOT set Content-Type header — the browser sets the correct
        //       multipart boundary automatically when using FormData.
        const res = await fetch('/api/imports', {
            method: 'POST',
            body: fd
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to register shipment');

        const hasImage = fileInput && fileInput.files && fileInput.files[0];
        showToast(
            (data.message || 'تم حفظ الشحنة بنجاح') + (hasImage ? ' 📎 تم رفع صورة الفاتورة' : ''),
            'success'
        );

        // Reset staging area and form
        shipmentItems = [];
        renderStagingTable();
        document.getElementById('import-form').reset();
        if (fileInput) fileInput.value = '';
        updateInvoicePreview(); // clear preview

        await loadLogs();
        await loadProducts();
    } catch (error) {
        console.error(error);
        showToast(error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalContent;
    }
}

// ── Invoice image preview helper ─────────────────────────────────────────────
function updateInvoicePreview() {
    const input   = document.getElementById('invoice-image-input');
    const preview = document.getElementById('invoice-preview-area');
    if (!preview) return;
    if (!input || !input.files || !input.files[0]) {
        preview.innerHTML = '';
        preview.style.display = 'none';
        return;
    }
    const file = input.files[0];
    const url  = URL.createObjectURL(file);
    preview.style.display = 'block';
    preview.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-top:8px;">
            <img src="${url}" alt="invoice preview"
                 style="height:50px;width:60px;object-fit:cover;border-radius:6px;border:1px solid #d1fae5;">
            <div>
                <div style="font-weight:600;color:#15803d;font-size:0.85rem;">✓ صورة الفاتورة جاهزة للرفع</div>
                <div style="font-size:0.75rem;color:#64748b;">${file.name} (${(file.size/1024).toFixed(1)} KB)</div>
            </div>
            <button type="button" onclick="clearInvoiceImage()"
                style="margin-right:auto;background:none;border:none;color:#ef4444;cursor:pointer;font-size:1.1rem;">×</button>
        </div>`;
}

function clearInvoiceImage() {
    const input = document.getElementById('invoice-image-input');
    if (input) input.value = '';
    updateInvoicePreview();
}


// 4. Return to Supplier Logic
let currentImportReturnId = null;

function openImportReturnModal(logId, totalQty, returnedQty) {
    currentImportReturnId = logId;
    const maxReturnable = totalQty - returnedQty;

    document.getElementById('return-import-id-display').textContent = logId;
    document.getElementById('import-return-qty').value = '';
    document.getElementById('import-return-qty').max = maxReturnable;
    document.getElementById('import-return-reason').value = '';
    document.getElementById('import-return-max-helper').textContent = `Max available to return: ${maxReturnable} (Total: ${totalQty}, Already Returned: ${returnedQty})`;

    document.getElementById('return-import-modal').style.display = 'flex';
}

function closeImportReturnModal() {
    document.getElementById('return-import-modal').style.display = 'none';
    currentImportReturnId = null;
}

async function submitImportReturn() {
    if (!currentImportReturnId) return;

    const qtyInput = document.getElementById('import-return-qty');
    const reasonInput = document.getElementById('import-return-reason');

    const returnQty = parseInt(qtyInput.value);
    const maxReturnable = parseInt(qtyInput.max);

    if (!returnQty || returnQty <= 0 || returnQty > maxReturnable) {
        alert(`Please enter a valid quantity between 1 and ${maxReturnable}.`);
        return;
    }

    const btn = document.getElementById('submit-import-return-btn');
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

    try {
        const payload = {
            return_qty: returnQty,
            return_reason: reasonInput.value
        };

        const res = await fetch(`/api/imports/${currentImportReturnId}/return`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Failed to process return');

        showToast(`Return processed successfully! Supplier credited $${Number(data.credit_amount).toFixed(2)}`, 'success');
        closeImportReturnModal();

        // Refresh logs and stock
        await loadLogs();
        await loadProducts();

    } catch (error) {
        console.error("Return Error:", error);
        alert(error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalContent;
    }
}
