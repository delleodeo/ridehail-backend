import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import {
  buildActiveFareSettingsFilter,
  calculateFare,
} from '../src/modules/fares/fare.service.js';

describe('fare service', () => {
  it('preserves the server-owned effective date selector when filters are sanitized', () => {
    const now = new Date('2026-10-19T00:00:00.000Z');
    const filter = buildActiveFareSettingsFilter('shared', now);

    mongoose.sanitizeFilter(filter);

    expect(filter).toMatchObject({
      rideType: 'shared',
      isActive: true,
      effectiveFrom: { $lte: now },
    });
    expect(filter.effectiveFrom).not.toHaveProperty('$eq');
  });

  it('uses the minimum fare when routing is unavailable', () => {
    expect(
      calculateFare(
        {
          minimumFare: 15,
          baseFare: 18,
          baseDistanceKm: 2,
          perKilometerRate: 4,
          sharedPassengerDiscountRate: 0.2,
        },
        null,
      ),
    ).toBe(15);
  });
});
