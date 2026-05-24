const crypto = require('crypto');

// In-memory session store (sufficient for single-admin use case)
const sessions = new Map();

/**
 * POST /api/auth/login
 * Validates credentials against environment variables and issues a session token.
 */
const login = async (req, res) => {
    try {
        const { email, password, remember } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email and password are required.' });
        }

        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminEmail || !adminPassword) {
            console.error('⚠️  ADMIN_EMAIL or ADMIN_PASSWORD not set in environment.');
            return res.status(500).json({ success: false, error: 'Server authentication not configured.' });
        }

        // Case-insensitive email comparison, exact password match
        if (email.trim().toLowerCase() !== adminEmail.trim().toLowerCase() || password !== adminPassword) {
            return res.status(401).json({ success: false, error: 'Invalid credentials. Please check your email and password.' });
        }

        // Generate session token
        const token = crypto.randomBytes(32).toString('hex');
        const maxAge = remember ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // 7 days or 1 day

        sessions.set(token, {
            email: adminEmail,
            createdAt: Date.now(),
            expiresAt: Date.now() + maxAge
        });

        // Set HTTP-only cookie
        res.cookie('session_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT === 'production',
            sameSite: 'lax',
            maxAge: maxAge,
            path: '/'
        });

        res.json({
            success: true,
            message: 'Login successful',
            redirect: '/index.html'
        });

    } catch (err) {
        console.error('Auth error:', err);
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
};

/**
 * GET /api/auth/check
 * Validates the current session token.
 */
const checkSession = (req, res) => {
    const token = req.cookies?.session_token;

    if (!token || !sessions.has(token)) {
        return res.status(401).json({ authenticated: false });
    }

    const session = sessions.get(token);
    if (Date.now() > session.expiresAt) {
        sessions.delete(token);
        return res.status(401).json({ authenticated: false });
    }

    res.json({ authenticated: true, email: session.email });
};

/**
 * POST /api/auth/logout
 * Destroys the session and clears the cookie.
 */
const logout = (req, res) => {
    const token = req.cookies?.session_token;
    if (token) {
        sessions.delete(token);
    }
    res.clearCookie('session_token', { path: '/' });
    res.json({ success: true, message: 'Logged out successfully.' });
};

/**
 * Middleware: requireAuth
 * Protects routes — redirects to login.html if not authenticated.
 */
const requireAuth = (req, res, next) => {
    const token = req.cookies?.session_token;

    if (!token || !sessions.has(token)) {
        // For HTML requests, redirect to login
        if (req.accepts('html')) {
            return res.redirect('/login.html');
        }
        return res.status(401).json({ error: 'Authentication required.' });
    }

    const session = sessions.get(token);
    if (Date.now() > session.expiresAt) {
        sessions.delete(token);
        if (req.accepts('html')) {
            return res.redirect('/login.html');
        }
        return res.status(401).json({ error: 'Session expired.' });
    }

    req.user = { email: session.email };
    next();
};

module.exports = { login, checkSession, logout, requireAuth };
