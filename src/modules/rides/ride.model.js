import mongoose from 'mongoose';
import { RIDE_STATUS, RIDE_TYPE } from '../../shared/constants.js';

const rideSchema = new mongoose.Schema(
  {
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true, index: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    rideType: { type: String, enum: Object.values(RIDE_TYPE), required: true },
    bookingIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }],
    status: {
      type: String,
      enum: Object.values(RIDE_STATUS),
      default: RIDE_STATUS.ACTIVE,
      index: true,
    },
    maximumCapacity: { type: Number, required: true, min: 1 },
    occupiedSeats: { type: Number, required: true, min: 0 },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

rideSchema.index({ driverId: 1, status: 1 });

export const Ride = mongoose.model('Ride', rideSchema);

