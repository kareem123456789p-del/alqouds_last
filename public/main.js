const app = document.getElementById('app');

// Cards Configuration (Translated)
const dashboardCards = [
    { title: 'المستلزمات الطبية', desc: 'إدارة العناصر والكتالوج', icon: 'fa-box', color: '#fff7ed', iconColor: '#ea580c' },
    { title: 'المخازن', desc: 'المواقع والتخزين', icon: 'fa-warehouse', color: '#eff6ff', iconColor: '#3b82f6', link: 'warehouse.html' },
    { title: 'المخزون', desc: 'تتبع المستويات المباشر', icon: 'fa-chart-line', color: '#f0fdf4', iconColor: '#16a34a' },
    { title: 'الأطباء', desc: 'قاعدة بيانات الواصفين', icon: 'fa-user-doctor', color: '#fafaf9', iconColor: '#0ea5e9' },

    { title: 'الصيدلية', desc: 'وحدات الصرف', icon: 'fa-pills', color: '#fff1f2', iconColor: '#e11d48' },
    { title: 'الطلبات', desc: 'طلبات الشراء', icon: 'fa-file-invoice', color: '#fffbeb', iconColor: '#d97706' },
    { title: 'الواردات', desc: 'الشحنات الواردة', icon: 'fa-file-import', color: '#ecfdf5', iconColor: '#059669', link: 'import.html' },
    { title: 'الصادرات', desc: 'التوزيع الصادر', icon: 'fa-file-export', color: '#fff7ed', iconColor: '#c2410c' },

    {
        title: 'الموردين',
        desc: 'البائعين والشركاء',
        icon: 'fa-handshake',
        color: '#fefce8',
        iconColor: '#ca8a04',
        link: 'suppliers.html',
        dynamicCountId: 'card-supplier-count'
    },
    { title: 'الموظفين', desc: 'إدارة الكادر', icon: 'fa-users', color: '#eff6ff', iconColor: '#2563eb' },
    { title: 'المسحوبات', desc: 'التتبع المالي', icon: 'fa-money-bill-wave', color: '#f0fdf4', iconColor: '#15803d', link: 'withdrawals.html', dynamicCountId: 'card-wd-total' },
    { title: 'التقارير', desc: 'التحليلات والرؤى', icon: 'fa-chart-bar', color: '#f3f4f6', iconColor: '#4b5563' },

    { title: 'الإشعارات', desc: '3 تنبيهات جديدة', icon: 'fa-bell', color: '#fff1f2', iconColor: '#dc2626' }
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
    document.querySelector('.page-title h1').textContent = 'نظرة عامة';
    document.querySelector('.breadcrumbs').innerHTML = 'الرئيسية <i class="fa-solid fa-chevron-left" style="font-size: 0.7em; margin: 0 5px;"></i> لوحة القيادة';

    const today = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });

    app.innerHTML = `
        <!-- Welcome Banner -->
        <div class="welcome-banner">
            <div class="welcome-text">
                <h2>مرحباً بك، د. أمير 👋</h2>
                <p>لديك 12 إشعار معلق و 4 تنبيهات انخفاض مخزون اليوم.</p>
            </div>
            <div class="date-badge">
                <i class="fa-regular fa-calendar"></i> ${today}
            </div>
        </div>

        <!-- Cards Grid -->
        <div class="card-grid">
            ${dashboardCards.map(card => {
        const isLinked = !!card.link;
        const tag = isLinked ? 'a' : 'div';
        const href = isLinked ? `href="${card.link}"` : ``;
        const clickAttr = isLinked ? `onclick="window.location.href='${card.link}'"` : `onclick="alert('الانتقال إلى ${card.title}')"`;
        const countEl = card.dynamicCountId
            ? `<span class="card-live-count" id="${card.dynamicCountId}">…</span>`
            : '';
        return `
                <${tag} class="nav-card${isLinked ? ' nav-card--linked' : ''}" ${href} ${clickAttr}>
                    <div class="card-icon" style="background-color: ${card.color}; color: ${card.iconColor};">
                        <i class="fa-solid ${card.icon}"></i>
                    </div>
                    <h3>${card.title}</h3>
                    <p>${card.desc}${countEl}</p>
                </${tag}>`;
    }).join('')}
        </div>
    `;

    // Fetch live supplier count and inject into card
    loadSupplierCount();
    // Fetch live withdrawals total for the month and inject into card
    loadWithdrawalsTotal();
}

/**
 * Fetches the total number of local suppliers from the API
 * and updates the count badge on the dashboard card.
 */
async function loadSupplierCount() {
    try {
        const res = await fetch('/api/suppliers');
        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        const el = document.getElementById('card-supplier-count');
        if (el) el.textContent = ` · ${data.length} مورد`;
    } catch (e) {
        // silently fail – count badge just stays hidden
        const el = document.getElementById('card-supplier-count');
        if (el) el.style.display = 'none';
    }
}

/**
 * Fetches the monthly withdrawals total and injects it into the dashboard card.
 */
async function loadWithdrawalsTotal() {
    try {
        const res = await fetch('/api/withdrawals/stats');
        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        const el = document.getElementById('card-wd-total');
        if (el) {
            const formatted = parseFloat(data.monthly_total || 0).toLocaleString('en-EG', {
                minimumFractionDigits: 0, maximumFractionDigits: 0
            });
            el.textContent = `EGP ${formatted}`;
            el.style.color = '#15803d';
            el.style.background = '#f0fdf4';
            el.style.borderColor = '#bbf7d0';
            // If there are alerts, highlight in orange
            if (data.alerts && data.alerts.length > 0) {
                el.textContent += ` · ${data.alerts.length} تنبيه`;
                el.style.color = '#c2410c';
                el.style.background = '#fff7ed';
                el.style.borderColor = '#fed7aa';
            }
        }
    } catch (e) {
        const el = document.getElementById('card-wd-total');
        if (el) el.style.display = 'none';
    }
}

/**
 * Loads the Inventory Management View.
 */
async function loadInventory() {
    setActiveLink('link-inventory');

    // Update Page Title
    document.querySelector('.page-title h1').textContent = 'إدارة المخزون';
    document.querySelector('.breadcrumbs').innerHTML = 'الرئيسية <i class="fa-solid fa-chevron-left" style="font-size: 0.7em; margin: 0 5px;"></i> المخزون';

    app.innerHTML = '<p style="text-align: center; margin-top: 2rem; color: #64748b;">جاري التحميل...</p>';

    try {
        const response = await fetch('/api/inventory');
        const inventory = await response.json();

        // Calculate Stats
        const totalItems = inventory.length;
        const lowStockItems = inventory.filter(i => (i.warehouse_stock + i.store_stock) < 10).length;
        const totalValue = inventory.reduce((sum, i) => sum + (i.warehouse_stock * (i.price || 50)), 0); // Mock price if missing

        app.innerHTML = `
            <!-- Top Stats -->
            <div class="inv-stats-grid">
                <div class="inv-stat-card blue">
                    <span class="stat-tag">إجمالي</span>
                    <div class="stat-icon"><i class="fa-solid fa-box" style="color: #3b82f6;"></i></div>
                    <div>
                        <div class="stat-label">إجمالي العناصر</div>
                        <div class="stat-value">${totalItems}</div>
                    </div>
                </div>
                <div class="inv-stat-card red">
                    <span class="stat-tag">عاجل</span>
                    <div class="stat-icon"><i class="fa-solid fa-triangle-exclamation" style="color: #ef4444;"></i></div>
                    <div>
                        <div class="stat-label">منتهي الصلاحية</div>
                        <div class="stat-value">0</div> <!-- Dummy -->
                    </div>
                </div>
                <div class="inv-stat-card orange">
                    <span class="stat-tag">إعادة تعبئة</span>
                    <div class="stat-icon"><i class="fa-solid fa-arrow-trend-down" style="color: #f97316;"></i></div>
                    <div>
                        <div class="stat-label">مخزون منخفض</div>
                        <div class="stat-value">${lowStockItems}</div>
                    </div>
                </div>
                <div class="inv-stat-card green">
                    <span class="stat-tag">تقييم</span>
                    <div class="stat-icon"><i class="fa-solid fa-sack-dollar" style="color: #22c55e;"></i></div>
                    <div>
                        <div class="stat-label">قيمة المخزون</div>
                        <div class="stat-value">$${totalValue.toLocaleString()}</div>
                    </div>
                </div>
            </div>

            <!-- Filter Bar -->
            <div class="filter-bar">
                <div class="search-input-group">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="text" placeholder="بحث عن اسم عنصر أو رمز...">
                </div>
                <select class="filter-select">
                    <option>المخزن: الكل</option>
                    <option>المستودع الرئيسي</option>
                    <option>الصيدلية</option>
                </select>
                <select class="filter-select">
                    <option>الفئة: الكل</option>
                </select>

                <div class="action-buttons">
                    <button class="btn-secondary" onclick="alert('Feature coming soon')">
                        <i class="fa-solid fa-arrow-right-arrow-left"></i> نقل
                    </button>
                    <button class="btn-secondary" onclick="alert('Feature coming soon')">
                        <i class="fa-solid fa-print"></i> تقرير
                    </button>
                    <button class="btn-secondary" onclick="alert('Feature coming soon')">
                        <i class="fa-solid fa-sliders"></i> تعديل
                    </button>
                </div>
            </div>

            <!-- Table -->
            <div class="inv-table-container">
                <table class="inv-table">
                    <thead>
                        <tr>
                            <th>اسم العنصر</th>
                            <th>المستودع الرئيسي</th>
                            <th>الكمية المتاحة</th>
                            <th>تاريخ الصلاحية</th>
                            <th>الحالة</th>
                            <th>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${inventory.map(item => {
            const totalStock = item.warehouse_stock + item.store_stock;
            const status = getStatus(totalStock);
            const initial = item.name.charAt(0).toUpperCase();

            // Mock Data for display
            const section = `قسم ${String.fromCharCode(65 + (item.id % 3))}-0${item.id}`;
            const expiry = "ديسمبر 2025";

            return `
                                <tr>
                                    <td>
                                        <div class="item-name-cell">
                                            <div class="item-icon-box" style="background: #eff6ff; color: #3b82f6;">${initial}</div>
                                            <div class="item-details">
                                                <h4>${item.name}</h4>
                                                <span>REF: ${item.sku}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td>${section}</td>
                                    <td style="font-weight: bold;">${totalStock}</td>
                                    <td>${expiry}</td>
                                    <td>${status.badge}</td>
                                    <td>
                                        <button class="btn-icon-only"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                                    </td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
                <div class="pagination">
                    <span>عرض 1 إلى ${inventory.length} من ${inventory.length} عناصر</span>
                    <div>
                        <i class="fa-solid fa-chevron-right" style="margin-left: 10px; cursor: pointer;"></i>
                        <span style="color: #3b82f6; font-weight: bold;">1</span>
                        <i class="fa-solid fa-chevron-left" style="margin-right: 10px; cursor: pointer;"></i>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading inventory:', error);
        app.innerHTML = `<p class="error">فشل تحميل البيانات: ${error.message}</p>`;
    }
}

/**
 * Returns HTML badge based on quantity status.
 * @param {number} qty 
 */
function getStatus(qty) {
    if (qty <= 0) {
        return { badge: '<span class="badge badge-out"><i class="fa-solid fa-circle-xmark"></i> غير متوفر</span>' };
    } else if (qty < 20) {
        return { badge: '<span class="badge badge-low"><i class="fa-solid fa-triangle-exclamation"></i> ينفد</span>' };
    } else {
        return { badge: '<span class="badge badge-available"><i class="fa-solid fa-circle-check"></i> متوفر</span>' };
    }
}

// Initial Load
document.addEventListener('DOMContentLoaded', loadDashboard);
