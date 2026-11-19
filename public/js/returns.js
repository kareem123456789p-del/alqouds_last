/**
 * Advanced Returns Management System (نظام المرتجعات)
 * Hierarchical Date Tree (Months -> Days -> Invoices) + Real-time Inventory Restock & Analytics Deduction
 */

(function () {
    let invoicesTreeData = [];
    let currentSelectedInvoice = null;
    let cachedActiveBranch = null;

    // Helper: Format currency
    function formatCurrency(num) {
        return Number(num || 0).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }) + ' د.أ';
    }

    // Helper: Format Arabic Date
    function formatArabicDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    // Determine current active branch ID from session/cookies/storage
    function getActiveBranchId() {
        if (cachedActiveBranch) return cachedActiveBranch;
        // Check window globals or local storage
        if (window.currentBranchId) return window.currentBranchId;
        const stored = localStorage.getItem('active_branch_id') || localStorage.getItem('branch_id');
        if (stored) return parseInt(stored, 10);
        return null;
    }

    /**
     * Open Returns Modal and load hierarchical invoices tree
     */
    window.openReturnModal = async function (preselectedInvoiceId) {
        const overlay = document.getElementById('return-modal-overlay');
        if (!overlay) {
            console.error('Return modal overlay element (#return-modal-overlay) not found');
            return;
        }

        overlay.style.display = 'flex';
        resetReturnState();

        await loadInvoicesTree(preselectedInvoiceId);
    };

    /**
     * Close Returns Modal
     */
    window.closeReturnModal = function () {
        const overlay = document.getElementById('return-modal-overlay');
        if (overlay) overlay.style.display = 'none';
        currentSelectedInvoice = null;
    };

    /**
     * Reset Modal State
     */
    function resetReturnState() {
        currentSelectedInvoice = null;
        const searchInput = document.getElementById('return-invoice-search-input');
        if (searchInput) searchInput.value = '';

        const filterInput = document.getElementById('return-tree-filter-input');
        if (filterInput) filterInput.value = '';

        const invoiceInfoCard = document.getElementById('return-selected-invoice-card');
        if (invoiceInfoCard) invoiceInfoCard.style.display = 'none';

        const tbody = document.getElementById('return-items-tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 50px 20px; color: #94a3b8; font-size: 1.1rem;">
                        <i class="fa-solid fa-folder-open" style="font-size: 48px; color: #cbd5e1; display: block; margin-bottom: 12px;"></i>
                        اختر فاتورة من شجرة التواريخ بالجانب الأيمن أو ابحث برقم الفاتورة لعرض الأصناف
                    </td>
                </tr>
            `;
        }

        updateTotalsBar(0, 0);
    }

    /**
     * Fetch invoices tree from Backend API
     */
    async function loadInvoicesTree(preselectedInvoiceId) {
        const treeContainer = document.getElementById('return-folders-tree');
        if (treeContainer) {
            treeContainer.innerHTML = `
                <div style="text-align: center; padding: 30px; color: #64748b;">
                    <i class="fa-solid fa-spinner fa-spin" style="font-size: 24px; color: #3b82f6; display: block; margin-bottom: 8px;"></i>
                    جاري تحميل شجرة الفواتير...
                </div>
            `;
        }

        try {
            const branchId = getActiveBranchId();
            const url = branchId ? `/api/returns/invoices-tree?branch_id=${branchId}` : '/api/returns/invoices-tree';
            const res = await fetch(url);
            if (!res.ok) throw new Error('فشل تحميل شجرة الفواتير');

            const data = await res.json();
            invoicesTreeData = data.tree || [];

            renderFoldersTree(invoicesTreeData);

            if (preselectedInvoiceId) {
                selectInvoiceById(preselectedInvoiceId);
            }

        } catch (err) {
            console.error('Error loading invoices tree:', err);
            if (treeContainer) {
                treeContainer.innerHTML = `
                    <div style="padding: 20px; text-align: center; color: #ef4444;">
                        <i class="fa-solid fa-triangle-exclamation" style="font-size: 24px; display: block; margin-bottom: 8px;"></i>
                        خطأ في الاتصال بالخادم: ${err.message}
                    </div>
                `;
            }
        }
    }

    /**
     * Render hierarchical Tree: Months -> Days -> Invoices
     */
    function renderFoldersTree(tree, filterQuery = '') {
        const treeContainer = document.getElementById('return-folders-tree');
        if (!treeContainer) return;

        if (!tree || tree.length === 0) {
            treeContainer.innerHTML = `
                <div style="padding: 30px 15px; text-align: center; color: #94a3b8; font-size: 0.95rem;">
                    <i class="fa-regular fa-folder-closed" style="font-size: 36px; display: block; margin-bottom: 8px; color: #cbd5e1;"></i>
                    لا توجد فواتير مكتملة في هذا الفرع
                </div>
            `;
            return;
        }

        const query = (filterQuery || '').trim().toLowerCase();
        let html = '';

        tree.forEach((month, mIdx) => {
            // Filter days/invoices if search query exists
            let filteredDays = month.days;
            if (query) {
                filteredDays = month.days.map(d => {
                    const matchingInvoices = d.invoices.filter(inv =>
                        (inv.order_number && inv.order_number.toLowerCase().includes(query)) ||
                        (inv.client_name && inv.client_name.toLowerCase().includes(query)) ||
                        String(inv.id).includes(query)
                    );
                    return { ...d, invoices: matchingInvoices };
                }).filter(d => d.invoices.length > 0);
            }

            if (filteredDays.length === 0 && query) return;

            // Month isOpen if first month or searching
            const monthIsOpen = query ? true : (mIdx === 0);

            html += `
                <div class="tree-month-node" style="margin-bottom: 8px;">
                    <div class="tree-month-header" onclick="toggleTreeNode(this)" 
                         style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: #e2e8f0; border-radius: 8px; cursor: pointer; user-select: none; font-weight: 700; color: #1e293b; transition: background 0.2s;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-chevron-left tree-chevron" style="font-size: 11px; color: #64748b; transition: transform 0.2s; transform: ${monthIsOpen ? 'rotate(-90deg)' : 'rotate(0deg)'};"></i>
                            <i class="fa-solid fa-calendar-days" style="color: #2563eb;"></i>
                            <span>${month.monthLabel}</span>
                        </div>
                        <span style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: bold;">
                            ${month.totalInvoices}
                        </span>
                    </div>

                    <div class="tree-month-body" style="display: ${monthIsOpen ? 'block' : 'none'}; padding-inline-start: 12px; margin-top: 4px; border-inline-start: 2px dashed #cbd5e1;">
            `;

            filteredDays.forEach((day, dIdx) => {
                const dayIsOpen = query ? true : (mIdx === 0 && dIdx === 0);

                html += `
                    <div class="tree-day-node" style="margin-bottom: 6px;">
                        <div class="tree-day-header" onclick="toggleTreeNode(this)" 
                             style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: #f1f5f9; border-radius: 6px; cursor: pointer; user-select: none; font-size: 0.9rem; font-weight: 600; color: #334155;">
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <i class="fa-solid fa-chevron-left tree-chevron" style="font-size: 10px; color: #94a3b8; transition: transform 0.2s; transform: ${dayIsOpen ? 'rotate(-90deg)' : 'rotate(0deg)'};"></i>
                                <i class="fa-regular fa-clock" style="color: #64748b;"></i>
                                <span>${day.dayLabel}</span>
                            </div>
                            <span style="background: #cbd5e1; color: #334155; padding: 1px 6px; border-radius: 10px; font-size: 0.7rem;">
                                ${day.invoices.length}
                            </span>
                        </div>

                        <div class="tree-day-body" style="display: ${dayIsOpen ? 'block' : 'none'}; padding-inline-start: 10px; margin-top: 3px;">
                `;

                day.invoices.forEach(inv => {
                    const isSelected = currentSelectedInvoice && currentSelectedInvoice.id === inv.id && currentSelectedInvoice.invoice_type === inv.invoice_type;
                    const activeStyle = isSelected ? 'background: #eff6ff; border: 1px solid #3b82f6; color: #1d4ed8;' : 'background: white; border: 1px solid #e2e8f0; color: #1e293b;';

                    html += `
                        <div class="tree-invoice-item" data-inv-id="${inv.id}" data-inv-type="${inv.invoice_type}" 
                             onclick="selectInvoiceDirect(${inv.id}, '${inv.invoice_type}')"
                             style="padding: 8px 10px; margin: 4px 0; border-radius: 6px; cursor: pointer; transition: all 0.15s; ${activeStyle}">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                                <strong style="font-size: 0.88rem; color: #2563eb;">
                                    <i class="fa-solid fa-receipt" style="margin-left: 4px;"></i>${inv.order_number}
                                </strong>
                                <span style="font-size: 0.75rem; color: #64748b;">${inv.time || ''}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem;">
                                <span style="color: #475569; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 130px;">
                                    ${inv.client_name || 'عميل'}
                                </span>
                                <strong style="color: #059669;">$${Number(inv.total_amount).toFixed(2)}</strong>
                            </div>
                        </div>
                    `;
                });

                html += `
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        });

        treeContainer.innerHTML = html;
    }

    /**
     * Toggle tree node collapse/expand
     */
    window.toggleTreeNode = function (headerElem) {
        const bodyElem = headerElem.nextElementSibling;
        const chevron = headerElem.querySelector('.tree-chevron');
        if (!bodyElem) return;

        if (bodyElem.style.display === 'none' || bodyElem.style.display === '') {
            bodyElem.style.display = 'block';
            if (chevron) chevron.style.transform = 'rotate(-90deg)';
        } else {
            bodyElem.style.display = 'none';
            if (chevron) chevron.style.transform = 'rotate(0deg)';
        }
    };

    /**
     * Filter Tree by keyword (sidebar quick search)
     */
    window.filterReturnsTree = function (query) {
        renderFoldersTree(invoicesTreeData, query);
    };

    /**
     * Select Invoice from tree directly
     */
    window.selectInvoiceDirect = function (invId, invType) {
        let foundInv = null;
        for (const month of invoicesTreeData) {
            for (const day of month.days) {
                const match = day.invoices.find(i => i.id === invId && i.invoice_type === invType);
                if (match) {
                    foundInv = match;
                    break;
                }
            }
            if (foundInv) break;
        }

        if (foundInv) {
            loadInvoiceIntoTable(foundInv);
        } else {
            selectInvoiceById(invId);
        }
    };

    /**
     * Search Invoice by number/ID from the top search bar
     */
    window.searchReturnInvoice = async function () {
        const input = document.getElementById('return-invoice-search-input');
        if (!input) return;
        const rawId = input.value.trim();
        if (!rawId) {
            alert('يرجى إدخال رقم الفاتورة للبحث');
            return;
        }

        const searchBtn = document.getElementById('btn-search-invoice');
        if (searchBtn) {
            searchBtn.disabled = true;
            searchBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        }

        try {
            // First check if it exists in loaded tree
            let found = null;
            const searchLower = rawId.toLowerCase();
            for (const month of invoicesTreeData) {
                for (const day of month.days) {
                    const match = day.invoices.find(i =>
                        (i.order_number && i.order_number.toLowerCase().includes(searchLower)) ||
                        String(i.id) === rawId
                    );
                    if (match) {
                        found = match;
                        break;
                    }
                }
                if (found) break;
            }

            if (found) {
                loadInvoiceIntoTable(found);
                return;
            }

            // Otherwise, fetch directly from API
            const res = await fetch(`/api/returns/invoice/${encodeURIComponent(rawId)}`);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'لم يتم العثور على الفاتورة');
            }

            const data = await res.json();
            if (data.invoice) {
                loadInvoiceIntoTable(data.invoice);
            } else {
                throw new Error('لم يتم العثور على بيانات الفاتورة');
            }

        } catch (err) {
            alert(err.message);
            resetReturnState();
        } finally {
            if (searchBtn) {
                searchBtn.disabled = false;
                searchBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> بحث';
            }
        }
    };

    /**
     * Select invoice by ID/number and load into view
     */
    async function selectInvoiceById(invoiceId) {
        const input = document.getElementById('return-invoice-search-input');
        if (input) input.value = invoiceId;
        await window.searchReturnInvoice();
    }

    /**
     * Load invoice items into the returns table
     */
    function loadInvoiceIntoTable(invoice) {
        currentSelectedInvoice = invoice;

        // Highlight selected invoice item in sidebar tree
        document.querySelectorAll('.tree-invoice-item').forEach(el => {
            const elId = parseInt(el.getAttribute('data-inv-id'), 10);
            const elType = el.getAttribute('data-inv-type');
            if (elId === invoice.id && elType === invoice.invoice_type) {
                el.style.background = '#eff6ff';
                el.style.border = '1px solid #3b82f6';
                el.style.color = '#1d4ed8';
            } else {
                el.style.background = 'white';
                el.style.border = '1px solid #e2e8f0';
                el.style.color = '#1e293b';
            }
        });

        // Populate Selected Invoice Info Card
        const card = document.getElementById('return-selected-invoice-card');
        if (card) {
            card.style.display = 'block';
            document.getElementById('lbl-ret-invoice-no').textContent = invoice.order_number || `#${invoice.id}`;
            document.getElementById('lbl-ret-client-name').textContent = invoice.client_name || 'عميل';
            document.getElementById('lbl-ret-date').textContent = new Date(invoice.created_at).toLocaleString('ar-EG');
            document.getElementById('lbl-ret-total').textContent = `$${Number(invoice.total_amount).toFixed(2)}`;
        }

        // Populate Items Table
        const tbody = document.getElementById('return-items-tbody');
        if (!tbody) return;

        if (!invoice.items || invoice.items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 40px; color: #ef4444;">
                        لا توجد أصناف قابلة للإرجاع في هذه الفاتورة
                    </td>
                </tr>
            `;
            updateTotalsBar(0, 0);
            return;
        }

        tbody.innerHTML = invoice.items.map((item, idx) => {
            const soldQty = item.sold_qty || item.qty || 0;
            const alreadyReturned = item.already_returned_qty || item.returned_qty || 0;
            const returnable = Math.max(0, soldQty - alreadyReturned);
            const unitPrice = parseFloat(item.unit_price || item.selling_price || 0);

            const isFullyReturned = returnable <= 0;
            const trBg = isFullyReturned ? 'background: #f8fafc; opacity: 0.6;' : '';

            return `
                <tr style="border-bottom: 1px solid #f1f5f9; ${trBg}">
                    <td style="padding: 12px; font-weight: 600; color: #1e293b;">
                        <div style="font-size: 0.95rem;">${item.product_name}</div>
                        ${item.sku ? `<div style="font-size: 0.78rem; color: #64748b;">SKU: ${item.sku}</div>` : ''}
                        ${item.batch_number && item.batch_number !== '—' ? `<div style="font-size: 0.78rem; color: #0284c7;"><i class="fa-solid fa-tag"></i> تشغيلة: ${item.batch_number}</div>` : ''}
                    </td>
                    <td style="padding: 12px; text-align: center; color: #334155;">
                        <span style="font-weight: 700;">${soldQty}</span>
                        ${alreadyReturned > 0 ? `<div style="font-size: 0.75rem; color: #ef4444;">(مرتجع سابقاً: ${alreadyReturned})</div>` : ''}
                    </td>
                    <td style="padding: 12px; text-align: center; font-weight: 600; color: #475569;">
                        $${unitPrice.toFixed(2)}
                    </td>
                    <td style="padding: 12px; text-align: center;">
                        ${isFullyReturned ? `
                            <span style="color: #94a3b8; font-size: 0.85rem; font-weight: bold;">تم إرجاعه بالكامل</span>
                        ` : `
                            <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                                <input type="number" min="0" max="${returnable}" value="0" 
                                       class="ret-qty-input" 
                                       data-idx="${idx}" 
                                       data-price="${unitPrice}" 
                                       data-max="${returnable}"
                                       oninput="handleReturnQtyChange(this)"
                                       style="width: 75px; padding: 7px; border-radius: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; font-size: 0.95rem;">
                                <button type="button" onclick="setReturnMax(this, ${returnable})" 
                                        style="background: #e2e8f0; border: none; border-radius: 4px; padding: 6px 8px; font-size: 0.75rem; cursor: pointer; color: #334155;" title="إرجاع الكل">
                                    الكل
                                </button>
                            </div>
                        `}
                    </td>
                    <td style="padding: 12px; text-align: center; font-weight: 700; color: #2563eb;" class="item-refund-subtotal">
                        $0.00
                    </td>
                </tr>
            `;
        }).join('');

        updateCalculatedRefund();
    }

    /**
     * Handle input change for return quantity
     */
    window.handleReturnQtyChange = function (input) {
        const max = parseInt(input.getAttribute('data-max'), 10) || 0;
        let val = parseInt(input.value, 10);

        if (isNaN(val) || val < 0) val = 0;
        if (val > max) {
            val = max;
            alert(`أقصى كمية قابلة للإرجاع لهذا الصنف هي ${max}`);
        }
        input.value = val;

        const price = parseFloat(input.getAttribute('data-price')) || 0;
        const subtotalCell = input.closest('tr').querySelector('.item-refund-subtotal');
        if (subtotalCell) {
            subtotalCell.textContent = `$${(val * price).toFixed(2)}`;
        }

        updateCalculatedRefund();
    };

    /**
     * Quick button to set maximum returnable quantity
     */
    window.setReturnMax = function (btn, maxQty) {
        const input = btn.closest('tr').querySelector('.ret-qty-input');
        if (input) {
            input.value = maxQty;
            window.handleReturnQtyChange(input);
        }
    };

    /**
     * Update calculated refund summary and enable/disable Confirm button
     */
    function updateCalculatedRefund() {
        const inputs = document.querySelectorAll('.ret-qty-input');
        let totalRefund = 0;
        let totalItems = 0;

        inputs.forEach(inp => {
            const qty = parseInt(inp.value, 10) || 0;
            const price = parseFloat(inp.getAttribute('data-price')) || 0;
            if (qty > 0) {
                totalRefund += (qty * price);
                totalItems += qty;
            }
        });

        updateTotalsBar(totalRefund, totalItems);
    }

    function updateTotalsBar(totalRefund, totalItems) {
        const totalElem = document.getElementById('return-calculated-total');
        if (totalElem) totalElem.textContent = `$${Number(totalRefund).toFixed(2)}`;

        const countElem = document.getElementById('return-calculated-count');
        if (countElem) countElem.textContent = totalItems;

        const btn = document.getElementById('btn-confirm-return');
        if (btn) {
            if (totalItems > 0) {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            } else {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            }
        }
    }

    /**
     * Process return submission
     */
    window.submitReturnProcess = async function () {
        if (!currentSelectedInvoice) {
            alert('يرجى اختيار فاتورة أولاً');
            return;
        }

        const inputs = document.querySelectorAll('.ret-qty-input');
        const returnItems = [];

        inputs.forEach(inp => {
            const idx = parseInt(inp.getAttribute('data-idx'), 10);
            const returnQty = parseInt(inp.value, 10) || 0;

            if (returnQty > 0 && currentSelectedInvoice.items[idx]) {
                const item = currentSelectedInvoice.items[idx];
                returnItems.push({
                    item_id: item.item_id || item.id,
                    product_id: item.product_id,
                    batch_id: item.batch_id || null,
                    return_qty: returnQty
                });
            }
        });

        if (returnItems.length === 0) {
            alert('يرجى تحديد كمية إرجاع صالحة لصنف واحد على الأقل');
            return;
        }

        const confirmMessage = `هل أنت متأكد من تأكيد الإرجاع؟\n` +
            `عدد الأصناف: ${returnItems.length}\n` +
            `المبلغ المسترجع: ${document.getElementById('return-calculated-total')?.textContent || '$0.00'}\n` +
            `سيتم تلقائياً إعادة الأصناف للمخزون وخصم المبلغ من المبيعات والتقارير المالية.`;

        if (!confirm(confirmMessage)) return;

        const confirmBtn = document.getElementById('btn-confirm-return');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري تأكيد الإرجاع...';
        }

        try {
            const branchId = getActiveBranchId();
            const payload = {
                original_invoice_id: currentSelectedInvoice.order_number || currentSelectedInvoice.id,
                branch_id: branchId,
                items: returnItems,
                return_reason: 'مرتجع مبيعات POS'
            };

            const res = await fetch('/api/returns/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'فشلت معالجة الإرجاع');

            // Success feedback
            alert(`✅ تم إرجاع الأصناف بنجاح!\n` +
                  `رقم إيصال الإرجاع: ${data.return_number}\n` +
                  `إجمالي المبلغ المسترجع: $${Number(data.total_refund).toFixed(2)}\n\n` +
                  `تمت إعادة الأصناف إلى المخزون تلقائياً وتحديث تقارير المبيعات والتحليلات (Analytics).`);

            window.closeReturnModal();

            // Refresh external modules if active
            if (typeof window.loadCurrentShift === 'function') {
                window.loadCurrentShift();
            }
            if (typeof window.searchProducts === 'function') {
                window.searchProducts('');
            }
            if (typeof window.getOrders === 'function') {
                window.getOrders();
            }

            // Dispatch global event for other components to react
            window.dispatchEvent(new CustomEvent('inventoryUpdated', { detail: { return_id: data.return_id } }));

        } catch (err) {
            alert('❌ خطأ: ' + err.message);
        } finally {
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '<i class="fa-solid fa-check"></i> تأكيد الإرجاع';
            }
        }
    };

})();
