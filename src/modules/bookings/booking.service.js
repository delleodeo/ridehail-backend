import { randomUUID } from "node:crypto";
import { Driver } from "../drivers/driver.model.js";
import { RoadsideSignal } from "../roadsideSignals/roadsideSignal.model.js";
import { buildActiveCommuterRoadsideSignalFilter } from "../roadsideSignals/roadsideSignal.repository.js";
import { BOOKING_STATUS, ROLES } from "../../shared/constants.js";
import { AppError, notFoundError } from "../../shared/errors/AppError.js";
import { publishPendingEvents } from "../../shared/events/outboxDispatcher.js";
import { estimateFare } from "../fares/fare.service.js";
import {
  assertLocationsInServiceArea,
  getRoadRoute,
} from "../locations/location.service.js";
import { bookingRepository } from "./booking.repository.js";

async function hasActiveRoadsideRide(commuterId) {
  return Boolean(
    await RoadsideSignal.exists(
      buildActiveCommuterRoadsideSignalFilter(commuterId),
    ),
  );
}

export class BookingService {
  constructor({
    repository = bookingRepository,
    fareEstimator = estimateFare,
    serviceAreaValidator = assertLocationsInServiceArea,
    routeProvider = getRoadRoute,
    eventPublisher = publishPendingEvents,
    roadsidePickupChecker = hasActiveRoadsideRide,
  } = {}) {
    this.repository = repository;
    this.fareEstimator = fareEstimator;
    this.serviceAreaValidator = serviceAreaValidator;
    this.routeProvider = routeProvider;
    this.eventPublisher = eventPublisher;
    this.roadsidePickupChecker = roadsidePickupChecker;
  }

  async estimate(input) {
    await this.serviceAreaValidator(
      input.pickupLocation,
      input.dropoffLocation,
    );
    const route = await this.routeProvider(
      input.pickupLocation,
      input.dropoffLocation,
    );
    const fare = await this.fareEstimator(input.rideType, route.distanceKm);
    return { route, fare };
  }

  async create(input, { commuterId, idempotencyKey }) {
    if (await this.roadsidePickupChecker(commuterId)) {
      throw new AppError(
        "Complete your roadside passenger drop-off before booking another ride.",
        {
          statusCode: 409,
          code: "ACTIVE_ROADSIDE_PICKUP_EXISTS",
        },
      );
    }
    const { route, fare } = await this.estimate(input);
    const result = await this.repository.create({
      ...input,
      commuterId,
      idempotencyKey: idempotencyKey || randomUUID(),
      routeDistanceKm: route.distanceKm,
      routeDurationMinutes: route.durationMinutes,
      routeGeometry: route.geometry,
      estimatedFare: fare.amount,
      fareSettingsId: fare.fareSettingsId,
      status: BOOKING_STATUS.SEARCHING,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    if (result.created)
      await this.eventPublisher({ aggregateId: result.booking._id });
    return { ...result, route };
  }

  async listForCommuter(commuterId, pagination) {
    return this.repository.listForCommuter(commuterId, pagination);
  }

  async getAuthorized(bookingId, auth) {
    const booking = await this.repository.findById(bookingId);
    if (!booking) throw notFoundError("Booking");
    if (auth.role === ROLES.ADMIN) return booking;
    const commuterId = booking.commuterId?._id ?? booking.commuterId;
    if (auth.role === ROLES.COMMUTER && String(commuterId) === auth.userId) {
      return booking;
    }
    if (auth.role === ROLES.DRIVER) {
      const driver = await Driver.findOne({ userId: auth.userId })
        .select("_id")
        .lean();
      const assignedId =
        booking.assignedDriverId?._id ?? booking.assignedDriverId;
      if (driver && String(assignedId) === String(driver._id)) return booking;
    }
    throw new AppError("You do not have access to this booking.", {
      statusCode: 403,
      code: "FORBIDDEN",
    });
  }

  async cancel(bookingId, commuterId, reason) {
    const booking = await this.repository.cancel({
      bookingId,
      commuterId,
      reason,
    });
    await this.eventPublisher({ aggregateId: booking._id });
    return booking;
  }

  async accept(bookingId, driverUserId) {
    const booking = await this.repository.acceptAtomically({
      bookingId,
      driverUserId,
    });
    await this.eventPublisher({ aggregateId: booking._id });
    return booking;
  }

  async transition(bookingId, driverUserId, targetStatus) {
    const booking = await this.repository.transitionByDriver({
      bookingId,
      driverUserId,
      targetStatus,
    });
    await this.eventPublisher({ aggregateId: booking._id });
    return booking;
  }
}

export const bookingService = new BookingService();
