const express = require('express');
const router = express.Router();
const { login, checkSession, logout, refreshPermissions, switchBranch } = require('../controllers/authController');

router.post('/login', login);
router.get('/check', checkSession);
router.post('/logout', logout);
router.post('/refresh-permissions', refreshPermissions);
router.post('/switch-branch', switchBranch);

module.exports = router;
