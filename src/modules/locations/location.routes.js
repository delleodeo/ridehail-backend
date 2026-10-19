import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../shared/utils/apiResponse.js';
import { searchLocations } from './location.service.js';
import { locationSearchSchema } from './location.validator.js';

const router = Router();
router.use(authenticate);
router.get(
  '/search',
  validate(locationSearchSchema),
  asyncHandler(async (req, res) =>
    sendSuccess(res, { locations: await searchLocations(req.validated.query.q) }),
  ),
);

export default router;

