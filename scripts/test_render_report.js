const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');

async function testFullReport() {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/login.html');
    await page.fill('#login-registration-number', 'admin');
    await page.fill('#login-password', 'Passw0rd!');
    await page.click('#login-btn');
    await page.waitForURL('**/dashboard');
    await page.goto('http://localhost:3000/warehouse.html');
    await page.waitForSelector('#btn-download-audit');

    const result = await page.evaluate(() => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        
        doc.addFileToVFS('Amiri-Regular.ttf', window.AmiriBase64);
        doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
        doc.addFont('Amiri-Regular.ttf', 'Amiri', 'bold');
        doc.setFont('Amiri');

        const branchName = 'مركز القدس 2 للمستلزمات والأجهزة الطبية';
        const branchAddress = 'أسوان - السيل - شارع المشرحة بجوار مستشفى أسوان الجامعي - مركز القدس 2';
        const branchPhones = '01155675246 - 01221884709 - 01220212028 - 01227831253';
        const whNameAr = 'كافة المخازن';
        const dateStr = '2026-11-20';
        const timeStr = '21:50';

        // Header Section
        doc.setFont('Amiri', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(30, 41, 59);
        doc.text('تقرير جرد المخزون', 105, 18, { align: 'center' });

        doc.setFontSize(13);
        doc.setTextColor(37, 99, 235);
        doc.text(branchName, 105, 26, { align: 'center' });

        // Decorative Line
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.4);
        doc.line(14, 30, 196, 30);

        // Metadata Info Bar
        doc.setFont('Amiri', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(71, 85, 105);

        // Right side
        doc.text('المخزن: ' + whNameAr, 196, 37, { align: 'right' });
        doc.text('تاريخ الجرد: ' + dateStr + '  ' + timeStr, 196, 43, { align: 'right' });

        // Left side
        doc.text('إجمالي الأصناف: 15 صنف', 14, 37, { align: 'left' });
        doc.text('إجمالي القيمة: 46,765.00 ج.م', 14, 43, { align: 'left' });

        // Table Data & Headers
        const tableColumn = [
            'الإجمالي (ج.م)',
            'سعر الوحدة (ج.م)',
            'الكمية',
            'تاريخ الصلاحية',
            'رقم التشغيلة',
            'اسم الصنف',
            'م'
        ];

        const tableRows = [
            ['90.00', '1.50', '60', '2029-05-07', 'B-P12-BAND', 'شاش طبي لاصق معقم', '1'],
            ['360.00', '20.00', '18', '2027-04-18', 'B-P11-ALC', 'كحول طبي نقي 70%', '2'],
            ['187.50', '12.50', '15', '2026-11-29', 'B-P2-NEAR', 'أموكسيسيلين كبسولات 250 مجم', '3'],
            ['312.50', '12.50', '25', '2027-09-15', 'B-P2-FAR', 'أموكسيسيلين شراب معلق 250 مجم', '4'],
            ['375.00', '15.00', '25', '2028-10-19', 'B-P10-COT', 'قطن طبي معقم كبير', '5'],
            ['200.00', '2.00', '100', '2028-07-11', 'B-P7-MASK', 'كمامة طبية 3 طبقات زرقاء', '6'],
            ['1,200.00', '150.00', '8', '2027-02-17', 'B-P3-COLD', 'إنسولين جلارجين 100 وحدة/مل', '7'],
            ['300.00', '25.00', '12', '2027-01-03', 'B-P6-IV', 'محلول ملحي وريدي 0.9%', '8'],
            ['50.00', '5.00', '10', '2026-09-20', 'B-P1-EXPIRED', 'باراسيتامول أقراص 500 مجم', '9'],
            ['100.00', '5.00', '20', '2026-12-09', 'B-P1-NEAR', 'باراسيتامول شراب أطفال', '10'],
            ['150.00', '5.00', '30', '2027-12-24', 'B-P1-FAR', 'باراسيتامول فوار مسكن', '11'],
            ['40,000.00', '80.00', '500', '2028-04-02', 'B-P4-BULK', 'قفازات طبية فحص مقاس M', '12'],
            ['90.00', '3.00', '30', '2027-06-07', 'B-P5-NOCOST', 'سرنجة معقمة 5 مل سن رفيع', '13'],
            ['2,000.00', '200.00', '10', '2029-01-27', 'B-P8-THERM', 'ترمومتر رقمي إلكتروني سريع', '14'],
            ['1,350.00', '30.00', '45', '2027-03-19', 'B-P9-VITC', 'فيتامين سي أقراص فوارة 1000 مجم', '15']
        ];

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            foot: [[
                '46,765.00',
                '',
                '908',
                '',
                '',
                'المجموع الكلي لـ 15 صنف',
                'المجموع'
            ]],
            startY: 48,
            theme: 'grid',
            headStyles: {
                fillColor: [37, 99, 235],
                textColor: 255,
                fontSize: 9.5,
                font: 'Amiri',
                fontStyle: 'bold',
                halign: 'center'
            },
            bodyStyles: {
                fontSize: 9,
                textColor: [30, 41, 59],
                font: 'Amiri',
                fontStyle: 'normal',
                cellPadding: 3
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252]
            },
            footStyles: {
                fillColor: [241, 245, 249],
                textColor: [15, 23, 42],
                fontSize: 9.5,
                font: 'Amiri',
                fontStyle: 'bold',
                halign: 'center'
            },
            margin: { top: 10, left: 14, right: 14, bottom: 22 },
            columnStyles: {
                0: { cellWidth: 26, halign: 'center' },
                1: { cellWidth: 26, halign: 'center' },
                2: { cellWidth: 16, halign: 'center' },
                3: { cellWidth: 24, halign: 'center' },
                4: { cellWidth: 26, halign: 'center' },
                5: { cellWidth: 54, halign: 'right' },
                6: { cellWidth: 10, halign: 'center' }
            }
        });

        // Footers
        const pageCount = doc.internal.getNumberOfPages();
        for (let p = 1; p <= pageCount; p++) {
            doc.setPage(p);
            doc.setFont('Amiri', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(100, 116, 139);
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.4);
            doc.line(14, 283, 196, 283);

            doc.text('العنوان: ' + branchAddress + '  |  هاتف: ' + branchPhones, 105, 288, { align: 'center' });
            doc.text('صفحة ' + p + ' من ' + pageCount, 196, 292, { align: 'right' });
            doc.text('نظام مركز القدس الطبي', 14, 292, { align: 'left' });
        }

        return doc.output('datauristring');
    });

    const base64Data = result.split(',')[1];
    fs.writeFileSync('/tmp/perfect_arabic_report.pdf', Buffer.from(base64Data, 'base64'));
    execSync('pdftoppm -png -r 150 /tmp/perfect_arabic_report.pdf /tmp/perfect_arabic_page');
    console.log('SUCCESS! Generated /tmp/perfect_arabic_page-1.png');
    await browser.close();
}
testFullReport().catch(console.error);
