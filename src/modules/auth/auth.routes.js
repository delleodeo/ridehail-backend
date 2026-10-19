import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middlewares/authenticate.js';
import { csrfProtection } from '../../middlewares/csrf.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import * as controller from './auth.controller.js';
import { loginSchema, registerSchema } from './auth.validator.js';

const router = Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

router.get('/csrf', controller.csrf);
router.post('/register', authLimiter, validate(registerSchema), asyncHandler(controller.register));
router.post('/login', authLimiter, validate(loginSchema), asyncHandler(controller.login));
router.post('/refresh', authLimiter, csrfProtection, asyncHandler(controller.refresh));
router.post('/logout', csrfProtection, asyncHandler(controller.logout));
router.get('/me', authenticate, controller.me);

export default router;

