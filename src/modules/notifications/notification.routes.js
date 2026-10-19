import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middlewares/authenticate.js';
import { csrfProtection } from '../../middlewares/csrf.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../shared/utils/apiResponse.js';
import { notFoundError } from '../../shared/errors/AppError.js';
import { Notification } from './notification.model.js';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [items, unreadCount] = await Promise.all([
      Notification.find({ userId: req.auth.userId }).sort({ createdAt: -1 }).limit(50).lean(),
      Notification.countDocuments({ userId: req.auth.userId, readAt: null }),
    ]);
    return sendSuccess(res, { notifications: items, unreadCount });
  }),
);

const notificationIdSchema = z.object({
  body: z.object({}),
  params: z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) }),
  query: z.object({}),
});
router.patch(
  '/:id/read',
  csrfProtection,
  validate(notificationIdSchema),
  asyncHandler(async (req, res) => {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.validated.params.id, userId: req.auth.userId },
      { $set: { readAt: new Date() } },
      { returnDocument: 'after' },
    ).lean();
    if (!notification) throw notFoundError('Notification');
    return sendSuccess(res, { notification });
  }),
);

export default router;

