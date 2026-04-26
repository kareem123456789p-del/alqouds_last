let clientChoices;
let currentClientType = null;
let currentClientId = null;

document.addEventListener('DOMContentLoaded', () => {
    initClientChoices();
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
        noChoicesText: 'لا يوجد عملاء متاحين'
    });

    select.addEventListener('change', (e) => {
        handleClientSelection(e.target.value);
    });
}

// Load Clients into Dropdown
async function loadClients() {
    try {
        const [docsRes, pharmRes] = await Promise.all([
            fetch('/api/doctors'),
            fetch('/api/pharmacies')
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

        clientChoices.setChoices(groups, 'value', 'label', true);
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
        const [sumRes, monthlyRes] = await Promise.all([
            fetch(`/api/clients/${rawValue}/summary`),
            fetch(`/api/collections/client/${rawValue}/monthly`)
        ]);

        if (!sumRes.ok) throw new Error("Failed to fetch client balance");
        
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
        amtEl.textContent = `${debt.toLocaleString(undefined, { minimumFractionDigits: 2 })} ד.أ`;
        badgeEl.textContent = 'مديونية مستحقة (Debt)';
    } else if (debt < 0) {
        box.classList.add('credit-state');
        amtEl.textContent = `${Math.abs(debt).toLocaleString(undefined, { minimumFractionDigits: 2 })} ד.أ +`;
        badgeEl.textContent = 'رصيد دائن (Credit)';
    } else {
        amtEl.textContent = '0.00 ד.أ';
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
    amtEl.textContent = '0.00 ד.أ';
    badgeEl.textContent = 'اختر عميل';
    document.getElementById('credit-limit-container').style.display = 'none';
}

// Save Payment
async function savePayment() {
    const clientVal = document.getElementById('client-select').value;
    const amountVal = document.getElementById('paid-amount').value;
    const methodVal = document.getElementById('payment-method').value;
    const notesVal = document.getElementById('payment-notes').value;
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
                notes: notesVal
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Server error');

        // Success UI
        document.getElementById('paid-amount').value = '';
        document.getElementById('payment-notes').value = '';
        
        // Refresh full client view automatically to update limits and totals
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

// Load Paginated History
let historyOffset = 0;
async function loadHistory(showMore = false) {
    if (!showMore) historyOffset = 0;

    const tbody = document.getElementById('history-tbody');
    if (!showMore) tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #64748b;">جاري تحميل البيانات...</td></tr>';

    try {
        const res = await fetch(`/api/collections?limit=10&offset=${historyOffset}`);
        const data = await res.json();

        if (data.payments.length === 0 && historyOffset === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #64748b;">لا يوجد سجل مدفوعات.</td></tr>';
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

// Load Summaries
async function loadSummary() {
    try {
        const res = await fetch('/api/collections/summary');
        const data = await res.json();
        
        document.getElementById('monthly-collections-val').textContent = `${(data.monthly_collections || 0).toLocaleString(undefined, {minimumFractionDigits: 2})} د.أ`;
        document.getElementById('market-debt-val').textContent = `${(data.total_market_debt || 0).toLocaleString(undefined, {minimumFractionDigits: 2})} د.أ`;
    } catch (err) {
        console.error("Error loading summary: ", err);
    }
}
