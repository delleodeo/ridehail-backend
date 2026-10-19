import mongoose from 'mongoose';
import { BOOKING_STATUS, RIDE_TYPE } from '../../shared/constants.js';
import { pointSchema } from '../../shared/models/locationSchema.js';

const routeGeometrySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['LineString'],
      required: true,
    },
    coordinates: {
      type: [[Number]],
      required: true,
      validate: {
        validator(value) {
          return (
            Array.isArray(value) &&
            value.length >= 2 &&
            value.every(
              (coordinate) =>
                Array.isArray(coordinate) &&
                coordinate.length === 2 &&
                coordinate[0] >= -180 &&
                coordinate[0] <= 180 &&
                coordinate[1] >= -90 &&
                coordinate[1] <= 90,
            )
          );
        },
        message: 'Route coordinates must contain valid [longitude, latitude] pairs.',
      },
    },
  },
  { _id: false },
);

const bookingSchema = new mongoose.Schema(
  {
    commuterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    assignedDriverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      default: null,
      index: true,
    },
    rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', default: null, index: true },
    rideType: { type: String, enum: Object.values(RIDE_TYPE), required: true },
    passengerCount: { type: Number, required: true, min: 1, max: 8 },
    pickupLocation: { type: pointSchema, required: true },
    dropoffLocation: { type: pointSchema, required: true },
    routeDistanceKm: { type: Number, min: 0, default: null },
    routeDurationMinutes: { type: Number, min: 0, default: null },
    routeGeometry: { type: routeGeometrySchema, default: null },
    estimatedFare: { type: Number, required: true, min: 0 },
    finalFare: { type: Number, min: 0, default: null },
    fareSettingsId: { type: mongoose.Schema.Types.ObjectId, ref: 'FareSettings', required: true },
    status: {
      type: String,
      enum: Object.values(BOOKING_STATUS),
      default: BOOKING_STATUS.SEARCHING,
      index: true,
    },
    acceptedAt: { type: Date, default: null },
    arrivingAt: { type: Date, default: null },
    pickedUpAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    cancellationReason: { type: String, maxlength: 300, default: null },
    idempotencyKey: { type: String, required: true, maxlength: 100 },
  },
  { timestamps: true },
);

bookingSchema.index({ pickupLocation: '2dsphere' });
bookingSchema.index({ dropoffLocation: '2dsphere' });
bookingSchema.index({ commuterId: 1, idempotencyKey: 1 }, { unique: true });
bookingSchema.index({ status: 1, rideType: 1, createdAt: -1 });
bookingSchema.index({ assignedDriverId: 1, status: 1 });

export const Booking = mongoose.model('Booking', bookingSchema);

