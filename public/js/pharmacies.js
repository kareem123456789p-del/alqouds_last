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
