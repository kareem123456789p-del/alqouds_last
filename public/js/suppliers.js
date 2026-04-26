/* ============================================================
   suppliers.js  –  Local Supplier Directory frontend logic
   ============================================================ */

const API = '/api/suppliers';

/* ── State ─────────────────────────────────── */
let allSuppliers = [];   // full dataset from server
let filtered = [];   // after search/city filter
let currentPage = 1;
const PAGE_SIZE = 8;
let searchQuery = '';
let cityQuery = '';
let selectedId = null; // row highlighted in detail panel
let editingId = null; // null => add mode, number => edit mode
let pendingDeleteId = null;

/* ── Avatar colour palette ──────────────────── */
const PALETTE = [
    '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b',
    '#ef4444', '#06b6d4', '#ec4899', '#6366f1',
];
function avatarColor(str = '') {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
    return PALETTE[Math.abs(h) % PALETTE.length];
}
function initials(name = '') {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

/* ── Bootstrap ──────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    loadSuppliers();
});

/* ── API: Load all suppliers ─────────────────── */
async function loadSuppliers() {
    try {
        const res = await fetch(API);
        if (!res.ok) throw new Error('Server error');
        allSuppliers = await res.json();
        applyFilters();
        updateStats();
    } catch (err) {
        console.error('Load error:', err);
        showToast('Failed to load suppliers', 'error');
        document.getElementById('sup-tbody').innerHTML =
            `<tr><td colspan="6">
               <div class="empty-state">
                 <i class="fa-solid fa-circle-exclamation"></i>
                 <p>Unable to load data. Is the server running?</p>
               </div>
             </td></tr>`;
    }
}

/* ── Stats ──────────────────────────────────── */
function updateStats() {
    document.getElementById('stat-total').textContent = allSuppliers.length;
    // count suppliers added within current calendar month
    const now = new Date();
    const newThisMonth = allSuppliers.filter(s => {
        const created = s.created_at ? new Date(s.created_at) : null;
        return created &&
            created.getMonth() === now.getMonth() &&
            created.getFullYear() === now.getFullYear();
    }).length;
    const txt = document.getElementById('stat-new-text');
    if (txt) txt.textContent = `+${newThisMonth} new this month`;
}

/* ── Filtering & Pagination ─────────────────── */
function applyFilters() {
    const sq = searchQuery.toLowerCase();
    const cq = cityQuery.toLowerCase();
    filtered = allSuppliers.filter(s => {
        const matchSearch = !sq ||
            (s.company_name || '').toLowerCase().includes(sq) ||
            (s.contact_person || '').toLowerCase().includes(sq);
        const matchCity = !cq ||
            (s.city_area || '').toLowerCase().includes(cq);
        return matchSearch && matchCity;
    });
    currentPage = 1;
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('sup-tbody');
    const countEl = document.getElementById('table-count');

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6">
          <div class="empty-state">
            <i class="fa-solid fa-store"></i>
            <p>No suppliers found.</p>
          </div>
        </td></tr>`;
        if (countEl) countEl.textContent = '0 suppliers';
        renderPagination(0);
        return;
    }

    const start = (currentPage - 1) * PAGE_SIZE;
    const page = filtered.slice(start, start + PAGE_SIZE);

    tbody.innerHTML = page.map(s => {
        const bg = avatarColor(s.company_name || '');
        const ini = initials(s.company_name || '??');
        const isSelected = s.id === selectedId;
        return `
        <tr class="sup-row ${isSelected ? 'row-selected' : ''}" 
            onclick="selectRow(${s.id})" data-id="${s.id}">
            <td>
              <a class="sup-id-link" href="#" onclick="event.preventDefault()">
                ${escHtml(s.supplier_code || `SUP-${s.id}`)}
              </a>
            </td>
            <td>
              <div class="company-cell">
                <div class="sup-avatar" style="background:${bg}">${ini}</div>
                <span class="company-name-text">${escHtml(s.company_name)}</span>
              </div>
            </td>
            <td>${escHtml(s.contact_person || '—')}</td>
            <td>${escHtml(s.phone || '—')}</td>
            <td><span class="city-badge">${escHtml(s.city_area || '—')}</span></td>
            <td onclick="event.stopPropagation()">
              <div class="action-btns">
                <button class="btn-edit" onclick="openEditModal(${s.id})">
                  <i class="fa-solid fa-pen"></i> Edit
                </button>
                <button class="btn-del" onclick="confirmDelete(${s.id}, '${escHtml(s.company_name).replace(/'/g, "\\'")}')">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </td>
        </tr>`;
    }).join('');

    if (countEl) countEl.textContent = `${filtered.length} supplier${filtered.length !== 1 ? 's' : ''}`;
    renderPagination(filtered.length);
}

function renderPagination(total) {
    const pagEl = document.getElementById('pagination');
    if (!pagEl) return;
    const pages = Math.ceil(total / PAGE_SIZE);
    if (pages <= 1) { pagEl.innerHTML = ''; return; }

    let html = `<button class="page-btn" onclick="goPage(${currentPage - 1})"
                         ${currentPage === 1 ? 'disabled' : ''}>‹</button>`;
    for (let i = 1; i <= pages; i++) {
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}"
                         onclick="goPage(${i})">${i}</button>`;
    }
    html += `<button class="page-btn" onclick="goPage(${currentPage + 1})"
                      ${currentPage === pages ? 'disabled' : ''}>›</button>`;
    pagEl.innerHTML = html;
}

function goPage(n) {
    const pages = Math.ceil(filtered.length / PAGE_SIZE);
    if (n < 1 || n > pages) return;
    currentPage = n;
    renderTable();
}

/* ── Row selection / Detail Panel ───────────── */
function selectRow(id) {
    selectedId = (selectedId === id) ? null : id;
    renderTable(); // re-renders to update selection highlight
    renderDetailPanel();
}

function renderDetailPanel() {
    const emptyEl = document.getElementById('detail-empty');
    const contentEl = document.getElementById('detail-content');
    if (!emptyEl || !contentEl) return;

    if (!selectedId) {
        emptyEl.style.display = '';
        contentEl.style.display = 'none';
        contentEl.innerHTML = '';
        return;
    }

    const s = allSuppliers.find(x => x.id === selectedId);
    if (!s) { selectedId = null; renderDetailPanel(); return; }

    const bg = avatarColor(s.company_name || '');
    const ini = initials(s.company_name || '??');

    contentEl.innerHTML = `
      <div class="detail-top">
        <div class="detail-avatar" style="background:${bg}">${ini}</div>
        <div>
          <div class="detail-company-name">${escHtml(s.company_name)}</div>
          <span class="detail-badge">Verified Local</span>
        </div>
      </div>

      <div class="detail-section-title">CONTACT DETAILS</div>
      <div class="detail-info-list">
        <div class="detail-info-row">
          <i class="fa-solid fa-user"></i>
          <span>${escHtml(s.contact_person || '—')}</span>
        </div>
        <div class="detail-info-row">
          <i class="fa-solid fa-phone"></i>
          <span>${escHtml(s.phone || '—')}</span>
        </div>
        <div class="detail-info-row">
          <i class="fa-solid fa-location-dot"></i>
          <span>${escHtml(s.city_area || '—')}</span>
        </div>
      </div>

      ${s.notes ? `
      <div class="detail-section-title">NOTES</div>
      <div class="detail-notes">${escHtml(s.notes)}</div>` : ''}

      <div class="detail-action-row">
        <button class="detail-btn-edit" onclick="openEditModal(${s.id})" style="flex: 1;">
          <i class="fa-solid fa-pen"></i> Edit
        </button>
        <button class="detail-btn-del" style="flex: 1;"
          onclick="confirmDelete(${s.id}, '${escHtml(s.company_name).replace(/'/g, "\\'")}')">
          <i class="fa-solid fa-trash"></i> Delete
        </button>
      </div>
      <div style="margin-top: 1rem;">
          <button class="btn-primary" style="width: 100%; border-radius: 8px; padding: 0.75rem; background: linear-gradient(135deg, #3b82f6, #2563eb); border: none; color: white; cursor: pointer; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 0.5rem;" onclick="openHistoryModal(${s.id})">
              <i class="fa-solid fa-clock-rotate-left"></i> View Transaction History
          </button>
      </div>
    `;

    emptyEl.style.display = 'none';
    contentEl.style.display = '';
}

/* ── Search ──────────────────────────────────── */
function handleSearch(value) {
    searchQuery = value.trim();
    const clearBtn = document.getElementById('search-clear');
    if (clearBtn) {
        clearBtn.classList.toggle('visible', searchQuery.length > 0);
    }
    applyFilters();
}

function clearSearch() {
    const input = document.getElementById('global-search');
    if (input) input.value = '';
    handleSearch('');
}

/* ── City Filter ────────────────────────────── */
function toggleCityFilter() {
    const bar = document.getElementById('city-filter-bar');
    if (bar) bar.classList.toggle('open');
}

function handleCityFilter(value) {
    cityQuery = value.trim();
    applyFilters();
}

function clearCityFilter() {
    const input = document.getElementById('city-filter');
    if (input) input.value = '';
    handleCityFilter('');
}

/* ── Export CSV ─────────────────────────────── */
function exportCSV() {
    const headers = ['Supplier ID', 'Company Name', 'Contact Person', 'Phone', 'City/Area'];
    const rows = filtered.map(s => [
        s.supplier_code || s.id,
        s.company_name,
        s.contact_person,
        s.phone,
        s.city_area,
    ]);
    const csv = [headers, ...rows].map(r =>
        r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `suppliers_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
}

/* ── Modal: Add ─────────────────────────────── */
function openAddModal() {
    editingId = null;
    document.getElementById('modal-title').innerHTML =
        '<i class="fa-solid fa-store"></i> Add New Supplier';
    document.getElementById('btn-save').innerHTML =
        '<i class="fa-solid fa-plus"></i> Add Supplier';
    clearForm();
    openModal();
}

/* ── Modal: Edit ─────────────────────────────── */
function openEditModal(id) {
    const s = allSuppliers.find(x => x.id === id);
    if (!s) return;
    editingId = id;
    document.getElementById('modal-title').innerHTML =
        '<i class="fa-solid fa-pen"></i> Edit Supplier';
    document.getElementById('btn-save').innerHTML =
        '<i class="fa-solid fa-floppy-disk"></i> Save Changes';
    document.getElementById('f-company').value = s.company_name || '';
    document.getElementById('f-contact').value = s.contact_person || '';
    document.getElementById('f-phone').value = s.phone || '';
    document.getElementById('f-city').value = s.city_area || '';
    document.getElementById('f-notes').value = s.notes || '';
    document.getElementById('edit-id').value = id;
    openModal();
}

function openModal() {
    document.getElementById('modal-overlay').classList.add('open');
    document.getElementById('f-company').focus();
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
}

function closeModalOnBack(e) {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
}

function clearForm() {
    ['f-company', 'f-contact', 'f-phone', 'f-city', 'f-notes', 'edit-id']
        .forEach(id => { document.getElementById(id).value = ''; });
}

/* ── Form Submit ────────────────────────────── */
async function submitForm(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save');
    const body = {
        company_name: document.getElementById('f-company').value.trim(),
        contact_person: document.getElementById('f-contact').value.trim(),
        phone: document.getElementById('f-phone').value.trim(),
        city_area: document.getElementById('f-city').value.trim(),
        notes: document.getElementById('f-notes').value.trim() || null,
    };
    if (!body.company_name || !body.contact_person || !body.phone || !body.city_area) {
        showToast('Please fill in all required fields.', 'error');
        return;
    }
    btn.disabled = true;
    try {
        let res;
        if (editingId) {
            res = await fetch(`${API}/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
        } else {
            res = await fetch(API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
        }
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Server error');
        }
        closeModal();
        showToast(editingId ? 'Supplier updated!' : 'Supplier added!', 'success');
        await loadSuppliers();
        if (editingId && selectedId === editingId) renderDetailPanel();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
    }
}

/* ── Delete ──────────────────────────────────── */
function confirmDelete(id, name) {
    pendingDeleteId = id;
    const p = document.querySelector('#confirm-dialog p');
    if (p) p.textContent = `Delete "${name}"? This action cannot be undone.`;
    document.getElementById('confirm-dialog').classList.add('open');
}

function cancelDelete() {
    pendingDeleteId = null;
    document.getElementById('confirm-dialog').classList.remove('open');
}

async function doDelete() {
    if (!pendingDeleteId) return;
    document.getElementById('confirm-dialog').classList.remove('open');
    try {
        const res = await fetch(`${API}/${pendingDeleteId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed');
        if (selectedId === pendingDeleteId) {
            selectedId = null;
            renderDetailPanel();
        }
        showToast('Supplier deleted.', 'success');
        await loadSuppliers();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        pendingDeleteId = null;
    }
}

/* ── Toast ───────────────────────────────────── */
function showToast(msg, type = '') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-circle-check'
        : type === 'error' ? 'fa-circle-exclamation'
            : 'fa-circle-info';
    t.innerHTML = `<i class="fa-solid ${icon}"></i> ${escHtml(msg)}`;
    container.appendChild(t);
    setTimeout(() => {
        t.style.opacity = '0';
        t.style.transition = 'opacity 0.3s';
        setTimeout(() => t.remove(), 300);
    }, 3000);
}

/* ── History Modal ────────────────────────────── */

// Track current month groups globally so the details modal can read from it
window.currentMonthGroups = [];

async function openHistoryModal(id) {
    document.getElementById('history-modal-overlay').classList.add('open');

    const listEl = document.getElementById('hist-shipments-list');
    listEl.innerHTML = `
        <div style="text-align:center;padding:3rem;color:#94a3b8;">
            <i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;margin-bottom:.75rem;display:block;"></i>
            جاري تحميل السجل...
        </div>`;

    document.getElementById('hist-total-count').textContent   = '…';
    document.getElementById('hist-total-balance').textContent = '…';

    try {
        const res = await fetch(`${API}/${id}/history`);
        if (!res.ok) throw new Error('Failed to fetch history');
        const data = await res.json();

        // ── Summary stats ──────────────────────────────────────────────────
        document.getElementById('hist-total-count').textContent =
            data.total_transactions_count;
        document.getElementById('hist-total-balance').textContent =
            '$' + Number(data.total_outstanding_balance)
                    .toLocaleString(undefined, { minimumFractionDigits: 2 });

        window.currentMonthGroups = data.monthGroups || [];

        // ── Shipment cards (Grouped by Month) ──────────────────────────────
        if (!data.monthGroups || data.monthGroups.length === 0) {
            listEl.innerHTML = `
                <div style="text-align:center;padding:3rem;color:#94a3b8;">
                    <i class="fa-solid fa-folder-open" style="font-size:2.5rem;display:block;margin-bottom:.75rem;"></i>
                    لا توجد شحنات مسجلة لهذا المورد.
                </div>`;
            return;
        }

        listEl.innerHTML = data.monthGroups.map((group, mIdx) => {
            const shipmentsHtml = group.shipments.map((s, sIdx) => {
                const dateObj  = new Date(s.created_at);
                const dateStr  = dateObj.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
                const timeStr  = dateObj.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
                const total    = Number(s.shipment_total).toLocaleString(undefined, { minimumFractionDigits: 2 });
                const imgPath  = s.invoice_image; 
                const count    = s.items ? s.items.length : 0;

                const invoiceBtn = imgPath
                    ? `<button onclick="openLightbox('${imgPath}')"
                           style="display:flex;align-items:center;gap:8px;padding:10px 20px;border:none;border-radius:10px;
                                  background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;font-weight:700;
                                  font-size:.9rem;cursor:pointer;white-space:nowrap;transition:.2s;flex-shrink:0;"
                           onmouseover="this.style.transform='scale(1.04)'"
                           onmouseout="this.style.transform='scale(1)'">
                           <i class="fa-solid fa-eye"></i> عرض الفاتورة
                       </button>`
                    : `<div style="display:flex;align-items:center;gap:8px;padding:10px 18px;border-radius:10px;
                                  background:#f1f5f9;color:#94a3b8;font-size:.82rem;font-weight:600;white-space:nowrap;flex-shrink:0;border:1px dashed #cbd5e1;">
                           <i class="fa-solid fa-image-slash"></i> لا توجد صورة فاتورة
                       </div>`;

                return `
                <div style="display:flex;align-items:center;gap:1rem;padding:1rem 1.25rem;
                            background:#fff;border:1px solid #e2e8f0;border-radius:12px;
                            box-shadow:0 1px 4px rgba(0,0,0,.04);transition:box-shadow .2s;"
                     onmouseover="this.style.boxShadow='0 4px 16px rgba(0,0,0,.08)'"
                     onmouseout="this.style.boxShadow='0 1px 4px rgba(0,0,0,.04)'">

                    <!-- Date column -->
                    <div style="min-width:90px;text-align:center;background:#f8fafc;border-radius:10px;padding:.6rem .8rem;border:1px solid #e2e8f0;">
                        <div style="font-size:.68rem;font-weight:700;color:#94a3b8;letter-spacing:.4px;margin-bottom:2px;">DATE</div>
                        <div style="font-size:.85rem;font-weight:700;color:#1e293b;line-height:1.2;">${dateStr}</div>
                        <div style="font-size:.72rem;color:#94a3b8;">${timeStr}</div>
                    </div>

                    <!-- Info column -->
                    <div style="flex:1;min-width:0;">
                        <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:4px;">
                            <i class="fa-solid fa-truck-ramp-box" style="color:#3b82f6;font-size:.85rem;"></i>
                            <span style="font-weight:700;color:#1e293b;font-size:.9rem;">
                                شحنة — ${count} ${count === 1 ? 'صنف' : 'أصناف'}
                            </span>
                        </div>
                        <div style="margin-top:0.5rem;">
                            <button onclick="openShipmentDetailsModal(${mIdx}, ${sIdx})"
                                    style="background:#f1f5f9;border:1px solid #cbd5e1;padding:0.4rem 0.8rem;border-radius:6px;font-size:0.8rem;color:#475569;cursor:pointer;display:flex;align-items:center;gap:0.4rem;font-weight:600;transition:0.2s;"
                                    onmouseover="this.style.background='#e2e8f0';this.style.color='#1e293b';"
                                    onmouseout="this.style.background='#f1f5f9';this.style.color='#475569';">
                                <i class="fa-solid fa-list-ul"></i> View Items
                            </button>
                        </div>
                    </div>

                    <!-- Total column -->
                    <div style="text-align:center;min-width:90px;">
                        <div style="font-size:.68rem;font-weight:700;color:#94a3b8;letter-spacing:.4px;margin-bottom:2px;">TOTAL</div>
                        <div style="font-size:1.05rem;font-weight:800;color:#059669;">$${total}</div>
                    </div>

                    <!-- Invoice button -->
                    ${invoiceBtn}
                </div>`;
            }).join('');

            return `
            <div class="accordion-item" style="margin-bottom:1rem;">
                <div class="accordion-header" onclick="toggleAccordion(this)">
                    <div style="display:flex;align-items:center;gap:0.75rem;">
                        <i class="fa-solid fa-folder" style="color:#3b82f6;font-size:1.2rem;"></i>
                        <span style="font-size:1.05rem;">${group.monthLabel}</span>
                    </div>
                    <i class="fa-solid fa-chevron-down accordion-icon"></i>
                </div>
                <div class="accordion-content">
                    ${shipmentsHtml}
                </div>
            </div>
            `;
        }).join('');

    } catch (err) {
        showToast(err.message, 'error');
        listEl.innerHTML = `
            <div style="text-align:center;padding:2rem;color:#ef4444;">
                <i class="fa-solid fa-circle-exclamation" style="font-size:1.5rem;display:block;margin-bottom:.5rem;"></i>
                خطأ في تحميل السجل.
            </div>`;
    }
}

function toggleAccordion(headerEl) {
    headerEl.classList.toggle('active');
    const content = headerEl.nextElementSibling;
    if (content.classList.contains('open')) {
        content.classList.remove('open');
    } else {
        content.classList.add('open');
    }
}

function openShipmentDetailsModal(monthIdx, shipmentIdx) {
    const group = window.currentMonthGroups[monthIdx];
    if (!group) return;
    const shipment = group.shipments[shipmentIdx];
    if (!shipment) return;

    const tbody = document.getElementById('shipment-details-tbody');
    tbody.innerHTML = '';

    if (!shipment.items || shipment.items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:1.5rem;color:#64748b;">لا توجد أصناف مسجلة لهذه الشحنة.</td></tr>`;
    } else {
        tbody.innerHTML = shipment.items.map(item => `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 0.75rem; font-weight: 600; color: #1e293b;">${escHtml(item.product_name)}</td>
                <td style="padding: 0.75rem; text-align: center; color: #475569;">${item.quantity}</td>
                <td style="padding: 0.75rem; text-align: right; color: #059669; font-weight: 600;">$${Number(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
        `).join('');
    }

    document.getElementById('shipment-details-overlay').classList.add('open');
}

function closeShipmentDetails() {
    document.getElementById('shipment-details-overlay').classList.remove('open');
}

function closeShipmentDetailsOnBack(e) {
    if (e.target === document.getElementById('shipment-details-overlay')) closeShipmentDetails();
}

function closeHistoryModal() {
    document.getElementById('history-modal-overlay').classList.remove('open');
}

function closeHistoryModalOnBack(e) {
    if (e.target === document.getElementById('history-modal-overlay')) closeHistoryModal();
}

/* ── Invoice Lightbox ─────────────────────────── */
function openLightbox(imagePath) {
    const lb  = document.getElementById('invoice-lightbox');
    const img = document.getElementById('lightbox-img');
    const dl  = document.getElementById('lightbox-download');
    img.src   = imagePath;
    img.onerror = function() { this.src = '/img/placeholder.png'; this.style.opacity = 0.5; this.onerror=null; };
    dl.href   = imagePath;
    lb.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    document.getElementById('invoice-lightbox').style.display = 'none';
    document.body.style.overflow = '';
}

/* close lightbox on Escape */
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        const lb = document.getElementById('invoice-lightbox');
        if (lb && lb.style.display === 'flex') { closeLightbox(); return; }
        const overlay = document.getElementById('modal-overlay');
        if (overlay && overlay.classList.contains('open')) closeModal();
    }
});

/* ── Util ────────────────────────────────────── */
function escHtml(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

