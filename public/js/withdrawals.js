/* ==========================================
   withdrawals.js — Employee Withdrawals Page
   ========================================== */

const API = '/api';

// ── Palette for employee avatars ──
const AVATAR_COLORS = [
    '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
    '#f97316', '#10b981', '#06b6d4', '#f59e0b'
];
function avatarColor(name) {
    let h = 0;
    for (let c of (name || '?')) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function initials(name) {
    return (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
function fmtMoney(v) {
    return parseFloat(v || 0).toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(ts) {
    const d = new Date(ts);
    return {
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };
}
function categoryBadge(cat) {
    const map = {
        'Emergency': 'badge-emergency',
        'Salary Advance': 'badge-salary',
        'Personal': 'badge-personal'
    };
    return `<span class="category-badge ${map[cat] || 'badge-personal'}">${cat || 'Personal'}</span>`;
}

// ── Toast ──
function toast(msg, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => el.remove(), 3500);
}

// ── Staff dropdown ──
let staffCache = [];
async function loadStaff() {
    try {
        const res = await fetch(`${API}/staff`);
        staffCache = await res.json();
        const sel = document.getElementById('wd-employee');
        sel.innerHTML = '<option value="">Search employee name or ID...</option>';
        staffCache.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.dataset.salary = s.base_salary || 0;
            opt.textContent = `${s.name} (ID: ${String(s.id).padStart(4, '0')})`;
            sel.appendChild(opt);
        });
    } catch {
        toast('Failed to load staff list', 'error');
    }
}

// ── Real-time salary validation ──
function updateSalaryHint() {
    const sel = document.getElementById('wd-employee');
    const amtEl = document.getElementById('wd-amount');
    const hint = document.getElementById('salary-hint');

    const salary = parseFloat(sel.selectedOptions[0]?.dataset?.salary || 0);
    const amount = parseFloat(amtEl.value || 0);

    if (!sel.value || !amount) { hint.textContent = ''; hint.className = 'salary-hint'; return; }

    // Fetch current monthly total for the employee from cache (approximation; real check is server-side)
    const pct = salary > 0 ? ((amount / salary) * 100).toFixed(1) : 0;
    if (salary > 0 && amount > salary * 0.5) {
        hint.textContent = `⚠️ This amount is ${pct}% of salary (EGP ${fmtMoney(salary)}) — exceeds 50% limit`;
        hint.className = 'salary-hint warn';
    } else if (salary > 0) {
        hint.textContent = `✓ ${pct}% of salary (EGP ${fmtMoney(salary)}) — within limits`;
        hint.className = 'salary-hint ok';
    } else {
        hint.textContent = 'No base salary recorded for this employee.';
        hint.className = 'salary-hint';
    }
}

// ── Stats ──
async function loadStats() {
    try {
        const res = await fetch(`${API}/withdrawals/stats`);
        const data = await res.json();

        // Card 1: Monthly total
        document.getElementById('stat-total').textContent = `EGP ${fmtMoney(data.monthly_total)}`;
        // Percentage sub-label (we compare future to past -> just show amount label)
        const subEl = document.getElementById('stat-total-sub');
        subEl.innerHTML = `<i class="fa-solid fa-calendar-days"></i> This month's total`;

        // Card 2: Top employee
        if (data.top_employee) {
            document.getElementById('stat-top-name').textContent = data.top_employee.name;
            document.getElementById('stat-top-sub').textContent =
                `${data.top_employee.tx_count} Transaction${data.top_employee.tx_count !== 1 ? 's' : ''} this month`;
        } else {
            document.getElementById('stat-top-name').textContent = '—';
            document.getElementById('stat-top-sub').textContent = 'No transactions this month';
        }

        // Card 3: Alerts
        const alertCount = data.alerts ? data.alerts.length : 0;
        document.getElementById('stat-alerts').textContent =
            alertCount > 0 ? `${alertCount} Employee${alertCount !== 1 ? 's' : ''}` : '0 Employees';

        const alertSub = document.getElementById('stat-alerts-sub');
        const alertOk = document.getElementById('stat-alerts-ok');
        if (alertCount > 0) {
            alertSub.style.display = 'flex';
            alertOk.style.display = 'none';
        } else {
            alertSub.style.display = 'none';
            alertOk.style.display = 'flex';
        }
    } catch {
        toast('Failed to load stats', 'error');
    }
}

// ── Transactions ──
let txAll = [];
async function loadTransactions() {
    try {
        const res = await fetch(`${API}/withdrawals`);
        txAll = await res.json();
        renderTable(txAll);
    } catch {
        toast('Failed to load transactions', 'error');
    }
}

function renderTable(rows) {
    const tbody = document.getElementById('tx-body');
    if (!rows.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="5">No transactions found.</td></tr>`;
        return;
    }
    tbody.innerHTML = rows.map(r => {
        const { date, time } = fmtDate(r.created_at);
        const badge = r.is_high_ratio
            ? '<span class="ratio-badge high">⚠ HIGH RATIO</span>'
            : '<span class="ratio-badge normal">Normal</span>';
        const reasonText = r.reason || r.category || 'N/A';
        const color = avatarColor(r.staff_name);
        const idPad = String(r.staff_id).padStart(4, '0');
        return `
        <tr>
            <td>
                <div class="emp-cell">
                    <div class="emp-avatar" style="background:${color}">${initials(r.staff_name)}</div>
                    <div>
                        <div class="emp-name">${r.staff_name}</div>
                        <div class="emp-id">ID: ${idPad}</div>
                    </div>
                </div>
            </td>
            <td>
                <div class="amount-val">${fmtMoney(r.amount)}</div>
                ${badge}
            </td>
            <td>
                <div class="date-val">${date}</div>
                <div class="time-val">${time}</div>
            </td>
            <td>${categoryBadge(r.category)}</td>
            <td>
                <button class="btn-print" title="Print receipt" onclick="printReceipt(${JSON.stringify(r).replace(/"/g, '&quot;')})">
                    <i class="fa-solid fa-print"></i>
                </button>
            </td>
        </tr>`;
    }).join('');
}

// ── Filter ──
document.getElementById('tx-filter').addEventListener('input', function () {
    const q = this.value.toLowerCase();
    const filtered = txAll.filter(r =>
        r.staff_name.toLowerCase().includes(q) ||
        (r.reason || '').toLowerCase().includes(q) ||
        (r.category || '').toLowerCase().includes(q) ||
        String(r.staff_id).includes(q)
    );
    renderTable(filtered);
});

// ── Salary hint update on change ──
document.getElementById('wd-employee').addEventListener('change', updateSalaryHint);
document.getElementById('wd-amount').addEventListener('input', updateSalaryHint);

// ── Form Submit ──
document.getElementById('btn-confirm').addEventListener('click', async () => {
    const staff_id = document.getElementById('wd-employee').value;
    const amount = document.getElementById('wd-amount').value;
    const category = document.getElementById('wd-category').value;
    const reasonEl = document.getElementById('wd-reason');
    const reason = reasonEl.value.trim() || category;

    if (!staff_id) return toast('Please select an employee.', 'error');
    if (!amount || parseFloat(amount) <= 0) return toast('Please enter a valid amount.', 'error');
    if (!category) return toast('Please select a reason/category.', 'error');

    const btn = document.getElementById('btn-confirm');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Processing...';

    try {
        const res = await fetch(`${API}/withdrawals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ staff_id, amount: parseFloat(amount), reason, category })
        });
        const data = await res.json();

        if (!res.ok) {
            toast(data.error || 'Failed to save withdrawal.', 'error');
        } else {
            if (data.is_high_ratio) {
                toast(`⚠️ Withdrawal saved — ${data.staff_name} has now exceeded 50% of salary this month!`, 'warning');
            } else {
                toast(`✅ Withdrawal of EGP ${fmtMoney(amount)} for ${data.staff_name} saved.`, 'success');
            }

            // Reset form
            document.getElementById('wd-employee').value = '';
            document.getElementById('wd-amount').value = '';
            document.getElementById('wd-category').value = '';
            reasonEl.value = '';
            document.getElementById('salary-hint').textContent = '';
            document.getElementById('salary-hint').className = 'salary-hint';

            // Refresh stats and table immediately (no page reload)
            await Promise.all([loadStats(), loadTransactions()]);
        }
    } catch (err) {
        toast('Network error. Please try again.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Confirm Withdrawal';
    }
});

// ── Reconcile button ──
document.getElementById('btn-reconcile').addEventListener('click', () => {
    toast('Salary reconciliation report generation is coming soon.', 'success');
});

// ── CSV Export ──
document.getElementById('btn-download').addEventListener('click', () => {
    if (!txAll.length) return toast('No data to export.', 'error');
    const headers = ['ID', 'Employee', 'Staff ID', 'Amount', 'Category', 'Reason', 'Date', 'High Ratio'];
    const rows = txAll.map(r => {
        const { date, time } = fmtDate(r.created_at);
        return [
            r.id, r.staff_name, r.staff_id, r.amount,
            r.category, r.reason, `${date} ${time}`,
            r.is_high_ratio ? 'Yes' : 'No'
        ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `withdrawals_${Date.now()}.csv`; a.click();
});

// ── Print Receipt ──
window.printReceipt = function (r) {
    const { date, time } = fmtDate(r.created_at);
    const w = window.open('', '_blank');
    w.document.write(`
        <html><head><title>Withdrawal Receipt</title><style>
            body{font-family:monospace;padding:30px;max-width:400px;margin:auto;}
            h2{border-bottom:2px solid #000;padding-bottom:8px;}
            .row{display:flex;justify-content:space-between;margin:6px 0;}
            .label{color:#666;} .val{font-weight:bold;}
            .footer{margin-top:20px;text-align:center;font-size:0.8rem;color:#94a3b8;}
        </style></head><body>
        <h2>Al-Quds Center — Withdrawal Receipt</h2>
        <div class="row"><span class="label">Employee:</span><span class="val">${r.staff_name}</span></div>
        <div class="row"><span class="label">ID:</span><span class="val">${String(r.staff_id).padStart(4, '0')}</span></div>
        <div class="row"><span class="label">Amount:</span><span class="val">EGP ${fmtMoney(r.amount)}</span></div>
        <div class="row"><span class="label">Category:</span><span class="val">${r.category}</span></div>
        <div class="row"><span class="label">Reason:</span><span class="val">${r.reason || '—'}</span></div>
        <div class="row"><span class="label">Date:</span><span class="val">${date} at ${time}</span></div>
        <div class="row"><span class="label">Status:</span><span class="val" style="color:${r.is_high_ratio ? '#ef4444' : '#10b981'}">${r.is_high_ratio ? '⚠ HIGH RATIO (>50% Salary)' : '✓ Normal'}</span></div>
        <div class="footer">Authorized by System Manager — Al-Quds Center</div>
        </body></html>
    `);
    w.document.close();
    w.print();
};

// ── Init ──
(async function init() {
    await loadStaff();
    await loadStats();
    await loadTransactions();
})();
