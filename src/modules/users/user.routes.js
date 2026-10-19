import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { csrfProtection } from '../../middlewares/csrf.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../shared/utils/apiResponse.js';
import { notFoundError } from '../../shared/errors/AppError.js';
import { User } from './user.model.js';
import { updateProfileSchema } from './user.validator.js';

const router = Router();
router.use(authenticate);
router.patch(
  '/me',
  csrfProtection,
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findByIdAndUpdate(
      req.auth.userId,
      { $set: req.validated.body },
      { returnDocument: 'after', runValidators: true },
    ).lean();
    if (!user) throw notFoundError('User');
    return sendSuccess(res, { user });
  }),
);

export default router;

