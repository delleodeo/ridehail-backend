import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { csrfProtection } from '../../middlewares/csrf.js';
import { validate } from '../../middlewares/validate.js';
import { ROLES } from '../../shared/constants.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import * as controller from './driver.controller.js';
import {
  availabilitySchema,
  driverBookingSchema,
  locationUpdateSchema,
  nearbyDriversSchema,
  vehicleSchema,
} from './driver.validator.js';

const router = Router();
router.use(authenticate);
router.get(
  '/nearby',
  authorize(ROLES.COMMUTER),
  validate(nearbyDriversSchema),
  asyncHandler(controller.nearby),
);
router.use(authorize(ROLES.DRIVER));

router.get('/me', asyncHandler(controller.getMe));
router.patch(
  '/availability',
  csrfProtection,
  validate(availabilitySchema),
  asyncHandler(controller.updateAvailability),
);
router.put(
  '/vehicle',
  csrfProtection,
  validate(vehicleSchema),
  asyncHandler(controller.upsertVehicle),
);
router.patch(
  '/location',
  csrfProtection,
  validate(locationUpdateSchema),
  asyncHandler(controller.updateLocation),
);
router.get('/available-bookings', asyncHandler(controller.availableBookings));
router.get('/active-assignments', asyncHandler(controller.activeAssignments));
router.get('/history', asyncHandler(controller.history));
router.get('/earnings', asyncHandler(controller.earnings));
router.post(
  '/bookings/:id/accept',
  csrfProtection,
  validate(driverBookingSchema),
  asyncHandler(controller.accept),
);
router.post(
  '/bookings/:id/arriving',
  csrfProtection,
  validate(driverBookingSchema),
  asyncHandler(controller.arriving),
);
router.post(
  '/bookings/:id/pickup',
  csrfProtection,
  validate(driverBookingSchema),
  asyncHandler(controller.pickup),
);
router.post(
  '/bookings/:id/complete',
  csrfProtection,
  validate(driverBookingSchema),
  asyncHandler(controller.complete),
);

export default router;

