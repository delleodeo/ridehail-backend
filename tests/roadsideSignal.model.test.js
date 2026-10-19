import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { RoadsideSignal } from '../src/modules/roadsideSignals/roadsideSignal.model.js';

function signal(overrides = {}) {
  return new RoadsideSignal({
    commuterId: new mongoose.Types.ObjectId(),
    location: {
      type: 'Point',
      coordinates: [121.2788, 13.1734],
      label: 'Current roadside location',
    },
    destinationNote: 'Public market entrance',
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    ...overrides,
  });
}

describe('RoadsideSignal model', () => {
  it('accepts a temporary waiting signal without booking or ride fields', async () => {
    const document = signal();
    await expect(document.validate()).resolves.toBeUndefined();
    expect(document.status).toBe('waiting');
    expect(document.toObject()).not.toHaveProperty('bookingId');
    expect(document.toObject()).not.toHaveProperty('rideId');
  });

  it('rejects invalid roadside coordinates', async () => {
    const document = signal({
      location: { type: 'Point', coordinates: [200, 13.1734], label: 'Invalid' },
    });
    const error = await document.validate().catch((validationError) => validationError);
    expect(error.errors).toHaveProperty('location.coordinates');
  });

  it('accepts a claimed pickup route while remaining separate from bookings and rides', async () => {
    const document = signal({
      status: 'claimed',
      claimedByDriverId: new mongoose.Types.ObjectId(),
      claimedAt: new Date(),
      pickupRouteDistanceKm: 1.4,
      pickupRouteDurationMinutes: 6,
      pickupRouteGeometry: {
        type: 'LineString',
        coordinates: [
          [121.27, 13.17],
          [121.2788, 13.1734],
        ],
      },
    });

    await expect(document.validate()).resolves.toBeUndefined();
    expect(document.toObject()).not.toHaveProperty('bookingId');
    expect(document.toObject()).not.toHaveProperty('rideId');
  });

  it('keeps a picked-up roadside passenger onboard without an expiry until drop-off', async () => {
    const document = signal({
      status: 'picked_up',
      claimedByDriverId: new mongoose.Types.ObjectId(),
      claimedAt: new Date(),
      pickedUpAt: new Date(),
      expiresAt: null,
    });

    await expect(document.validate()).resolves.toBeUndefined();
    expect(document.status).toBe('picked_up');
    expect(document.expiresAt).toBeNull();

    document.status = 'dropped_off';
    document.droppedOffAt = new Date();
    await expect(document.validate()).resolves.toBeUndefined();
  });
});
