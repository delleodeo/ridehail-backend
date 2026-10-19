import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import {
  buildNearbyAvailableDriverFilter,
  toPublicNearbyDriver,
} from '../src/modules/drivers/driver.service.js';

describe('nearby driver public projection', () => {
  it('returns useful availability data without exposing private account fields', () => {
    const result = toPublicNearbyDriver(
      {
        _id: 'driver-1',
        userId: {
          firstName: 'Juan',
          lastName: 'Dela Cruz',
          avatar: null,
          email: 'private@example.com',
          phone: '+639170000003',
        },
        currentLocation: { type: 'Point', coordinates: [121.279, 13.174] },
        totalCompletedBookings: 98,
        totalEarnings: 5000,
        vehicleId: {
          plateNumber: 'RYD-1001',
          bodyNumber: 'VIC-001',
          maximumPassengerCapacity: 3,
        },
      },
      { type: 'Point', coordinates: [121.2788, 13.1734] },
    );

    expect(result).toMatchObject({
      id: 'driver-1',
      name: 'Juan Dela Cruz',
      completedBookings: 98,
      vehicle: { plateNumber: 'RYD-1001', bodyNumber: 'VIC-001', seats: 3 },
    });
    expect(result.distanceKm).toBeGreaterThanOrEqual(0);
    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('phone');
    expect(result).not.toHaveProperty('totalEarnings');
  });

  it('preserves the server-owned nearby selector when filters are sanitized', () => {
    const origin = { type: 'Point', coordinates: [121.2788, 13.1734] };
    const filter = buildNearbyAvailableDriverFilter(origin, 8);

    mongoose.sanitizeFilter(filter);

    expect(filter.currentLocation).toMatchObject({
      $near: {
        $geometry: origin,
        $maxDistance: 8000,
      },
    });
    expect(filter.currentLocation).not.toHaveProperty('$eq');
  });
});
