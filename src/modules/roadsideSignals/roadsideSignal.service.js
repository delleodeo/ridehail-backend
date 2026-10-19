import mongoose from 'mongoose';
import { env } from '../../config/env.js';
import { Driver } from '../drivers/driver.model.js';
import { getRoadRoute, isInsideActiveServiceArea } from '../locations/location.service.js';
import {
  DRIVER_APPROVAL,
  DRIVER_AVAILABILITY,
  RIDE_STATUS,
  RIDE_TYPE,
} from '../../shared/constants.js';
import { AppError, notFoundError } from '../../shared/errors/AppError.js';
import { publishPendingEvents } from '../../shared/events/outboxDispatcher.js';
import { haversineDistanceKm } from '../../shared/utils/geo.js';
import {
  roadsideSignalRepository,
  toCommuterRoadsideSignal,
  toDriverRoadsideSignal,
} from './roadsideSignal.repository.js';

async function requireSharedPickupDriver(userId) {
  const driver = await Driver.findOne({
    userId,
    approvalStatus: DRIVER_APPROVAL.APPROVED,
    availabilityStatus: mongoose.trusted({
      $in: [DRIVER_AVAILABILITY.AVAILABLE, DRIVER_AVAILABILITY.ON_RIDE],
    }),
  })
    .select('_id currentLocation vehicleId currentRideId availabilityStatus')
    .populate('vehicleId', 'maximumPassengerCapacity vehicleStatus')
    .populate('currentRideId', 'rideType status maximumCapacity occupiedSeats')
    .lean();
  if (!driver) {
    throw new AppError('Only an approved, online driver can manage roadside commuters.', {
      statusCode: 403,
      code: 'DRIVER_NOT_AVAILABLE',
    });
  }
  if (!driver.vehicleId || driver.vehicleId.vehicleStatus !== 'active') {
    throw new AppError('An active vehicle is required for roadside pickups.', {
      statusCode: 409,
      code: 'ACTIVE_VEHICLE_REQUIRED',
    });
  }
  if (
    driver.currentRideId &&
    (driver.currentRideId.status !== RIDE_STATUS.ACTIVE ||
      driver.currentRideId.rideType !== RIDE_TYPE.SHARED)
  ) {
    throw new AppError('Roadside passengers can only join a shared ride.', {
      statusCode: 409,
      code: 'NON_SHARED_RIDE_ACTIVE',
    });
  }
  if (!driver.currentLocation?.coordinates) {
    throw new AppError('Share your current location before viewing roadside commuters.', {
      statusCode: 409,
      code: 'DRIVER_LOCATION_REQUIRED',
    });
  }
  return driver;
}

async function getAvailableSeatCount(driver) {
  const roadsideSeats = await roadsideSignalRepository.countActiveByDriver(driver._id);
  const bookedSeats = driver.currentRideId?.occupiedSeats ?? 0;
  const maximumCapacity =
    driver.currentRideId?.maximumCapacity ?? driver.vehicleId.maximumPassengerCapacity;
  return Math.max(0, maximumCapacity - roadsideSeats - bookedSeats);
}

async function requireApprovedDriver(userId) {
  const driver = await Driver.findOne({
    userId,
    approvalStatus: DRIVER_APPROVAL.APPROVED,
  })
    .select('_id currentLocation')
    .lean();
  if (!driver) {
    throw new AppError('Only an approved driver can manage roadside pickups.', {
      statusCode: 403,
      code: 'DRIVER_NOT_APPROVED',
    });
  }
  return driver;
}

export async function publishRoadsideSignal(commuterId, input) {
  if (!(await isInsideActiveServiceArea(input.location))) {
    throw new AppError('Your roadside location must be inside the configured service area.', {
      statusCode: 422,
      code: 'OUTSIDE_SERVICE_AREA',
    });
  }
  let signal;
  try {
    signal = await roadsideSignalRepository.publish({
      commuterId,
      ...input,
      expiresAt: new Date(Date.now() + env.ROADSIDE_SIGNAL_TTL_MINUTES * 60 * 1000),
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError('Your roadside ride is active. Wait for drop-off before adding a note.', {
        statusCode: 409,
        code: 'ACTIVE_ROADSIDE_RIDE_EXISTS',
      });
    }
    throw error;
  }
  await publishPendingEvents({ aggregateId: signal._id });
  return toCommuterRoadsideSignal(signal);
}

export async function getMyActiveRoadsideSignal(commuterId) {
  const signal = await roadsideSignalRepository.findActiveForCommuter(commuterId);
  return toCommuterRoadsideSignal(signal);
}

export async function stopRoadsideSignal(commuterId) {
  const signal = await roadsideSignalRepository.stop(commuterId);
  if (signal) await publishPendingEvents({ aggregateId: signal._id });
  return signal;
}

export async function getNearbyRoadsideSignals(driverUserId) {
  const driver = await requireSharedPickupDriver(driverUserId);
  if ((await roadsideSignalRepository.listClaimedByDriver(driver._id)).length) return [];
  if ((await getAvailableSeatCount(driver)) === 0) return [];
  const signals = await roadsideSignalRepository.listNearby(
    driver.currentLocation,
    env.ROADSIDE_SIGNAL_RADIUS_KM,
  );
  return signals.map(toDriverRoadsideSignal);
}

export async function getActiveRoadsideSignals(driverUserId) {
  const driver = await requireApprovedDriver(driverUserId);
  const signals = await roadsideSignalRepository.listActiveByDriver(driver._id);
  return signals.map(toDriverRoadsideSignal);
}

export const getClaimedRoadsideSignals = getActiveRoadsideSignals;

export async function claimRoadsideCommuter(signalId, driverUserId) {
  const driver = await requireSharedPickupDriver(driverUserId);
  const existingClaim = await roadsideSignalRepository.listClaimedByDriver(driver._id);
  if (existingClaim.length) {
    throw new AppError('Finish your active roadside pickup before claiming another commuter.', {
      statusCode: 409,
      code: 'ACTIVE_ROADSIDE_PICKUP_EXISTS',
    });
  }
  if ((await getAvailableSeatCount(driver)) === 0) {
    throw new AppError('Your tricycle is full. Drop off a passenger before adding another.', {
      statusCode: 409,
      code: 'RIDE_CAPACITY_EXCEEDED',
    });
  }
  const signal = await roadsideSignalRepository.findActiveById(signalId);
  if (!signal) throw notFoundError('Active roadside signal');
  if (
    haversineDistanceKm(driver.currentLocation, signal.location) >
    env.ROADSIDE_SIGNAL_RADIUS_KM
  ) {
    throw new AppError('This roadside commuter is outside your nearby service radius.', {
      statusCode: 409,
      code: 'ROADSIDE_SIGNAL_NOT_NEARBY',
    });
  }
  const route = await getRoadRoute(driver.currentLocation, signal.location);
  let claimed;
  try {
    claimed = await roadsideSignalRepository.claim({
      signalId,
      driverId: driver._id,
      route,
      expiresAt: new Date(Date.now() + env.ROADSIDE_PICKUP_TTL_MINUTES * 60 * 1000),
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError('Finish your active roadside pickup before claiming another commuter.', {
        statusCode: 409,
        code: 'ACTIVE_ROADSIDE_PICKUP_EXISTS',
      });
    }
    throw error;
  }
  if (!claimed) {
    throw new AppError('This roadside commuter is no longer waiting.', {
      statusCode: 409,
      code: 'ROADSIDE_SIGNAL_UNAVAILABLE',
    });
  }
  await publishPendingEvents({ aggregateId: claimed._id });
  return claimed;
}

export async function markRoadsidePassengerPickedUp(signalId, driverUserId) {
  const driver = await requireApprovedDriver(driverUserId);
  const pickedUp = await roadsideSignalRepository.markPickedUp({
    signalId,
    driverId: driver._id,
  });
  if (!pickedUp) {
    throw new AppError('This roadside pickup is no longer active or belongs to another driver.', {
      statusCode: 409,
      code: 'ROADSIDE_PICKUP_UNAVAILABLE',
    });
  }
  await publishPendingEvents({ aggregateId: pickedUp._id });
  return pickedUp;
}

export async function dropOffRoadsidePassenger(signalId, driverUserId) {
  const driver = await requireApprovedDriver(driverUserId);
  const droppedOff = await roadsideSignalRepository.dropOff({
    signalId,
    driverId: driver._id,
  });
  if (!droppedOff) {
    throw new AppError('This passenger is not onboard or belongs to another driver.', {
      statusCode: 409,
      code: 'ROADSIDE_DROPOFF_UNAVAILABLE',
    });
  }
  await publishPendingEvents({ aggregateId: droppedOff._id });
  return droppedOff;
}
