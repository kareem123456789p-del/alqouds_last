const fs = require('fs');
let code = fs.readFileSync('public/js/suppliers.js', 'utf8');

// Find the start of openHistoryModal
const startIdx = code.indexOf('async function openHistoryModal(id) {');
// Find the end of openHistoryModal
const closeHistoryModalIdx = code.indexOf('function closeHistoryModal() {');

if (startIdx === -1 || closeHistoryModalIdx === -1) {
    console.error("Could not find openHistoryModal or closeHistoryModal in suppliers.js");
    process.exit(1);
}

const before = code.substring(0, startIdx);
const after = code.substring(closeHistoryModalIdx);

const newLogic = `
// Track current month groups globally so the details modal can read from it
window.currentMonthGroups = [];

async function openHistoryModal(id) {
    document.getElementById('history-modal-overlay').classList.add('open');

    const listEl = document.getElementById('hist-shipments-list');
    listEl.innerHTML = \`
        <div style="text-align:center;padding:3rem;color:#94a3b8;">
            <i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;margin-bottom:.75rem;display:block;"></i>
            جاري تحميل السجل...
        </div>\`;

    document.getElementById('hist-total-count').textContent   = '…';
    document.getElementById('hist-total-balance').textContent = '…';

    try {
        const res = await fetch(\`\${API}/\${id}/history\`);
        if (!res.ok) throw new Error('Failed to fetch history');
        const data = await res.json();

        // ── Summary stats ──────────────────────────────────────────────────
        document.getElementById('hist-total-count').textContent =
            data.total_transactions_count;
        document.getElementById('hist-total-balance').textContent =
            '$' + Number(data.total_outstanding_balance)
                    .toLocaleString(undefined, { minimumFractionDigits: 2 });

        window.currentMonthGroups = data.monthGroups || [];

        // ── Shipment cards (Grouped by Month) ──────────────────────────────
        if (!data.monthGroups || data.monthGroups.length === 0) {
            listEl.innerHTML = \`
                <div style="text-align:center;padding:3rem;color:#94a3b8;">
                    <i class="fa-solid fa-folder-open" style="font-size:2.5rem;display:block;margin-bottom:.75rem;"></i>
                    لا توجد شحنات مسجلة لهذا المورد.
                </div>\`;
            return;
        }

        listEl.innerHTML = data.monthGroups.map((group, mIdx) => {
            const shipmentsHtml = group.shipments.map((s, sIdx) => {
                const dateObj  = new Date(s.created_at);
                const dateStr  = dateObj.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
                const timeStr  = dateObj.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
                const total    = Number(s.shipment_total).toLocaleString(undefined, { minimumFractionDigits: 2 });
                const imgPath  = s.invoice_image; 
                const count    = s.items ? s.items.length : 0;

                const invoiceBtn = imgPath
                    ? \`<button onclick="openLightbox('\${imgPath}')"
                           style="display:flex;align-items:center;gap:8px;padding:10px 20px;border:none;border-radius:10px;
                                  background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;font-weight:700;
                                  font-size:.9rem;cursor:pointer;white-space:nowrap;transition:.2s;flex-shrink:0;"
                           onmouseover="this.style.transform='scale(1.04)'"
                           onmouseout="this.style.transform='scale(1)'">
                           <i class="fa-solid fa-eye"></i> عرض الفاتورة
                       </button>\`
                    : \`<div style="display:flex;align-items:center;gap:8px;padding:10px 18px;border-radius:10px;
                                  background:#f1f5f9;color:#94a3b8;font-size:.82rem;font-weight:600;white-space:nowrap;flex-shrink:0;border:1px dashed #cbd5e1;">
                           <i class="fa-solid fa-image-slash"></i> لا توجد صورة فاتورة
                       </div>\`;

                return \`
                <div style="display:flex;align-items:center;gap:1rem;padding:1rem 1.25rem;
                            background:#fff;border:1px solid #e2e8f0;border-radius:12px;
                            box-shadow:0 1px 4px rgba(0,0,0,.04);transition:box-shadow .2s;"
                     onmouseover="this.style.boxShadow='0 4px 16px rgba(0,0,0,.08)'"
                     onmouseout="this.style.boxShadow='0 1px 4px rgba(0,0,0,.04)'">

                    <!-- Date column -->
                    <div style="min-width:90px;text-align:center;background:#f8fafc;border-radius:10px;padding:.6rem .8rem;border:1px solid #e2e8f0;">
                        <div style="font-size:.68rem;font-weight:700;color:#94a3b8;letter-spacing:.4px;margin-bottom:2px;">DATE</div>
                        <div style="font-size:.85rem;font-weight:700;color:#1e293b;line-height:1.2;">\${dateStr}</div>
                        <div style="font-size:.72rem;color:#94a3b8;">\${timeStr}</div>
                    </div>

                    <!-- Info column -->
                    <div style="flex:1;min-width:0;">
                        <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:4px;">
                            <i class="fa-solid fa-truck-ramp-box" style="color:#3b82f6;font-size:.85rem;"></i>
                            <span style="font-weight:700;color:#1e293b;font-size:.9rem;">
                                شحنة — \${count} \${count === 1 ? 'صنف' : 'أصناف'}
                            </span>
                        </div>
                        <div style="margin-top:0.5rem;">
                            <button onclick="openShipmentDetailsModal(\${mIdx}, \${sIdx})"
                                    style="background:#f1f5f9;border:1px solid #cbd5e1;padding:0.4rem 0.8rem;border-radius:6px;font-size:0.8rem;color:#475569;cursor:pointer;display:flex;align-items:center;gap:0.4rem;font-weight:600;transition:0.2s;"
                                    onmouseover="this.style.background='#e2e8f0';this.style.color='#1e293b';"
                                    onmouseout="this.style.background='#f1f5f9';this.style.color='#475569';">
                                <i class="fa-solid fa-list-ul"></i> View Items
                            </button>
                        </div>
                    </div>

                    <!-- Total column -->
                    <div style="text-align:center;min-width:90px;">
                        <div style="font-size:.68rem;font-weight:700;color:#94a3b8;letter-spacing:.4px;margin-bottom:2px;">TOTAL</div>
                        <div style="font-size:1.05rem;font-weight:800;color:#059669;">$\${total}</div>
                    </div>

                    <!-- Invoice button -->
                    \${invoiceBtn}
                </div>\`;
            }).join('');

            return \`
            <div class="accordion-item" style="margin-bottom:1rem;">
                <div class="accordion-header" onclick="toggleAccordion(this)">
                    <div style="display:flex;align-items:center;gap:0.75rem;">
                        <i class="fa-solid fa-folder" style="color:#3b82f6;font-size:1.2rem;"></i>
                        <span style="font-size:1.05rem;">\${group.monthLabel}</span>
                    </div>
                    <i class="fa-solid fa-chevron-down accordion-icon"></i>
                </div>
                <div class="accordion-content">
                    \${shipmentsHtml}
                </div>
            </div>
            \`;
        }).join('');

    } catch (err) {
        showToast(err.message, 'error');
        listEl.innerHTML = \`
            <div style="text-align:center;padding:2rem;color:#ef4444;">
                <i class="fa-solid fa-circle-exclamation" style="font-size:1.5rem;display:block;margin-bottom:.5rem;"></i>
                خطأ في تحميل السجل.
            </div>\`;
    }
}

function toggleAccordion(headerEl) {
    headerEl.classList.toggle('active');
    const content = headerEl.nextElementSibling;
    if (content.classList.contains('open')) {
        content.classList.remove('open');
    } else {
        content.classList.add('open');
    }
}

function openShipmentDetailsModal(monthIdx, shipmentIdx) {
    const group = window.currentMonthGroups[monthIdx];
    if (!group) return;
    const shipment = group.shipments[shipmentIdx];
    if (!shipment) return;

    const tbody = document.getElementById('shipment-details-tbody');
    tbody.innerHTML = '';

    if (!shipment.items || shipment.items.length === 0) {
        tbody.innerHTML = \`<tr><td colspan="3" style="text-align:center;padding:1.5rem;color:#64748b;">لا توجد أصناف مسجلة لهذه الشحنة.</td></tr>\`;
    } else {
        tbody.innerHTML = shipment.items.map(item => \`
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 0.75rem; font-weight: 600; color: #1e293b;">\${escHtml(item.product_name)}</td>
                <td style="padding: 0.75rem; text-align: center; color: #475569;">\${item.quantity}</td>
                <td style="padding: 0.75rem; text-align: right; color: #059669; font-weight: 600;">$\${Number(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
        \`).join('');
    }

    document.getElementById('shipment-details-overlay').classList.add('open');
}

function closeShipmentDetails() {
    document.getElementById('shipment-details-overlay').classList.remove('open');
}

function closeShipmentDetailsOnBack(e) {
    if (e.target === document.getElementById('shipment-details-overlay')) closeShipmentDetails();
}

`;

code = before + newLogic + after;

// Now add the fallback to lightbox img
const lightboxImgIdx = code.indexOf('img.src   = imagePath;');
if (lightboxImgIdx !== -1) {
    const lbImgLine = "img.src   = imagePath;\n    img.onerror = function() { this.src = '/img/placeholder.png'; this.style.opacity = 0.5; this.onerror=null; };";
    code = code.replace("img.src   = imagePath;", lbImgLine);
}

fs.writeFileSync('public/js/suppliers.js', code);
console.log("public/js/suppliers.js patched successfully.");
