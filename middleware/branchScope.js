/**
 * Strict Backend Branch Middleware
 * 
 * Securely extracts req.branchId from the session.
 * For Non-Admin Staff: req.branchId = req.session.user.assigned_branch_id (Strictly ignores body/query)
 * For Admin Users: req.branchId = req.session.user.active_branch_id || req.session.user.assigned_branch_id || 1
 */

const branchScope = (req, res, next) => {
    // Determine the user's role and session details
    // Ensure we rely on req.user (which is populated by requireAuth from controllers/authController)
    if (!req.user) {
        // If route is public, or auth wasn't applied, we can't determine branch scope safely.
        // We'll just pass, or return 400. The prompt says:
        // "Reject any request with 400 Bad Request if req.branchId cannot be determined."
        // But some routes (like /api/auth/login) might not have req.user.
        // The middleware should be applied AFTER requireAuth in app.js.
        return res.status(400).json({ error: 'Cannot determine branch scope (Unauthorized or no user in request).' });
    }

    const role = req.user.role ? req.user.role.toUpperCase() : '';
    const isAdmin = (role === 'ADMIN' || role === 'SUPER ADMIN');

    if (isAdmin) {
        req.branchId = req.user.active_branch_id || req.user.assigned_branch_id || 1;
    } else {
        req.branchId = req.user.assigned_branch_id;
    }

    if (!req.branchId) {
        return res.status(400).json({ error: 'Cannot determine branch scope (branchId is missing).' });
    }

    console.log(`[SCOPE DEBUG] Path: ${req.path} | User: ${req.user?.name} | Assigned Branch: ${req.user?.assigned_branch_id} | Applied req.branchId: ${req.branchId}`);

    next();
};

module.exports = branchScope;
