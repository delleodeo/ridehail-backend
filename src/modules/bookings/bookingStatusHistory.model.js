import mongoose from 'mongoose';
import { BOOKING_STATUS } from '../../shared/constants.js';

const bookingStatusHistorySchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    previousStatus: { type: String, enum: [...Object.values(BOOKING_STATUS), null], default: null },
    newStatus: { type: String, enum: Object.values(BOOKING_STATUS), required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorRole: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    reason: { type: String, maxlength: 300, default: null },
  },
  { timestamps: false },
);

bookingStatusHistorySchema.index({ bookingId: 1, timestamp: 1 });

export const BookingStatusHistory = mongoose.model(
  'BookingStatusHistory',
  bookingStatusHistorySchema,
);

