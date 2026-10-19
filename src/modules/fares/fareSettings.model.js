import mongoose from 'mongoose';
import { RIDE_TYPE } from '../../shared/constants.js';

const fareSettingsSchema = new mongoose.Schema(
  {
    rideType: { type: String, enum: Object.values(RIDE_TYPE), required: true, index: true },
    minimumFare: { type: Number, required: true, min: 0 },
    baseFare: { type: Number, required: true, min: 0 },
    baseDistanceKm: { type: Number, required: true, min: 0, default: 1 },
    perKilometerRate: { type: Number, required: true, min: 0 },
    sharedPassengerDiscountRate: { type: Number, min: 0, max: 0.8, default: 0 },
    effectiveFrom: { type: Date, required: true, default: Date.now },
    isActive: { type: Boolean, default: true, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

fareSettingsSchema.index({ rideType: 1, isActive: 1, effectiveFrom: -1 });

export const FareSettings = mongoose.model('FareSettings', fareSettingsSchema);

