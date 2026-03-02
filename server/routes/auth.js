const express = require('express');
const router = express.Router();
const { register, login, refreshTokenHandler, resetPassword } = require('../controllers/authController');
const { validate } = require('../middlewares/validate');
const { registerSchema, loginSchema, resetPasswordSchema } = require('../validators/schemas');
const { authLimiter } = require('../middlewares/rateLimiter');

router.use(authLimiter);

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/refresh', refreshTokenHandler);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

module.exports = router;
