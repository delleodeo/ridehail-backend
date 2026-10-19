import mongoose from 'mongoose';

export const pointSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator(value) {
          return (
            value.length === 2 &&
            value[0] >= -180 &&
            value[0] <= 180 &&
            value[1] >= -90 &&
            value[1] <= 90
          );
        },
        message: 'Coordinates must be [longitude, latitude].',
      },
    },
    label: { type: String, trim: true, maxlength: 180 },
    address: { type: String, trim: true, maxlength: 300 },
  },
  { _id: false },
);

