import mongoose from 'mongoose';
import { ROADSIDE_SIGNAL_STATUS } from '../../shared/constants.js';
import { pointSchema } from '../../shared/models/locationSchema.js';

const routeGeometrySchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['LineString'], required: true },
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
        message: 'Pickup route must contain valid [longitude, latitude] pairs.',
      },
    },
  },
  { _id: false },
);

const roadsideSignalSchema = new mongoose.Schema(
  {
    commuterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    location: { type: pointSchema, required: true },
    destinationNote: { type: String, required: true, trim: true, minlength: 2, maxlength: 180 },
    status: {
      type: String,
      enum: Object.values(ROADSIDE_SIGNAL_STATUS),
      default: ROADSIDE_SIGNAL_STATUS.WAITING,
      index: true,
    },
    claimedByDriverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      default: null,
    },
    claimedAt: { type: Date, default: null },
    pickupRouteDistanceKm: { type: Number, min: 0, default: null },
    pickupRouteDurationMinutes: { type: Number, min: 0, default: null },
    pickupRouteGeometry: { type: routeGeometrySchema, default: null },
    pickedUpAt: { type: Date, default: null },
    droppedOffAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

roadsideSignalSchema.index({ location: '2dsphere' });
roadsideSignalSchema.index({ status: 1, expiresAt: 1 });
roadsideSignalSchema.index(
  { claimedByDriverId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: ROADSIDE_SIGNAL_STATUS.CLAIMED },
  },
);
roadsideSignalSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RoadsideSignal = mongoose.model('RoadsideSignal', roadsideSignalSchema);
