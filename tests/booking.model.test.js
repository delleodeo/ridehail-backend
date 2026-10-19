import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { Booking } from '../src/modules/bookings/booking.model.js';

function bookingWithRoute(routeGeometry) {
  return new Booking({
    commuterId: new mongoose.Types.ObjectId(),
    rideType: 'shared',
    passengerCount: 1,
    pickupLocation: { type: 'Point', coordinates: [121.2, 13.1], label: 'Pickup' },
    dropoffLocation: { type: 'Point', coordinates: [121.3, 13.2], label: 'Drop-off' },
    routeDistanceKm: 1.8,
    routeDurationMinutes: 6,
    routeGeometry,
    estimatedFare: 15,
    fareSettingsId: new mongoose.Types.ObjectId(),
    idempotencyKey: 'route-test-1',
  });
}

describe('booking route geometry', () => {
  it('accepts a valid GeoJSON LineString road route', async () => {
    const booking = bookingWithRoute({
      type: 'LineString',
      coordinates: [[121.2, 13.1], [121.25, 13.15], [121.3, 13.2]],
    });

    await expect(booking.validate()).resolves.toBeUndefined();
  });

  it('rejects route geometry without at least two valid coordinate pairs', async () => {
    const booking = bookingWithRoute({
      type: 'LineString',
      coordinates: [[121.2, 13.1]],
    });

    const error = await booking.validate().catch((validationError) => validationError);
    expect(error.errors).toHaveProperty('routeGeometry.coordinates');
  });
});
