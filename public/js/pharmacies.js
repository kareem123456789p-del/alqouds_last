/* pharmacies.js */

let allPharmacies = [];
let selectedPharmacyId = null;

document.addEventListener('DOMContentLoaded', () => {
    loadPharmacies();
});

async function loadPharmacies() {
    try {
        const res = await fetch('/api/pharmacies');
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            console.error('API Error loading pharmacies:', errData.error || res.statusText);
            return;
        }
        allPharmacies = await res.json();
        console.log('Loaded pharmacies:', allPharmacies.length); // Debug log
        renderTable(allPharmacies);
        updateStats();
    } catch (err) {
        console.error('Network Error loading pharmacies:', err);
    }
}

function updateStats() {
    document.getElementById('stat-total-pharmacies').textContent = allPharmacies.length;
    document.getElementById('stat-active-pharmacies').textContent = allPharmacies.filter(p => p.status === 'active').length;

    const totalDebt = allPharmacies.reduce((sum, p) => sum + parseFloat(p.total_debt || 0), 0);
    document.getElementById('stat-total-debt').textContent = '$' + totalDebt.toLocaleString(undefined, { minimumFractionDigits: 2 });
}

function renderTable(data) {
    const tbody = document.getElementById('pharmacies-tbody');
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">لا توجد صيدليات.</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(p => {
        let badgeClass = 'badge active';
        let statusText = 'نشط';
        if (p.status === 'pending') { badgeClass = 'badge pending'; statusText = 'قيد الانتظار'; }
        if (p.status === 'suspended') { badgeClass = 'badge suspended'; statusText = 'موقوف'; }

        return `
            <tr onclick="selectPharmacy(${p.id}, this)">
                <td style="font-weight:600; color:#1e293b;">
                    <i class="fa-solid fa-store" style="color:#64748b; margin-left:8px;"></i>
                    ${p.name}
                </td>
                <td style="font-family:monospace; color:#64748b;">${p.license_number || '-'}</td>
                <td>${p.area || '-'}</td>
                <td><span class="${badgeClass}">${statusText}</span></td>
                <td style="font-weight:600;">$${parseFloat(p.credit_limit || 20000).toLocaleString()}</td>
                <td style="text-align:center; white-space:nowrap;" onclick="event.stopPropagation()">
                    <button class="action-icon-btn edit" title="تعديل" onclick="openEditModal(${p.id})">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="action-icon-btn delete" title="حذف" onclick="deletePharmacy(${p.id}, '${p.name.replace(/'/g, "&#39;")}')">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                    <button class="action-icon-btn" title="سجل المعاملات" onclick="openClientHistoryModal('pharmacy', ${p.id}, '${p.name.replace(/'/g, "&#39;")}')" style="color:#3b82f6; border-color:#bfdbfe; background:#eff6ff;">
                        <i class="fa-solid fa-clock-rotate-left"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function filterPharmacies() {
    const q = document.getElementById('directory-search').value.toLowerCase();
    const filtered = allPharmacies.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.area && p.area.toLowerCase().includes(q)) ||
        (p.license_number && p.license_number.toLowerCase().includes(q))
    );
    renderTable(filtered);
}

// Side Profile
function selectPharmacy(id, rowElement) {
    // UI toggle
    document.querySelectorAll('.data-table tr').forEach(r => r.classList.remove('selected'));
    if (rowElement) rowElement.classList.add('selected');

    selectedPharmacyId = id;
    const p = allPharmacies.find(x => Number(x.id) === Number(id));
    if (!p) { console.warn('Pharmacy not found in local cache for id:', id); return; }

    // Show panel
    document.getElementById('empty-sidebar-msg').style.display = 'none';
    document.getElementById('pharmacy-profile-sidebar').style.display = 'block';

    // Populate data
    document.getElementById('profile-name').textContent = p.name;

    let statusText = p.status === 'active' ? 'نشط' : (p.status === 'pending' ? 'قيد الانتظار' : 'موقوف');
    let badgeClass = p.status === 'active' ? 'badge active' : (p.status === 'pending' ? 'badge pending' : 'badge suspended');
    document.getElementById('profile-status').className = badgeClass;
    document.getElementById('profile-status').textContent = statusText;

    document.getElementById('profile-contact').innerHTML = `<i class="fa-solid fa-user"></i> <span>${p.contact_person || '-'}</span>`;
    document.getElementById('profile-phone').innerHTML = `<i class="fa-solid fa-phone"></i> <span dir="ltr">${p.phone || '-'}</span>`;
    document.getElementById('profile-area').innerHTML = `<i class="fa-solid fa-location-dot"></i> <span>${p.area || '-'}</span>`;

    document.getElementById('profile-limit').textContent = '$' + parseFloat(p.credit_limit || 20000).toLocaleString(undefined, { minimumFractionDigits: 2 });
    document.getElementById('profile-debt').textContent = '$' + parseFloat(p.total_debt || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });
    // History button in sidebar
    const histBtn = document.getElementById('pharmacy-history-btn');
    if (histBtn) histBtn.onclick = () => openClientHistoryModal('pharmacy', id, p.name);
}

// Create Order Redirection
function createOrderForPharmacy() {
    if (!selectedPharmacyId) return;
    window.location.href = `orders.html?client=pharm_${selectedPharmacyId}`;
}

// Modal actions
function openPharmacyModal() {
    document.getElementById('addPharmacyForm').reset();
    document.getElementById('addPharmacyModal').classList.add('active');
}

function closePharmacyModal() {
    document.getElementById('addPharmacyModal').classList.remove('active');
}

async function submitPharmacy(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-pharmacy');
    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    btn.disabled = true;
    btn.textContent = 'جاري الحفظ...';

    try {
        const res = await fetch('/api/pharmacies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Server error');

        alert('تم تسجيل الصيدلية بنجاح!');
        closePharmacyModal();
        loadPharmacies();

    } catch (err) {
        alert('حدث خطأ أثناء الحفظ: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'حفظ البيانات';
    }
}

/* ── Safe JSON helper ──────────────────────────────── */
// Gracefully parses a response as JSON — if the server returned an HTML page
// (e.g. because a route doesn't exist yet), returns a clean error object instead.
async function safeJson(res) {
    const text = await res.text();
    try { return JSON.parse(text); }
    catch { return { error: `HTTP ${res.status} — route missing or server not restarted.` }; }
}

/* ── Edit Pharmacy Functions ──────────────────────── */
function openEditModal(id) {
    const p = allPharmacies.find(x => Number(x.id) === Number(id));
    if (!p) return;

    document.getElementById('edit-pharmacy-id').value = p.id;
    document.getElementById('edit-name').value = p.name;
    document.getElementById('edit-license').value = p.license_number || '';
    document.getElementById('edit-area').value = p.area || '';
    document.getElementById('edit-contact').value = p.contact_person || '';
    document.getElementById('edit-phone').value = p.phone || '';
    document.getElementById('edit-credit').value = p.credit_limit || 20000;
    document.getElementById('edit-status').value = p.status || 'active';

    document.getElementById('editPharmacyModal').classList.add('active');
}

function closeEditModal() {
    document.getElementById('editPharmacyModal').classList.remove('active');
}

async function submitEditPharmacy(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-edit');
    const id = document.getElementById('edit-pharmacy-id').value;

    const payload = {
        name: document.getElementById('edit-name').value,
        license_number: document.getElementById('edit-license').value,
        contact_person: document.getElementById('edit-contact').value,
        area: document.getElementById('edit-area').value,
        phone: document.getElementById('edit-phone').value,
        credit_limit: document.getElementById('edit-credit').value,
        status: document.getElementById('edit-status').value,
    };

    btn.disabled = true;
    btn.textContent = 'جاري الحفظ...';

    try {
        const res = await fetch(`/api/pharmacies/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await safeJson(res);
        if (!res.ok) throw new Error(result.error || 'Server error');

        closeEditModal();
        loadPharmacies();

    } catch (err) {
        alert('حدث خطأ أثناء التعديل: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'حفظ التعديلات';
    }
}

/* ── Delete Pharmacy ──────────────────────────────── */
async function deletePharmacy(id, name) {
    if (!confirm(`هل أنت متأكد من حذف صيدلية "${name}"؟ لا يمكن التراجع عن هذا الإجراء.`)) return;

    try {
        const res = await fetch(`/api/pharmacies/${id}`, { method: 'DELETE' });
        const result = await safeJson(res);
        if (!res.ok) throw new Error(result.error || 'Server error');

        loadPharmacies();

        // If this pharmacy's profile is open in the sidebar, close it
        if (Number(selectedPharmacyId) === Number(id)) {
            selectedPharmacyId = null;
            document.getElementById('pharmacy-profile-sidebar').style.display = 'none';
            document.getElementById('empty-sidebar-msg').style.display = 'flex';
        }
    } catch (err) {
        alert('حدث خطأ أثناء الحذف: ' + err.message);
    }
}

/* ══════════════════════════════════════════════════════════════
   UNIFIED CLIENT TRANSACTION HISTORY MODAL
   Reused by both pharmacies.js and doctors.js
   ══════════════════════════════════════════════════════════════ */

window.clientHistoryMonthGroups = [];
// Cache fetched order items so we don't re-fetch on every toggle
window._orderItemsCache = {};

async function openClientHistoryModal(clientType, id, name) {
    let overlay = document.getElementById('client-history-overlay');
    if (!overlay) _buildClientHistoryModal();
    overlay = document.getElementById('client-history-overlay');

    overlay.classList.add('open');
    document.getElementById('client-hist-title').textContent = `سجل معاملات: ${name}`;
    document.getElementById('client-hist-total-count').textContent = '…';
    document.getElementById('client-hist-total-balance').textContent = '…';
    const listEl = document.getElementById('client-hist-list');
    listEl.innerHTML = `<div style="text-align:center;padding:3rem;color:#94a3b8;">
        <i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;margin-bottom:.75rem;display:block;"></i>
        جاري تحميل السجل...</div>`;

    try {
        const res = await fetch(`/api/orders/history/${clientType}/${id}`);
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();

        document.getElementById('client-hist-total-count').textContent = data.total_transactions_count;
        document.getElementById('client-hist-total-balance').textContent =
            '$' + Number(data.total_outstanding_balance).toLocaleString(undefined, { minimumFractionDigits: 2 });

        window.clientHistoryMonthGroups = data.monthGroups || [];

        if (!data.monthGroups || data.monthGroups.length === 0) {
            listEl.innerHTML = `<div style="text-align:center;padding:3rem;color:#94a3b8;">
                <i class="fa-solid fa-folder-open" style="font-size:2.5rem;display:block;margin-bottom:.75rem;"></i>
                لا توجد طلبات مسجلة لهذا العميل.</div>`;
            return;
        }

        listEl.innerHTML = data.monthGroups.map(group => {
            const shipmentsHtml = group.shipments.map(s => {
                const dateObj = new Date(s.created_at);
                const dateStr = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const total   = Number(s.shipment_total).toLocaleString(undefined, { minimumFractionDigits: 2 });
                const count   = s.item_count || (s.items ? s.items.length : 0);
                const sc      = s.status === 'Dispatched' ? '#059669' : s.status === 'Cancelled' ? '#ef4444' : '#f59e0b';

                return `
                <div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;
                            box-shadow:0 1px 4px rgba(0,0,0,.04);margin-bottom:.75rem;">

                    <!-- Order row -->
                    <div style="display:flex;align-items:center;gap:1rem;padding:1rem 1.25rem;
                                background:#fff;transition:background .15s;">

                        <!-- Date box -->
                        <div style="min-width:90px;text-align:center;background:#f8fafc;border-radius:10px;
                                    padding:.6rem .8rem;border:1px solid #e2e8f0;flex-shrink:0;">
                            <div style="font-size:.68rem;font-weight:700;color:#94a3b8;letter-spacing:.4px;margin-bottom:2px;">DATE</div>
                            <div style="font-size:.85rem;font-weight:700;color:#1e293b;line-height:1.2;">${dateStr}</div>
                            <div style="font-size:.72rem;color:#94a3b8;">${timeStr}</div>
                        </div>

                        <!-- Info -->
                        <div style="flex:1;min-width:0;">
                            <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:4px;flex-wrap:wrap;">
                                <i class="fa-solid fa-truck-ramp-box" style="color:#3b82f6;font-size:.85rem;"></i>
                                <span style="font-weight:700;color:#1e293b;font-size:.9rem;">
                                    طلب — ${count} ${count == 1 ? 'صنف' : 'أصناف'}
                                </span>
                                <span style="font-size:.75rem;font-weight:600;padding:2px 8px;border-radius:999px;
                                             background:${sc}1a;color:${sc};border:1px solid ${sc}33;">${s.status}</span>
                            </div>
                            <div style="color:#64748b;font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px;">
                                ${s.order_number}${s.main_item_name ? ' • ' + s.main_item_name : ''}
                            </div>
                        </div>

                        <!-- Total -->
                        <div style="text-align:center;min-width:80px;flex-shrink:0;">
                            <div style="font-size:.68rem;font-weight:700;color:#94a3b8;letter-spacing:.4px;margin-bottom:2px;">TOTAL</div>
                            <div style="font-size:1.05rem;font-weight:800;color:#059669;">$${total}</div>
                        </div>

                        <!-- Details toggle button -->
                        <button id="det-btn-${s.id}"
                            onclick="toggleOrderDetails(${s.id})"
                            style="display:flex;align-items:center;gap:6px;padding:9px 18px;border:1.5px solid #3b82f6;
                                   border-radius:10px;background:#fff;color:#2563eb;font-weight:700;
                                   font-size:.88rem;cursor:pointer;white-space:nowrap;transition:.2s;flex-shrink:0;"
                            onmouseover="this.style.background='#eff6ff'"
                            onmouseout="this.style.background='#fff'">
                            <i class="fa-solid fa-list-ul"></i> تفاصيل الطلب
                        </button>
                    </div>

                    <!-- Expandable item detail panel (hidden by default) -->
                    <div id="det-panel-${s.id}" style="display:none;border-top:1px solid #e2e8f0;background:#f8fafc;">
                        <div style="padding:.75rem 1.25rem;text-align:center;color:#94a3b8;font-size:.85rem;">
                            <i class="fa-solid fa-spinner fa-spin"></i> جاري تحميل التفاصيل...
                        </div>
                    </div>
                </div>`;
            }).join('');

            return `
            <div style="margin-bottom:1rem;">
                <div style="display:flex;align-items:center;justify-content:space-between;
                            padding:1rem 1.25rem;background:#eef2ff;border-radius:12px;cursor:pointer;
                            font-weight:700;color:#1e293b;margin-bottom:.5rem;"
                     onclick="const c=this.nextElementSibling;c.style.display=c.style.display==='none'?'block':'none'">
                    <div style="display:flex;align-items:center;gap:0.75rem;">
                        <i class="fa-solid fa-folder" style="color:#3b82f6;font-size:1.2rem;"></i>
                        <span style="font-size:1.05rem;">${group.monthLabel}</span>
                    </div>
                    <i class="fa-solid fa-chevron-down" style="color:#94a3b8;"></i>
                </div>
                <div>${shipmentsHtml}</div>
            </div>`;
        }).join('');

    } catch (err) {
        console.error('History fetch error:', err);
        listEl.innerHTML = `<div style="text-align:center;padding:2rem;color:#ef4444;">
            <i class="fa-solid fa-circle-exclamation" style="font-size:1.5rem;display:block;margin-bottom:.5rem;"></i>
            خطأ في تحميل السجل.</div>`;
    }
}

/* Toggle the inline detail panel for an order */
async function toggleOrderDetails(orderId) {
    const panel  = document.getElementById(`det-panel-${orderId}`);
    const btn    = document.getElementById(`det-btn-${orderId}`);
    if (!panel) return;

    const isOpen = panel.style.display !== 'none';
    if (isOpen) {
        panel.style.display = 'none';
        btn.innerHTML = '<i class="fa-solid fa-list-ul"></i> تفاصيل الطلب';
        btn.style.background = '#fff';
        return;
    }

    // Show panel (spinner already there from template)
    panel.style.display = 'block';
    btn.innerHTML = '<i class="fa-solid fa-chevron-up"></i> إخفاء التفاصيل';
    btn.style.background = '#eff6ff';

    // Use cache if available
    if (window._orderItemsCache[orderId]) {
        _renderOrderItems(panel, orderId, window._orderItemsCache[orderId]);
        return;
    }

    try {
        const res = await fetch(`/api/orders/${orderId}/items`);
        if (!res.ok) throw new Error('فشل تحميل بنود الطلب');
        const items = await res.json();
        window._orderItemsCache[orderId] = items;
        _renderOrderItems(panel, orderId, items);
    } catch (err) {
        panel.innerHTML = `<div style="padding:1rem 1.25rem;color:#ef4444;font-size:.85rem;">
            <i class="fa-solid fa-circle-exclamation"></i> ${err.message}</div>`;
    }
}

/* Render item rows into the detail panel */
function _renderOrderItems(panel, orderId, items) {
    if (!items || items.length === 0) {
        panel.innerHTML = `<div style="padding:1rem 1.25rem;color:#94a3b8;text-align:center;font-size:.85rem;">
            لا توجد بنود مسجلة لهذا الطلب.</div>`;
        return;
    }

    const rows = items.map(item => {
        const qty      = item.qty || 0;
        const unitPrice = parseFloat(item.unit_price || item.base_price || 0);
        const subtotal  = (qty * unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2 });
        const returned  = item.returned_qty ? `<span style="font-size:.75rem;color:#ef4444;margin-right:4px;">(مرتجع: ${item.returned_qty})</span>` : '';
        return `
        <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:.65rem 1rem;font-weight:600;color:#1e293b;">${item.product_name || '—'}</td>
            <td style="padding:.65rem 1rem;text-align:center;color:#475569;">${qty} ${returned}</td>
            <td style="padding:.65rem 1rem;text-align:center;color:#475569;font-family:monospace;">
                $${unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td style="padding:.65rem 1rem;text-align:left;color:#059669;font-weight:700;font-family:monospace;">
                $${subtotal}</td>
        </tr>`;
    }).join('');

    panel.innerHTML = `
    <div style="padding:.5rem 0;">
        <table style="width:100%;border-collapse:collapse;font-size:.85rem;">
            <thead>
                <tr style="background:#e8edf5;">
                    <th style="padding:.6rem 1rem;text-align:right;color:#64748b;font-weight:700;font-size:.75rem;letter-spacing:.3px;">اسم المنتج</th>
                    <th style="padding:.6rem 1rem;text-align:center;color:#64748b;font-weight:700;font-size:.75rem;letter-spacing:.3px;">الكمية</th>
                    <th style="padding:.6rem 1rem;text-align:center;color:#64748b;font-weight:700;font-size:.75rem;letter-spacing:.3px;">سعر الوحدة</th>
                    <th style="padding:.6rem 1rem;text-align:left;color:#64748b;font-weight:700;font-size:.75rem;letter-spacing:.3px;">الإجمالي</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    </div>`;
}

function closeClientHistoryModal() {
    const ov = document.getElementById('client-history-overlay');
    if (ov) ov.classList.remove('open');
    // Clear cache on close so fresh data is loaded next time
    window._orderItemsCache = {};
}

function openOrderInvoicePDF(orderId) {
    if (typeof exportOrderPDF === 'function') { exportOrderPDF(orderId); return; }
    window.open(`/orders.html?print=${orderId}`, '_blank');
}





function _buildClientHistoryModal() {
    const style = document.createElement('style');
    style.textContent = `
        #client-history-overlay { display:none; position:fixed; inset:0; background:rgba(15,23,42,.55);
            z-index:9000; align-items:center; justify-content:center; padding:1rem; }
        #client-history-overlay.open { display:flex !important; }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'client-history-overlay';
    overlay.addEventListener('click', e => { if (e.target === overlay) closeClientHistoryModal(); });

    overlay.innerHTML = `
    <div style="background:#fff;border-radius:20px;width:100%;max-width:800px;max-height:88vh;
                display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(0,0,0,.18);overflow:hidden;">
        <div style="padding:1.5rem 1.75rem;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:.75rem;">
                <i class="fa-solid fa-clock-rotate-left" style="color:#3b82f6;font-size:1.3rem;"></i>
                <h2 id="client-hist-title" style="font-size:1.2rem;font-weight:700;color:#1e293b;margin:0;">Transaction History</h2>
            </div>
            <button onclick="closeClientHistoryModal()"
                style="border:none;background:#f1f5f9;color:#64748b;width:36px;height:36px;
                       border-radius:50%;cursor:pointer;font-size:1.1rem;display:flex;align-items:center;justify-content:center;">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;padding:1.25rem 1.75rem;background:#f8fafc;border-bottom:1px solid #f1f5f9;">
            <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:1.1rem 1.5rem;display:flex;align-items:center;justify-content:space-between;">
                <div>
                    <div style="font-size:.7rem;font-weight:700;color:#94a3b8;letter-spacing:.5px;margin-bottom:4px;">TOTAL ORDERS</div>
                    <div id="client-hist-total-count" style="font-size:2rem;font-weight:800;color:#1e293b;">…</div>
                </div>
                <div style="width:48px;height:48px;background:#eff6ff;border-radius:12px;display:flex;align-items:center;justify-content:center;">
                    <i class="fa-solid fa-list-check" style="color:#3b82f6;font-size:1.3rem;"></i>
                </div>
            </div>
            <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:1.1rem 1.5rem;display:flex;align-items:center;justify-content:space-between;">
                <div>
                    <div style="font-size:.7rem;font-weight:700;color:#94a3b8;letter-spacing:.5px;margin-bottom:4px;">TOTAL OUTSTANDING BALANCE</div>
                    <div id="client-hist-total-balance" style="font-size:2rem;font-weight:800;color:#059669;">…</div>
                </div>
                <div style="width:48px;height:48px;background:#f0fdf4;border-radius:12px;display:flex;align-items:center;justify-content:center;">
                    <i class="fa-solid fa-money-bill-trend-up" style="color:#059669;font-size:1.3rem;"></i>
                </div>
            </div>
        </div>
        <div id="client-hist-list" style="flex:1;overflow-y:auto;padding:1.5rem 1.75rem;"></div>
        <div style="padding:1rem 1.75rem;border-top:1px solid #f1f5f9;text-align:left;">
            <button onclick="closeClientHistoryModal()"
                style="background:#f1f5f9;color:#475569;border:none;padding:.6rem 1.5rem;
                       border-radius:8px;font-weight:600;cursor:pointer;font-size:.9rem;">إغلاق</button>
        </div>
    </div>`;

    document.body.appendChild(overlay);
}
