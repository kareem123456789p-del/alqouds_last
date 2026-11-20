/**
 * Al-Quds Medical ERP — Internationalization & Dual-Language Manager
 * Supports:
 *   - 'ar'      : Fully Arabic with authentic clinical & operational ERP linguistic style (Default).
 *   - 'default' : Exact original bilingual/mixed text with zero modifications.
 */
(function() {
    'use strict';

    const STORAGE_KEY = 'alquds_language';
    // Default to fully Arabic as required
    const DEFAULT_LANG = 'ar';

    const translations = {
        ar: {
            name: 'العربية (كاملة)',
            flag: '🇸🇦',
            dir: 'rtl',
            // Login Page
            loginTitle: 'Al-Quds Center | مركز القدس',
            loginSubtitle: 'أهلاً بكم من جديد',
            regNumberLabel: 'رقم التسجيل',
            passwordLabel: 'كلمة المرور',
            forgotPassword: 'نسيت كلمة المرور؟',
            rememberSession: 'تذكر الجلسة',
            loginButton: 'تسجيل الدخول',
            secureBadge: 'دخول آمن ومشفّر لنظام إدارة المركز',
            // Main Index / Overview
            dashTitle: 'لوحة التحكم الرئيسية',
            transferConsoleTitle: 'التحويلات بين الفروع',
            transferConsoleDesc: 'تحويل المخزون بين الفروع والمستودعات',
            backToDashboard: 'العودة إلى لوحة التحكم',
            doctorDirTitle: 'مركز القدس - دليل الأطباء والعيادات',
            // Admin Dashboard
            adminBrand: 'مركز القدس الطبي',
            adminLogout: 'تسجيل الخروج',
            staffMgmtTitle: 'إدارة الموظفين والصلاحيات',
            staffMgmtDesc: 'إدارة وتعيين أدوار الموظفين وصلاحيات الوصول.',
            addStaffBtn: 'إضافة موظف جديد',
            thName: 'الاسم',
            thReg: 'رقم التسجيل',
            thBranch: 'الفرع',
            thRole: 'الدور الوظيفي',
            thStatus: 'الحالة',
            thActions: 'الإجراءات',
            transfersTitle: 'تحويلات المخزون بين الفروع',
            transfersDesc: 'إدارة ومتابعة حركات نقل المخزون بين الفروع والمستودعات.',
            auditLogBtn: 'سجل التدقيق',
            newTransferBtn: 'طلب تحويل جديد',
            branchLabel: 'الفرع:',
            welcomeOverview: 'مرحباً بكم في مركز القدس الطبي.'
        },
        default: {
            name: 'الافتراضي (ثنائي اللغة)',
            flag: '🌐',
            dir: 'rtl',
            // Login Page
            loginTitle: 'Al-Quds Center | مركز القدس',
            loginSubtitle: 'Welcome Back | أهلاً بكم من جديد',
            regNumberLabel: 'Registration Number | رقم التسجيل',
            passwordLabel: 'Password | كلمة المرور',
            forgotPassword: '?Forgot Password | نسيت كلمة المرور؟',
            rememberSession: 'Remember session | تذكر الجلسة',
            loginButton: 'Login',
            secureBadge: 'Secure Clinical Sanctuary Access | دخول آمن لنظام المركز',
            // Main Index / Overview
            dashTitle: 'DASHBOURD',
            transferConsoleTitle: 'Transfer Console',
            transferConsoleDesc: 'Inter-warehouse stock transfers',
            backToDashboard: 'Back to Dashboard',
            doctorDirTitle: 'Al-Quds Center - Doctor Directory',
            // Admin Dashboard
            adminBrand: 'Al-Quds Center',
            adminLogout: 'Logout',
            staffMgmtTitle: 'Staff Management',
            staffMgmtDesc: 'Manage employee roles and permissions.',
            addStaffBtn: 'Add Staff',
            thName: 'Name',
            thReg: 'Reg No.',
            thBranch: 'Branch',
            thRole: 'Role',
            thStatus: 'Status',
            thActions: 'Actions',
            transfersTitle: 'Stock Transfers / تحويلات المخزون',
            transfersDesc: 'Manage inter-branch stock movements.',
            auditLogBtn: 'Audit Log',
            newTransferBtn: 'New Transfer',
            branchLabel: 'Branch:',
            welcomeOverview: 'Welcome to Al-Quds Center.'
        }
    };

    function getLanguage() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && translations[saved]) {
            return saved;
        }
        return DEFAULT_LANG;
    }

    function setLanguage(lang) {
        if (!translations[lang]) return;
        localStorage.setItem(STORAGE_KEY, lang);
        applyTranslations(lang);
        updateSwitcherUI(lang);
    }

    function toggleLanguage() {
        const current = getLanguage();
        const next = current === 'ar' ? 'default' : 'ar';
        setLanguage(next);
    }

    function applyTranslations(lang) {
        const t = translations[lang];
        if (!t) return;

        // ── 1. Login Page ─────────────────────────────────────────────
        const loginTitle = document.querySelector('.login-title');
        if (loginTitle) {
            loginTitle.textContent = t.loginTitle;
        }

        const loginSubtitle = document.querySelector('.login-subtitle');
        if (loginSubtitle) {
            loginSubtitle.textContent = t.loginSubtitle;
        }

        // Form labels
        const formLabels = document.querySelectorAll('.form-group .form-label-row');
        if (formLabels.length >= 2) {
            // First group: Reg number
            if (lang === 'ar') {
                formLabels[0].innerHTML = `<span class="form-label-ar" style="font-weight:700; color:#1e293b; font-size:0.95rem;">${t.regNumberLabel}</span>`;
            } else {
                formLabels[0].innerHTML = `<span class="form-label">Registration Number</span><span class="form-label-ar">| رقم التسجيل</span>`;
            }

            // Second group: Password
            if (lang === 'ar') {
                formLabels[1].innerHTML = `
                    <span class="form-label-ar" style="font-weight:700; color:#1e293b; font-size:0.95rem;">${t.passwordLabel}</span>
                    <a class="forgot-link" href="javascript:void(0)" onclick="showToast('يرجى التواصل مع مسؤول النظام لإعادة تعيين كلمة المرور.', 'error')">${t.forgotPassword}</a>
                `;
            } else {
                formLabels[1].innerHTML = `
                    <span class="form-label">Password</span>
                    <span class="form-label-ar">| كلمة المرور</span>
                    <a class="forgot-link" href="javascript:void(0)" onclick="showToast('Please contact system admin to reset your password.', 'error')">?Forgot Password | نسيت كلمة المرور؟</a>
                `;
            }
        }

        const rememberLabel = document.querySelector('label[for="remember-session"]');
        if (rememberLabel) {
            rememberLabel.textContent = t.rememberSession;
        }

        const loginBtnText = document.getElementById('login-btn-text');
        if (loginBtnText) {
            loginBtnText.textContent = t.loginButton;
        }

        const secureBadgeText = document.querySelector('.secure-badge span');
        if (secureBadgeText) {
            secureBadgeText.textContent = t.secureBadge;
        }

        // ── 2. Index Page (Operations Dashboard) ──────────────────────
        const mainDashH1 = document.querySelector('.page-title h1');
        if (mainDashH1) {
            mainDashH1.textContent = t.dashTitle;
        }

        // Dashboard cards in main.js
        if (window.dashboardCards && Array.isArray(window.dashboardCards)) {
            const transferCard = window.dashboardCards.find(c => c.action && c.action.includes('transfer.html'));
            if (transferCard) {
                transferCard.title = t.transferConsoleTitle;
                transferCard.desc = t.transferConsoleDesc;
            }
        }

        // ── 3. Back to Dashboard Buttons ──────────────────────────────
        document.querySelectorAll('a[href="index.html"]').forEach(el => {
            if (el.textContent.includes('Back to Dashboard') || el.textContent.includes('العودة إلى لوحة التحكم')) {
                const icon = el.querySelector('i');
                const iconHtml = icon ? icon.outerHTML + ' ' : '';
                el.innerHTML = iconHtml + t.backToDashboard;
            }
        });

        // ── 4. Doctor Directory Header ────────────────────────────────
        const docHeader = document.querySelector('.doctor-header .header-title');
        if (docHeader) {
            const icon = docHeader.querySelector('i');
            const iconHtml = icon ? icon.outerHTML + ' ' : '';
            docHeader.innerHTML = iconHtml + t.doctorDirTitle;
        }

        // ── 5. Admin Dashboard (dashboard.html) ────────────────────────
        const adminBrand = document.querySelector('.navbar-brand');
        if (adminBrand) {
            const icon = adminBrand.querySelector('i');
            const iconHtml = icon ? icon.outerHTML + ' ' : '';
            adminBrand.innerHTML = iconHtml + t.adminBrand;
        }

        const logoutBtn = document.querySelector('.logout-btn');
        if (logoutBtn) {
            const icon = logoutBtn.querySelector('i');
            const iconHtml = icon ? icon.outerHTML + ' ' : '';
            logoutBtn.innerHTML = iconHtml + t.adminLogout;
        }

        const staffHeaderTitle = document.querySelector('#admin-panel .page-header h1');
        if (staffHeaderTitle) staffHeaderTitle.textContent = t.staffMgmtTitle;

        const staffHeaderDesc = document.querySelector('#admin-panel .page-header p');
        if (staffHeaderDesc) staffHeaderDesc.textContent = t.staffMgmtDesc;

        const addStaffBtn = document.querySelector('#admin-panel .btn-primary');
        if (addStaffBtn) {
            addStaffBtn.innerHTML = `<i class="fa-solid fa-plus"></i> ${t.addStaffBtn}`;
        }

        const staffThs = document.querySelectorAll('#admin-panel table thead th');
        if (staffThs.length >= 6) {
            staffThs[0].textContent = t.thName;
            staffThs[1].textContent = t.thReg;
            staffThs[2].textContent = t.thBranch;
            staffThs[3].textContent = t.thRole;
            staffThs[4].textContent = t.thStatus;
            staffThs[5].textContent = t.thActions;
        }

        const transfersHeaderTitle = document.querySelector('#transfers-panel .page-header h1');
        if (transfersHeaderTitle) transfersHeaderTitle.textContent = t.transfersTitle;

        const transfersHeaderDesc = document.querySelector('#transfers-panel .page-header p');
        if (transfersHeaderDesc) transfersHeaderDesc.textContent = t.transfersDesc;

        const auditLogBtn = document.querySelector('#transfers-panel .btn-outline');
        if (auditLogBtn) auditLogBtn.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i> ${t.auditLogBtn}`;

        const newTransferBtn = document.querySelector('#transfers-panel .btn-primary');
        if (newTransferBtn) newTransferBtn.innerHTML = `<i class="fa-solid fa-truck"></i> ${t.newTransferBtn}`;
    }

    function createSwitcherButton() {
        if (document.getElementById('alquds-lang-switcher')) return;

        const current = getLanguage();
        const other = current === 'ar' ? 'default' : 'ar';
        const label = current === 'ar' ? '🌐 العربية (كاملة)' : '🌐 الافتراضي (Default)';
        const title = current === 'ar' ? 'انقر للتبديل إلى الوضع الافتراضي (ثنائي اللغة)' : 'انقر للتبديل إلى اللغة العربية بالكامل';

        const btn = document.createElement('button');
        btn.id = 'alquds-lang-switcher';
        btn.type = 'button';
        btn.title = title;
        btn.innerHTML = `<span style="font-size: 0.95rem; font-weight: 700;">${label}</span>`;
        btn.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 14px;
            background: #ffffff;
            color: #1e293b;
            border: 1px solid #cbd5e1;
            border-radius: 20px;
            font-size: 0.85rem;
            font-family: inherit;
            cursor: pointer;
            box-shadow: 0 1px 3px rgba(0,0,0,0.08);
            transition: all 0.2s ease;
            user-select: none;
            z-index: 10000;
        `;

        btn.onmouseover = () => {
            btn.style.background = '#f8fafc';
            btn.style.borderColor = '#2563eb';
            btn.style.color = '#2563eb';
        };
        btn.onmouseout = () => {
            btn.style.background = '#ffffff';
            btn.style.borderColor = '#cbd5e1';
            btn.style.color = '#1e293b';
        };
        btn.onclick = (e) => {
            e.preventDefault();
            toggleLanguage();
        };

        // Try mounting into appropriate header containers
        // 1. Dashboard navbar menu
        const navMenu = document.querySelector('.navbar-menu');
        if (navMenu) {
            btn.style.marginRight = '0.5rem';
            navMenu.insertBefore(btn, navMenu.firstChild);
            return;
        }

        // 2. Index top-actions
        const topActions = document.querySelector('.top-actions');
        if (topActions) {
            topActions.insertBefore(btn, topActions.firstChild);
            return;
        }

        // 3. Global new header
        const globalHeader = document.querySelector('.new-global-header');
        if (globalHeader) {
            btn.style.marginLeft = '12px';
            globalHeader.appendChild(btn);
            return;
        }

        // 4. Doctor header right
        const docHeaderRight = document.querySelector('.doctor-header .header-right');
        if (docHeaderRight) {
            docHeaderRight.appendChild(btn);
            return;
        }

        // 5. Login wrapper (top corner floating badge)
        const loginWrapper = document.querySelector('.login-wrapper');
        if (loginWrapper) {
            btn.style.position = 'fixed';
            btn.style.top = '20px';
            btn.style.right = '20px';
            document.body.appendChild(btn);
            return;
        }

        // Fallback: floating pill in top-left
        btn.style.position = 'fixed';
        btn.style.top = '15px';
        btn.style.left = '15px';
        document.body.appendChild(btn);
    }

    function updateSwitcherUI(lang) {
        const btn = document.getElementById('alquds-lang-switcher');
        if (!btn) return;
        const label = lang === 'ar' ? '🌐 العربية (كاملة)' : '🌐 الافتراضي (Default)';
        const title = lang === 'ar' ? 'انقر للتبديل إلى الوضع الافتراضي (ثنائي اللغة)' : 'انقر للتبديل إلى اللغة العربية بالكامل';
        btn.innerHTML = `<span style="font-size: 0.95rem; font-weight: 700;">${label}</span>`;
        btn.title = title;
    }

    // Auto-init on DOM ready
    function init() {
        const lang = getLanguage();
        applyTranslations(lang);
        createSwitcherButton();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Public API
    window.AlQudsI18n = {
        getLanguage,
        setLanguage,
        toggleLanguage,
        translations
    };
})();
