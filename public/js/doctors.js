/**
 * Standalone Script for Doctor Directory page (doctors.html)
 */

window.currentDoctors = [];

document.addEventListener('DOMContentLoaded', () => {
    loadDoctors();
});

async function loadDoctors() {
    const app = document.getElementById('app');
    app.innerHTML = '<p style="text-align: center; margin-top: 2rem; color: #64748b;">جاري التحميل...</p>';

    try {
        const response = await fetch('/api/doctors');
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || `HTTP Config Error: ${response.status}`);
        }

        const doctors = await response.json();
        window.currentDoctors = doctors; // Save globally for profile panel

        if (!Array.isArray(doctors)) {
            throw new Error(doctors.error || 'Invalid data received from API');
        }

        renderDoctorsList(doctors);

    } catch (error) {
        console.error('Error loading doctors:', error);
        app.innerHTML = `<p class="error">Failed to load data: ${error.message}</p>`;
    }
}

function renderDoctorsList(doctorsList) {
    const app = document.getElementById('app');

    // Avatar colors for variety
    const avatarColors = ['#eff6ff', '#fff1f2', '#fefce8', '#f0fdf4', '#f8fafc'];
    const avatarIcons = ['👨‍⚕️', '👩‍⚕️'];

    app.innerHTML = `
        <div dir="ltr" style="text-align: left;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <div class="page-title-section">
                    <h1 style="font-size: 1.8rem; color: #1e293b; font-weight: 700; margin-bottom: 8px;">Doctor Directory</h1>
                    <p style="color: #64748b; font-size: 0.95rem;">Manage and view all medical practitioners at Al-Quds Center</p>
                </div>
                <button class="btn-primary" onclick="openAddDoctorModal()" style="font-size: 0.95rem;">
                    <i class="fa-solid fa-user-plus"></i> Add New Doctor
                </button>
            </div>

            <!-- Stats -->
            <div class="doc-stats-grid">
                <div class="doc-stat-card">
                    <span class="stat-badge">+5%</span>
                    <div class="doc-stat-icon" style="background: #eff6ff; color: #3b82f6;"><i class="fa-solid fa-user-group"></i></div>
                    <div>
                        <div class="doc-stat-label">Total Doctors</div>
                        <div class="doc-stat-value">${window.currentDoctors.length}</div>
                    </div>
                </div>
                <div class="doc-stat-card">
                    <div class="doc-stat-icon" style="background: #faf5ff; color: #a855f7;"><i class="fa-solid fa-kit-medical"></i></div>
                    <div>
                        <div class="doc-stat-label">Top Specializations</div>
                        <div class="doc-stat-value" style="font-size: 1.5rem;">Surgery, Pediatrics</div>
                    </div>
                </div>
            </div>

            <!-- Controls -->
            <div class="doc-controls" style="display: flex; align-items: center; gap: 20px;">
                <div class="doc-search" style="flex: 1; margin-bottom: 0;">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="text" id="doctorSearch" placeholder="Search doctors by name, specialty, or phone..." oninput="handleDoctorSearch(this.value)">
                </div>
                <div class="doc-filters">
                    <span class="filter-label" style="text-transform: uppercase; font-size: 0.75rem; color: #94a3b8; font-weight: 700; margin-right: 12px; margin-left: 0;">QUICK FILTERS :</span>
                    <button class="filter-pill active" onclick="filterDoctorsBySpecialty('All', this)">All</button>
                    <button class="filter-pill" onclick="filterDoctorsBySpecialty('جراحة', this)">Surgery</button>
                    <button class="filter-pill" onclick="filterDoctorsBySpecialty('أسنان', this)">Dentistry</button>
                    <button class="filter-pill" onclick="filterDoctorsBySpecialty('أطفال', this)">Pediatrics</button>
                    <button class="filter-pill" onclick="filterDoctorsBySpecialty('قلب', this)">Cardiology</button>
                </div>
            </div>

            <!-- Grid -->
            <div class="doctors-grid" id="doctorsGridContainer">
                ${generateDoctorsCardsHTML(doctorsList)}
            </div>
        </div>
    `;
}

function generateDoctorsCardsHTML(doctorsList) {
    const avatarColors = ['#eff6ff', '#fff1f2', '#fefce8', '#f0fdf4', '#f8fafc'];
    const avatarIcons = ['👨‍⚕️', '👩‍⚕️'];

    if (doctorsList.length === 0) {
        return '<div style="grid-column: 1 / -1; text-align: center; color: #64748b; padding: 2rem;">No doctors found matching your criteria.</div>';
    }

    return doctorsList.map((doc, index) => {
        const color = avatarColors[index % avatarColors.length];
        const icon = avatarIcons[index % avatarIcons.length];
        const specialtyMap = {
            'جراحة عامة': 'GENERAL SURGEON',
            'طب أطفال': 'PEDIATRICIAN',
            'طب أسنان': 'DENTIST',
            'قلب وأوعية': 'CARDIOLOGIST',
            'جراحة': 'GENERAL SURGEON',
            'أطفال': 'PEDIATRICIAN',
            'أسنان': 'DENTIST',
            'قلب': 'CARDIOLOGIST',
            'عظام': 'ORTHOPEDIC',
            'أشعة': 'RADIOLOGIST'
        };
        const engSpecialty = specialtyMap[doc.specialty] || doc.specialty;
        const docName = doc.name.startsWith('د.') ? doc.name.replace('د. ', 'Dr. ') : 'Dr. ' + doc.name;

        return `
            <div class="doctor-card" id="doc-card-${doc.id}">
                <div class="doc-card-actions">
                    <button class="doc-action-btn edit" title="Edit Doctor" onclick="openEditDoctorModal(${doc.id})">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="doc-action-btn delete" title="Delete Doctor" onclick="deleteDoctorById(${doc.id}, '${docName.replace(/'/g, "\\'")}')">  
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                    <button class="doc-action-btn" title="Transaction History"
                        style="color:#3b82f6;border-color:#bfdbfe;background:#eff6ff;"
                        onclick="openClientHistoryModal('doctor', ${doc.id}, '${docName.replace(/'/g, "\\'")}')">  
                        <i class="fa-solid fa-clock-rotate-left"></i>
                    </button>
                </div>
                <div class="doc-avatar-wrapper">
                    <div class="doc-avatar" style="background: ${color}; display: flex; align-items: center; justify-content: center; font-size: 2.5rem;">
                        ${icon}
                    </div>
                    <div class="doc-status" style="background: ${doc.status === 'active' ? '#10b981' : '#cbd5e1'};"></div>
                </div>
                <h3 class="doc-name">${docName}</h3>
                <span class="doc-specialty">${engSpecialty}</span>
                <div class="doc-contact">
                    <i class="fa-solid fa-phone" style="font-size: 0.8rem;"></i>
                    <span dir="ltr">${doc.phone || '+970 599-123-456'}</span>
                </div>
                <button class="btn-outline" onclick="showDoctorProfile(${doc.id})">View Profile</button>
            </div>
        `;
    }).join('');
}

// Global active specialty filter
let activeSpecialty = 'All';

function handleDoctorSearch(query) {
    applyFilters(query, activeSpecialty);
}

function filterDoctorsBySpecialty(specialty, buttonElement) {
    // Update active UI state
    document.querySelectorAll('.filter-pill').forEach(btn => btn.classList.remove('active'));
    buttonElement.classList.add('active');

    activeSpecialty = specialty;
    const searchInput = document.getElementById('doctorSearch');
    const query = searchInput ? searchInput.value : '';

    applyFilters(query, activeSpecialty);
}

function applyFilters(query, specialty) {
    const lowerQuery = query.toLowerCase();

    const filtered = window.currentDoctors.filter(doc => {
        // Specialty match (partial match to cover 'جراحة' in 'جراحة عامة')
        const matchesSpecialty = specialty === 'All' || doc.specialty?.includes(specialty);
        // Query match
        const matchesSearch = doc.name?.toLowerCase().includes(lowerQuery) ||
            doc.specialty?.toLowerCase().includes(lowerQuery) ||
            doc.phone?.toLowerCase().includes(lowerQuery);

        return matchesSpecialty && matchesSearch;
    });

    const grid = document.getElementById('doctorsGridContainer');
    if (grid) {
        grid.innerHTML = generateDoctorsCardsHTML(filtered);
    }
}

/**
 * Shows the slide-out profile for a doctor.
 */
async function showDoctorProfile(id) {
    const doc = window.currentDoctors?.find(d => d.id == id);
    if (!doc) {
        console.warn('Doctor not found for ID:', id);
        return;
    }

    const panel = document.getElementById('doctor-profile-panel');
    const overlay = document.querySelector('.slide-panel-overlay');

    const specialtyMap = {
        'جراحة عامة': 'General Surgeon',
        'طب أطفال': 'Pediatrician',
        'طب أسنان': 'Dentist',
        'قلب وأوعية': 'Cardiology Specialist',
        'جراحة': 'General Surgeon',
        'أطفال': 'Pediatrician',
        'أسنان': 'Dentist',
        'قلب': 'Cardiology Specialist',
        'عظام': 'Orthopedic',
        'أشعة': 'Radiologist'
    };
    const engSpecialty = specialtyMap[doc.specialty] || doc.specialty;
    const docName = doc.name.startsWith('د.') ? doc.name.replace('د. ', 'Dr. ') : 'Dr. ' + doc.name;

    try {
        const res = await fetch(`/api/doctors/${id}/orders`);
        const orders = await res.json();

        // Define status mapping
        const statusMap = {
            'Dispatched': { color: '#22c55e', text: 'Dispatched' }, // Green
            'Pending': { color: '#eab308', text: 'Pending' },       // Yellow
            'Cancelled': { color: '#ef4444', text: 'Cancelled' }    // Red
        };

        let orderHistoryHtml = '';
        if (orders && orders.length > 0) {
            orderHistoryHtml = orders.map(o => {
                const sMap = statusMap[o.status] || { color: '#cbd5e1', text: o.status };
                const dateStr = new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const itemName = o.main_item_name
                    ? (o.total_items > 1 ? `${o.main_item_name} +${o.total_items - 1} more` : o.main_item_name)
                    : 'System Order';

                return `
                    <div class="history-item">
                        <div class="history-dot" style="background: ${sMap.color};"></div>
                        <div class="history-content">
                            <h4>${itemName}</h4>
                            <span>${o.order_number} • ${sMap.text} ($${Number(o.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })})</span>
                        </div>
                        <div class="history-date">${dateStr}</div>
                    </div>
                `;
            }).join('');
        } else {
            orderHistoryHtml = `<div class="history-item"><div class="history-content"><span style="color: #94a3b8;">No recent orders found.</span></div></div>`;
        }

        panel.innerHTML = `
            <div dir="ltr" style="text-align: left; height: 100%; display: flex; flex-direction: column;">
                <div class="panel-header" style="border-bottom: 0;">
                    <h2>Full Profile</h2>
                    <button class="close-btn" onclick="closeDoctorProfile()"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="panel-content" style="padding-top: 0;">
                    <div class="profile-header">
                        <div class="profile-avatar" style="background: #eff6ff; color: #3b82f6; width: 80px; height: 80px; font-size: 2rem; margin-bottom: 12px;">
                            <i class="fa-solid fa-user"></i>
                        </div>
                        <h3 class="profile-name" style="font-size: 1.25rem; font-weight: 700; color: #1e293b;">${docName}</h3>
                        <div class="profile-meta" style="color: #3b82f6; font-size: 0.85rem; font-weight: 700;">
                            <i class="fa-solid fa-stethoscope"></i> ${engSpecialty}
                        </div>
                        <div class="profile-license" style="color: #94a3b8; font-size: 0.75rem; margin-top: 4px;">License: #MED-992384-PS</div>
                    </div>

                    <div class="info-section">
                        <div class="section-title">CONTACT DETAILS</div>
                        <div class="contact-item">
                            <i class="fa-solid fa-mobile-screen"></i>
                            <span>${doc.phone || 'N/A'}</span>
                        </div>
                        <div class="contact-item">
                            <i class="fa-solid fa-envelope"></i>
                            <span>${doc.email || 'N/A'}</span>
                        </div>
                        <div class="contact-item">
                            <i class="fa-solid fa-location-dot"></i>
                            <span>${doc.location || 'N/A'}</span>
                        </div>
                    </div>

                    <div class="info-section">
                        <div class="section-title">ORDER HISTORY</div>
                        ${orderHistoryHtml}
                        <button class="btn-outline" style="width: 100%; margin-top: 1rem; border-color: #e2e8f0; color: #475569; padding: 0.75rem;"
                            onclick="openClientHistoryModal('doctor', ${doc.id}, '${docName.replace(/'/g, "\\'")}')">VIEW FULL ACTIVITY</button>
                    </div>
                </div>
                
                <div class="panel-footer" style="padding: 1.5rem; border-top: 1px solid #f1f5f9; display: flex; gap: 1rem; justify-content: space-between;">
                    <button class="btn-primary" style="flex: 1; padding: 0.75rem; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <i class="fa-solid fa-circle-plus"></i> Create Request
                    </button>
                    <button class="icon-btn" style="width: 44px; height: 44px; flex-shrink: 0; color: #475569;">
                        <i class="fa-solid fa-print"></i>
                    </button>
                </div>
            </div>
        `;

        panel.classList.add('active');
        overlay.classList.add('active');
    } catch (err) {
        console.error('Error fetching doctor orders for profile:', err);
    }
}

function closeDoctorProfile() {
    document.getElementById('doctor-profile-panel').classList.remove('active');
    document.querySelector('.slide-panel-overlay').classList.remove('active');
}

/**
 * Modals and CRUD
 */
function openAddDoctorModal() {
    const modal = document.getElementById('addDoctorModal');
    modal.style.display = 'flex';
    document.getElementById('addDoctorForm').reset();
}

function closeAddDoctorModal() {
    const modal = document.getElementById('addDoctorModal');
    modal.style.display = 'none';
}

async function submitAddDoctor(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);

    const doctorData = {
        name: formData.get('name'),
        specialty: formData.get('specialty'),
        phone: formData.get('phone'),
        location: formData.get('location'),
        status: formData.get('status'),
        credit_limit: formData.get('credit_limit')
    };

    try {
        const response = await fetch('/api/doctors', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(doctorData)
        });

        const result = await response.json();

        if (response.ok) {
            alert('✅ ' + result.message);
            closeAddDoctorModal();
            loadDoctors();
        } else {
            alert('❌ ' + result.error);
        }
    } catch (error) {
        console.error('Error adding doctor:', error);
        alert('❌ حدث خطأ أثناء إضافة الطبيب');
    }
}

async function deleteDoctorById(id, name) {
    const confirmed = confirm(`Are you sure you want to permanently delete ${name}?\n\nThis action cannot be undone and will remove this doctor from all order dropdowns.`);
    if (!confirmed) return;

    try {
        const res = await fetch(`/api/doctors/${id}`, { method: 'DELETE' });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Delete failed');

        const card = document.getElementById(`doc-card-${id}`);
        if (card) {
            card.style.transition = 'opacity 0.3s, transform 0.3s';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.9)';
            setTimeout(() => {
                card.remove();
                if (window.currentDoctors) {
                    window.currentDoctors = window.currentDoctors.filter(d => d.id !== id);
                    if (window.currentDoctors.length === 0) {
                        loadDoctors();
                    }
                }
            }, 350);
        } else {
            loadDoctors();
        }

    } catch (err) {
        alert('Failed to delete doctor: ' + err.message);
    }
}

function openEditDoctorModal(id) {
    const doc = window.currentDoctors?.find(d => d.id == id);
    if (!doc) return alert('Doctor data not found. Please refresh.');

    const existing = document.getElementById('edit-doctor-modal');
    if (existing) existing.remove();

    const specialtyOptions = ['جراحة عامة', 'طب أطفال', 'طب أسنان', 'قلب وأوعية', 'جراحة', 'أطفال', 'أسنان', 'قلب', 'عظام', 'أشعة', 'باطنة']
        .map(s => `<option value="${s}" ${doc.specialty === s ? 'selected' : ''}>${s}</option>`)
        .join('');

    const docName = doc.name.startsWith('د.') ? doc.name.replace('د. ', 'Dr. ') : 'Dr. ' + doc.name;

    const modal = document.createElement('div');
    modal.id = 'edit-doctor-modal';
    modal.style.cssText = `
        position: fixed; inset: 0; background: rgba(15,23,42,0.5); z-index: 9999;
        display: flex; align-items: center; justify-content: center;
    `;
    modal.innerHTML = `
        <div style="background: #fff; border-radius: 16px; padding: 32px; width: 440px; max-width: 95vw; box-shadow: 0 20px 60px rgba(0,0,0,0.2); position: relative; dir: ltr; text-align: left;">
            <button onclick="document.getElementById('edit-doctor-modal').remove()"
                style="position: absolute; top: 16px; right: 16px; border: none; background: #f1f5f9; color: #64748b;
                       width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 1.1rem; display: flex; align-items: center; justify-content: center;">
                <i class="fa-solid fa-xmark"></i>
            </button>
            <h2 style="margin: 0 0 6px 0; font-size: 1.25rem; color: #1e293b; text-align: left;">Edit Doctor</h2>
            <p style="margin: 0 0 24px 0; color: #64748b; font-size: 0.875rem; text-align: left;">Editing: <strong>${docName}</strong></p>

            <div style="display: flex; flex-direction: column; gap: 16px; text-align: left;">
                <div style="text-align: left;">
                    <label style="font-size: 0.75rem; font-weight: 600; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 6px; text-align: left;">Full Name</label>
                    <input id="edit-doc-name" type="text" value="${doc.name}" dir="auto"
                        style="width: 100%; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.9rem; box-sizing: border-box; outline: none; text-align: left;"
                        onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#e2e8f0'">
                </div>
                <div style="text-align: left;">
                    <label style="font-size: 0.75rem; font-weight: 600; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 6px; text-align: left;">Specialty</label>
                    <select id="edit-doc-specialty" dir="auto"
                        style="width: 100%; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.9rem; box-sizing: border-box; outline: none; background: white; text-align: right;"
                        onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#e2e8f0'">
                        ${specialtyOptions}
                    </select>
                </div>
                <div style="text-align: left;">
                    <label style="font-size: 0.75rem; font-weight: 600; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 6px; text-align: left;">Phone</label>
                    <input id="edit-doc-phone" type="text" value="${doc.phone || ''}" dir="ltr"
                        style="width: 100%; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.9rem; box-sizing: border-box; outline: none; text-align: left;"
                        onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#e2e8f0'">
                </div>
                <div style="text-align: left;">
                    <label style="font-size: 0.75rem; font-weight: 600; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 6px; text-align: left;">الحد الائتماني (Credit Limit)</label>
                    <input id="edit-doc-credit-limit" type="number" value="${doc.credit_limit || 60000}" dir="ltr" step="500" min="0"
                        style="width: 100%; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.9rem; box-sizing: border-box; outline: none; text-align: left;"
                        onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#e2e8f0'">
                </div>
            </div>

            <div style="display: flex; gap: 10px; margin-top: 24px;">
                <button onclick="saveEditedDoctor(${id})"
                    style="flex: 1; background: #3b82f6; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.9rem; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <i class="fa-solid fa-floppy-disk"></i> Save Changes
                </button>
                <button onclick="document.getElementById('edit-doctor-modal').remove()"
                    style="padding: 12px 20px; background: #f1f5f9; color: #64748b; border: none; border-radius: 8px; font-weight: 500; cursor: pointer; font-size: 0.9rem;">
                    Cancel
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

async function saveEditedDoctor(id) {
    const name = document.getElementById('edit-doc-name')?.value?.trim();
    const specialty = document.getElementById('edit-doc-specialty')?.value;
    const phone = document.getElementById('edit-doc-phone')?.value?.trim();
    const credit_limit = document.getElementById('edit-doc-credit-limit')?.value;

    if (!name || !specialty) return alert('Name and specialty are required.');

    const saveBtn = document.querySelector('#edit-doctor-modal button[onclick*="saveEditedDoctor"]');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...'; }

    try {
        const existing = window.currentDoctors?.find(d => d.id == id);
        const res = await fetch(`/api/doctors/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name, specialty, phone, credit_limit,
                email: existing?.email || null,
                license_number: existing?.license_number || null,
                status: existing?.status || 'active',
                location: existing?.location || null
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Update failed');

        if (window.currentDoctors) {
            const idx = window.currentDoctors.findIndex(d => d.id == id);
            if (idx !== -1) window.currentDoctors[idx] = { ...window.currentDoctors[idx], name, specialty, phone, credit_limit };
        }

        document.getElementById('edit-doctor-modal')?.remove();
        loadDoctors();

    } catch (err) {
        alert('Failed to save changes: ' + err.message);
        if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Changes'; }
    }
}

/* ══════════════════════════════════════════════════════════════
   UNIFIED CLIENT TRANSACTION HISTORY MODAL (shared with pharmacies.js)
   ══════════════════════════════════════════════════════════════ */

window.clientHistoryMonthGroups = [];

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
                لا توجد طلبات مسجلة لهذا الطبيب.</div>`;
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
                <div style="display:flex;align-items:center;gap:1rem;padding:1rem 1.25rem;
                            background:#fff;border:1px solid #e2e8f0;border-radius:12px;
                            box-shadow:0 1px 4px rgba(0,0,0,.04);margin-bottom:.75rem;transition:box-shadow .2s;"
                     onmouseover="this.style.boxShadow='0 4px 16px rgba(0,0,0,.08)'"
                     onmouseout="this.style.boxShadow='0 1px 4px rgba(0,0,0,.04)'">

                    <div style="min-width:90px;text-align:center;background:#f8fafc;border-radius:10px;padding:.6rem .8rem;border:1px solid #e2e8f0;">
                        <div style="font-size:.68rem;font-weight:700;color:#94a3b8;letter-spacing:.4px;margin-bottom:2px;">DATE</div>
                        <div style="font-size:.85rem;font-weight:700;color:#1e293b;line-height:1.2;">${dateStr}</div>
                        <div style="font-size:.72rem;color:#94a3b8;">${timeStr}</div>
                    </div>

                    <div style="flex:1;min-width:0;">
                        <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:4px;">
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

                    <div style="text-align:center;min-width:90px;">
                        <div style="font-size:.68rem;font-weight:700;color:#94a3b8;letter-spacing:.4px;margin-bottom:2px;">TOTAL</div>
                        <div style="font-size:1.05rem;font-weight:800;color:#059669;">$${total}</div>
                    </div>

                    <button onclick="openOrderInvoicePDF(${s.id})"
                        style="display:flex;align-items:center;gap:8px;padding:10px 20px;border:none;border-radius:10px;
                               background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;font-weight:700;
                               font-size:.9rem;cursor:pointer;white-space:nowrap;transition:.2s;flex-shrink:0;"
                        onmouseover="this.style.transform='scale(1.04)'"
                        onmouseout="this.style.transform='scale(1)'">
                        <i class="fa-solid fa-eye"></i> عرض الفاتورة
                    </button>
                </div>`;
            }).join('');

            return `
            <div style="margin-bottom:1rem;">
                <div style="display:flex;align-items:center;justify-content:space-between;
                            padding:1rem 1.25rem;background:#eef2ff;border-radius:12px;cursor:pointer;
                            font-weight:700;color:#1e293b;"
                     onclick="const c=this.nextElementSibling;c.style.display=c.style.display==='none'?'block':'none'">
                    <div style="display:flex;align-items:center;gap:0.75rem;">
                        <i class="fa-solid fa-folder" style="color:#3b82f6;font-size:1.2rem;"></i>
                        <span style="font-size:1.05rem;">${group.monthLabel}</span>
                    </div>
                    <i class="fa-solid fa-chevron-down" style="color:#94a3b8;"></i>
                </div>
                <div style="padding:.75rem 0 0;">${shipmentsHtml}</div>
            </div>`;
        }).join('');

    } catch (err) {
        console.error('History fetch error:', err);
        listEl.innerHTML = `<div style="text-align:center;padding:2rem;color:#ef4444;">
            <i class="fa-solid fa-circle-exclamation" style="font-size:1.5rem;display:block;margin-bottom:.5rem;"></i>
            خطأ في تحميل السجل.</div>`;
    }
}

function closeClientHistoryModal() {
    const ov = document.getElementById('client-history-overlay');
    if (ov) ov.classList.remove('open');
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
