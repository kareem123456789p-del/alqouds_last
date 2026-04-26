const app = document.getElementById('app');
let allInventory = []; // Store inventory globally for search

// Cards Configuration (Translated)
const dashboardCards = [
    { title: 'Transfer Console', desc: 'Inter-warehouse stock transfers', icon: 'fa-arrow-right-arrow-left', color: '#fff7ed', iconColor: '#f97316', action: "window.location.href='transfer.html'" },
    { title: 'اللوازم الطبية', desc: 'إدارة العناصر والكتالوج', icon: 'fa-box-medical', color: '#fff7ed', iconColor: '#ea580c', action: "window.location.href='products.html'" },
    { title: 'المستودع', desc: 'المواقع والتخزين', icon: 'fa-warehouse', color: '#eff6ff', iconColor: '#3b82f6', action: "window.location.href='warehouse.html'", cssClass: 'warehouse-card' },
    { title: 'المخزون', desc: 'تتبع المستويات المباشر', icon: 'fa-chart-line', color: '#f0fdf4', iconColor: '#16a34a', action: 'promptInventoryPassword()', cssClass: 'inventory-card' },
    { title: 'الأطباء', desc: 'قاعدة بيانات الواصفين', icon: 'fa-user-doctor', color: '#fafaf9', iconColor: '#0ea5e9', action: "window.location.href='doctors.html'", cssClass: 'doctors-card' },

    { title: 'الصيدلية', desc: 'وحدات الصرف', icon: 'fa-pills', color: '#fff1f2', iconColor: '#e11d48', action: "window.location.href='pharmacy_directory.html'" },
    { title: 'مبيعات الجمهور', desc: 'فتح واجهة البيع المباشر', icon: 'fa-cash-register', color: '#e0f2fe', iconColor: '#0284c7', action: "window.location.href='retail_sales.html'" },
    { title: 'الطلبات', desc: 'طلبات الشراء', icon: 'fa-file-invoice', color: '#fffbeb', iconColor: '#d97706', action: "window.location.href='orders.html'", cssClass: 'orders-card' },
    { title: 'الواردات', desc: 'الشحنات الواردة', icon: 'fa-file-import', color: '#ecfdf5', iconColor: '#059669', action: "window.location.href='import.html'" },
    { title: 'الصادرات', desc: 'التوزيع الصادر', icon: 'fa-file-export', color: '#fff7ed', iconColor: '#c2410c' },

    { title: 'الموردين', desc: 'البائعين والشركاء', icon: 'fa-handshake', color: '#fefce8', iconColor: '#ca8a04', action: "window.location.href='suppliers.html'" },
    { title: 'الموظفين', desc: 'إدارة الكادر', icon: 'fa-users', color: '#eff6ff', iconColor: '#2563eb', action: "window.location.href='staff_directory.html'" },
    { title: 'المسحوبات', desc: 'التتبع المالي', icon: 'fa-money-bill-wave', color: '#f0fdf4', iconColor: '#15803d', action: "window.location.href='withdrawals.html'", cssClass: 'finance-card' },
    { title: 'التحصيلات', desc: 'إدارة المدفوعات وديون العملاء', icon: 'fa-hand-holding-dollar', color: '#e0f2fe', iconColor: '#0284c7', action: "window.location.href='collections.html'", cssClass: 'collections-card' },
    { title: 'التقارير', desc: 'التحليلات والرؤى', icon: 'fa-chart-bar', color: '#f3f4f6', iconColor: '#4b5563' },

    { title: 'الإشعارات', desc: '3 تنبيهات جديدة', icon: 'fa-bell', color: '#fff1f2', iconColor: '#dc2626' }
];

// Mock Data for Doctors
const mockDoctors = [
    { id: 1, name: 'د. أحمد ياسين', specialty: 'جراحة عامة', phone: '+970 599-123-456', status: 'active', color: '#eff6ff', icon: '👨‍⚕️' },
    { id: 2, name: 'د. سارة خليل', specialty: 'طب أطفال', phone: '+970 598-765-432', status: 'active', color: '#fff1f2', icon: '👩‍⚕️' },
    { id: 3, name: 'د. عمر فاروق', specialty: 'طب أسنان', phone: '+970 597-111-222', status: 'away', color: '#fefce8', icon: '👨‍⚕️' },
    { id: 4, name: 'د. ليلى حسن', specialty: 'قلب وأوعية', phone: '+970 595-444-555', status: 'active', color: '#f0fdf4', icon: '👩‍⚕️' },
    { id: 5, name: 'د. رامي منصور', specialty: 'عظام', phone: '+970 592-998-877', status: 'active', color: '#eff6ff', icon: '👨‍⚕️' },
    { id: 6, name: 'د. سامر عودة', specialty: 'أشعة', phone: '+970 591-222-333', status: 'away', color: '#f8fafc', icon: '👨‍⚕️' }
];

/**
 * Updates the sidebar active state.
 * @param {string} activeId - The ID of the link to set as active.
 */
function setActiveLink(activeId) {
    // Remove active class from all links
    const links = document.querySelectorAll('.sidebar nav a');
    links.forEach(link => link.classList.remove('active'));

    // Add active class to the clicked link
    const activeLink = document.getElementById(activeId);
    if (activeLink) {
        activeLink.classList.add('active');
    }
}

/**
 * Loads the Dashboard Overview View.
 */
async function loadDashboard() {
    setActiveLink('link-dashboard');

    // Update Page Title
    const topBar = document.querySelector('.top-bar');
    if (topBar) topBar.style.display = 'flex'; // Restore top bar

    document.querySelector('.page-title h1').textContent = 'نظرة عامة';
    document.querySelector('.breadcrumbs').innerHTML = 'الرئيسية <i class="fa-solid fa-chevron-left" style="font-size: 0.7em; margin: 0 5px;"></i> لوحة القيادة';

    const today = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });

    app.innerHTML = `
        <!-- Welcome Banner -->
        <div class="welcome-banner">
            <div class="welcome-text">
                <h2>مركز القدس لاجهزه و المستلزمات الطبيه</h2>
                <p>لديك 12 إشعار معلق و 4 تنبيهات انخفاض مخزون اليوم.</p>
            </div>
            <div class="date-badge">
                <i class="fa-regular fa-calendar"></i> ${today}
            </div>
        </div>

        <!-- Cards Grid -->
        <div class="card-grid">
            ${dashboardCards.map(card => `
                <div class="nav-card ${card.cssClass || ''}" onclick="${card.action || `alert('الانتقال إلى ${card.title}')`}">
                    <div class="card-icon" style="background-color: ${card.color}; color: ${card.iconColor};">
                        <i class="fa-solid ${card.icon}"></i>
                    </div>
                    <h3>${card.title}</h3>
                    <p id="${card.cssClass ? card.cssClass + '-desc' : ''}">${card.desc}</p>
                </div>
            `).join('')}
        </div>
    `;

    // Fetch live dashboard statistics to populate all specific cards
    loadDashboardStats();
}

/**
 * Fetches the live dashboard stats from the API and updates the dynamic cards.
 */
async function loadDashboardStats() {
    try {
        const res = await fetch('/api/dashboard/stats');
        if (!res.ok) return;
        const data = await res.json();

        // Template for generating badges
        const badgeSpan = (val, bg, color) => `<span style="display:inline-block; background:${bg}; color:${color}; font-size:0.7rem; font-weight:700; padding:1px 7px; border-radius:20px; vertical-align:middle; margin-right: 5px;">${val}</span>`;

        // Update Warehouse Count
        const warehouseDesc = document.getElementById('warehouse-card-desc');
        if (warehouseDesc && data.active_warehouses !== null) {
            warehouseDesc.innerHTML = `المواقع والتخزين &nbsp;${badgeSpan(data.active_warehouses + ' نشط', '#3b82f6', '#fff')}`;
        }

        // Update Orders (Pending) Count
        const ordersDesc = document.getElementById('orders-card-desc');
        if (ordersDesc && data.pending_orders !== null) {
            ordersDesc.innerHTML = `طلبات الشراء &nbsp;${badgeSpan(data.pending_orders + ' قيد الانتظار', '#d97706', '#fff')}`;
        }

        // Update Finance (Dispatched Withdrawals/Sales)
        const financeDesc = document.getElementById('finance-card-desc');
        if (financeDesc && data.dispatched_total !== null) {
            financeDesc.innerHTML = `التتبع المالي &nbsp;${badgeSpan('$' + Number(data.dispatched_total).toLocaleString(), '#15803d', '#fff')}`;
        }

        // Update Inventory Stats
        // Removed for privacy: Dashboard summaries for inventory are disabled.

        // Update Doctors/Client Total
        const doctorsDesc = document.getElementById('doctors-card-desc');
        if (doctorsDesc && data.registered_clients !== null) {
            doctorsDesc.innerHTML = `قاعدة بيانات الواصفين &nbsp;${badgeSpan(data.registered_clients + ' مسجل', '#0ea5e9', '#fff')}`;
        }

    } catch (e) {
        console.error("Failed to load dashboard statistics", e);
    }
}

/**
 * Loads the Product Catalog View (اللوازم الطبية).
 * Simple master directory for defining items before they enter any warehouse.
 */
async function loadInventory() {
    setActiveLink('link-inventory');

    document.querySelector('.page-title h1').textContent = 'كتالوج اللوازم الطبية';
    document.querySelector('.breadcrumbs').innerHTML = 'الرئيسية / اللوازم الطبية';

    const topBar = document.querySelector('.top-bar');
    if (topBar) topBar.style.display = 'none';

    app.innerHTML = '<p style="text-align: center; margin-top: 2rem; color: #64748b;">جاري التحميل...</p>';

    try {
        const response = await fetch('/api/products');
        allInventory = await response.json();

        app.innerHTML = `
            <div dir="ltr" style="text-align: left;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px;">
                    <div>
                        <h1 style="font-size: 1.8rem; color: #1e293b; font-weight: 700; margin-bottom: 6px;">Product Catalog</h1>
                        <p style="color: #64748b; font-size: 0.95rem; margin: 0;">اللوازم الطبية — Master list for defining products before they enter any warehouse.</p>
                    </div>
                    <button onclick="openProductModal()" style="
                        background: #ea580c; color: white; border: none; padding: 11px 22px;
                        border-radius: 9px; font-weight: 600; cursor: pointer; display: inline-flex;
                        align-items: center; gap: 8px; font-size: 0.9rem; font-family: inherit;">
                        <i class="fa-solid fa-plus"></i> Add New Product
                    </button>
                </div>

                <!-- Search Bar -->
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 20px;
                            display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
                    <i class="fa-solid fa-magnifying-glass" style="color: #94a3b8;"></i>
                    <input type="text" id="catalogSearch" placeholder="Search by name or category..."
                        oninput="filterInventory(this.value)"
                        style="border: none; outline: none; width: 100%; font-size: 0.95rem; color: #1e293b;">
                </div>

                <!-- Product Table -->
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                                <th style="padding: 14px 20px; text-align: left; font-size: 0.72rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">PRODUCT NAME</th>
                                <th style="padding: 14px 20px; text-align: left; font-size: 0.72rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">CATEGORY</th>
                                <th style="padding: 14px 20px; text-align: left; font-size: 0.72rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">BASE PRICE</th>
                                <th style="padding: 14px 20px; text-align: right; font-size: 0.72rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody id="inventoryTableBody">
                            ${generateCatalogRows(allInventory)}
                        </tbody>
                    </table>
                    ${allInventory.length === 0 ? '<div style="text-align:center; padding: 3rem; color:#94a3b8;">No products defined yet. Click "Add New Product" to get started.</div>' : ''}
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading product catalog:', error);
        app.innerHTML = `<p class="error">Failed to load catalog: ${error.message}</p>`;
    }
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
        const price = item.price != null ? `$${Number(item.price).toFixed(2)}` : '—';
        const initial = item.name ? item.name[0].toUpperCase() : '?';
        const initBg = ['#eff6ff', '#fff7ed', '#f0fdf4', '#faf5ff', '#fefce8'][i % 5];
        const initColor = ['#3b82f6', '#ea580c', '#16a34a', '#a855f7', '#ca8a04'][i % 5];

        return `
            <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s;"
                onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <td style="padding: 14px 20px;">
                    <div style="display: flex; align-items: center; gap: 14px;">
                        <div style="width: 36px; height: 36px; border-radius: 9px; background: ${initBg}; color: ${initColor};
                                    display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1rem;">
                            ${initial}
                        </div>
                        <span style="font-weight: 600; color: #1e293b; font-size: 0.92rem;">${item.name}</span>
                    </div>
                </td>
                <td style="padding: 14px 20px;">
                    <span style="background: ${cat.bg}; color: ${cat.text}; padding: 4px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: 700;">
                        ${cat.label}
                    </span>
                </td>
                <td style="padding: 14px 20px; font-weight: 700; color: #1e293b; font-size: 0.95rem;">
                    ${price}
                </td>
                <td style="padding: 14px 20px; text-align: right;">
                    <button onclick="openEditProductModal(${item.id}, '${item.name.replace(/'/g, "\\'")}', ${item.price || 0}, ${item.quantity || 0}, '${item.expiry_date || ''}')"
                        style="border: 1px solid #e2e8f0; background: white; color: #475569; padding: 6px 14px; border-radius: 6px;
                               cursor: pointer; font-size: 0.82rem; font-weight: 600; display: inline-flex; align-items: center;
                               gap: 5px; transition: all 0.2s; margin-right: 6px;"
                        onmouseover="this.style.borderColor='#ea580c'; this.style.color='#ea580c';"
                        onmouseout="this.style.borderColor='#e2e8f0'; this.style.color='#475569';">
                        <i class="fa-solid fa-pen" style="font-size: 0.75rem;"></i> Edit
                    </button>
                    <button onclick="deleteProduct(${item.id})"
                        style="border: 1px solid #fecaca; background: #fff5f5; color: #ef4444; padding: 6px 14px; border-radius: 6px;
                               cursor: pointer; font-size: 0.82rem; font-weight: 600; display: inline-flex; align-items: center;
                               gap: 5px; transition: all 0.2s;"
                        onmouseover="this.style.background='#fee2e2'; this.style.borderColor='#ef4444';"
                        onmouseout="this.style.background='#fff5f5'; this.style.borderColor='#fecaca';">
                        <i class="fa-solid fa-trash-can" style="font-size: 0.75rem;"></i> Delete
                    </button>
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

/* ─── PASSWORD GATE FOR المخزون ─────────────────────────────── */
const INVENTORY_PASSWORD = 'admin2024'; // Change this to the owner's password

function promptInventoryPassword() {
    // Remove any existing modal
    const existing = document.getElementById('inv-pwd-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'inv-pwd-modal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);
        z-index: 9999; display: flex; align-items: center; justify-content: center;
    `;

    modal.innerHTML = `
        <div style="background: white; border-radius: 20px; padding: 2.5rem; max-width: 420px; width: 90%;
                    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); text-align: center; position: relative;">
            <div style="width: 64px; height: 64px; border-radius: 16px; background: #f0fdf4; color: #16a34a;
                         display: flex; align-items: center; justify-content: center; font-size: 1.8rem; margin: 0 auto 1.25rem;">
                <i class="fa-solid fa-lock"></i>
            </div>
            <h2 style="font-size: 1.4rem; font-weight: 700; color: #1e293b; margin-bottom: 0.4rem;">المخزون — محمي بكلمة مرور</h2>
            <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 1.5rem;">هذا القسم مخصص للمالك / الإدارة فقط.<br>الرجاء إدخال كلمة المرور للمتابعة.</p>
            <div style="position: relative; margin-bottom: 1rem;">
                <input type="password" id="inv-pwd-input" placeholder="أدخل كلمة المرور..."
                    onkeydown="if(event.key==='Enter') checkInventoryPassword();"
                    style="width: 100%; box-sizing: border-box; padding: 12px 16px; border: 1.5px solid #e2e8f0;
                           border-radius: 10px; font-size: 1rem; text-align: center; outline: none;
                           font-family: inherit; transition: border-color 0.2s;"
                    onfocus="this.style.borderColor='#16a34a'"
                    onblur="this.style.borderColor='#e2e8f0'">
            </div>
            <p id="inv-pwd-error" style="color: #ef4444; font-size: 0.85rem; min-height: 1.2rem; margin-bottom: 0.75rem;"></p>
            <div style="display: flex; gap: 10px;">
                <button onclick="document.getElementById('inv-pwd-modal').remove()"
                    style="flex: 1; padding: 11px; border: 1px solid #e2e8f0; background: white; color: #64748b;
                           border-radius: 9px; font-weight: 600; cursor: pointer; font-family: inherit; font-size: 0.9rem;">
                    إلغاء
                </button>
                <button onclick="checkInventoryPassword()"
                    style="flex: 1; padding: 11px; background: #16a34a; color: white; border: none;
                           border-radius: 9px; font-weight: 600; cursor: pointer; font-family: inherit; font-size: 0.9rem;">
                    دخول <i class="fa-solid fa-arrow-left" style="margin-right: 4px;"></i>
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    setTimeout(() => document.getElementById('inv-pwd-input')?.focus(), 100);
}

function checkInventoryPassword() {
    const input = document.getElementById('inv-pwd-input');
    if (input.value === INVENTORY_PASSWORD) {
        document.getElementById('inv-pwd-modal').remove();
        sessionStorage.setItem('inventoryAuth', 'true');
        window.location.href = 'inventory.html';
    } else {
        document.getElementById('inv-pwd-modal').remove();
        alert('Unauthorized: كلمة المرور غير صحيحة');
    }
}

/**
 * Loads the Warehouse Stock View (المخزون) — Owner only.
 * Shows actual stock levels, total inventory value across all warehouses.
 */
async function loadStock() {
    setActiveLink('link-inventory');

    document.querySelector('.page-title h1').textContent = 'المخزون — إدارة المخازن';
    document.querySelector('.breadcrumbs').innerHTML = 'الرئيسية / المخزون';

    const topBar = document.querySelector('.top-bar');
    if (topBar) topBar.style.display = 'none';

    app.innerHTML = '<p style="text-align: center; margin-top: 2rem; color: #64748b;">جاري التحميل...</p>';

    try {
        // Fetch warehouses for the selector
        const [productsRes, warehousesRes] = await Promise.all([
            fetch('/api/products'),
            fetch('/api/warehouse/list')
        ]);
        const products = await productsRes.json();
        const warehouses = await warehousesRes.json();

        // Calculate total value (price × quantity)
        const totalValue = products.reduce((sum, p) => sum + (Number(p.price) * Number(p.quantity || 0)), 0);
        const totalUnits = products.reduce((sum, p) => sum + Number(p.quantity || 0), 0);
        const lowStock = products.filter(p => p.quantity < 20 && p.quantity > 0).length;

        app.innerHTML = `
            <div dir="ltr" style="text-align: left;">

                <!-- Header -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px;">
                    <div>
                        <h1 style="font-size: 1.8rem; color: #1e293b; font-weight: 700; margin-bottom: 6px;">
                            <i class="fa-solid fa-lock" style="color:#16a34a; font-size: 1.2rem; margin-right: 8px;"></i>
                            Warehouse Inventory
                        </h1>
                        <p style="color: #64748b; font-size: 0.95rem; margin: 0;">المخزون — Actual stock levels and total valuation across all warehouses. Admin view only.</p>
                    </div>
                    <span style="background: #dcfce7; color: #166534; padding: 6px 16px; border-radius: 20px; font-size: 0.8rem; font-weight: 700;">
                        🔐 Admin Access
                    </span>
                </div>

                <!-- Valuation Stats -->
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; margin-bottom: 28px;">
                    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1.5rem; border-top: 4px solid #16a34a;">
                        <div style="font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">
                            💰 TOTAL INVENTORY VALUE
                        </div>
                        <div style="font-size: 2rem; font-weight: 800; color: #1e293b;">
                            $${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>
                    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1.5rem; border-top: 4px solid #3b82f6;">
                        <div style="font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">
                            📦 TOTAL UNITS IN STOCK
                        </div>
                        <div style="font-size: 2rem; font-weight: 800; color: #1e293b;">
                            ${totalUnits.toLocaleString()} <span style="font-size: 1rem; font-weight: 400; color: #94a3b8;">units</span>
                        </div>
                    </div>
                    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1.5rem; border-top: 4px solid #f59e0b;">
                        <div style="font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">
                            ⚠️ LOW STOCK ALERTS
                        </div>
                        <div style="font-size: 2rem; font-weight: 800; color: ${lowStock > 0 ? '#f59e0b' : '#1e293b'};">
                            ${lowStock} <span style="font-size: 1rem; font-weight: 400; color: #94a3b8;">SKUs</span>
                        </div>
                    </div>
                </div>

                <!-- Detailed Stock Table -->
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                    <div style="padding: 18px 22px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                        <h2 style="font-size: 1.1rem; font-weight: 700; color: #1e293b; margin: 0;">Stock Levels Detail</h2>
                        <span style="color: #64748b; font-size: 0.85rem;">${products.length} products registered</span>
                    </div>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                                <th style="padding: 13px 20px; text-align: left; font-size: 0.72rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">PRODUCT</th>
                                <th style="padding: 13px 20px; text-align: left; font-size: 0.72rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">QTY IN STOCK</th>
                                <th style="padding: 13px 20px; text-align: left; font-size: 0.72rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">UNIT PRICE</th>
                                <th style="padding: 13px 20px; text-align: left; font-size: 0.72rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">STOCK VALUE</th>
                                <th style="padding: 13px 20px; text-align: left; font-size: 0.72rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">STATUS</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${products.map((p, i) => {
            const qty = Number(p.quantity || 0);
            const price = Number(p.price || 0);
            const lineVal = qty * price;
            const pct = Math.min(100, (qty / 2000) * 100);
            const barColor = qty === 0 ? '#ef4444' : qty < 20 ? '#f59e0b' : '#16a34a';
            const status = qty === 0 ? '<span style="background:#fee2e2;color:#ef4444;padding:3px 10px;border-radius:5px;font-size:0.75rem;font-weight:700;">OUT</span>'
                : qty < 20 ? '<span style="background:#fef3c7;color:#d97706;padding:3px 10px;border-radius:5px;font-size:0.75rem;font-weight:700;">LOW</span>'
                    : '<span style="background:#dcfce7;color:#16a34a;padding:3px 10px;border-radius:5px;font-size:0.75rem;font-weight:700;">OK</span>';
            const initBg = ['#eff6ff', '#fff7ed', '#f0fdf4', '#faf5ff', '#fefce8'][i % 5];
            const initClr = ['#3b82f6', '#ea580c', '#16a34a', '#a855f7', '#ca8a04'][i % 5];
            return `
                                    <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s;"
                                        onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                                        <td style="padding: 13px 20px;">
                                            <div style="display: flex; align-items: center; gap: 12px;">
                                                <div style="width: 34px; height: 34px; border-radius: 8px; background: ${initBg}; color: ${initClr};
                                                            display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.95rem;">
                                                    ${p.name ? p.name[0].toUpperCase() : '?'}
                                                </div>
                                                <span style="font-weight: 600; color: #1e293b; font-size: 0.9rem;">${p.name}</span>
                                            </div>
                                        </td>
                                        <td style="padding: 13px 20px;">
                                            <div style="font-weight: 700; color: #1e293b; margin-bottom: 5px;">${qty.toLocaleString()} units</div>
                                            <div style="width: 90px; height: 4px; background: #f1f5f9; border-radius: 2px;">
                                                <div style="width: ${pct}%; height: 100%; background: ${barColor}; border-radius: 2px;"></div>
                                            </div>
                                        </td>
                                        <td style="padding: 13px 20px; font-weight: 600; color: #475569;">
                                            $${price.toFixed(2)}
                                        </td>
                                        <td style="padding: 13px 20px; font-weight: 700; color: #1e293b;">
                                            $${lineVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td style="padding: 13px 20px;">${status}</td>
                                    </tr>
                                `;
        }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading stock view:', error);
        app.innerHTML = `<p class="error">فشل تحميل المخزون: ${error.message}</p>`;
    }
}




/**
 * Loads the Doctor Directory View.
 */
/* ORPHANED_CODE_DISABLED


















                <div class="inv-stat-card">
                    <div class="stat-header">
                        <div class="stat-icon-box" style="background: #fef3c7; color: #d97706;"><i class="fa-solid fa-triangle-exclamation"></i></div>
                        <div class="stat-trend" style="background: #ffedd5; color: #ea580c;">Action Required</div>
                    </div>
                    <div class="stat-content">
                        <div class="stat-label">Low Stock Alerts</div>
                        <div class="stat-value">${lowStockCount} <span style="font-size: 1rem; color: #94a3b8; font-weight: normal;">SKUs</span></div>
                    </div>
                </div>
                <div class="inv-stat-card">
                    <div class="stat-header">
                        <div class="stat-icon-box" style="background: #fee2e2; color: #ef4444;"><i class="fa-regular fa-calendar-xmark"></i></div>
                        <div class="stat-trend" style="background: #fee2e2; color: #ef4444;">-4%</div>
                    </div>
                    <div class="stat-content">
                        <div class="stat-label">Expiring Soon</div>
                        <div class="stat-value">${expiringSoonCount} <span style="font-size: 1rem; color: #94a3b8; font-weight: normal;">items</span></div>
                    </div>
                </div>
            </div >

            < !--Table Container-- >
    <div class="inv-table-container" style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-top: 24px;">

        <!-- Header & Filter -->
        <div class="filter-bar" style="display: flex; flex-wrap: wrap; gap: 15px; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid #e2e8f0;">
            <div class="filter-actions-left" style="display: flex; gap: 20px; align-items: center; flex-grow: 1;">
                <h2 style="font-size: 1.25rem; font-weight: 700; color: #1e293b; margin: 0; min-width: 180px;">Stock Management</h2>
                <div class="search-input-group" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 16px; display: flex; align-items: center; flex-grow: 1; max-width: 400px;">
                    <i class="fa-solid fa-magnifying-glass" style="color: #94a3b8; margin-right: 12px;"></i>
                    <input type="text" id="inventorySearch" placeholder="Search by name, SKU or category..." oninput="filterInventory(this.value)" style="border: none; background: transparent; outline: none; width: 100%; font-size: 0.95rem;">
                </div>
            </div>
            <div class="filter-actions-right" style="display: flex; gap: 12px;">
                <button class="btn-outline" style="border: 1px solid #e2e8f0; background: white; color: #334155; padding: 10px 20px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: 500;">
                    <i class="fa-solid fa-filter"></i> Filter
                </button>
                <button class="btn-primary" onclick="openProductModal()" style="background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: 500;">
                    <i class="fa-solid fa-plus"></i> Add New Product
                </button>
            </div>
        </div>

        <table class="inv-table" style="width: 100%; border-collapse: collapse;">
            <thead style="background: white; border-bottom: 2px solid #e2e8f0; color: #94a3b8; font-size: 0.75rem; font-weight: 700; text-align: left; letter-spacing: 0.5px; text-transform: uppercase;">
                <tr>
                    <th style="padding: 16px 24px; border-bottom: 1px solid #e2e8f0;">MEDICINE NAME</th>
                    <th style="padding: 16px 24px; border-bottom: 1px solid #e2e8f0;">SKU</th>
                    <th style="padding: 16px 24px; border-bottom: 1px solid #e2e8f0;">CATEGORY</th>
                    <th style="padding: 16px 24px; border-bottom: 1px solid #e2e8f0;">QUANTITY</th>
                    <th style="padding: 16px 24px; border-bottom: 1px solid #e2e8f0;">EXPIRY DATE</th>
                    <th style="padding: 16px 24px; border-bottom: 1px solid #e2e8f0; text-align: right;">ACTIONS</th>
                </tr>
            </thead>
            <tbody id="inventoryTableBody">
                ${generateTableRows(inventory)}
            </tbody>
        </table>
        <div class="pagination" style="padding: 16px 24px; display: flex; justify-content: flex-start; align-items: center; color: #64748b; font-size: 0.875rem; gap: 20px;">
            <span>Showing 1 to ${Math.min(inventory.length, 4)} of ${inventory.length.toLocaleString()} items</span>
            <div style="display: flex; gap: 8px; align-items: center; margin-left: auto;">
                <button class="btn-icon-only" style="border: 1px solid #e2e8f0; border-radius: 6px; width: 32px; height: 32px; background: white; cursor: pointer; color: #94a3b8; display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-chevron-left"></i></button>
                <button class="btn-icon-only" style="border: none; border-radius: 6px; width: 32px; height: 32px; background: #3b82f6; color: white; font-weight: 600; display: flex; align-items: center; justify-content: center;">1</button>
                <button class="btn-icon-only" style="border: none; background: transparent; cursor: pointer; color: #334155; font-weight: 600; padding: 0 8px;">2</button>
                <button class="btn-icon-only" style="border: none; background: transparent; cursor: pointer; color: #334155; font-weight: 600; padding: 0 8px;">3</button>
                <button class="btn-icon-only" style="border: 1px solid #e2e8f0; border-radius: 6px; width: 32px; height: 32px; background: white; cursor: pointer; color: #334155; display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-chevron-right"></i></button>
            </div>
        </div>
    </div>
            </div >
            
            < !--Side Panel Container(Hidden by default )-- >
            <div class="item-details-panel" id="itemDetailsPanel">
                <!-- Content injected via JS -->
            </div>
            <div class="item-panel-overlay" onclick="closeItemPanel()"></div>



















if (expDate <= ninetyDays) {
    expiryStyling = 'color: #ef4444; font-weight: 600; font-style: italic;';
    if (expDate < now) {
        expiryDisplay = 'Expired';
    }
}
} else {
    // Mock dates if not present to match UI
    const mockDates = ['Dec 01, 2025', 'May 15, 2026', 'Nov 20, 2024', 'Aug 10, 2025'];
    expiryDisplay = mockDates[index % mockDates.length];
    if (index % 4 === 2) expiryStyling = 'color: #64748b; font-style: italic;'; // simulate the Nov 20, 2024 one
}

// Progress Bar styling
let progressWidth = Math.min(100, (item.quantity / 2000) * 100);
let progressColor = '#10b981'; // green
if (item.quantity < 50) progressColor = '#f59e0b'; // amber
if (item.quantity === 0) progressColor = '#ef4444'; // red

return `
            <tr style="border-bottom: 1px solid #f8fafc; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <td style="padding: 16px 24px;">
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <div style="width: 40px; height: 40px; border-radius: 8px; background: #eff6ff; color: #3b82f6; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
                            <i class="fa-solid fa-pills"></i>
                        </div>
                        <div>
                            <div style="font-weight: 600; color: #1e293b; font-size: 0.95rem; margin-bottom: 2px;">${item.name}</div>
                            <div style="color: #94a3b8; font-size: 0.8rem;">${subCategory}</div>
                        </div>
                    </div>
                </td>
                <td style="padding: 16px 24px; color: #64748b; font-size: 0.9rem; font-family: monospace;">${sku}</td>
                <td style="padding: 16px 24px;">
                    <span style="background: ${catColor}; color: ${catText}; padding: 4px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: 700;">${category}</span>
                </td>
                <td style="padding: 16px 24px;">
                    <div style="font-weight: 700; color: #1e293b; font-size: 0.95rem; margin-bottom: 6px;">${item.quantity.toLocaleString()} <span style="font-weight: normal; color: #64748b; font-size: 0.85rem;">units</span></div>
                    <div style="width: 100px; height: 4px; background: #f1f5f9; border-radius: 2px; overflow: hidden;">
                        <div style="width: ${progressWidth}%; height: 100%; background: ${progressColor}; border-radius: 2px;"></div>
                    </div>
                </td>
                <td style="padding: 16px 24px; ${expiryStyling} font-size: 0.9rem;">${expiryDisplay}</td>
                <td style="padding: 16px 24px; text-align: right;">
                    <button class="btn-icon-only" style="border: none; background: transparent; cursor: pointer; color: #cbd5e1; font-size: 1.1rem; transition: color 0.2s; margin-right: 12px;" onmouseover="this.style.color='#64748b'" onmouseout="this.style.color='#cbd5e1'" onclick="event.stopPropagation(); openEditProductModal(${item.id}, '${item.name}', ${item.price}, ${item.quantity}, '${item.expiry_date || ''}')">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn-icon-only" style="border: none; background: transparent; cursor: pointer; color: #cbd5e1; font-size: 1.1rem; transition: color 0.2s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#cbd5e1'" onclick="event.stopPropagation(); deleteProduct(${item.id})">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                    <button class="btn-icon-only" style="border: none; background: transparent; cursor: pointer; color: #cbd5e1; font-size: 1.1rem; transition: color 0.2s; margin-left: 12px;" onmouseover="this.style.color='#3b82f6'" onmouseout="this.style.color='#cbd5e1'" onclick="event.stopPropagation(); showItemDetails(${item.id})">
                        <i class="fa-solid fa-ellipsis-vertical"></i>
                    </button>
                </td>
            </tr>
        `;
}).join('');
}












        </div >
        <div class="panel-content">
            <div class="large-icon-wrapper">
                <i class="fa-solid fa-box-open" style="color:#d1d5db;"></i>
            </div>
            <h2 class="detail-title">${item.name}</h2>
            <div class="detail-sku">SKU: ${sku}-MED</div>
            
            <div class="stock-info-card ${item.quantity < 20 ? 'low' : ''}">
                <div class="stock-label">STOCK LEVEL</div>
                <div class="stock-value">${item.quantity < 20 ? 'Low Stock' : 'Optimal'} (${item.quantity.toLocaleString()})</div>
            </div>
            
            <div class="stock-label" style="margin-bottom: 1rem;">PRICE HISTORY LOG</div>
            <div class="timeline">
                <div class="timeline-item">
                    <span class="timeline-date">Today, 10:45 AM</span>
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                        <h4>Updated Selling Price</h4>
                        <p>Changed from $${(item.price - 2).toFixed(2)} to $${Number(item.price).toFixed(2)} by Dr. Sarah</p>
                    </div>
                </div>
                 <div class="timeline-item">
                    <span class="timeline-date">Oct 12, 2023</span>
                    <div class="timeline-dot" style="background:#cbd5e1; border-color:white; box-shadow:none;"></div>
                    <div class="timeline-content">
                        <h4>New Batch Received</h4>
                        <p>+500 units added to Warehouse A</p>
                    </div>
                </div>
            </div>
        </div>
        <div class="panel-footer">
            <button class="btn-panel-primary">Save Changes</button>
            <button class="btn-panel-secondary">Export PDF</button>
        </div>
`;

panel.classList.add('active');
overlay.classList.add('active');
*//* ORPHANED_BLOCK_END */


// Product Actions
function toggleMenu(id) {
    const menu = document.getElementById(`menu - ${id} `);

    // Close other open menus
    document.querySelectorAll('.dropdown-content').forEach(el => {
        if (el.id !== `menu - ${id} `) el.classList.remove('show');
    });

    menu.classList.toggle('show');
}

// Close menu when clicking outside
window.onclick = function (event) {
    if (!event.target.matches('.btn-icon-only') && !event.target.matches('.btn-icon-only i')) {
        document.querySelectorAll('.dropdown-content').forEach(el => el.classList.remove('show'));
    }
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

function openEditProductModal(id, name, price, quantity, expiryDate) {
    document.getElementById('productModalTitle').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> تعديل المنتج';
    document.getElementById('productSubmitBtn').textContent = 'تحديث المنتج';

    document.getElementById('productId').value = id;
    document.querySelector('input[name="name"]').value = name;
    if(document.querySelector('input[name="price"]')) document.querySelector('input[name="price"]').value = price;
    
    // We try to fill the unit data from allInventory if available
    const product = typeof allInventory !== 'undefined' ? allInventory.find(p => p.id == id) : null;
    if (product) {
        document.querySelector('select[name="base_uom"]').value = product.base_uom || 'Piece';
        if (product.bulk_uom && product.conversion_factor > 1) {
            document.getElementById('has_bulk_uom').checked = true;
            document.getElementById('bulk-uom-group').style.display = 'flex';
            document.querySelector('select[name="bulk_uom"]').value = product.bulk_uom;
            document.querySelector('input[name="conversion_factor"]').value = product.conversion_factor;
        } else {
            document.getElementById('has_bulk_uom').checked = false;
            document.getElementById('bulk-uom-group').style.display = 'none';
        }
    }

    document.getElementById('addProductModal').style.display = 'flex';
}

function closeProductModal() {
    document.getElementById('addProductModal').style.display = 'none';
}

async function submitProductForm(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const id = formData.get('id');

    const productData = { name: formData.get('name'), price: formData.get('price'), base_uom: formData.get('base_uom'), has_bulk: formData.get('has_bulk_uom') === 'on'
    };
    
    if (productData.has_bulk) {
        productData.bulk_uom = formData.get('bulk_uom');
        productData.conversion_factor = parseInt(formData.get('conversion_factor')) || null;
    }

    // We no longer send quantity, price, expiry_date here
    const url = id ? `/api/products/${id}` : '/api/products';
    const method = id ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productData)
        });

        const result = await response.json();

        if (response.ok) {
            alert(`✅ ${id ? 'تم التحديث بنجاح' : 'تمت الإضافة بنجاح'} `);
            closeProductModal();
            // Reload whichever view is currently active
            if (document.querySelector('.page-title h1')?.textContent === 'Stock Inventory') {
                loadStock();
            } else {
                loadInventory();
            }
        } else {
            alert('❌ ' + (result.error || 'فشلت العملية'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('❌ خطأ في الاتصال');
    }
}

async function deleteProduct(id) {
    if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;

    try {
        const response = await fetch(`/api/products/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert('✅ تم الحذف بنجاح');
            
            // Broadcast deletion event to sync Master-Mirror screens
            if (window.BroadcastChannel) {
                const bc = new BroadcastChannel('inventory_sync');
                bc.postMessage({ type: 'delete', productId: id });
                bc.close();
            }

            if (document.querySelector('.page-title h1')?.textContent === 'Stock Inventory') {
                loadStock();
            } else {
                loadInventory();
            }
        } else {
            const result = await response.json();
            alert('❌ ' + (result.error || 'فشل الحذف'));
        }
    } catch (error) {
        console.error('Error deleting:', error);
        alert('❌ خطأ في الاتصال');
    }
}

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
    
    const hasBulkCheckbox = document.getElementById('has_bulk_uom');
    if (hasBulkCheckbox) {
        hasBulkCheckbox.addEventListener('change', function() {
            document.getElementById('bulk-uom-group').style.display = this.checked ? 'flex' : 'none';
        });
    }
});

/**
 * Loads the Stock Inventory View.
 */
async function loadStock() {
    setActiveLink('link-stock');

    // Update Page Title
    const topBar = document.querySelector('.top-bar');
    if (topBar) topBar.style.display = 'flex'; // Restore top bar

    document.querySelector('.page-title h1').textContent = 'Stock Inventory';
    document.querySelector('.breadcrumbs').innerHTML = 'Home <i class="fa-solid fa-chevron-right" style="font-size: 0.7em; margin: 0 5px;"></i> Stock Management';

    // Update Top Action Button to keep addition field visually but restrict it
    const actionBtn = document.querySelector('.top-actions .btn-primary');
    if (actionBtn) {
        actionBtn.innerHTML = '<i class="fa-solid fa-plus"></i> New Entry';
        actionBtn.onclick = () => alert('في المخزون لا يمكنك إضافة مواد مباشرة. الرجاء استخدام قسم اللوازم الطبية.');
    }

    app.innerHTML = '<p style="text-align: center; margin-top: 2rem; color: #64748b;">جاري تحميل المخزون...</p>';

    try {
        const response = await fetch('/api/products');
        allInventory = await response.json();
        const inventory = allInventory;

        const totalItems = inventory.reduce((acc, curr) => acc + curr.quantity, 0);

        app.innerHTML = `
            < !--Top Stats-- >
            <div class="inv-stats-grid stock-stats" style="margin-bottom: 25px;">
                <!-- Total Items -->
                <div class="inv-stat-card" style="border-left: 4px solid #3b82f6;">
                    <div class="stat-header">
                        <div class="stat-icon-box" style="background: transparent; color: #b45309; font-size: 1.5rem;"><i class="fa-solid fa-box"></i></div>
                        <div class="stat-trend text-only" style="color: #3b82f6; background: #eff6ff; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold;">GLOBAL</div>
                    </div>
                    <div class="stat-content">
                        <div class="stat-label">Total Items</div>
                        <div class="stat-value" style="font-size: 1.8rem;">${totalItems.toLocaleString()}</div>
                    </div>
                </div>
                <!-- Expired Items -->
                <div class="inv-stat-card" style="border-left: 4px solid #ef4444;">
                    <div class="stat-header">
                        <div class="stat-icon-box" style="background: transparent; color: #eab308; font-size: 1.5rem;"><i class="fa-solid fa-triangle-exclamation"></i></div>
                        <div class="stat-trend text-only" style="color: #ef4444; background: #fef2f2; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold;">URGENT</div>
                    </div>
                    <div class="stat-content">
                        <div class="stat-label">Expired Items</div>
                        <div class="stat-value" style="font-size: 1.8rem;">12</div>
                    </div>
                </div>
                <!-- Low Stock -->
                <div class="inv-stat-card" style="border-left: 4px solid #f97316;">
                    <div class="stat-header">
                        <div class="stat-icon-box" style="background: transparent; color: #60a5fa; font-size: 1.5rem;"><i class="fa-solid fa-chart-line-down"></i></div>
                        <div class="stat-trend text-only" style="color: #f97316; background: #fff7ed; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold;">REFILL</div>
                    </div>
                    <div class="stat-content">
                        <div class="stat-label">Low Stock</div>
                        <div class="stat-value" style="font-size: 1.8rem;">45</div>
                    </div>
                </div>
                <!-- Inventory Value -->
                <div class="inv-stat-card" style="border-left: 4px solid #22c55e;">
                    <div class="stat-header">
                        <div class="stat-icon-box" style="background: transparent; color: #eab308; font-size: 1.5rem;"><i class="fa-solid fa-sack-dollar"></i></div>
                        <div class="stat-trend text-only" style="color: #22c55e; background: #f0fdf4; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold;">VALUATION</div>
                    </div>
                    <div class="stat-content">
                        <div class="stat-label">Inventory Value</div>
                        <div class="stat-value" style="font-size: 1.8rem;">$42,500</div>
                    </div>
                </div>
            </div>

            <!--Header & Filter-->
            <div class="filter-bar" style="display: flex; flex-wrap: wrap; gap: 15px; align-items: center; justify-content: space-between; background: white; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
                <div class="filter-actions-left" style="display: flex; gap: 15px; align-items: center; flex-grow: 1;">
                    <div class="search-input-group" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; display: flex; align-items: center; min-width: 250px;">
                        <i class="fa-solid fa-magnifying-glass" style="color: #94a3b8; margin-right: 8px;"></i>
                        <input type="text" id="stockSearch" placeholder="Search by name, SKU or category" oninput="filterStock(this.value)" style="border: none; background: transparent; outline: none; width: 100%; font-size: 0.9rem;">
                    </div>
                    <div class="filter-dropdown" style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; display: flex; align-items: center; background: #f8fafc; color: #475569; font-size: 0.9rem; cursor: pointer;">
                        <i class="fa-solid fa-filter" style="margin-right: 6px; color: #94a3b8;"></i> Filter <i class="fa-solid fa-chevron-down" style="margin-left: 10px; font-size: 0.8em; color: #94a3b8;"></i>
                    </div>
                </div>
                <div class="filter-actions-right" style="display: flex; gap: 10px; align-items: center;">
                    <button class="btn-primary" onclick="openProductModal()" style="background: #3b82f6; color: white; border: none; padding: 10px 18px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 0.9rem;">
                        <i class="fa-solid fa-plus"></i> Add New Product
                    </button>
                </div>
            </div>

            <!--Table -->
            <div class="inv-table-container" style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                <table class="inv-table" style="width: 100%; border-collapse: collapse;">
                    <thead style="background: white; border-bottom: 2px solid #e2e8f0; color: #64748b; font-size: 0.75rem; font-weight: bold; text-align: left; letter-spacing: 0.5px;">
                        <tr>
                            <th style="padding: 16px 24px;">ITEM NAME</th>
                            <th style="padding: 16px 24px;">MAIN WAREHOUSE</th>
                            <th style="padding: 16px 24px;">AVAILABLE QTY</th>
                            <th style="padding: 16px 24px;">EXPIRATION DATE</th>
                            <th style="padding: 16px 24px;">STATUS</th>
                            <th style="padding: 16px 24px; text-align: center;">ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody id="stockTableBody">
                        ${generateStockRows(inventory)}
                    </tbody>
                </table>
                <div class="pagination" style="padding: 16px 24px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; color: #64748b; font-size: 0.875rem;">
                    <span>Showing 1 to ${Math.min(inventory.length, 4)} of ${inventory.length.toLocaleString()} items</span>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <button class="btn-icon-only" style="border: none; background: transparent; cursor: pointer; color: #cbd5e1;"><i class="fa-solid fa-chevron-left"></i></button>
                        <span style="color: #3b82f6; font-weight: 600; padding: 0 8px;">1</span>
                        <button class="btn-icon-only" style="border: none; background: transparent; cursor: pointer; color: #334155;"><i class="fa-solid fa-chevron-right"></i></button>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading stock:', error);
        app.innerHTML = `< p class= "error" > Failed to load data: ${error.message}</p > `;
    }
}

function filterStock(query) {
    const lowerQuery = query.toLowerCase();
    const filtered = allInventory.filter(item =>
        item.name.toLowerCase().includes(lowerQuery) ||
        item.id.toString().includes(lowerQuery)
    );
    document.getElementById('stockTableBody').innerHTML = generateStockRows(filtered);
}

function generateStockRows(items) {
    if (items.length === 0) {
        return '<tr><td colspan="6" style="text-align:center; padding: 2rem;">No items found</td></tr>';
    }

    return items.map((item, index) => {
        const sku = `REF: ${item.name.substring(0, 3).toUpperCase()} - 2023-00${item.id} `;

        // Mock warehouse logic to match English design
        const warehouses = ['Section A-12', 'Section C-04', 'Cold Storage 1', 'Section B-05'];
        const warehouse = warehouses[index % warehouses.length];

        let statusBadge = '<span style="background: #dcfce7; color: #16a34a; padding: 4px 12px; border-radius: 999px; font-size: 0.75rem; font-weight: bold; display: inline-flex; align-items: center; gap: 6px;"><i class="fa-solid fa-circle-check"></i> Available</span>';
        if (item.quantity < 20 && item.quantity > 0) {
            statusBadge = '<span style="background: #ffedd5; color: #ea580c; padding: 4px 12px; border-radius: 999px; font-size: 0.75rem; font-weight: bold; display: inline-flex; align-items: center; gap: 6px;"><i class="fa-solid fa-triangle-exclamation"></i> Running low</span>';
        } else if (item.quantity === 0) {
            statusBadge = '<span style="background: #fee2e2; color: #dc2626; padding: 4px 12px; border-radius: 999px; font-size: 0.75rem; font-weight: bold; display: inline-flex; align-items: center; gap: 6px;"><i class="fa-solid fa-circle-xmark"></i> Not available</span>';
        }

        const qtyColor = item.quantity === 0 ? '#ef4444' : (item.quantity < 20 ? '#ea580c' : '#1e293b');
        const qtyFontWeight = item.quantity < 20 ? 'bold' : '600';

        // Initial / Avatar logic
        const initial = item.name.charAt(0).toUpperCase();
        const initialBg = ['#eff6ff', '#f3e8ff', '#fee2e2', '#e0f2fe'][index % 4];
        const initialColor = ['#3b82f6', '#9333ea', '#ef4444', '#0284c7'][index % 4];

        const expiry = item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Dec 2025';

        return `
            < tr style = "border-bottom: 1px solid #f8fafc; cursor: pointer; transition: background 0.2s;" onmouseover = "this.style.background='#f8fafc'" onmouseout = "this.style.background='transparent'" >
                <td style="padding: 16px 24px;">
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <div style="width: 36px; height: 36px; border-radius: 8px; background: ${initialBg}; color: ${initialColor}; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.1rem;">
                            ${initial}
                        </div>
                        <div>
                            <div style="font-weight: 600; color: #1e293b; font-size: 0.95rem; margin-bottom: 4px;">${item.name}</div>
                            <div style="color: #94a3b8; font-size: 0.75rem;">${sku}</div>
                        </div>
                    </div>
                </td>
                <td style="padding: 16px 24px; color: #64748b; font-size: 0.9rem;">${warehouse}</td>
                <td style="padding: 16px 24px; color: ${qtyColor}; font-weight: ${qtyFontWeight}; font-size: 0.95rem;">${item.quantity.toLocaleString()}</td>
                <td style="padding: 16px 24px; color: #64748b; font-size: 0.9rem;">${expiry}</td>
                <td style="padding: 16px 24px;">${statusBadge}</td>
                <td style="padding: 16px 24px; text-align: center; white-space: nowrap;">
                    <button onclick="event.stopPropagation(); openEditProductModal(${item.id}, '${item.name.replace(/'/g, "\\'").replace(/"/g, "&quot;")}', ${item.price || 0}, ${item.quantity}, '${item.expiry_date || ''}')" style="border: 1px solid #e2e8f0; background: white; color: #475569; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 600; display: inline-flex; align-items: center; gap: 5px; transition: all 0.2s; margin-right: 6px;" onmouseover="this.style.borderColor='#3b82f6'; this.style.color='#3b82f6';" onmouseout="this.style.borderColor='#e2e8f0'; this.style.color='#475569';">
                        <i class="fa-solid fa-pen" style="font-size: 0.75rem;"></i> Edit
                    </button>
                    <button onclick="event.stopPropagation(); deleteProduct(${item.id})" style="border: 1px solid #fecaca; background: #fff5f5; color: #ef4444; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 600; display: inline-flex; align-items: center; gap: 5px; transition: all 0.2s;" onmouseover="this.style.background='#fee2e2'; this.style.borderColor='#ef4444';" onmouseout="this.style.background='#fff5f5'; this.style.borderColor='#fecaca';">
                        <i class="fa-solid fa-trash-can" style="font-size: 0.75rem;"></i> Delete
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}


