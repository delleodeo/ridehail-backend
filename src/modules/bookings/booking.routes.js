import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { csrfProtection } from '../../middlewares/csrf.js';
import { validate } from '../../middlewares/validate.js';
import { ROLES } from '../../shared/constants.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import * as controller from './booking.controller.js';
import {
  bookingIdSchema,
  cancelBookingSchema,
  createBookingSchema,
  estimateBookingSchema,
  listBookingsSchema,
} from './booking.validator.js';

const router = Router();
router.use(authenticate);

router.post(
  '/estimate',
  authorize(ROLES.COMMUTER),
  csrfProtection,
  validate(estimateBookingSchema),
  asyncHandler(controller.estimate),
);
router.post(
  '/',
  authorize(ROLES.COMMUTER),
  csrfProtection,
  validate(createBookingSchema),
  asyncHandler(controller.create),
);
router.get(
  '/my',
  authorize(ROLES.COMMUTER),
  validate(listBookingsSchema),
  asyncHandler(controller.listMine),
);
router.get('/:id', validate(bookingIdSchema), asyncHandler(controller.getById));
router.post(
  '/:id/cancel',
  authorize(ROLES.COMMUTER),
  csrfProtection,
  validate(cancelBookingSchema),
  asyncHandler(controller.cancel),
);

export default router;

