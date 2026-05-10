/**
 * Transfer Console — Frontend Logic
 * Manages the 3-step inter-warehouse transfer wizard.
 */

// ── State ────────────────────────────────────────────
let selectedSourceId = null;
let selectedSourceName = '';
let allProducts = [];
let currentPage = 1;
const PAGE_SIZE = 8;

// ── DOM Refs ─────────────────────────────────────────
const warehouseGrid = document.getElementById('warehouse-grid');
const itemsTbody = document.getElementById('items-tbody');
const tableInfo = document.getElementById('table-info');
const destSelect = document.getElementById('dest-warehouse');
const summaryItems = document.getElementById('summary-items');
const summaryUnits = document.getElementById('summary-units');
const summaryFrom = document.getElementById('summary-from');
const summaryTo = document.getElementById('summary-to');
const btnConfirm = document.getElementById('btn-confirm');
const selectAllChk = document.getElementById('select-all-items');
const paginationCtrl = document.getElementById('pagination-controls');

// ── Bootstrap ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadWarehouses();

    destSelect.addEventListener('change', () => {
        summaryTo.textContent = destSelect.options[destSelect.selectedIndex]?.text || 'None selected';
        summaryTo.style.color = destSelect.value ? '#1f2937' : '#9ca3af';
        validateConfirmButton();
    });

    selectAllChk.addEventListener('change', () => {
        document.querySelectorAll('.row-checkbox').forEach(cb => {
            cb.checked = selectAllChk.checked;
            const row = cb.closest('tr');
            toggleRowQtyInput(row, cb.checked);
        });
        updateSummary();
        validateConfirmButton();
    });
});

// ── Step 1: Load Warehouses ──────────────────────────
async function loadWarehouses() {
    try {
        const res = await fetch('/api/transfer/warehouses');
        const data = await res.json();
        window._allWarehouses = data; // cache for reactive dest filtering
        renderWarehouseCards(data);
        populateDestDropdown(data);
    } catch (err) {
        showToast('Failed to load warehouses. Is the server running?', 'error');
        warehouseGrid.innerHTML = `<p style="color:#ef4444;font-size:0.875rem">Error: ${err.message}</p>`;
    }
}

function renderWarehouseCards(warehouses) {
    warehouseGrid.innerHTML = warehouses.map(wh => {
        const fillPct = Math.min(Math.round((wh.total_stock / wh.capacity) * 100), 100);
        return `
        <div class="warehouse-card" id="wh-card-${wh.id}" onclick="selectWarehouse(${wh.id}, '${escapeHtml(wh.name)}')">
            <div class="wh-check"><i class="fa-solid fa-check"></i></div>
            <div class="wh-icon"><i class="fa-solid fa-warehouse"></i></div>
            <div class="wh-name">${escapeHtml(wh.name)}</div>
            <div class="wh-loc">${escapeHtml(wh.location)}</div>
            <div class="wh-capacity-label">Capacity</div>
            <div class="capacity-bar-bg">
                <div class="capacity-bar-fill" style="width:${fillPct}%"></div>
            </div>
            <div class="capacity-pct">${fillPct}% Full</div>
        </div>`;
    }).join('');
}

function populateDestDropdown(warehouses, excludeId = null) {
    destSelect.innerHTML = '<option value="">— Select Target Warehouse —</option>';
    warehouses.forEach(wh => {
        if (String(wh.id) === String(excludeId)) return; // exclude source
        const opt = document.createElement('option');
        opt.value = wh.id;
        opt.textContent = `${wh.name} (${wh.location})`;
        destSelect.appendChild(opt);
    });
    // reset destination summary when source changes
    summaryTo.textContent = 'None selected';
    summaryTo.style.color = '#9ca3af';
}

// ── Step 1: Select Warehouse ─────────────────────────
async function selectWarehouse(warehouseId, warehouseName) {
    // Remove highlight from all cards
    document.querySelectorAll('.warehouse-card').forEach(c => c.classList.remove('selected'));

    // Highlight selected card
    const card = document.getElementById(`wh-card-${warehouseId}`);
    if (card) card.classList.add('selected');

    selectedSourceId = warehouseId;
    selectedSourceName = warehouseName;
    currentPage = 1;

    // Update summary
    summaryFrom.textContent = warehouseName;
    summaryFrom.style.color = '#1f2937';

    // Reactively rebuild destination dropdown excluding the new source
    populateDestDropdown(window._allWarehouses || [], warehouseId);
    destSelect.value = '';
    validateConfirmButton();

    // Fetch products for this warehouse
    itemsTbody.innerHTML = `
        <tr>
            <td colspan="5" class="table-empty-state">
                <div class="spinner" style="margin:0 auto 0.75rem"></div>
                <p>Loading inventory for <strong>${escapeHtml(warehouseName)}</strong>…</p>
            </td>
        </tr>`;
    tableInfo.textContent = 'Loading…';

    try {
        const res = await fetch(`/api/transfer/products/${warehouseId}`);
        allProducts = await res.json();
        renderItemsPage(currentPage);
    } catch (err) {
        itemsTbody.innerHTML = `
            <tr>
                <td colspan="5" class="table-empty-state">
                    <i class="fa-solid fa-circle-exclamation" style="color:#ef4444"></i>
                    <p>Failed to load products: ${err.message}</p>
                </td>
            </tr>`;
    }
}

// ── Step 2: Render Items Table ───────────────────────
function renderItemsPage(page) {
    if (!allProducts || allProducts.length === 0) {
        itemsTbody.innerHTML = `
            <tr>
                <td colspan="5" class="table-empty-state">
                    <i class="fa-solid fa-box-open" style="font-size: 2rem; color: #cbd5e1; margin-bottom: 0.5rem; display: block;"></i>
                    <p>هذا المخزن فارغ حالياً، لا توجد أصناف قابلة للنقل</p>
                </td>
            </tr>`;
        tableInfo.textContent = 'لا توجد أصناف.';
        paginationCtrl.innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(allProducts.length / PAGE_SIZE);
    const start = (page - 1) * PAGE_SIZE;
    const pageItems = allProducts.slice(start, start + PAGE_SIZE);
    currentPage = page;

    const icons = ['fa-pills', 'fa-syringe', 'fa-flask', 'fa-kit-medical', 'fa-bandage'];

    itemsTbody.innerHTML = pageItems.map((item, idx) => {
        const icon = icons[idx % icons.length];
        return `
        <tr data-product-id="${item.id}">
            <td>
                <input type="checkbox" class="item-checkbox row-checkbox"
                    onchange="onRowCheck(this)"
                    data-id="${item.id}"
                    data-name="${escapeHtml(item.name)}"
                    data-avail="${item.available_qty}">
            </td>
            <td>
                <div class="item-name-col">
                    <div class="item-icon-badge"><i class="fa-solid ${icon}"></i></div>
                    <div>
                        <div class="item-text-name">${escapeHtml(item.name)}</div>
                        <div class="item-text-sku">${escapeHtml(item.sku || 'N/A')}</div>
                    </div>
                </div>
            </td>
            <td class="sku-cell">${escapeHtml(item.sku || '—')}</td>
            <td class="avail-qty">${Number(item.available_qty).toLocaleString()} Units</td>
            <td>
                <input type="number"
                    class="transfer-qty-input qty-input"
                    data-product-id="${item.id}"
                    data-available="${item.available_qty}"
                    min="0"
                    max="${item.available_qty}"
                    value="0"
                    disabled
                    oninput="onQtyChange(this)">
            </td>
        </tr>`;
    }).join('');

    // Update footer info
    const endIdx = Math.min(start + PAGE_SIZE, allProducts.length);
    tableInfo.textContent = `Showing ${start + 1}-${endIdx} of ${allProducts.length} medical supplies`;

    // Render pagination
    renderPagination(page, totalPages);

    // Reset select-all
    selectAllChk.checked = false;
    updateSummary();
}

function renderPagination(current, total) {
    if (total <= 1) { paginationCtrl.innerHTML = ''; return; }

    let html = `<button onclick="changePage(${current - 1})" ${current === 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i></button>`;
    for (let p = 1; p <= total; p++) {
        html += `<button class="${p === current ? 'pg-active' : ''}" onclick="changePage(${p})">${p}</button>`;
    }
    html += `<button onclick="changePage(${current + 1})" ${current === total ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button>`;
    paginationCtrl.innerHTML = html;
}

function changePage(page) {
    const total = Math.ceil(allProducts.length / PAGE_SIZE);
    if (page < 1 || page > total) return;
    renderItemsPage(page);
}

// ── Row Checkbox / Qty Toggle ────────────────────────
function onRowCheck(checkbox) {
    const row = checkbox.closest('tr');
    toggleRowQtyInput(row, checkbox.checked);

    // Sync select-all state
    const allChecks = document.querySelectorAll('.row-checkbox');
    selectAllChk.checked = [...allChecks].every(c => c.checked);
    selectAllChk.indeterminate = !selectAllChk.checked && [...allChecks].some(c => c.checked);

    updateSummary();
    validateConfirmButton();
}

function toggleRowQtyInput(row, enabled) {
    const qtyInput = row.querySelector('.qty-input');
    if (!qtyInput) return;
    qtyInput.disabled = !enabled;
    if (!enabled) { qtyInput.value = 0; }
    else if (Number(qtyInput.value) === 0) { qtyInput.value = 1; }
}

function onQtyChange(input) {
    const max = parseInt(input.getAttribute('data-available'), 10);
    let val = parseInt(input.value, 10);

    if (isNaN(val) || val < 0) { input.value = 0; val = 0; }
    if (val > max) { input.value = max; val = max; showToast(`Max available: ${max} units`, 'info'); }

    updateSummary();
    validateConfirmButton();
}

// ── Summary Update ───────────────────────────────────
function updateSummary() {
    const checked = document.querySelectorAll('.row-checkbox:checked');
    let totalUnits = 0;
    checked.forEach(cb => {
        const row = cb.closest('tr');
        const input = row.querySelector('.qty-input');
        totalUnits += parseInt(input?.value || 0, 10);
    });
    summaryItems.textContent = `${checked.length} Type${checked.length !== 1 ? 's' : ''}`;
    summaryUnits.textContent = `${totalUnits.toLocaleString()} Units`;
}

function validateConfirmButton() {
    const hasSource = !!selectedSourceId;
    const hasDest = !!destSelect.value;
    const hasItems = document.querySelectorAll('.row-checkbox:checked').length > 0;
    const differentWh = String(selectedSourceId) !== String(destSelect.value);

    btnConfirm.disabled = !(hasSource && hasDest && hasItems && differentWh);
}

// ── Step 3: Confirm Transfer ─────────────────────────
async function confirmTransfer() {
    const toWarehouseId = destSelect.value;
    if (!selectedSourceId || !toWarehouseId) { return; }

    const checkedRows = document.querySelectorAll('.row-checkbox:checked');
    const items = [];
    checkedRows.forEach(cb => {
        const row = cb.closest('tr');
        const input = row.querySelector('.qty-input');
        const qty = parseInt(input?.value || 0, 10);
        if (qty > 0) {
            items.push({ product_id: parseInt(cb.dataset.id, 10), quantity: qty });
        }
    });

    if (items.length === 0) {
        showToast('Please set a transfer quantity > 0 for at least one selected item.', 'error');
        return;
    }

    const payload = {
        from_warehouse_id: parseInt(selectedSourceId, 10),
        to_warehouse_id: parseInt(toWarehouseId, 10),
        items
    };

    // Disable button & show loading
    btnConfirm.disabled = true;
    btnConfirm.innerHTML = '<div class="spinner"></div> Processing…';

    try {
        const res = await fetch('/api/transfer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Transfer failed');

        showToast(`✅ ${data.message}`, 'success');

        // Reload source warehouse stock BEFORE resetting form, so selectedSourceId is still valid
        const reloadId = selectedSourceId;
        const reloadName = selectedSourceName;
        resetForm();
        await selectWarehouse(reloadId, reloadName);
        // Also refresh warehouse cards to reflect updated fill %
        const whRes = await fetch('/api/transfer/warehouses');
        const whData = await whRes.json();
        window._allWarehouses = whData;
        renderWarehouseCards(whData);
        // Re-highlight the active source card
        const card = document.getElementById(`wh-card-${reloadId}`);
        if (card) card.classList.add('selected');
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btnConfirm.innerHTML = '<i class="fa-solid fa-circle-check"></i> Confirm Transfer Now';
        validateConfirmButton();
    }
}

function saveDraft() {
    showToast('Draft saved locally. (Draft persistence coming soon)', 'info');
}

// Reset only item selections — preserve source warehouse context
function resetForm() {
    selectAllChk.checked = false;
    document.querySelectorAll('.row-checkbox').forEach(cb => {
        cb.checked = false;
        const row = cb.closest('tr');
        toggleRowQtyInput(row, false);
    });
    destSelect.value = '';
    summaryTo.textContent = 'None selected';
    summaryTo.style.color = '#9ca3af';
    updateSummary();
    validateConfirmButton();
}

// ── Toast Utility ────────────────────────────────────
function showToast(msg, type = 'info') {
    const icons = { success: 'fa-circle-check', error: 'fa-circle-exclamation', info: 'fa-circle-info' };
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fa-solid ${icons[type]} toast-icon"></i>
        <span>${msg}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fade-out 0.3s ease both';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ── HTML Escape Utility ──────────────────────────────
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
