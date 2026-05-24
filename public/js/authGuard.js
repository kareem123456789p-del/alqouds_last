/**
 * Al-Quds Center — Client-Side Auth Guard
 * Performs an asynchronous check on DOMContentLoaded to verify user session.
 * If unauthorized or session is expired, redirects immediately to login page.
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
        }
    } catch (err) {
        console.error('Auth Guard: check failed:', err);
        window.location.href = '/login.html';
    }
});
