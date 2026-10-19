import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { csrfProtection } from '../../middlewares/csrf.js';
import { validate } from '../../middlewares/validate.js';
import { ROLES } from '../../shared/constants.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import * as controller from './roadsideSignal.controller.js';
import {
  emptyRoadsideSignalSchema,
  publishRoadsideSignalSchema,
  roadsideSignalIdSchema,
} from './roadsideSignal.validator.js';

const router = Router();
router.use(authenticate);

router.get(
  '/mine',
  authorize(ROLES.COMMUTER),
  validate(emptyRoadsideSignalSchema),
  asyncHandler(controller.mine),
);
router.put(
  '/mine',
  authorize(ROLES.COMMUTER),
  csrfProtection,
  validate(publishRoadsideSignalSchema),
  asyncHandler(controller.publish),
);
router.delete(
  '/mine',
  authorize(ROLES.COMMUTER),
  csrfProtection,
  validate(emptyRoadsideSignalSchema),
  asyncHandler(controller.stop),
);
router.get(
  '/nearby',
  authorize(ROLES.DRIVER),
  validate(emptyRoadsideSignalSchema),
  asyncHandler(controller.nearby),
);
router.get(
  '/active',
  authorize(ROLES.DRIVER),
  validate(emptyRoadsideSignalSchema),
  asyncHandler(controller.active),
);
router.get(
  '/claimed',
  authorize(ROLES.DRIVER),
  validate(emptyRoadsideSignalSchema),
  asyncHandler(controller.claimed),
);
router.post(
  '/:id/claim',
  authorize(ROLES.DRIVER),
  csrfProtection,
  validate(roadsideSignalIdSchema),
  asyncHandler(controller.claim),
);
router.post(
  '/:id/pickup',
  authorize(ROLES.DRIVER),
  csrfProtection,
  validate(roadsideSignalIdSchema),
  asyncHandler(controller.pickup),
);
router.post(
  '/:id/dropoff',
  authorize(ROLES.DRIVER),
  csrfProtection,
  validate(roadsideSignalIdSchema),
  asyncHandler(controller.dropoff),
);

export default router;
