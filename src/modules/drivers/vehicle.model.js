import mongoose from 'mongoose';

const vehicleSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      required: true,
      unique: true,
    },
    plateNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    bodyNumber: { type: String, required: true, unique: true, trim: true },
    maximumPassengerCapacity: { type: Number, required: true, min: 1, max: 8, default: 3 },
    vehicleStatus: {
      type: String,
      enum: ['active', 'maintenance', 'suspended'],
      default: 'active',
    },
  },
  { timestamps: true },
);

export const Vehicle = mongoose.model('Vehicle', vehicleSchema);

