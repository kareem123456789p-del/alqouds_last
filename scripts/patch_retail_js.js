const fs = require('fs');

const returnsLogic = `
// ==========================================
// RETAIL RETURNS (مرتجعات) LOGIC
// ==========================================

let currentReturnInvoice = null;

function openReturnModal() {
    if (!currentShiftId) {
        showToast('يرجى فتح يومية أولاً لمعالجة المرتجعات', 'error');
        return;
    }
    document.getElementById('return-modal-overlay').style.display = 'flex';
    document.getElementById('return-invoice-id').value = '';
    document.getElementById('return-invoice-info').style.display = 'none';
    document.getElementById('return-items-tbody').innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px; color: #94a3b8;">يرجى البحث عن فاتورة لعرض الأصناف</td></tr>';
    document.getElementById('btn-confirm-return').disabled = true;
    document.getElementById('btn-confirm-return').style.opacity = '0.6';
    document.getElementById('btn-confirm-return').style.cursor = 'not-allowed';
    currentReturnInvoice = null;
}

function closeReturnModal() {
    document.getElementById('return-modal-overlay').style.display = 'none';
}

async function searchInvoice() {
    const invoiceId = document.getElementById('return-invoice-id').value.trim();
    if (!invoiceId) return;

    try {
        const res = await fetch(\`/api/retail/sales/\${invoiceId}\`);
        if (!res.ok) throw new Error('لم يتم العثور على الفاتورة');
        const data = await res.json();
        
        currentReturnInvoice = data;
        
        // Populate Info
        document.getElementById('return-invoice-info').style.display = 'block';
        document.getElementById('return-lbl-id').textContent = data.sale.id;
        document.getElementById('return-lbl-date').textContent = new Date(data.sale.created_at).toLocaleString('ar-EG');
        document.getElementById('return-lbl-total').textContent = Number(data.sale.total_amount).toFixed(2);

        // Populate Items
        const tbody = document.getElementById('return-items-tbody');
        tbody.innerHTML = data.items.map((item, idx) => {
            const soldQty = item.qty; // original quantity
            // Prevent returning negative original quantities (e.g., if this was already a return)
            if (soldQty <= 0) return '';
            
            return \`
                <tr>
                    <td style="padding: 12px; border-bottom: 1px solid #f1f5f9;">\${item.product_name}</td>
                    <td style="padding: 12px; text-align: center; border-bottom: 1px solid #f1f5f9;">\${soldQty}</td>
                    <td style="padding: 12px; text-align: center; border-bottom: 1px solid #f1f5f9;">$\${Number(item.selling_price).toFixed(2)}</td>
                    <td style="padding: 12px; text-align: center; border-bottom: 1px solid #f1f5f9;">
                        <input type="number" min="0" max="\${soldQty}" value="0" class="return-qty-input" data-idx="\${idx}" style="width: 80px; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1; text-align: center;" onchange="validateReturnQty(this, \${soldQty})">
                    </td>
                </tr>
            \`;
        }).join('');

        // Enable confirm button if there are valid items
        if (data.items.some(i => i.qty > 0)) {
            const btn = document.getElementById('btn-confirm-return');
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        }

    } catch (err) {
        showToast(err.message, 'error');
        document.getElementById('return-invoice-info').style.display = 'none';
        document.getElementById('return-items-tbody').innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px; color: #ef4444;">' + err.message + '</td></tr>';
    }
}

function validateReturnQty(input, maxQty) {
    let val = parseInt(input.value) || 0;
    if (val < 0) val = 0;
    if (val > maxQty) val = maxQty;
    input.value = val;
}

async function confirmReturn() {
    if (!currentReturnInvoice || !currentShiftId) return;

    const inputs = document.querySelectorAll('.return-qty-input');
    const returnItems = [];

    inputs.forEach(input => {
        const idx = input.getAttribute('data-idx');
        const returnQty = parseInt(input.value) || 0;
        
        if (returnQty > 0) {
            const item = currentReturnInvoice.items[idx];
            returnItems.push({
                product_id: item.product_id,
                return_qty: returnQty,
                unit_price: item.selling_price,
                cost_price: item.cost_price
            });
        }
    });

    if (returnItems.length === 0) {
        showToast('الرجاء تحديد كمية للإرجاع', 'error');
        return;
    }

    const confirmBtn = document.getElementById('btn-confirm-return');
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري المعالجة...';

    const warehouseId = document.getElementById('warehouse-source').value;

    try {
        const res = await fetch('/api/retail/returns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                original_sale_id: currentReturnInvoice.sale.id,
                warehouse_id: warehouseId,
                items: returnItems
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'خطأ في معالجة المرتجع');

        showToast('تم إرجاع الأصناف بنجاح وخصم المبلغ من اليومية', 'success');
        closeReturnModal();
        
        // Refresh shift UI to show deducted totals
        loadCurrentShift();
        
        // Update product search list to reflect added stock
        searchProducts('');

    } catch (err) {
        showToast(err.message, 'error');
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fa-solid fa-check"></i> تأكيد الإرجاع';
    }
}
`;

fs.appendFileSync('public/js/retail.js', returnsLogic);
console.log("retail.js logic appended.");
