import mongoose from 'mongoose';
import { ACCOUNT_STATUS, ROLES } from '../../shared/constants.js';

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, trim: true, lowercase: true, sparse: true, unique: true },
    phone: { type: String, trim: true, sparse: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), required: true },
    avatar: { type: String, default: null },
    accountStatus: {
      type: String,
      enum: Object.values(ACCOUNT_STATUS),
      default: ACCOUNT_STATUS.ACTIVE,
    },
  },
  { timestamps: true },
);

userSchema.index({ role: 1, accountStatus: 1 });
userSchema.set('toJSON', {
  transform(_document, value) {
    delete value.passwordHash;
    delete value.__v;
    return value;
  },
});

export const User = mongoose.model('User', userSchema);

