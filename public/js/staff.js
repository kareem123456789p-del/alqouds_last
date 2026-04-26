/* staff.js — Staff Directory JavaScript */
'use strict';

// ──────────────────────────────────────────────
// State
// ──────────────────────────────────────────────
let allStaff = [];
let currentPage = 1;
const PAGE_SIZE = 10;
let editingId = null;
let searchTerm = '';

// ──────────────────────────────────────────────
// Bootstrap
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadStaff();

    // Hook up search
    const searchInput = document.getElementById('staff-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value.trim().toLowerCase();
            currentPage = 1;
            renderTable();
        });
    }
});

// ──────────────────────────────────────────────
// API Helpers
// ──────────────────────────────────────────────
async function loadStats() {
    try {
        const res = await fetch('/api/staff/stats');
        if (!res.ok) return;
        const data = await res.json();
        document.getElementById('stat-total').textContent = data.total || 0;
        document.getElementById('stat-active').textContent = data.active || 0;
        document.getElementById('stat-leave').textContent = data.on_leave || 0;
    } catch (e) {
        console.error('Stats load error:', e);
    }
}

async function loadStaff() {
    try {
        const res = await fetch('/api/staff');
        if (!res.ok) throw new Error(await res.text());
        allStaff = await res.json();
        currentPage = 1;
        renderTable();
    } catch (e) {
        console.error('Staff load error:', e);
        document.getElementById('staff-tbody').innerHTML =
            `<tr class="empty-row"><td colspan="5"><i class="fa-solid fa-triangle-exclamation"></i>تعذّر تحميل البيانات</td></tr>`;
    }
}

// ──────────────────────────────────────────────
// Render
// ──────────────────────────────────────────────
function renderTable() {
    const filtered = allStaff.filter(s =>
        !searchTerm ||
        s.name.toLowerCase().includes(searchTerm) ||
        (s.email && s.email.toLowerCase().includes(searchTerm)) ||
        (s.role && s.role.toLowerCase().includes(searchTerm))
    );

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * PAGE_SIZE;
    const slice = filtered.slice(start, start + PAGE_SIZE);

    const tbody = document.getElementById('staff-tbody');
    if (!slice.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="5"><i class="fa-solid fa-users-slash"></i>لا يوجد موظفون للعرض</td></tr>`;
    } else {
        tbody.innerHTML = slice.map(s => rowHTML(s)).join('');
    }

    // Pagination info
    document.getElementById('page-info').textContent =
        `عرض ${Math.min(start + 1, total)} إلى ${Math.min(start + slice.length, total)} من أصل ${total} موظف`;

    renderPagination(totalPages);
}

function rowHTML(s) {
    const initials = s.name.split(' ').map(w => w[0]).join('').slice(0, 2);
    const statusLabel = s.status === 'active' ? 'نشط' : 'إجازة';
    const statusClass = s.status === 'active' ? 'active' : 'leave';

    const roleMap = {
        admin: { label: 'مسؤول', icon: 'fa-shield-halved', cls: 'admin' },
        sales: { label: 'مبيعات', icon: 'fa-cash-register', cls: 'sales' },
        warehouse: { label: 'مستودع', icon: 'fa-boxes-stacked', cls: 'warehouse' }
    };
    const role = roleMap[s.role] || { label: s.role, icon: 'fa-user', cls: 'admin' };
    const idStr = `ALQ-${String(s.id).padStart(3, '0')}#`;

    return `
    <tr>
        <td>
            <div class="emp-cell">
                <div class="emp-info">
                    <div class="emp-name">${escHtml(s.name)}</div>
                    <div class="emp-id">معرف: ${idStr}</div>
                </div>
                <div class="emp-avatar">${initials}</div>
            </div>
        </td>
        <td>
            <span class="role-badge ${role.cls}">
                <i class="fa-solid ${role.icon}"></i> ${role.label}
            </span>
        </td>
        <td class="contact-cell">
            <span class="contact-email">${escHtml(s.email || '—')}</span>
            <span class="contact-phone">${escHtml(s.phone || '—')}</span>
        </td>
        <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
        <td>
            <div class="action-cell">
                <button class="action-btn del" title="حذف" onclick="deleteStaff(${s.id}, '${escHtml(s.name)}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
                <button class="action-btn edit" title="تعديل" onclick="openEditModal(${s.id})">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>
            </div>
        </td>
    </tr>`;
}

function renderPagination(totalPages) {
    const ctrl = document.getElementById('pagination-controls');
    let html = `
        <button class="page-btn" id="prev-btn" onclick="goPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
            <i class="fa-solid fa-chevron-right"></i>
        </button>`;

    // Show up to 5 page buttons
    const range = getPaginationRange(currentPage, totalPages);
    for (const p of range) {
        if (p === '...') {
            html += `<span style="padding:0 4px;color:#94a3b8;">...</span>`;
        } else {
            html += `<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="goPage(${p})">${p}</button>`;
        }
    }

    html += `
        <button class="page-btn" id="next-btn" onclick="goPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
            <i class="fa-solid fa-chevron-left"></i>
        </button>`;
    ctrl.innerHTML = html;
}

function getPaginationRange(cur, total) {
    if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
    if (cur <= 3) return [1, 2, 3, '...', total];
    if (cur >= total - 2) return [1, '...', total - 2, total - 1, total];
    return [1, '...', cur - 1, cur, cur + 1, '...', total];
}

function goPage(p) {
    const totalPages = Math.ceil(
        allStaff.filter(s => !searchTerm || s.name.toLowerCase().includes(searchTerm)).length / PAGE_SIZE
    );
    if (p < 1 || p > totalPages) return;
    currentPage = p;
    renderTable();
}

// ──────────────────────────────────────────────
// Add Modal
// ──────────────────────────────────────────────
function openAddModal() {
    editingId = null;
    document.getElementById('modal-title').textContent = 'إضافة موظف جديد';
    document.getElementById('staff-form').reset();
    document.getElementById('staff-modal').classList.add('open');
}

function closeAddModal() {
    document.getElementById('staff-modal').classList.remove('open');
}

// ──────────────────────────────────────────────
// Edit Modal
// ──────────────────────────────────────────────
async function openEditModal(id) {
    try {
        const res = await fetch(`/api/staff/${id}`);
        if (!res.ok) throw new Error();
        const s = await res.json();
        editingId = id;

        document.getElementById('modal-title').textContent = 'تعديل بيانات الموظف';
        document.getElementById('f-name').value = s.name || '';
        document.getElementById('f-role').value = s.role || 'sales';
        document.getElementById('f-email').value = s.email || '';
        document.getElementById('f-phone').value = s.phone || '';
        document.getElementById('f-salary').value = s.base_salary || '';
        document.getElementById('f-status').value = s.status || 'active';
        document.getElementById('staff-modal').classList.add('open');
    } catch (e) {
        alert('تعذّر تحميل بيانات الموظف');
    }
}

// ──────────────────────────────────────────────
// Submit (Add / Edit)
// ──────────────────────────────────────────────
async function submitStaffForm(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-staff');
    btn.textContent = 'جاري الحفظ...';
    btn.disabled = true;

    const payload = {
        name: document.getElementById('f-name').value.trim(),
        role: document.getElementById('f-role').value,
        email: document.getElementById('f-email').value.trim(),
        phone: document.getElementById('f-phone').value.trim(),
        status: document.getElementById('f-status').value,
        base_salary: document.getElementById('f-salary').value
    };

    try {
        const url = editingId ? `/api/staff/${editingId}` : '/api/staff';
        const method = editingId ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'خطأ في الحفظ');

        closeAddModal();
        await loadStaff();
        await loadStats();
    } catch (err) {
        alert(err.message || 'حدث خطأ أثناء الحفظ');
    } finally {
        btn.textContent = 'حفظ';
        btn.disabled = false;
    }
}

// ──────────────────────────────────────────────
// Delete
// ──────────────────────────────────────────────
async function deleteStaff(id, name) {
    if (!confirm(`هل أنت متأكد من حذف الموظف "${name}"؟`)) return;
    try {
        const res = await fetch(`/api/staff/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'خطأ في الحذف');
        await loadStaff();
        await loadStats();
    } catch (err) {
        alert(err.message || 'تعذّر حذف الموظف');
    }
}

// ──────────────────────────────────────────────
// Utility
// ──────────────────────────────────────────────
function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function handleOverlayClick(e) {
    if (e.target.id === 'staff-modal') {
        closeAddModal();
    }
}
