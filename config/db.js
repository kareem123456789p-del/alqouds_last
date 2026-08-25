// config/db.js — re-exports the root-level PostgreSQL pool wrapper
// so that controllers using require('../config/db') get the same pool.
module.exports = require('../db');
