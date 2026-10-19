import mongoose from 'mongoose';
import {
  DRIVER_APPROVAL,
  DRIVER_AVAILABILITY,
} from '../../shared/constants.js';
import { pointSchema } from '../../shared/models/locationSchema.js';

const driverSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', default: null },
    approvalStatus: {
      type: String,
      enum: Object.values(DRIVER_APPROVAL),
      default: DRIVER_APPROVAL.PENDING,
    },
    availabilityStatus: {
      type: String,
      enum: Object.values(DRIVER_AVAILABILITY),
      default: DRIVER_AVAILABILITY.OFFLINE,
    },
    currentLocation: { type: pointSchema, default: null },
    lastLocationUpdate: { type: Date, default: null },
    currentRideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', default: null },
    totalCompletedBookings: { type: Number, default: 0, min: 0 },
    totalEarnings: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

driverSchema.index({ currentLocation: '2dsphere' }, { sparse: true });
driverSchema.index({ approvalStatus: 1, availabilityStatus: 1 });

export const Driver = mongoose.model('Driver', driverSchema);

