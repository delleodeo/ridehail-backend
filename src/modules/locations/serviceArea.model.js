import mongoose from 'mongoose';

const serviceAreaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    geometry: {
      type: {
        type: String,
        enum: ['Polygon', 'MultiPolygon'],
        required: true,
      },
      coordinates: { type: mongoose.Schema.Types.Mixed, required: true },
    },
    isActive: { type: Boolean, default: true, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

serviceAreaSchema.index({ geometry: '2dsphere' });

export const ServiceArea = mongoose.model('ServiceArea', serviceAreaSchema);

