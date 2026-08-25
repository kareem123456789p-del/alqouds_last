/**
 * Al-Quds Center — Client-Side Auth Guard
 * Performs an asynchronous check on DOMContentLoaded to verify user session.
 * If unauthorized or session is expired, redirects immediately to login page.
 * Stores session data on window.__alqudsUser for downstream scripts to use.
 */
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
        } else {
            // Expose user data for downstream scripts (e.g., main.js nav rendering)
            window.__alqudsUser = data;
        }
    } catch (err) {
        console.error('Auth Guard: check failed:', err);
        window.location.href = '/login.html';
    }
});
