// ── Auth guard: must arrive from Dashboard with correct password ──────────────
if (!sessionStorage.getItem('inventoryAuth')) {
    window.location.href = 'index.html';
}

// ── State ─────────────────────────────────────────────────────────────────────
let allInventory = [];  // Cache for client-side filtering

// ── Bootstrap ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('searchInput').addEventListener('input', applyFilters);
    document.getElementById('statusFilter').addEventListener('change', applyFilters);
    loadInventory();
});

// ── Load Inventory ─────────────────────────────────────────────────────────────
async function loadInventory() {
    const tbody = document.getElementById('inventoryTableBody');
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:#64748b;">جاري تحميل البيانات...</td></tr>';

    try {
        const res = await fetch('/api/inventory');
        if (!res.ok) throw new Error(`Server error ${res.status}`);

        allInventory = await res.json();
        renderTable(allInventory);
    } catch (e) {
        console.error('Inventory fetch error:', e);
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#ef4444;padding:2rem;">خطأ في جلب بيانات المخزون</td></tr>';
    }
}

// ── Status Helper ──────────────────────────────────────────────────────────────
function getStatusInfo(item) {
    const qty = parseInt(item.qty) || 0;
    const qtyThreshold = item.qty_threshold != null ? parseInt(item.qty_threshold) : 20;
    const expMonthThreshold = item.expiry_month_threshold != null ? parseInt(item.expiry_month_threshold) : 3;

    let statusHTML = '<span style="background:#dcfce7;color:#15803d;padding:3px 10px;border-radius:12px;font-size:.8rem;font-weight:600;">متوفر</span>';
    let filterStatus = 'available';

    if (item.expiry_date) {
        const expDate = new Date(item.expiry_date);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        
        if (expDate < today) {
            return {
                html: '<span style="background:#fee2e2;color:#b91c1c;padding:3px 10px;border-radius:12px;font-size:.8rem;font-weight:600;">منتهي الصلاحية</span>',
                status: 'expired'
            };
        }

        const daysDiff = Math.ceil((expDate.getTime() - today.getTime()) / 86400000);
        if (daysDiff <= expMonthThreshold * 30) {
            return {
                html: '<span style="background:#ffedd5;color:#c2410c;padding:3px 10px;border-radius:12px;font-size:.8rem;font-weight:600;">صلاحية قريبة</span>',
                status: 'expired'
            };
        }
    }

    if (qty <= 0) {
        filterStatus = 'low';
        statusHTML = '<span style="background:#fee2e2;color:#b91c1c;padding:3px 10px;border-radius:12px;font-size:.8rem;font-weight:600;">نفذت الكمية</span>';
    } else if (qty <= qtyThreshold) {
        filterStatus = 'low';
        statusHTML = '<span style="background:#fef3c7;color:#b45309;padding:3px 10px;border-radius:12px;font-size:.8rem;font-weight:600;">كمية منخفضة</span>';
    }

    return { html: statusHTML, status: filterStatus };
}

// ── Render Table ───────────────────────────────────────────────────────────────
function renderTable(data) {
    const tbody = document.getElementById('inventoryTableBody');

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#64748b;padding:2rem;">لا توجد عناصر في المخزون</td></tr>';
        return;
    }

    // 1. Group data by product_id (or item_name)
    const groupedData = data.reduce((acc, item) => {
        const key = item.product_id || item.item_name || item.sku || 'Unknown';
        if (!acc[key]) {
            acc[key] = {
                product_id: item.product_id,
                item_name: item.item_name,
                sku: item.sku,
                base_uom: item.base_uom,
                has_bulk_uom: item.has_bulk_uom,
                bulk_uom: item.bulk_uom,
                conversion_factor: item.conversion_factor,
                qty_threshold: item.qty_threshold,
                price: parseFloat(item.price) || 0,
                purchase_price: parseFloat(item.purchase_price) || 0,
                total_qty: 0,
                batches: []
            };
        }
        acc[key].total_qty += parseInt(item.qty) || 0;
        acc[key].batches.push(item);
        return acc;
    }, {});

    // 2. Render Main Rows + Sub Rows
    const rowsHtml = Object.values(groupedData).map(group => {
        // Group Status
        const groupStatusInfo = getStatusInfo({
            qty: group.total_qty,
            qty_threshold: group.qty_threshold
        });

        const formattedTotalQty = typeof window.formatUoM === 'function'
            ? window.formatUoM(group.total_qty, group.base_uom, group.has_bulk_uom, group.bulk_uom, group.conversion_factor)
            : `${group.total_qty} وحدة`;

        // Map individual batches
        const batchesHtml = group.batches.map(item => {
            const statusInfo = getStatusInfo(item);
            let formattedDate = 'دائم / لا يوجد';
            let expiryStyle = 'color:#475569;';
            if (item.expiry_date) {
                const d = new Date(item.expiry_date);
                formattedDate = d.toLocaleDateString('en-GB');
                const expMonthThreshold = item.expiry_month_threshold != null ? parseInt(item.expiry_month_threshold) : 3;
                const daysDiff = Math.ceil((d.getTime() - Date.now()) / 86400000);
                if (daysDiff <= expMonthThreshold * 30) expiryStyle = 'color:red;font-weight:bold;';
            }

            const formattedQty = typeof window.formatUoM === 'function'
                ? window.formatUoM(item.qty, item.base_uom, item.has_bulk_uom, item.bulk_uom, item.conversion_factor)
                : `${item.qty} وحدة`;

            const invId = item.inventory_id;
            const prodId = item.product_id;

            // Batch price logic: show specific batch price if available, else fallback to current purchase price
            const batchPrice = item.batch_unit_price !== null && item.batch_unit_price !== undefined 
                ? parseFloat(item.batch_unit_price) 
                : group.purchase_price;

            return `
                <tr id="inv-row-${invId}" class="prod-row-${prodId}" style="border-bottom:1px solid #e2e8f0;">
                    <td style="padding:10px 15px; width:250px; color:#475569;"><span style="margin-right:2rem; font-size:0.8rem;"><i class="fa-solid fa-arrow-turn-down fa-rotate-90"></i> دفعة فرعية</span></td>
                    <td style="padding:10px 15px; color:#475569; font-size:0.85rem;">${escHtml(item.warehouse_name || '—')}</td>
                    <td style="padding:10px 15px; color:#475569; font-size:0.85rem;">${escHtml(item.batch_number || '—')}</td>
                    <td style="padding:10px 15px; font-weight:700; color:#1e293b; font-size:0.85rem;">${formattedQty}</td>
                    <td style="padding:10px 15px; font-size:0.85rem;"><span style="${expiryStyle}">${formattedDate}</span></td>
                    <td style="padding:10px 15px; color:#475569; font-weight:600; font-size:0.85rem;">$${batchPrice.toFixed(2)}</td>
                    <td style="padding:10px 15px;">${statusInfo.html}</td>
                    <td style="padding:10px 15px;">
                        <div style="display:flex;gap:5px;">
                            <button onclick="openEditModal(${invId})" title="تعديل"
                                style="height:30px;border:1px solid #e2e8f0;border-radius:6px;background:white;color:#64748b;cursor:pointer;padding:0 8px;display:inline-flex;align-items:center;gap:4px;font-family:inherit;transition:.2s;"
                                onmouseover="this.style.borderColor='#2563eb';this.style.color='#2563eb';"
                                onmouseout="this.style.borderColor='#e2e8f0';this.style.color='#64748b';">
                                <i class="fa-solid fa-pen" style="font-size:0.75rem;"></i><span style="font-size:.7rem;font-weight:600;">تعديل</span>
                            </button>
                            <button onclick="deleteItem(${prodId}, '${escHtml(item.item_name)}')" title="حذف"
                                style="height:30px;border:1px solid #fee2e2;border-radius:6px;background:#fef2f2;color:#ef4444;cursor:pointer;padding:0 8px;display:inline-flex;align-items:center;gap:4px;font-family:inherit;transition:.2s;"
                                onmouseover="this.style.borderColor='#ef4444';this.style.background='#fee2e2';"
                                onmouseout="this.style.borderColor='#fee2e2';this.style.background='#fef2f2';">
                                <i class="fa-solid fa-trash" style="font-size:0.75rem;"></i><span style="font-size:.7rem;font-weight:600;">حذف</span>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Main Accordion Row
        return `
            <tr class="prod-row-${group.product_id}" onclick="toggleAccordion('batch-list-${group.product_id}', 'icon-${group.product_id}')" 
                style="cursor:pointer; border-bottom:1px solid #e2e8f0; background:#fff; transition: background .2s;" 
                onmouseover="this.style.background='#f1f5f9'" 
                onmouseout="this.style.background='#fff'">
                <td style="padding:12px 15px;display:flex;align-items:center;gap:10px;">
                    <i id="icon-${group.product_id}" class="fas fa-chevron-right" style="transition: transform 0.3s ease; color:#64748b; margin-left:8px; font-size: 1.1rem;"></i>
                    <div style="background:#eff6ff;color:#2563eb;min-width:35px;height:35px;border-radius:8px;display:flex;align-items:center;justify-content:center;">
                        <i class="fa-solid fa-box"></i>
                    </div>
                    <div>
                        <div style="font-weight:700;color:#1e293b;font-size:0.95rem;">${escHtml(group.item_name)}</div>
                        <div style="font-size:.75rem;color:#94a3b8;">SKU: ${escHtml(group.sku || 'N/A')}</div>
                    </div>
                </td>
                <td style="padding:12px 15px;color:#475569;font-weight:500;">متعدد (Multiple)</td>
                <td style="padding:12px 15px;color:#475569;">—</td>
                <td style="padding:12px 15px;font-weight:800;color:#0f172a;font-size:1.05rem;">${formattedTotalQty}</td>
                <td style="padding:12px 15px;color:#475569;">—</td>
                <td style="padding:12px 15px;color:#475569;font-weight:600;">$${group.purchase_price.toFixed(2)}</td>
                <td style="padding:12px 15px;">${groupStatusInfo.html}</td>
                <td style="padding:12px 15px;">
                    <span style="font-size:0.75rem; color:#94a3b8; background:#f1f5f9; padding:4px 8px; border-radius:6px; font-weight:600; display:inline-block; border: 1px solid #e2e8f0;">${group.batches.length} دفعات</span>
                </td>
            </tr>
            <tr id="batch-list-${group.product_id}" class="prod-row-${group.product_id}" style="display:none; background:#f8fafc; box-shadow: inset 0 3px 6px -3px rgba(0,0,0,0.05);">
                <td colspan="8" style="padding:0;">
                    <table style="width:100%; border-collapse:collapse; background:transparent;">
                        <tbody>
                            ${batchesHtml}
                        </tbody>
                    </table>
                </td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = rowsHtml;
}

// ── Accordion Toggle Helper ────────────────────────────────────────────────────
window.toggleAccordion = function(rowId, iconId) {
    const row = document.getElementById(rowId);
    const icon = document.getElementById(iconId);
    
    if (row.style.display === 'none' || row.style.display === '') {
        row.style.display = 'table-row';
        icon.style.transform = 'rotate(90deg)';
    } else {
        row.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
    }
}

// ── Filters ────────────────────────────────────────────────────────────────────
function applyFilters() {
    const searchTerm  = document.getElementById('searchInput').value.toLowerCase();
    const filterValue = document.getElementById('statusFilter').value;

    const filtered = allInventory.filter(item => {
        const matchesSearch = (item.item_name || '').toLowerCase().includes(searchTerm)
                           || (item.sku      || '').toLowerCase().includes(searchTerm);
        const matchesStatus = filterValue === 'all' || getStatusInfo(item).status === filterValue;
        return matchesSearch && matchesStatus;
    });

    renderTable(filtered);
}

// ── Edit Modal ─────────────────────────────────────────────────────────────────
function openEditModal(inventoryId) {
    const item = allInventory.find(i => i.inventory_id === inventoryId);
    if (!item) return;

    document.getElementById('edit_inventory_id').value  = item.inventory_id;
    document.getElementById('edit_item_name').value     = item.item_name      || '';
    document.getElementById('edit_warehouse_name').value= item.warehouse_name || '';
    document.getElementById('edit_current_stock').value = item.qty            || 0;
    document.getElementById('edit_batch_number').value  = item.batch_number   || '';
    document.getElementById('edit_expiry_date').value   = item.expiry_date ? item.expiry_date.split('T')[0] : '';

    document.getElementById('editInventoryModal').style.display = 'flex';
}

document.getElementById('editInventoryForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!sessionStorage.getItem('inventoryAuth')) { showToast('error', 'غير مصرح لك'); return; }

    const inventoryId = document.getElementById('edit_inventory_id').value;
    const data = {
        current_stock: document.getElementById('edit_current_stock').value,
        batch_number:  document.getElementById('edit_batch_number').value,
        expiry_date:   document.getElementById('edit_expiry_date').value || null
    };

    try {
        const response = await fetch('/api/inventory/' + inventoryId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            document.getElementById('editInventoryModal').style.display = 'none';
            showToast('success', 'تم التعديل بنجاح ✓');
            loadInventory();  // Reload fresh data from server
        } else {
            showToast('error', 'فشل في التعديل: ' + (result.details || result.error || ''));
        }
    } catch (err) {
        console.error('Edit error:', err);
        showToast('error', 'خطأ في الاتصال بالسيرفر');
    }
});

// ── Delete (Soft Delete) ───────────────────────────────────────────────────────
async function deleteItem(productId, itemName) {
    if (!sessionStorage.getItem('inventoryAuth')) { showToast('error', 'غير مصرح لك'); return; }

    const confirmed = confirm(`هل أنت متأكد من إلغاء تنشيط العنصر:\n"${itemName}"?\n\nسيتم إخفاء العنصر من الجرد مع الإبقاء على السجلات التاريخية.`);
    if (!confirmed) return;

    // Optimistically remove all rows associated with this product from the DOM
    const rows = document.querySelectorAll(`.prod-row-${productId}`);
    rows.forEach(row => {
        row.style.transition = 'opacity .3s, transform .3s';
        row.style.opacity = '0';
        row.style.transform = 'translateX(20px)';
    });

    try {
        const response = await fetch('/api/inventory/' + productId, { method: 'DELETE' });
        const result = await response.json();

        if (response.ok) {
            // Remove from local cache
            allInventory = allInventory.filter(i => i.product_id !== productId);

            // Remove rows from DOM
            setTimeout(() => { rows.forEach(row => row.remove()); }, 300);

            showToast('success', `تم إلغاء تنشيط "${itemName}" بنجاح ✓`);
            
            // Broadcast deletion event to sync Master-Mirror
            if (window.BroadcastChannel) {
                const bc = new BroadcastChannel('inventory_sync');
                bc.postMessage({ type: 'delete', productId });
                bc.close();
            }
        } else {
            // Rollback: restore opacity
            rows.forEach(row => { row.style.opacity = '1'; row.style.transform = 'none'; });
            showToast('error', 'فشل في الحذف: ' + (result.details || result.error || ''));
        }
    } catch (error) {
        rows.forEach(row => { row.style.opacity = '1'; row.style.transform = 'none'; });
        console.error('Delete error:', error);
        showToast('error', 'خطأ في الاتصال بالسيرفر');
    }
}

// ── Toast Notifications ────────────────────────────────────────────────────────
let _toastTimer = null;
function showToast(type, msg) {
    let toast = document.getElementById('inv-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'inv-toast';
        Object.assign(toast.style, {
            position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%) translateY(20px)',
            padding: '12px 24px', borderRadius: '10px', fontFamily: 'inherit', fontSize: '0.95rem',
            fontWeight: '600', boxShadow: '0 4px 20px rgba(0,0,0,.15)', zIndex: '9999',
            transition: 'opacity .3s, transform .3s', opacity: '0', pointerEvents: 'none'
        });
        document.body.appendChild(toast);
    }

    const isSuccess = type === 'success';
    toast.style.background = isSuccess ? '#f0fdf4' : '#fef2f2';
    toast.style.color       = isSuccess ? '#15803d'  : '#b91c1c';
    toast.style.border      = `1px solid ${isSuccess ? '#bbf7d0' : '#fecaca'}`;
    toast.textContent       = msg;

    clearTimeout(_toastTimer);
    requestAnimationFrame(() => {
        toast.style.opacity   = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
    });
    _toastTimer = setTimeout(() => {
        toast.style.opacity   = '0';
        toast.style.transform = 'translateX(-50%) translateY(20px)';
    }, 3500);
}

// ── HTML Escape ────────────────────────────────────────────────────────────────
function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
