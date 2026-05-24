const express = require('express');
const router = express.Router();
const { login, checkSession, logout } = require('../controllers/authController');

router.post('/login', login);
router.get('/check', checkSession);
router.post('/logout', logout);

module.exports = router;
