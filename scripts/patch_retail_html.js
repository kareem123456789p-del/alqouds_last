const fs = require('fs');
let code = fs.readFileSync('public/retail_sales.html', 'utf8');

// 1. Add the Returns Button in the Header
const headerSearch = '<h2 style="margin: 0; font-size: 1.5rem; font-weight: 800; color: white;">مبيعات الجمهور (POS)</h2>';
const headerReplace = `<h2 style="margin: 0; font-size: 1.5rem; font-weight: 800; color: white;">مبيعات الجمهور (POS)</h2>
                <button onclick="openReturnModal()" style="background: #ef4444; color: white; padding: 8px 16px; border-radius: 6px; border: none; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 8px; margin-right: 20px;">
                    <i class="fa-solid fa-rotate-left"></i> المرتجعات
                </button>`;

code = code.replace(headerSearch, headerReplace);

// 2. Add the Returns Modal before the script tag
const scriptSearch = '<script src="./js/retail.js"></script>';
const modalCode = `
    <!-- ── Returns Modal ── -->
    <div class="disabled-overlay" id="return-modal-overlay" style="display:none; z-index: 100;" onclick="if(event.target===this)closeReturnModal()">
        <div style="background: white; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); width: 800px; max-width: 95%; max-height: 90vh; display: flex; flex-direction: column;">
            <div style="padding: 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border-radius: 12px 12px 0 0;">
                <h3 style="margin: 0; font-size: 1.5rem; color: #0f172a;"><i class="fa-solid fa-rotate-left" style="color: #ef4444;"></i> نظام المرتجعات</h3>
                <button onclick="closeReturnModal()" style="background: none; border: none; font-size: 1.5rem; color: #64748b; cursor: pointer;">&times;</button>
            </div>
            
            <div style="padding: 20px; display: flex; gap: 10px; border-bottom: 1px solid #e2e8f0;">
                <input type="number" id="return-invoice-id" placeholder="أدخل رقم الفاتورة للبحث..." style="flex: 1; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 1.1rem; text-align: right;">
                <button onclick="searchInvoice()" style="background: #3b82f6; color: white; padding: 0 24px; border-radius: 8px; border: none; font-weight: bold; cursor: pointer; font-size: 1.1rem;">
                    <i class="fa-solid fa-magnifying-glass"></i> بحث
                </button>
            </div>

            <div style="padding: 20px; flex: 1; overflow-y: auto;">
                <div id="return-invoice-info" style="margin-bottom: 15px; display: none; background: #eff6ff; padding: 15px; border-radius: 8px; border: 1px solid #bfdbfe;">
                    <strong style="color: #1e3a8a;">فاتورة رقم: #<span id="return-lbl-id"></span></strong> | 
                    <span style="color: #1e3a8a;">التاريخ: <span id="return-lbl-date"></span></span> | 
                    <span style="color: #1e3a8a;">الإجمالي: $<span id="return-lbl-total"></span></span>
                </div>

                <table class="pos-table" style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e2e8f0;">الصنف</th>
                            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e2e8f0;">الكمية المباعة</th>
                            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e2e8f0;">السعر</th>
                            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e2e8f0; width: 120px;">كمية الإرجاع</th>
                        </tr>
                    </thead>
                    <tbody id="return-items-tbody">
                        <tr><td colspan="4" style="text-align: center; padding: 40px; color: #94a3b8;">يرجى البحث عن فاتورة لعرض الأصناف</td></tr>
                    </tbody>
                </table>
            </div>

            <div style="padding: 20px; border-top: 1px solid #e2e8f0; background: #f8fafc; border-radius: 0 0 12px 12px; display: flex; justify-content: flex-end; gap: 10px;">
                <button onclick="closeReturnModal()" style="padding: 12px 24px; border-radius: 8px; border: 1px solid #cbd5e1; background: white; color: #475569; font-weight: bold; cursor: pointer;">إلغاء</button>
                <button id="btn-confirm-return" onclick="confirmReturn()" disabled style="padding: 12px 24px; border-radius: 8px; border: none; background: #22c55e; color: white; font-weight: bold; cursor: not-allowed; opacity: 0.6; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-check"></i> تأكيد الإرجاع
                </button>
            </div>
        </div>
    </div>

    <script src="./js/retail.js"></script>
`;

code = code.replace(scriptSearch, modalCode);

fs.writeFileSync('public/retail_sales.html', code);
console.log("retail_sales.html updated.");
