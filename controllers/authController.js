const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../db');

// In-memory session store (sufficient for single-admin use case, now extending to users)
const sessions = new Map();

/**
 * POST /api/auth/login
 * Validates credentials against db and issues a session token.
 */
const login = async (req, res) => {
    try {
        const { registration_number, password, remember } = req.body;

        if (!registration_number || !password) {
            return res.status(400).json({ success: false, error: 'Registration number and password are required.' });
        }

        // Fetch user by registration_number
        const [users] = await db.query('SELECT * FROM staff WHERE registration_number = $1', [registration_number]);
        
        if (users.length === 0) {
            return res.status(401).json({ success: false, error: 'Invalid credentials. Please check your registration number and password.' });
        }

        const user = users[0];

        if (!user.password_hash) {
             return res.status(401).json({ success: false, error: 'User does not have a password set.' });
        }

        // Validate password using bcrypt
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Invalid credentials. Please check your registration number and password.' });
        }

        // Fetch permissions
        const [permsResult] = await db.query('SELECT permission_key FROM staff_permissions WHERE staff_id = $1', [user.id]);
        const permissions = permsResult.map(p => p.permission_key);

        // Generate session token
        const token = crypto.randomBytes(32).toString('hex');
        const maxAge = remember ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // 7 days or 1 day

        console.log(`[LOGIN DEBUG] User: ${user.name} (${user.registration_number}), Assigned Branch ID: ${user.branch_id}`);

        sessions.set(token, {
            userId: user.id,
            registration_number: user.registration_number,
            name: user.name, // adding name for debug logs later
            role: user.role || 'EMPLOYEE',
            assigned_branch_id: user.branch_id,
            active_branch_id: user.branch_id,
            permissions: permissions,
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

        // Role-based redirect: ADMIN → admin dashboard, all others → main operational system
        const userRole = user.role || 'EMPLOYEE';
        const isAdmin = (userRole === 'ADMIN' || userRole === 'Admin' || userRole === 'Super Admin');
        const redirectUrl = isAdmin ? '/dashboard' : '/index.html';

        res.json({
            success: true,
            message: 'Login successful',
            role: userRole,
            redirect: redirectUrl
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
const checkSession = async (req, res) => {
    const token = req.cookies?.session_token;

    if (!token || !sessions.has(token)) {
        return res.status(401).json({ authenticated: false });
    }

    const session = sessions.get(token);
    if (Date.now() > session.expiresAt) {
        sessions.delete(token);
        return res.status(401).json({ authenticated: false });
    }

    // Fetch branch names
    let assigned_branch_name = 'Unknown';
    let active_branch_name = 'Unknown';
    try {
        const [branches] = await db.query('SELECT id, name FROM branches WHERE id IN ($1, $2)', [session.assigned_branch_id, session.active_branch_id]);
        for (const b of branches) {
            if (b.id === session.assigned_branch_id) assigned_branch_name = b.name;
            if (b.id === session.active_branch_id) active_branch_name = b.name;
        }
    } catch (e) { console.error('Error fetching branch names in checkSession', e); }

    res.json({ 
        authenticated: true, 
        userId: session.userId,
        registration_number: session.registration_number,
        role: session.role,
        assigned_branch_id: session.assigned_branch_id,
        active_branch_id: session.active_branch_id,
        assigned_branch_name,
        active_branch_name,
        permissions: session.permissions || []
    });
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
    const isApiRequest = req.path.startsWith('/api/') || req.originalUrl.startsWith('/api/');

    if (!token || !sessions.has(token)) {
        // For HTML requests, redirect to login
        if (!isApiRequest && req.accepts('html')) {
            return res.redirect('/login.html');
        }
        return res.status(401).json({ error: 'Authentication required.' });
    }

    const session = sessions.get(token);
    if (Date.now() > session.expiresAt) {
        sessions.delete(token);
        if (!isApiRequest && req.accepts('html')) {
            return res.redirect('/login.html');
        }
        return res.status(401).json({ error: 'Session expired.' });
    }

    req.user = { 
        userId: session.userId,
        registration_number: session.registration_number,
        name: session.name,
        role: session.role,
        assigned_branch_id: session.assigned_branch_id,
        active_branch_id: session.active_branch_id,
        permissions: session.permissions || []
    };
    next();
};

/**
 * Middleware: checkPermission
 * Checks if user is ADMIN or has the required permission key
 */
const checkPermission = (permissionKey) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized.' });
        }
        if (req.user.role === 'ADMIN' || req.user.role === 'Super Admin' || req.user.role === 'Admin') {
            return next();
        }
        if (req.user.permissions && req.user.permissions.includes(permissionKey)) {
            return next();
        }
        return res.status(403).json({ error: `Forbidden. Requires permission: ${permissionKey}` });
    };
};

/**
 * Middleware: requireAdmin
 * Blocks non-admin users from accessing admin-only routes (e.g., /dashboard, /api/admin/*).
 * For HTML page requests → redirects to main system (/index.html).
 * For API requests → returns 403 JSON.
 */
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        const isApiRequest = req.path.startsWith('/api/') || req.originalUrl.startsWith('/api/');
        if (!isApiRequest && req.accepts('html')) {
            return res.redirect('/login.html');
        }
        return res.status(401).json({ error: 'Authentication required.' });
    }

    const role = req.user.role;
    const isAdmin = (role === 'ADMIN' || role === 'Admin' || role === 'Super Admin');

    if (isAdmin) {
        return next();
    }

    // Non-admin user trying to access admin resources
    const isApiRequest = req.path.startsWith('/api/') || req.originalUrl.startsWith('/api/');
    if (!isApiRequest && req.accepts('html')) {
        return res.redirect('/index.html');
    }
    return res.status(403).json({ error: 'Access denied. Admins only.' });
};

/**
 * POST /api/auth/refresh-permissions
 * Refreshes the current session's permissions array from the DB
 */
const refreshPermissions = async (req, res) => {
    try {
        const token = req.cookies?.session_token;
        if (!token || !sessions.has(token)) {
            return res.status(401).json({ error: 'Not authenticated.' });
        }
        const session = sessions.get(token);
        const [permsResult] = await db.query('SELECT permission_key FROM staff_permissions WHERE staff_id = $1', [session.userId]);
        session.permissions = permsResult.map(p => p.permission_key);
        
        // update user role & branch just in case
        const [users] = await db.query('SELECT role, branch_id FROM staff WHERE id = $1', [session.userId]);
        if (users.length > 0) {
            session.role = users[0].role;
            session.branch_id = users[0].branch_id;
        }

        res.json({ success: true, permissions: session.permissions });
    } catch (err) {
        console.error('Refresh permissions error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

/**
 * POST /api/auth/switch-branch
 * Admins only: updates the active_branch_id in the session
 */
const switchBranch = async (req, res) => {
    try {
        const { branch_id } = req.body;
        const token = req.cookies?.session_token;

        if (!token || !sessions.has(token)) {
            return res.status(401).json({ error: 'Not authenticated.' });
        }
        
        const session = sessions.get(token);
        
        // Ensure user is an admin
        if (session.role !== 'ADMIN' && session.role !== 'Admin' && session.role !== 'Super Admin') {
            return res.status(403).json({ error: 'Only admins can switch branches.' });
        }

        if (!branch_id) {
            return res.status(400).json({ error: 'branch_id is required.' });
        }

        // Validate branch exists
        const [branches] = await db.query('SELECT id FROM branches WHERE id = $1', [branch_id]);
        if (branches.length === 0) {
            return res.status(404).json({ error: 'Branch not found.' });
        }

        session.active_branch_id = parseInt(branch_id);
        res.json({ success: true, active_branch_id: session.active_branch_id });
    } catch (error) {
        console.error('switchBranch error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

/**
 * Middleware: attachBranchScope
 * Injects req.branchId from the session so downstream handlers can scope queries easily.
 */
const attachBranchScope = (req, res, next) => {
    if (req.user && req.user.active_branch_id) {
        req.branchId = req.user.active_branch_id;
    }
    next();
};

module.exports = { 
    login, checkSession, logout, requireAuth, requireAdmin, checkPermission, refreshPermissions, 
    switchBranch, attachBranchScope, sessions 
};
