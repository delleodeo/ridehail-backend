import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { csrfProtection } from '../../middlewares/csrf.js';
import { validate } from '../../middlewares/validate.js';
import { ROLES } from '../../shared/constants.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import * as controller from './admin.controller.js';
import {
  driverApprovalSchema,
  fareUpdateSchema,
  listAdminBookingsSchema,
  listDriversSchema,
  listUsersSchema,
  serviceAreaUpdateSchema,
  userStatusSchema,
} from './admin.validator.js';

const router = Router();
router.use(authenticate, authorize(ROLES.ADMIN));

router.get('/dashboard', asyncHandler(controller.dashboard));
router.get('/users', validate(listUsersSchema), asyncHandler(controller.users));
router.patch(
  '/users/:id/status',
  csrfProtection,
  validate(userStatusSchema),
  asyncHandler(controller.updateUser),
);
router.get('/drivers', validate(listDriversSchema), asyncHandler(controller.drivers));
router.patch(
  '/drivers/:id/approval',
  csrfProtection,
  validate(driverApprovalSchema),
  asyncHandler(controller.approveDriver),
);
router.get('/bookings', validate(listAdminBookingsSchema), asyncHandler(controller.bookings));
router.get('/reports', asyncHandler(controller.reports));
router.get('/fares', asyncHandler(controller.fares));
router.patch(
  '/fares/:id',
  csrfProtection,
  validate(fareUpdateSchema),
  asyncHandler(controller.updateFare),
);
router.get('/service-area', asyncHandler(controller.serviceArea));
router.put(
  '/service-area',
  csrfProtection,
  validate(serviceAreaUpdateSchema),
  asyncHandler(controller.updateServiceArea),
);

export default router;

