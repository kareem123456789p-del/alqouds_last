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
            welcomeOverview: 'مرحباً بكم في مركز القدس الطبي.',

            // Inner Modals: Transfer Modal
            modalTransferTitle: 'طلب تحويل مخزني جديد',
            modalTransferDest: 'الفرع المستلم',
            modalTransferNotes: 'ملاحظات',
            modalTransferNotesPlaceholder: 'ملاحظات اختيارية...',
            modalTransferItems: 'الأصناف',
            modalTransferAddRow: 'إضافة صنف',
            modalTransferSubmit: 'إرسال طلب التحويل',
            modalTransferCancel: 'إلغاء',

            // Inner Modals: Audit Log Modal
            modalAuditLogTitle: 'سجل تدقيق التحويلات وحركات المخزون',
            thAuditDate: 'التاريخ',
            thAuditStaff: 'الموظف',
            thAuditAction: 'نوع الإجراء',
            thAuditItem: 'الصنف',
            thAuditQty: 'الكمية',

            // Inner Modals: Staff Modal
            modalStaffAddTitle: 'إضافة موظف جديد',
            modalStaffEditTitle: 'تعديل بيانات الموظف',
            modalStaffNameLabel: 'الاسم الكامل',
            modalStaffRegLabel: 'رقم التسجيل',
            modalStaffPasswordLabel: 'كلمة المرور',
            modalStaffPasswordHint: '(اتركها فارغة في التعديل للإبقاء على الحالية)',
            modalStaffRoleLabel: 'الدور الوظيفي',
            modalStaffBranchLabel: 'الفرع المعين',
            modalStaffStatusLabel: 'الحالة',
            modalStaffPermsLabel: 'الصلاحيات المتاحة',
            modalStaffCancel: 'إلغاء',
            modalStaffSave: 'حفظ التغييرات',

            // Inner Modals: Warehouse
            modalWhAddTitle: 'إضافة مستودع جديد',
            modalWhNameLabel: 'اسم المستودع',
            modalWhLocLabel: 'الموقع / العنوان',
            modalWhCapLabel: 'السعة الاستيعابية (وحدات)',
            modalWhCreateBtn: 'إنشاء المستودع',
            modalWhCancelBtn: 'إلغاء',
            whOverviewTitle: 'نظرة عامة على المستودعات',
            whAddBtn: 'إضافة مستودع',
            whDownloadAuditBtn: 'تحميل تقرير الجرد',
            whPrintReportBtn: 'طباعة التقرير',

            // Inner Modals: Suppliers
            modalSupplierAddTitle: 'إضافة مورد جديد',
            modalSupplierEditTitle: 'تعديل بيانات المورد',
            modalSupplierCompany: 'اسم الشركة',
            modalSupplierContact: 'الشخص المسؤول',
            modalSupplierPhone: 'رقم الهاتف',
            modalSupplierCity: 'المدينة / المنطقة',
            modalSupplierNotes: 'ملاحظات (اختياري)',
            modalSupplierCancel: 'إلغاء',
            modalSupplierSave: 'حفظ بيانات المورد',
            modalDeleteSupplierTitle: 'حذف المورد؟',
            modalDeleteSupplierMsg: 'هل أنت متأكد من حذف هذا المورد؟ لا يمكن التراجع عن هذا الإجراء.',
            modalDeleteConfirmBtn: 'تأكيد الحذف',
            modalDeleteCancelBtn: 'إلغاء',

            // Inner Modals: Supplier Payments (Analytics)
            modalPaymentTitle: 'تسجيل دفعة مورد',
            modalPaymentOutstanding: 'المبلغ المستحق:',
            modalPaymentAmountPlaceholder: 'أدخل المبلغ',
            modalPaymentMethodLabel: 'طريقة الدفع',
            modalPaymentNotesPlaceholder: 'ملاحظات الدفع...',
            modalPaymentCancel: 'إلغاء',
            modalPaymentPay: 'تأكيد الدفع',

            // Inner Modals: Returns
            modalImportReturnTitle: 'إرجاع للمورد',
            modalImportReturnQty: 'الكمية المراد إرجاعها',
            modalImportReturnReason: 'سبب الإرجاع',
            modalImportReturnCancel: 'إلغاء',
            modalImportReturnSubmit: 'تأكيد الإرجاع',

            // Buttons & Generic Labels
            btnSaveDraft: 'حفظ كمسودة',
            btnExportCSV: 'تصدير CSV',
            btnExportLedger: 'تصدير كشف الحساب',
            btnQuickPO: 'أمر شراء سريع',
            btnMarkClearance: 'تحديد للتصفية',
            btnCancel: 'إلغاء',
            btnClose: 'إغلاق',
            btnSave: 'حفظ',
            btnDelete: 'حذف',
            btnEdit: 'تعديل',

            // Status Badges
            statusPending: 'قيد الانتظار',
            statusInTransit: 'قيد الشحن',
            statusCompleted: 'مكتمل',
            statusCancelled: 'ملغي',
            statusActive: 'نشط',
            statusDisabled: 'معطل',

            // Pagination & Empty states
            noDataAvailable: 'لا توجد بيانات متاحة حالياً',
            showingPrefix: 'عرض',
            toPrefix: 'إلى',
            ofPrefix: 'من إجمالي',
            itemsSuffix: 'صنف'
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
            welcomeOverview: 'Welcome to Al-Quds Center.',

            // Inner Modals: Transfer Modal
            modalTransferTitle: 'New Stock Transfer / تحويل جديد',
            modalTransferDest: 'Destination Branch / الفرع المستلم',
            modalTransferNotes: 'Notes / ملاحظات',
            modalTransferNotesPlaceholder: 'Optional notes...',
            modalTransferItems: 'Items / الأصناف',
            modalTransferAddRow: 'Add Item',
            modalTransferSubmit: 'Create Transfer',
            modalTransferCancel: 'Cancel',

            // Inner Modals: Audit Log Modal
            modalAuditLogTitle: 'Stock Movement Log / سجل الحركات',
            thAuditDate: 'Date',
            thAuditStaff: 'Staff',
            thAuditAction: 'Action',
            thAuditItem: 'Item',
            thAuditQty: 'Qty',

            // Inner Modals: Staff Modal
            modalStaffAddTitle: 'Add Staff',
            modalStaffEditTitle: 'Edit Staff',
            modalStaffNameLabel: 'Full Name / الاسم الكامل',
            modalStaffRegLabel: 'Registration Number / رقم التسجيل',
            modalStaffPasswordLabel: 'Password / كلمة المرور',
            modalStaffPasswordHint: '(Leave blank on edit to keep)',
            modalStaffRoleLabel: 'Role / الدور الوظيفي',
            modalStaffBranchLabel: 'Branch Assignment / الفرع',
            modalStaffStatusLabel: 'Status / الحالة',
            modalStaffPermsLabel: 'Permissions Checkboxes / الصلاحيات المتاحة',
            modalStaffCancel: 'Cancel',
            modalStaffSave: 'Save Changes',

            // Inner Modals: Warehouse
            modalWhAddTitle: 'Add New Warehouse',
            modalWhNameLabel: 'Warehouse Name',
            modalWhLocLabel: 'Location',
            modalWhCapLabel: 'Capacity (units)',
            modalWhCreateBtn: 'Create Warehouse',
            modalWhCancelBtn: 'Cancel',
            whOverviewTitle: 'Warehouse Overview',
            whAddBtn: 'Add Warehouse',
            whDownloadAuditBtn: 'تحميل تقرير الجرد',
            whPrintReportBtn: 'Print Report',

            // Inner Modals: Suppliers
            modalSupplierAddTitle: 'Add New Supplier',
            modalSupplierEditTitle: 'Edit Supplier',
            modalSupplierCompany: 'Company Name',
            modalSupplierContact: 'Contact Person',
            modalSupplierPhone: 'Phone Number',
            modalSupplierCity: 'City / Area',
            modalSupplierNotes: 'Notes (optional)',
            modalSupplierCancel: 'Cancel',
            modalSupplierSave: 'Save Supplier',
            modalDeleteSupplierTitle: 'Delete Supplier?',
            modalDeleteSupplierMsg: 'Are you sure you want to delete this supplier? This action cannot be undone.',
            modalDeleteConfirmBtn: 'Delete',
            modalDeleteCancelBtn: 'Cancel',

            // Inner Modals: Supplier Payments (Analytics)
            modalPaymentTitle: 'Record Supplier Payment',
            modalPaymentOutstanding: 'Outstanding:',
            modalPaymentAmountPlaceholder: 'Enter amount',
            modalPaymentMethodLabel: 'Payment Method',
            modalPaymentNotesPlaceholder: 'Payment notes...',
            modalPaymentCancel: 'Cancel',
            modalPaymentPay: 'Confirm Payment',

            // Inner Modals: Returns
            modalImportReturnTitle: 'إرجاع للمورد',
            modalImportReturnQty: 'الكمية المراد إرجاعها',
            modalImportReturnReason: 'سبب الإرجاع',
            modalImportReturnCancel: 'إلغاء',
            modalImportReturnSubmit: 'تأكيد الإرجاع',

            // Buttons & Generic Labels
            btnSaveDraft: 'Save as Draft',
            btnExportCSV: 'Export CSV',
            btnExportLedger: 'Export Ledger',
            btnQuickPO: 'Quick PO',
            btnMarkClearance: 'Mark Clearance',
            btnCancel: 'Cancel',
            btnClose: 'Close',
            btnSave: 'Save',
            btnDelete: 'Delete',
            btnEdit: 'Edit',

            // Status Badges
            statusPending: 'PENDING',
            statusInTransit: 'IN_TRANSIT',
            statusCompleted: 'COMPLETED',
            statusCancelled: 'CANCELLED',
            statusActive: 'Active',
            statusDisabled: 'Disabled',

            // Pagination & Empty states
            noDataAvailable: 'No data available',
            showingPrefix: 'Showing',
            toPrefix: 'to',
            ofPrefix: 'of',
            itemsSuffix: 'items'
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

    // ── Smart Alert & Confirm Localization ─────────────────────────────
    const originalConfirm = window.confirm;
    window.confirm = function(message) {
        const lang = getLanguage();
        if (lang === 'ar' && message && typeof message === 'string') {
            if (message.includes('Are you sure you want to permanently delete') || (message.includes('delete') && message.includes('doctor'))) {
                const docMatch = message.match(/delete\s+(.*?)\?/);
                const name = docMatch ? docMatch[1] : '';
                return originalConfirm(`هل أنت متأكد من رغبتك في حذف الطبيب "${name}" نهائياً؟\n\nلا يمكن التراجع عن هذا الإجراء وسيتم إزالة الطبيب من كافة القوائم.`);
            }
            if (message.includes('Confirm & Dispatch')) {
                return originalConfirm('هل أنت متأكد من تأكيد وشحن هذا الطلب؟ سيتم خصم الكميات من المخزون وتحديث مديونية العميل.');
            }
            if (message.includes('cancel this order')) {
                return originalConfirm('هل أنت متأكد من إلغاء هذا الطلب؟ سيتم إلغاء الطلب دون التأثير على المخزون.');
            }
            if (message.includes('Delete warehouse')) {
                const whMatch = message.match(/warehouse\s+"?(.*?)"?\?/);
                const name = whMatch ? whMatch[1] : '';
                return originalConfirm(`هل أنت متأكد من حذف المستودع "${name}"؟\n\nلا يمكن التراجع عن هذا الإجراء.`);
            }
        }
        return originalConfirm(message);
    };

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

        const formLabels = document.querySelectorAll('.form-group .form-label-row');
        if (formLabels.length >= 2) {
            if (lang === 'ar') {
                formLabels[0].innerHTML = `<span class="form-label-ar" style="font-weight:700; color:#1e293b; font-size:0.95rem;">${t.regNumberLabel}</span>`;
            } else {
                formLabels[0].innerHTML = `<span class="form-label">Registration Number</span><span class="form-label-ar">| رقم التسجيل</span>`;
            }

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

        if (window.dashboardCards && Array.isArray(window.dashboardCards)) {
            const transferCard = window.dashboardCards.find(c => c.action && c.action.includes('transfer.html'));
            if (transferCard) {
                transferCard.title = t.transferConsoleTitle;
                transferCard.desc = t.transferConsoleDesc;
            }
        }

        // ── 3. Back to Dashboard Buttons ──────────────────────────────
        document.querySelectorAll('a[href="index.html"]').forEach(el => {
            if (el.textContent.includes('Back to Dashboard') || el.textContent.includes('العودة إلى لوحة التحكم') || el.textContent.includes('العودة للوحة التحكم')) {
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

        // ── 6. Modals Localization ───────────────────────────────────
        // Transfer Modal
        const transferModalHeader = document.querySelector('#transfer-modal .modal-header h2');
        if (transferModalHeader) transferModalHeader.textContent = t.modalTransferTitle;

        const transferDestLabel = document.querySelector('#transfer-modal label[for="transfer-dest"], #transfer-modal .form-group:nth-child(1) label');
        if (transferDestLabel) transferDestLabel.textContent = t.modalTransferDest;

        const transferNotesLabel = document.querySelector('#transfer-modal label[for="transfer-notes"], #transfer-modal .form-group:nth-child(2) label');
        if (transferNotesLabel) transferNotesLabel.textContent = t.modalTransferNotes;

        const transferNotesInput = document.getElementById('transfer-notes');
        if (transferNotesInput) transferNotesInput.placeholder = t.modalTransferNotesPlaceholder;

        const transferItemsHeading = document.querySelector('#transfer-modal h4');
        if (transferItemsHeading) transferItemsHeading.textContent = t.modalTransferItems;

        const transferAddRowBtn = document.querySelector('#transfer-modal .modal-body .btn-outline');
        if (transferAddRowBtn) transferAddRowBtn.innerHTML = `<i class="fa-solid fa-plus"></i> ${t.modalTransferAddRow}`;

        const transferCancelBtn = document.querySelector('#transfer-modal .modal-footer .btn-outline');
        if (transferCancelBtn) transferCancelBtn.textContent = t.modalTransferCancel;

        const transferSubmitBtn = document.querySelector('#transfer-modal .modal-footer .btn-primary');
        if (transferSubmitBtn) transferSubmitBtn.textContent = t.modalTransferSubmit;

        // Audit Log Modal
        const auditLogHeader = document.querySelector('#audit-log-modal .modal-header h2');
        if (auditLogHeader) auditLogHeader.textContent = t.modalAuditLogTitle;

        const auditTableThs = document.querySelectorAll('#audit-log-modal table thead th');
        if (auditTableThs.length >= 5) {
            auditTableThs[0].textContent = t.thAuditDate;
            auditTableThs[1].textContent = t.thAuditStaff;
            auditTableThs[2].textContent = t.thAuditAction;
            auditTableThs[3].textContent = t.thAuditItem;
            auditTableThs[4].textContent = t.thAuditQty;
        }

        // Staff Modal
        const staffModalHeader = document.querySelector('#staff-modal #modal-title');
        if (staffModalHeader) {
            if (staffModalHeader.textContent.includes('Edit') || staffModalHeader.textContent.includes('تعديل')) {
                staffModalHeader.textContent = t.modalStaffEditTitle;
            } else {
                staffModalHeader.textContent = t.modalStaffAddTitle;
            }
        }

        const staffModalCancel = document.querySelector('#staff-modal .modal-footer .btn-outline');
        if (staffModalCancel) staffModalCancel.textContent = t.modalStaffCancel;

        const staffModalSave = document.querySelector('#staff-modal .modal-footer .btn-primary');
        if (staffModalSave) staffModalSave.textContent = t.modalStaffSave;

        // Warehouse Page & Modal
        const whTitle = document.querySelector('.overview-title');
        if (whTitle) whTitle.textContent = t.whOverviewTitle;

        const whAddBtn = document.getElementById('btn-add-warehouse');
        if (whAddBtn) whAddBtn.innerHTML = `<i class="fa-solid fa-plus"></i> ${t.whAddBtn}`;

        const whPrintBtn = document.getElementById('btn-print-report');
        if (whPrintBtn) whPrintBtn.innerHTML = `<i class="fa-solid fa-print"></i> ${t.whPrintReportBtn}`;

        const whDownloadBtn = document.getElementById('btn-download-audit');
        if (whDownloadBtn) whDownloadBtn.innerHTML = `<i class="fa-solid fa-file-pdf"></i> ${t.whDownloadAuditBtn}`;

        const whModalTitle = document.querySelector('#add-warehouse-form')?.closest('.modal-box')?.querySelector('.modal-title');
        if (whModalTitle) whModalTitle.innerHTML = `<i class="fa-solid fa-warehouse"></i> ${t.modalWhAddTitle}`;

        const whSaveBtn = document.getElementById('btn-save-wh');
        if (whSaveBtn) whSaveBtn.innerHTML = `<i class="fa-solid fa-plus"></i> ${t.modalWhCreateBtn}`;

        // Suppliers Page & Modals
        const supModalTitle = document.querySelector('#supplier-form')?.closest('.modal-box')?.querySelector('.modal-title');
        if (supModalTitle) supModalTitle.innerHTML = `<i class="fa-solid fa-store"></i> ${t.modalSupplierAddTitle}`;

        const supDelTitle = document.querySelector('#confirm-dialog h3');
        if (supDelTitle) supDelTitle.textContent = t.modalDeleteSupplierTitle;

        const supDelCancel = document.querySelector('#confirm-dialog .btn-confirm-cancel');
        if (supDelCancel) supDelCancel.textContent = t.modalDeleteCancelBtn;

        const supDelConfirm = document.querySelector('#confirm-dialog .btn-confirm-del');
        if (supDelConfirm) supDelConfirm.innerHTML = `<i class="fa-solid fa-trash"></i> ${t.modalDeleteConfirmBtn}`;

        // Supplier Payment Modal (Analytics)
        const spModalTitle = document.querySelector('#sp-payment-modal .sp-modal-title');
        if (spModalTitle) spModalTitle.innerHTML = `<i class="fa-solid fa-hand-holding-dollar"></i> ${t.modalPaymentTitle}`;

        const spCancelBtn = document.getElementById('sp-modal-cancel-btn');
        if (spCancelBtn) spCancelBtn.textContent = t.modalPaymentCancel;

        const spPayBtn = document.getElementById('sp-modal-pay-btn');
        if (spPayBtn) spPayBtn.innerHTML = `<i class="fa-solid fa-check"></i> ${t.modalPaymentPay}`;

        // Transfer Draft Button
        const draftBtn = document.querySelector('.btn-draft');
        if (draftBtn) draftBtn.textContent = t.btnSaveDraft;

        // ── 7. Dynamic Branch Headers Hydration ───────────────────────
        if (typeof window.syncBranchHeaders === 'function' && window.__alqudsUser) {
            window.syncBranchHeaders(window.__alqudsUser);
        }
    }

    function createSwitcherButton() {
        if (document.getElementById('alquds-lang-switcher')) return;

        const current = getLanguage();
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

        // Try mounting into appropriate header containers across various pages:
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

        // 3. Global new header (inventory, orders, pos, retail_sales)
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

        // 5. Analytics topbar actions
        const analyticsTopbar = document.querySelector('.analytics-topbar');
        if (analyticsTopbar) {
            btn.style.marginLeft = '12px';
            analyticsTopbar.appendChild(btn);
            return;
        }

        // 6. Collections header
        const collHeader = document.querySelector('.global-header .header-content');
        if (collHeader) {
            btn.style.marginRight = 'auto';
            collHeader.appendChild(btn);
            return;
        }

        // 7. Pharmacy directory top nav
        const pharmTopNav = document.querySelector('.top-nav');
        if (pharmTopNav) {
            pharmTopNav.appendChild(btn);
            return;
        }

        // 8. Staff directory top nav
        const staffTopNav = document.querySelector('.staff-topnav .nav-right');
        if (staffTopNav) {
            staffTopNav.appendChild(btn);
            return;
        }

        // 9. Suppliers topbar
        const supTopbar = document.querySelector('.sup-topbar .topbar-left');
        if (supTopbar) {
            supTopbar.appendChild(btn);
            return;
        }

        // 10. Transfer topbar
        const transferTopbar = document.querySelector('.transfer-topbar');
        if (transferTopbar) {
            btn.style.marginLeft = '12px';
            transferTopbar.appendChild(btn);
            return;
        }

        // 11. Warehouse overview actions
        const whActions = document.querySelector('.overview-actions');
        if (whActions) {
            whActions.appendChild(btn);
            return;
        }

        // 12. Login wrapper (top corner floating badge)
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

    // Listen to branch sync event to re-apply any missing translations
    window.addEventListener('alquds:branch-synced', () => {
        applyTranslations(getLanguage());
    });

    // Public API
    window.AlQudsI18n = {
        getLanguage,
        setLanguage,
        toggleLanguage,
        applyTranslations,
        translations
    };
})();
