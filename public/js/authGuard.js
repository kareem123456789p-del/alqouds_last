/**
 * Al-Quds Center — Client-Side Auth Guard
 * Performs an asynchronous check on DOMContentLoaded to verify user session.
 * If unauthorized or session is expired, redirects immediately to login page.
 * Stores session data on window.__alqudsUser for downstream scripts to use.
 * Also enforces route-level page access restrictions (e.g. collections.html, analytics.html)
 * and dynamically synchronizes branch headers with user's active branch.
 */

function syncBranchHeaders(user) {
    if (!user) return;
    const branchName = user.active_branch_name && user.active_branch_name !== 'Unknown'
        ? user.active_branch_name
        : (user.active_branch_id === 1 ? 'مركز القدس 1 للمستلزمات الطبية' : 'مركز القدس 2 للمستلزمات والأجهزة الطبية');

    // Update target elements by explicit ID or class
    document.querySelectorAll('#header-branch-title, .header-branch-name, [data-branch-header]').forEach(el => {
        el.textContent = branchName;
    });

    // Replace legacy headers that previously had hardcoded "مركز القدس 2"
    document.querySelectorAll('.new-global-header h2, .top-nav .nav-brand span').forEach(el => {
        if (el.textContent.includes('مركز القدس')) {
            el.textContent = branchName;
        }
    });

    window.dispatchEvent(new CustomEvent('alquds:branch-synced', { detail: { branchName, user } }));
}
window.syncBranchHeaders = syncBranchHeaders;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('/api/auth/check', { credentials: 'same-origin' });
        if (!res.ok) {
            window.location.href = '/login.html';
            return;
        }
        const data = await res.json();
        if (!data || !data.authenticated) {
            window.location.href = '/login.html';
            return;
        }

        // Expose user data for downstream scripts (e.g., main.js nav rendering)
        window.__alqudsUser = data;
        window.__activeBranchId = data.active_branch_id || data.assigned_branch_id || 2;

        // Synchronize branch headers dynamically
        syncBranchHeaders(data);

        // Route-level page protection: Collections page
        const path = window.location.pathname.toLowerCase();
        const role = data.role ? data.role.toUpperCase() : '';
        const isAdmin = (role === 'ADMIN' || role === 'SUPER ADMIN');

        let perms = data.permissions || [];
        if (typeof perms === 'string') {
            try { perms = JSON.parse(perms); } catch(e) { perms = []; }
        }

        if (path.endsWith('collections.html') || path.includes('/collections.html')) {
            const hasCollectionsAccess = isAdmin || (Array.isArray(perms) && perms.includes('can_manage_collections'));
            if (!hasCollectionsAccess) {
                console.warn('[AUTH GUARD]: User lacks can_manage_collections permission. Redirecting to index.');
                window.location.href = '/index.html';
                return;
            }
        }

        // Route-level page protection: Analytics page
        if (path.endsWith('analytics.html') || path.includes('/analytics.html')) {
            const hasAnalyticsAccess = isAdmin || (Array.isArray(perms) && perms.includes('can_manage_analytics'));
            if (!hasAnalyticsAccess) {
                console.warn('[AUTH GUARD]: User lacks can_manage_analytics permission. Redirecting to index.');
                window.location.href = '/index.html';
                return;
            }
        }
    } catch (err) {
        console.error('Auth Guard: check failed:', err);
        window.location.href = '/login.html';
    }
});
