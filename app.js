const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Ensure all API responses default to application/json
app.use('/api', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    next();
});

// ── Auth routes (public — no cookie needed to reach login endpoint) ──
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// ── Global Auth Guard Middleware ──
const { requireAuth, requireAdmin, sessions } = require('./controllers/authController');

app.use((req, res, next) => {
    const requestPath = req.path;

    // 1. Exclude public API auth routes
    if (requestPath.startsWith('/api/auth')) {
        return next();
    }

    // 2. Exclude static assets (styles, scripts, fonts, images)
    const isAsset = /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i.test(requestPath) ||
                    requestPath.startsWith('/css/') ||
                    requestPath.startsWith('/js/') ||
                    requestPath.startsWith('/fonts/') ||
                    requestPath.startsWith('/assets/');
                    
    if (isAsset) {
        return next();
    }

    // 3. Exclude login.html and the root path /
    if (requestPath === '/login.html' || requestPath === '/') {
        return next();
    }

    // 4. Require authentication for all other routes
    requireAuth(req, res, next);
});

// Attach the branch scope to req.branchId globally (after auth)
const branchScope = require('./middleware/branchScope');
app.use((req, res, next) => {
    // Skip public routes like auth and static assets
    if (!req.user && req.path.startsWith('/api/auth')) {
        return next();
    }
    // Only apply branchScope if req.user exists (i.e. auth guard passed)
    if (req.user) {
        return branchScope(req, res, next);
    }
    next();
});

// خدمة الملفات الثابتة (HTML, CSS, JS)
const path = require('path');
app.use(express.static(path.join(__dirname, 'public'), {
    etag: false,
    maxAge: '0',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
        }
    }
}));

// Route for persistent uploads (invoices, etc.)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// استيراد المسارات (تأكد أن الملفات دي موجودة في فولدر routes)
const productRoutes = require('./routes/productRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const transferRoutes = require('./routes/transferRoutes');
const warehouseRoutes = require('./routes/warehouseRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const importRoutes = require('./routes/importRoutes');
const orderRoutes = require('./routes/orderRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const clientRoutes = require('./routes/clientRoutes');
const pharmacyRoutes = require('./routes/pharmacyRoutes');
const staffRoutes = require('./routes/staffRoutes');
const withdrawalRoutes = require('./routes/withdrawalRoutes');
const collectionRoutes = require('./routes/collectionRoutes');
const retailRoutes = require('./routes/retailRoutes');

// استخدام المسارات
app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/warehouse', warehouseRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/imports', importRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/pharmacies', pharmacyRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/retail', retailRoutes);

const adminRoutes = require('./routes/adminRoutes');
app.use('/api/admin', adminRoutes);

// --- إضافة مهمة: صيد الأخطاء (Error Handler) ---
// السطر ده هيخلي السيرفر يطبع لك السبب الحقيقي لخطأ 500 في الـ Terminal عندك
app.use((err, req, res, next) => {
    console.error("❌ خطأ في السيرفر:", err.stack);
    res.status(500).json({ error: 'حدث خطأ داخلي في السيرفر', message: err.message });
});


// Root route → role-aware redirect for authenticated users, login page for guests
app.get('/', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    const token = req.cookies?.session_token;
    if (token && sessions.has(token)) {
        const session = sessions.get(token);
        if (Date.now() <= session.expiresAt) {
            // ADMIN → admin dashboard, everyone else → main operational system
            const isAdmin = (session.role === 'ADMIN' || session.role === 'Admin' || session.role === 'Super Admin');
            return res.redirect(isAdmin ? '/dashboard' : '/index.html');
        }
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Dashboard route (protected: requires auth + ADMIN role)
app.get('/dashboard', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Start Server
app.listen(port, () => {
    console.log(`✅ Server is running on http://localhost:${port}`);
});
