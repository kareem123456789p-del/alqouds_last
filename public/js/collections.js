let clientChoices;
let currentClientType = null;
let currentClientId = null;

/**
 * Returns the currently active branch ID.
 * Priority: URL query param -> window.__activeBranchId -> window.__alqudsUser -> default 2
 */
function getActiveBranchId() {
    const urlParams = new URLSearchParams(window.location.search);
    const paramBranch = urlParams.get('branch_id');
    if (paramBranch && !isNaN(parseInt(paramBranch))) {
        return parseInt(paramBranch);
    }
    if (window.__activeBranchId) {
        return parseInt(window.__activeBranchId);
    }
    if (window.__alqudsUser) {
        return parseInt(window.__alqudsUser.active_branch_id || window.__alqudsUser.assigned_branch_id || 2);
    }
    return 2;
}

/**
 * Updates the top header title and switcher to reflect the active branch.
 */
function updateHeaderBranchTitle(branchId, user) {
    const titleEl = document.getElementById('page-header-title');
    if (!titleEl) return;

    const branchNames = {
        1: 'مركز القدس 1',
        2: 'مركز القدس 2'
    };

    let bName = branchNames[branchId];
    if (!bName && user && user.active_branch_name) {
        bName = user.active_branch_name;
    }
    if (!bName) {
        bName = `مركز القدس ${branchId}`;
    }

    titleEl.textContent = `التحصيلات والمديونيات - ${bName}`;
}

/**
 * Initializes branch context: verifies user session, exposes switcher for admin,
 * and sets up header title according to the current branch.
 */
async function initBranchContext() {
    try {
        let user = window.__alqudsUser;
        if (!user) {
            const checkRes = await fetch('/api/auth/check');
            if (checkRes.ok) {
                user = await checkRes.json();
                window.__alqudsUser = user;
                if (!window.__activeBranchId) {
                    window.__activeBranchId = user.active_branch_id || user.assigned_branch_id || 2;
                }
            }
        }

        if (user) {
            const role = user.role ? user.role.toUpperCase() : '';
            const isAdmin = (role === 'ADMIN' || role === 'SUPER ADMIN');
            let perms = user.permissions || [];
            if (typeof perms === 'string') {
                try { perms = JSON.parse(perms); } catch(e) { perms = []; }
            }
            const hasCollectionsAccess = isAdmin || (Array.isArray(perms) && perms.includes('can_manage_collections'));
            if (!hasCollectionsAccess) {
                console.warn('[COLLECTIONS RBAC]: User lacks can_manage_collections permission. Redirecting.');
                window.location.href = '/index.html';
                return;
            }
        }

        const urlParams = new URLSearchParams(window.location.search);
        const urlBranch = urlParams.get('branch_id');
        if (urlBranch && !isNaN(parseInt(urlBranch))) {
            window.__activeBranchId = parseInt(urlBranch);
        }

        const currentBranchId = getActiveBranchId();
        updateHeaderBranchTitle(currentBranchId, user);

        // Show branch switcher for Admin users
        const role = user?.role ? user.role.toUpperCase() : '';
        const isAdmin = (role === 'ADMIN' || role === 'SUPER ADMIN');
        const switcherWrap = document.getElementById('branch-switcher-wrap');
        const switcherSelect = document.getElementById('branch-select-switch');

        if (isAdmin && switcherWrap && switcherSelect) {
            switcherWrap.style.display = 'flex';
            switcherSelect.value = String(currentBranchId);
            switcherSelect.onchange = (e) => {
                onBranchChange(parseInt(e.target.value));
            };
        }
    } catch (err) {
        console.error('Error initializing branch context:', err);
    }
}

/**
 * Handles branch switching for Admin users without requiring a full page refresh.
 */
async function onBranchChange(newBranchId) {
    try {
        window.__activeBranchId = newBranchId;

        // Persist to session
        await fetch('/api/auth/switch-branch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ branch_id: newBranchId })
        }).catch(() => {});

        // Cleanly update URL param
        const url = new URL(window.location);
        url.searchParams.set('branch_id', newBranchId);
        window.history.replaceState({}, '', url);

        // Update header title
        updateHeaderBranchTitle(newBranchId, window.__alqudsUser);

        // Reset customer balance card
        resetBalanceBox();
        document.getElementById('client-monthly-val').textContent = '0.00 د.أ';

        // Re-fetch everything strictly for the new branch
        await Promise.all([
            loadClients(),
            loadHistory(false),
            loadSummary()
        ]);
    } catch (err) {
        console.error('Error switching branch:', err);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    initClientChoices();
    await initBranchContext();
    loadClients();
    loadHistory(false);
    loadSummary();
});

// Initialize Choices JS
function initClientChoices() {
    const select = document.getElementById('client-select');
    clientChoices = new Choices(select, {
        searchEnabled: true,
        itemSelectText: '',
        shouldSort: false,
        searchPlaceholderValue: 'البحث عن صيدلية أو دكتور...',
        noResultsText: 'لا توجد نتائج',
        noChoicesText: 'لا يوجد عملاء متاحين في هذا الفرع'
    });

    select.addEventListener('change', (e) => {
        handleClientSelection(e.target.value);
    });
}

// Load Clients into Dropdown strictly scoped to active branch
async function loadClients() {
    try {
        const branchId = getActiveBranchId();
        const [docsRes, pharmRes] = await Promise.all([
            fetch(`/api/doctors?branch_id=${branchId}`),
            fetch(`/api/pharmacies?branch_id=${branchId}`)
        ]);

        let docs = [], pharms = [];
        if (docsRes.ok) docs = await docsRes.json();
        if (pharmRes.ok) pharms = await pharmRes.json();

        const groups = [
            {
                label: 'Doctors / الدكاترة',
                id: 'docs',
                disabled: false,
                choices: docs.map(d => ({
                    value: `doc-${d.id}`,
                    label: `👨‍⚕️ د. ${d.name.replace('د. ', '')}`
                }))
            },
            {
                label: 'Pharmacies / الصيدليات',
                id: 'pharms',
                disabled: false,
                choices: pharms.map(p => ({
                    value: `pharm-${p.id}`,
                    label: `🏪 صيدلية ${p.name}`
                }))
            }
        ];

        // Replace choices cleanly
        clientChoices.setChoices(groups, 'value', 'label', true);
        clientChoices.removeActiveItems();
    } catch (err) {
        console.error("Error loading clients: ", err);
    }
}

// Handle Client Selection
async function handleClientSelection(rawValue) {
    if (!rawValue) {
        resetBalanceBox();
        document.getElementById('client-monthly-val').textContent = '0.00 د.أ';
        return;
    }

    try {
        const branchId = getActiveBranchId();
        const [sumRes, monthlyRes] = await Promise.all([
            fetch(`/api/clients/${rawValue}/summary?branch_id=${branchId}`),
            fetch(`/api/collections/client/${rawValue}/monthly?branch_id=${branchId}`)
        ]);

        if (!sumRes.ok) throw new Error("Failed to fetch client balance for active branch");
        
        const data = await sumRes.json();
        const debt = parseFloat(data.client.total_debt) || 0;
        const limit = parseFloat(data.client.credit_limit) || 0;

        let monthlyTotal = 0;
        if (monthlyRes.ok) {
            const mData = await monthlyRes.json();
            monthlyTotal = mData.monthly_sum || 0;
        }

        document.getElementById('client-monthly-val').textContent = `${monthlyTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} د.أ`;

        updateBalanceBox(debt, limit);
    } catch (err) {
        console.error("Error fetching balance:", err);
        resetBalanceBox();
    }
}

function updateBalanceBox(debt, limit = 0) {
    const box = document.getElementById('balance-box');
    const amtEl = document.getElementById('balance-amount');
    const badgeEl = document.getElementById('balance-badge');

    // Reset classes
    box.classList.remove('debt-state', 'credit-state');

    if (debt > 0) {
        box.classList.add('debt-state');
        amtEl.textContent = `${debt.toLocaleString(undefined, { minimumFractionDigits: 2 })} د.أ`;
        badgeEl.textContent = 'مديونية مستحقة (Debt)';
    } else if (debt < 0) {
        box.classList.add('credit-state');
        amtEl.textContent = `${Math.abs(debt).toLocaleString(undefined, { minimumFractionDigits: 2 })} د.أ +`;
        badgeEl.textContent = 'رصيد دائن (Credit)';
    } else {
        amtEl.textContent = '0.00 د.أ';
        badgeEl.textContent = 'الحساب مصفر';
        box.style.borderColor = '#e2e8f0';
        box.style.backgroundColor = '#ffffff';
    }

    // Toggle Credit Container Logic
    const creditContainer = document.getElementById('credit-limit-container');
    const creditPercentText = document.getElementById('credit-percent-text');
    const progressFill = document.getElementById('credit-progress-fill');
    const warningMsg = document.getElementById('credit-warning-msg');

    if (limit > 0 && debt >= 0) {
        creditContainer.style.display = 'block';
        const percent = Math.min(100, (debt / limit) * 100);
        creditPercentText.textContent = `${Math.round(percent)}%`;
        progressFill.style.width = `${percent}%`;

        // Strip previous states
        progressFill.className = 'progress-bar-fill';
        warningMsg.className = 'credit-warning-msg';

        if (percent >= 100) {
            progressFill.classList.add('red-alert');
            warningMsg.classList.add('red-alert');
            warningMsg.textContent = 'تحذير: العميل تجاوز الحد الائتماني!';
            warningMsg.style.display = 'block';
        } else if (percent >= 90) {
            progressFill.classList.add('orange-alert');
            warningMsg.classList.add('orange-alert');
            warningMsg.textContent = 'تنبيه: اقتراب من تخطي الحد الائتماني!';
            warningMsg.style.display = 'block';
        } else if (percent >= 70) {
            progressFill.classList.add('green-alert');
            warningMsg.style.display = 'none';
        } else {
            // Default styling for < 70%
            progressFill.classList.add('green-alert'); 
            warningMsg.style.display = 'none';
        }
    } else {
        creditContainer.style.display = 'none';
    }
}

function resetBalanceBox() {
    const box = document.getElementById('balance-box');
    const amtEl = document.getElementById('balance-amount');
    const badgeEl = document.getElementById('balance-badge');
    box.classList.remove('debt-state', 'credit-state');
    amtEl.textContent = '0.00 د.أ';
    badgeEl.textContent = 'اختر عميل';
    document.getElementById('credit-limit-container').style.display = 'none';
}

// Save Payment strictly to active branch
async function savePayment() {
    const clientVal = document.getElementById('client-select').value;
    const amountVal = document.getElementById('paid-amount').value;
    const methodVal = document.getElementById('payment-method').value;
    const notesVal = document.getElementById('payment-notes').value;
    const branchId = getActiveBranchId();
    const btn = document.querySelector('.btn-save');

    if (!clientVal) return alert("يرجى تحديد العميل أولاً.");
    if (!amountVal || amountVal <= 0) return alert("يرجى إدخال مبلغ دفع صحيح.");

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الحفظ...';

    try {
        const res = await fetch('/api/collections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: clientVal,
                amount: amountVal,
                payment_method: methodVal,
                notes: notesVal,
                branch_id: branchId
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Server error');

        // Success UI
        document.getElementById('paid-amount').value = '';
        document.getElementById('payment-notes').value = '';
        
        // Refresh client balance box
        handleClientSelection(clientVal);
        
        // Refresh Table and Summaries
        loadHistory(false);
        loadSummary();

    } catch (err) {
        alert("فشل في استلام الدفعة: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-plus"></i> حفظ الدفعة';
    }
}

// Load Paginated History strictly for active branch
let historyOffset = 0;
async function loadHistory(showMore = false) {
    if (!showMore) historyOffset = 0;

    const branchId = getActiveBranchId();
    const tbody = document.getElementById('history-tbody');
    if (!showMore) tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #64748b;">جاري تحميل البيانات...</td></tr>';

    try {
        const res = await fetch(`/api/collections?limit=10&offset=${historyOffset}&branch_id=${branchId}`);
        const data = await res.json();

        if (data.payments.length === 0 && historyOffset === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #64748b;">لا يوجد سجل مدفوعات في هذا الفرع.</td></tr>';
            return;
        }

        if (!showMore) tbody.innerHTML = ''; // clear loading

        data.payments.forEach(p => {
            const dateStr = new Date(p.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
            
            // Generate prefix based on method
            const isCash = p.payment_method === 'كاش' || p.payment_method === 'Cash';
            const badgeClass = isCash ? 'cash' : 'bank';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight: 600; color: #475569;">TRX-#${p.id}</td>
                <td style="font-weight: 600; color: #1e293b;">${p.client_name || 'غير محدد'}</td>
                <td>${dateStr}</td>
                <td style="color: #059669; font-weight: 700; direction:ltr; text-align:right;">${Number(p.amount).toLocaleString(undefined, {minimumFractionDigits: 2})} د.أ</td>
                <td><span class="badge-pay ${badgeClass}">${p.payment_method}</span></td>
            `;
            tbody.appendChild(tr);
        });

        // Setup Pagination logic (if there are more records)
        historyOffset += data.payments.length;
        const remaining = data.total - historyOffset;
        
        let moreBtnRow = document.getElementById('view-more-row');
        if (remaining > 0) {
            if (!moreBtnRow) {
                moreBtnRow = document.createElement('div');
                moreBtnRow.id = 'view-more-row';
                moreBtnRow.style.textAlign = 'center';
                moreBtnRow.style.marginTop = '15px';
                moreBtnRow.innerHTML = `<button class="icon-btn-text" onclick="loadHistory(true)">عرض المزيد (${remaining})</button>`;
                document.querySelector('.history-card').appendChild(moreBtnRow);
            } else {
                moreBtnRow.innerHTML = `<button class="icon-btn-text" onclick="loadHistory(true)">عرض المزيد (${remaining})</button>`;
            }
        } else if (moreBtnRow) {
            moreBtnRow.remove();
        }

    } catch (err) {
        console.error("Error loading history: ", err);
    }
}

// Load Summaries strictly for active branch
async function loadSummary() {
    try {
        const branchId = getActiveBranchId();
        const res = await fetch(`/api/collections/summary?branch_id=${branchId}`);
        const data = await res.json();
        
        document.getElementById('monthly-collections-val').textContent = `${(data.monthly_collections || 0).toLocaleString(undefined, {minimumFractionDigits: 2})} د.أ`;
        document.getElementById('market-debt-val').textContent = `${(data.total_market_debt || 0).toLocaleString(undefined, {minimumFractionDigits: 2})} د.أ`;
    } catch (err) {
        console.error("Error loading summary: ", err);
    }
}
