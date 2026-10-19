import mongoose from "mongoose";
import { Booking } from "../bookings/booking.model.js";
import { Driver } from "./driver.model.js";
import { Vehicle } from "./vehicle.model.js";
import { bookingService } from "../bookings/booking.service.js";
import {
  ACTIVE_BOOKING_STATUSES,
  BOOKING_STATUS,
  DRIVER_APPROVAL,
  DRIVER_AVAILABILITY,
  RIDE_TYPE,
} from "../../shared/constants.js";
import { AppError, notFoundError } from "../../shared/errors/AppError.js";
import {
  hasMovedSignificantly,
  haversineDistanceKm,
} from "../../shared/utils/geo.js";
import { emitEphemeral } from "../../shared/events/outboxDispatcher.js";
import { env } from "../../config/env.js";
import { RoadsideSignal } from "../roadsideSignals/roadsideSignal.model.js";
import { buildActiveRoadsideSignalFilter } from "../roadsideSignals/roadsideSignal.repository.js";

export async function getDriverProfile(userId) {
  const driver = await Driver.findOne({ userId })
    .populate("userId", "firstName lastName email phone avatar")
    .populate("vehicleId")
    .populate("currentRideId")
    .lean();
  if (!driver) throw notFoundError("Driver profile");
  return driver;
}

export function toPublicNearbyDriver(driver, origin) {
  const distanceKm = haversineDistanceKm(origin, driver.currentLocation);
  return {
    id: String(driver._id),
    name: `${driver.userId.firstName} ${driver.userId.lastName}`,
    avatar: driver.userId.avatar ?? null,
    location: driver.currentLocation,
    distanceKm: Math.round(distanceKm * 10) / 10,
    completedBookings: driver.totalCompletedBookings,
    vehicle: {
      plateNumber: driver.vehicleId.plateNumber,
      bodyNumber: driver.vehicleId.bodyNumber,
      seats: driver.vehicleId.maximumPassengerCapacity,
    },
  };
}

export function buildNearbyAvailableDriverFilter(origin, radiusKm) {
  return {
    approvalStatus: DRIVER_APPROVAL.APPROVED,
    availabilityStatus: DRIVER_AVAILABILITY.AVAILABLE,
    currentRideId: null,
    currentLocation: mongoose.trusted({
      $near: {
        $geometry: origin,
        $maxDistance: radiusKm * 1000,
      },
    }),
  };
}

export async function getNearbyAvailableDrivers(
  coordinates,
  { limit = 10, radiusKm = 8 } = {},
) {
  const origin = { type: "Point", coordinates };
  const drivers = await Driver.find(
    buildNearbyAvailableDriverFilter(origin, radiusKm),
  )
    .populate("userId", "firstName lastName avatar")
    .populate({ path: "vehicleId", match: { vehicleStatus: "active" } })
    .limit(limit)
    .lean();

  return drivers
    .filter((driver) => driver.userId && driver.vehicleId)
    .map((driver) => toPublicNearbyDriver(driver, origin));
}

export async function updateAvailability(userId, status) {
  const driver = await Driver.findOne({ userId });
  if (!driver) throw notFoundError("Driver profile");
  if (status === DRIVER_AVAILABILITY.AVAILABLE) {
    if (driver.approvalStatus !== DRIVER_APPROVAL.APPROVED) {
      throw new AppError(
        "Your driver account must be approved before going online.",
        {
          statusCode: 403,
          code: "DRIVER_NOT_APPROVED",
        },
      );
    }
    if (!driver.vehicleId) {
      throw new AppError("Add an approved vehicle before going online.", {
        statusCode: 409,
        code: "VEHICLE_REQUIRED",
      });
    }
  }
  if (status === DRIVER_AVAILABILITY.OFFLINE && driver.currentRideId) {
    throw new AppError("Complete the active ride before going offline.", {
      statusCode: 409,
      code: "ACTIVE_RIDE_EXISTS",
    });
  }
  if (status === DRIVER_AVAILABILITY.OFFLINE) {
    const activeRoadsidePickup = await RoadsideSignal.exists(
      buildActiveRoadsideSignalFilter(driver._id),
    );
    if (activeRoadsidePickup) {
      throw new AppError(
        "Complete the active roadside pickup before going offline.",
        {
          statusCode: 409,
          code: "ACTIVE_ROADSIDE_PICKUP_EXISTS",
        },
      );
    }
  }
  driver.availabilityStatus = status;
  await driver.save();
  return driver.toObject();
}

export async function upsertVehicle(userId, input) {
  const driver = await Driver.findOne({ userId });
  if (!driver) throw notFoundError("Driver profile");
  if (driver.currentRideId) {
    throw new AppError(
      "Vehicle details cannot be changed during an active ride.",
      {
        statusCode: 409,
        code: "ACTIVE_RIDE_EXISTS",
      },
    );
  }
  const vehicle = await Vehicle.findOneAndUpdate(
    { driverId: driver._id },
    {
      $set: {
        plateNumber: input.plateNumber.toUpperCase(),
        bodyNumber: input.bodyNumber,
        maximumPassengerCapacity: input.maximumPassengerCapacity,
      },
      $setOnInsert: { driverId: driver._id, vehicleStatus: "active" },
    },
    { upsert: true, returnDocument: "after", runValidators: true },
  );
  driver.vehicleId = vehicle._id;
  await driver.save();
  return vehicle.toObject();
}

export async function updateLocation(userId, coordinates) {
  const driver = await Driver.findOne({ userId });
  if (!driver) throw notFoundError("Driver profile");
  const location = { type: "Point", coordinates };
  if (!hasMovedSignificantly(driver.currentLocation, location)) {
    return { driver: driver.toObject(), transmitted: false };
  }
  driver.currentLocation = location;
  driver.lastLocationUpdate = new Date();
  await driver.save();

  const bookings = await Booking.find({
    assignedDriverId: driver._id,
    status: mongoose.trusted({ $in: ACTIVE_BOOKING_STATUSES }),
  })
    .select("_id commuterId")
    .lean();
  const roadsideSignals = await RoadsideSignal.find(
    buildActiveRoadsideSignalFilter(driver._id),
  )
    .select("_id commuterId")
    .lean();
  const rooms = new Set([`driver:${driver._id}`, "admin"]);
  for (const booking of bookings) {
    rooms.add(`user:${booking.commuterId}`);
    rooms.add(`booking:${booking._id}`);
  }
  for (const signal of roadsideSignals) rooms.add(`user:${signal.commuterId}`);
  emitEphemeral([...rooms], "driver:location_updated", {
    driverId: String(driver._id),
    coordinates,
    recordedAt: driver.lastLocationUpdate,
  });
  return { driver: driver.toObject(), transmitted: true };
}

async function requireEligibleDriver(userId) {
  const driver = await Driver.findOne({
    userId,
    approvalStatus: DRIVER_APPROVAL.APPROVED,
    availabilityStatus: mongoose.trusted({
      $in: [DRIVER_AVAILABILITY.AVAILABLE, DRIVER_AVAILABILITY.ON_RIDE],
    }),
  })
    .populate("currentRideId")
    .populate("vehicleId", "maximumPassengerCapacity")
    .lean();
  if (!driver) {
    throw new AppError(
      "Go online with an approved driver account to view requests.",
      {
        statusCode: 403,
        code: "DRIVER_NOT_ELIGIBLE",
      },
    );
  }
  return driver;
}

export async function getAvailableBookings(userId) {
  const driver = await requireEligibleDriver(userId);
  if (driver.currentRideId?.rideType === RIDE_TYPE.NON_SHARED) return [];
  const roadsideSeats = await RoadsideSignal.countDocuments(
    buildActiveRoadsideSignalFilter(driver._id),
  );
  const maximumCapacity =
    driver.currentRideId?.maximumCapacity ??
    driver.vehicleId?.maximumPassengerCapacity ??
    0;
  const bookedSeats = driver.currentRideId?.occupiedSeats ?? 0;
  const availableSeats = maximumCapacity - bookedSeats - roadsideSeats;
  if (availableSeats <= 0) return [];
  const filter = {
    status: BOOKING_STATUS.SEARCHING,
    assignedDriverId: null,
    expiresAt: mongoose.trusted({ $gt: new Date() }),
    passengerCount: mongoose.trusted({ $lte: availableSeats }),
  };
  if (driver.currentRideId || roadsideSeats > 0) {
    filter.rideType = RIDE_TYPE.SHARED;
  }
  const bookings = await Booking.find(filter)
    .select(
      "rideType passengerCount pickupLocation dropoffLocation estimatedFare routeDistanceKm routeDurationMinutes routeGeometry status createdAt expiresAt",
    )
    .sort({ createdAt: 1 })
    .limit(50)
    .lean();
  if ((!driver.currentRideId && roadsideSeats === 0) || !driver.currentLocation)
    return bookings;
  return bookings.filter(
    (booking) =>
      haversineDistanceKm(driver.currentLocation, booking.pickupLocation) <=
      env.SHARED_ROUTE_COMPATIBILITY_KM,
  );
}

export async function getActiveAssignments(userId) {
  const driver = await Driver.findOne({ userId }).select("_id").lean();
  if (!driver) throw notFoundError("Driver profile");
  return Booking.find({
    assignedDriverId: driver._id,
    status: mongoose.trusted({ $in: ACTIVE_BOOKING_STATUSES }),
  })
    .populate("commuterId", "firstName lastName avatar")
    .sort({ acceptedAt: 1 })
    .lean();
}

export async function getEarnings(userId) {
  const driver = await Driver.findOne({ userId }).select(
    "totalEarnings totalCompletedBookings",
  );
  if (!driver) throw notFoundError("Driver profile");
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const daily = await Booking.aggregate([
    {
      $match: {
        assignedDriverId: driver._id,
        status: BOOKING_STATUS.COMPLETED,
        completedAt: { $gte: start },
      },
    },
    {
      $group: { _id: null, amount: { $sum: "$finalFare" }, count: { $sum: 1 } },
    },
  ]);
  return {
    totalEarnings: driver.totalEarnings,
    totalCompletedBookings: driver.totalCompletedBookings,
    todayEarnings: daily[0]?.amount ?? 0,
    todayCompletedBookings: daily[0]?.count ?? 0,
  };
}

export async function getBookingHistory(userId, { limit = 30 } = {}) {
  const driver = await Driver.findOne({ userId }).select("_id").lean();
  if (!driver) throw notFoundError("Driver profile");
  return Booking.find({ assignedDriverId: driver._id })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

export async function acceptBooking(bookingId, userId) {
  return bookingService.accept(bookingId, userId);
}

export async function markArriving(bookingId, userId) {
  return bookingService.transition(
    bookingId,
    userId,
    BOOKING_STATUS.DRIVER_ARRIVING,
  );
}

export async function markPickedUp(bookingId, userId) {
  return bookingService.transition(bookingId, userId, BOOKING_STATUS.PICKED_UP);
}

export async function completeBooking(bookingId, userId) {
  return bookingService.transition(bookingId, userId, BOOKING_STATUS.COMPLETED);
}
