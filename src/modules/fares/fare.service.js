import mongoose from 'mongoose';
import { FareSettings } from './fareSettings.model.js';
import { AppError } from '../../shared/errors/AppError.js';

export function calculateFare(settings, distanceKm) {
  if (distanceKm == null) return settings.minimumFare;
  const billableDistance = Math.max(0, distanceKm - settings.baseDistanceKm);
  const rawFare = settings.baseFare + billableDistance * settings.perKilometerRate;
  const discounted = rawFare * (1 - (settings.sharedPassengerDiscountRate ?? 0));
  return Math.ceil(Math.max(settings.minimumFare, discounted));
}

export function buildActiveFareSettingsFilter(rideType, now = new Date()) {
  return {
    rideType,
    isActive: true,
    effectiveFrom: mongoose.trusted({ $lte: now }),
  };
}

export async function getActiveFareSettings(rideType, { session } = {}) {
  const query = FareSettings.findOne(buildActiveFareSettingsFilter(rideType)).sort({
    effectiveFrom: -1,
  });
  if (session) query.session(session);
  const settings = await query.lean();
  if (!settings) {
    throw new AppError('Fare settings are not configured for this ride type.', {
      statusCode: 503,
      code: 'FARE_NOT_CONFIGURED',
    });
  }
  return settings;
}

export async function estimateFare(rideType, distanceKm) {
  const settings = await getActiveFareSettings(rideType);
  return {
    amount: calculateFare(settings, distanceKm),
    currency: 'PHP',
    fareSettingsId: settings._id,
  };
}

