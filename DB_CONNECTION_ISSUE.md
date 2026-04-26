# Database Connection Issue

I was unable to connect to your MySQL database using the provided credentials (user: `root`, password: empty) or common alternatives.

The error strictly indicates "Access denied".

## Steps to Fix

1.  **Verify MySQL is Running**: Open XAMPP Control Panel and ensure MySQL is green (Running).
2.  **Verify Credentials**:
    -   Click **Shell** in XAMPP.
    -   Run: `mysql -u root`
    -   If this works, update `.env` with `DB_PASSWORD=` (empty).
    -   If it asks for a password, you HAVE a password. Please find it or reset it.
    -   If it fails, your user might not be `root`. Check phpMyAdmin > User Accounts.

3.  **Update Configuration**:
    -   Open `.env` file in the project root.
    -   Update `DB_USER` and `DB_PASSWORD` with the correct values.
    -   If using a custom port (not 3306), add `DB_PORT=3307` (example).

4.  **Run Import Manually**:
    -   Once fixed, run: `node scripts/import_schema.js`
    -   If successful, run: `node app.js`

Please fix the connection and try again.
