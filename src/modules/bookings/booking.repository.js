import mongoose from "mongoose";
import { logger } from "../../config/logger.js";
import { env } from "../../config/env.js";
import { Driver } from "../drivers/driver.model.js";
import { Vehicle } from "../drivers/vehicle.model.js";
import { Ride } from "../rides/ride.model.js";
import { RoadsideSignal } from "../roadsideSignals/roadsideSignal.model.js";
import { buildActiveRoadsideSignalFilter } from "../roadsideSignals/roadsideSignal.repository.js";
import { Booking } from "./booking.model.js";
import { BookingStatusHistory } from "./bookingStatusHistory.model.js";
import { OutboxEvent } from "../../shared/events/outboxEvent.model.js";
import { Notification } from "../notifications/notification.model.js";
import {
  ACTIVE_BOOKING_STATUSES,
  BOOKING_STATUS,
  DRIVER_APPROVAL,
  DRIVER_AVAILABILITY,
  RIDE_STATUS,
  RIDE_TYPE,
} from "../../shared/constants.js";
import { AppError, notFoundError } from "../../shared/errors/AppError.js";
import { haversineDistanceKm } from "../../shared/utils/geo.js";
import {
  assertBookingCompatibleWithRoadsidePassengers,
  assertRideCanAcceptBooking,
  assertTransition,
} from "./booking.policy.js";

function bookingPayload(booking) {
  return {
    bookingId: String(booking._id),
    status: booking.status,
    rideType: booking.rideType,
    assignedDriverId: booking.assignedDriverId
      ? String(booking.assignedDriverId)
      : null,
  };
}

async function addOutboxEvents(events, session) {
  await OutboxEvent.insertMany(events, { session });
}

export async function createAcceptanceNotifications({
  booking,
  driver,
  session,
  notificationModel = Notification,
}) {
  return notificationModel.create(
    [
      {
        userId: booking.commuterId,
        type: "booking_accepted",
        title: "Driver found",
        message:
          "A driver accepted your booking and is preparing to pick you up.",
        data: { bookingId: booking._id },
      },
      {
        userId: driver.userId,
        type: "booking_assigned",
        title: "Booking assigned",
        message: "The booking is now assigned to you.",
        data: { bookingId: booking._id },
      },
    ],
    { session, ordered: true },
  );
}

function historyRecord(
  booking,
  previousStatus,
  newStatus,
  changedBy,
  actorRole,
  reason,
) {
  return {
    bookingId: booking._id,
    previousStatus,
    newStatus,
    changedBy,
    actorRole,
    reason,
  };
}

export const bookingRepository = {
  async create(input) {
    const existing = await Booking.findOne({
      commuterId: input.commuterId,
      idempotencyKey: input.idempotencyKey,
    }).lean();
    if (existing) return { booking: existing, created: false };

    let created;
    try {
      await mongoose.connection.transaction(async (session) => {
        const activeBooking = await Booking.exists({
          commuterId: input.commuterId,
          status: mongoose.trusted({
            $in: [BOOKING_STATUS.SEARCHING, ...ACTIVE_BOOKING_STATUSES],
          }),
        }).session(session);
        if (activeBooking) {
          throw new AppError(
            "Finish or cancel your active booking before creating another.",
            {
              statusCode: 409,
              code: "ACTIVE_BOOKING_EXISTS",
            },
          );
        }

        const [booking] = await Booking.create([input], { session });
        await BookingStatusHistory.create(
          [
            historyRecord(
              booking,
              null,
              BOOKING_STATUS.SEARCHING,
              input.commuterId,
              "commuter",
            ),
          ],
          { session },
        );
        await addOutboxEvents(
          [
            {
              eventType: "booking:new",
              aggregateType: "booking",
              aggregateId: booking._id,
              rooms: [
                "drivers:available:victoria",
                ...(booking.rideType === RIDE_TYPE.SHARED
                  ? ["drivers:shared:victoria"]
                  : []),
              ],
              payload: {
                ...bookingPayload(booking),
                pickupLocation: booking.pickupLocation,
                dropoffLabel: booking.dropoffLocation.label,
                passengerCount: booking.passengerCount,
                estimatedFare: booking.estimatedFare,
              },
            },
            {
              eventType: "admin:booking_updated",
              aggregateType: "booking",
              aggregateId: booking._id,
              rooms: ["admin"],
              payload: bookingPayload(booking),
            },
          ],
          session,
        );
        created = booking.toObject();
      });
      return { booking: created, created: true };
    } catch (error) {
      if (error?.code === 11000) {
        const booking = await Booking.findOne({
          commuterId: input.commuterId,
          idempotencyKey: input.idempotencyKey,
        }).lean();
        if (booking) return { booking, created: false };
      }
      throw error;
    }
  },

  async listForCommuter(commuterId, { page = 1, limit = 20 } = {}) {
    const filter = { commuterId };
    const [items, total] = await Promise.all([
      Booking.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({
          path: "assignedDriverId",
          select: "userId vehicleId currentLocation",
          populate: [
            { path: "userId", select: "firstName lastName avatar" },
            { path: "vehicleId", select: "plateNumber bodyNumber" },
          ],
        })
        .lean(),
      Booking.countDocuments(filter),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  },

  async findById(bookingId) {
    return Booking.findById(bookingId)
      .populate("commuterId", "firstName lastName avatar")
      .populate({
        path: "assignedDriverId",
        select: "userId vehicleId currentLocation lastLocationUpdate",
        populate: [
          { path: "userId", select: "firstName lastName avatar" },
          {
            path: "vehicleId",
            select: "plateNumber bodyNumber maximumPassengerCapacity",
          },
        ],
      })
      .lean();
  },

  async cancel({ bookingId, commuterId, reason }) {
    let cancelled;
    await mongoose.connection.transaction(async (session) => {
      const booking = await Booking.findOneAndUpdate(
        {
          _id: bookingId,
          commuterId,
          status: BOOKING_STATUS.SEARCHING,
          assignedDriverId: null,
        },
        {
          $set: {
            status: BOOKING_STATUS.CANCELLED,
            cancelledAt: new Date(),
            cancellationReason: reason ?? "Cancelled by commuter",
          },
        },
        { returnDocument: "after", session },
      );
      if (!booking) {
        const existing = await Booking.findOne({
          _id: bookingId,
          commuterId,
        }).session(session);
        if (!existing) throw notFoundError("Booking");
        throw new AppError(
          "This booking can no longer be cancelled in the app.",
          {
            statusCode: 409,
            code: "BOOKING_CANNOT_CANCEL",
          },
        );
      }
      await BookingStatusHistory.create(
        [
          historyRecord(
            booking,
            BOOKING_STATUS.SEARCHING,
            BOOKING_STATUS.CANCELLED,
            commuterId,
            "commuter",
            reason,
          ),
        ],
        { session },
      );
      await addOutboxEvents(
        [
          {
            eventType: "booking:removed",
            aggregateType: "booking",
            aggregateId: booking._id,
            rooms: ["drivers:available:victoria", "drivers:shared:victoria"],
            payload: bookingPayload(booking),
          },
          {
            eventType: "admin:booking_updated",
            aggregateType: "booking",
            aggregateId: booking._id,
            rooms: ["admin"],
            payload: bookingPayload(booking),
          },
        ],
        session,
      );
      cancelled = booking.toObject();
    });
    return cancelled;
  },

  async acceptAtomically({ bookingId, driverUserId }) {
    let accepted;
    await mongoose.connection.transaction(async (session) => {
      const driver = await Driver.findOne({
        userId: driverUserId,
        approvalStatus: DRIVER_APPROVAL.APPROVED,
        availabilityStatus: mongoose.trusted({
          $in: [DRIVER_AVAILABILITY.AVAILABLE, DRIVER_AVAILABILITY.ON_RIDE],
        }),
      })
        .populate({ path: "vehicleId", model: Vehicle })
        .session(session);
      if (!driver) {
        throw new AppError(
          "Only an approved, online driver can accept bookings.",
          {
            statusCode: 403,
            code: "DRIVER_NOT_ELIGIBLE",
          },
        );
      }
      if (!driver.vehicleId || driver.vehicleId.vehicleStatus !== "active") {
        throw new AppError(
          "An active vehicle is required to accept bookings.",
          {
            statusCode: 409,
            code: "ACTIVE_VEHICLE_REQUIRED",
          },
        );
      }

      const booking = await Booking.findOneAndUpdate(
        {
          _id: bookingId,
          status: BOOKING_STATUS.SEARCHING,
          assignedDriverId: null,
        },
        {
          $set: {
            status: BOOKING_STATUS.ACCEPTED,
            assignedDriverId: driver._id,
            acceptedAt: new Date(),
          },
        },
        { returnDocument: "after", session },
      );
      if (!booking) {
        const current = await Booking.findById(bookingId).session(session);
        if (
          current &&
          String(current.assignedDriverId) === String(driver._id) &&
          current.status === BOOKING_STATUS.ACCEPTED
        ) {
          accepted = current.toObject();
          return;
        }
        throw new AppError(
          "This booking has already been accepted or is no longer available.",
          {
            statusCode: 409,
            code: "BOOKING_UNAVAILABLE",
          },
        );
      }

      const roadsidePassengers = await RoadsideSignal.countDocuments(
        buildActiveRoadsideSignalFilter(driver._id),
      ).session(session);
      let ride;
      if (driver.currentRideId) {
        ride = await Ride.findOne({
          _id: driver.currentRideId,
          driverId: driver._id,
          status: RIDE_STATUS.ACTIVE,
        }).session(session);
        if (!ride) {
          throw new AppError(
            "The driver assignment is inconsistent. Reconnect and try again.",
            {
              statusCode: 409,
              code: "DRIVER_STATE_CONFLICT",
            },
          );
        }
        assertBookingCompatibleWithRoadsidePassengers({
          roadsidePassengers,
          bookedSeats: ride.occupiedSeats,
          maximumCapacity: ride.maximumCapacity,
          booking,
        });
        assertRideCanAcceptBooking(ride, booking);
        if (
          driver.currentLocation &&
          haversineDistanceKm(driver.currentLocation, booking.pickupLocation) >
            env.SHARED_ROUTE_COMPATIBILITY_KM
        ) {
          throw new AppError(
            "This pickup is not compatible with the active shared route.",
            {
              statusCode: 409,
              code: "SHARED_ROUTE_INCOMPATIBLE",
            },
          );
        }
        ride = await Ride.findOneAndUpdate(
          mongoose.trusted({
            _id: ride._id,
            status: RIDE_STATUS.ACTIVE,
            rideType: RIDE_TYPE.SHARED,
            $expr: {
              $lte: [
                { $add: ["$occupiedSeats", booking.passengerCount] },
                { $subtract: ["$maximumCapacity", roadsidePassengers] },
              ],
            },
          }),
          {
            $inc: { occupiedSeats: booking.passengerCount },
            $push: { bookingIds: booking._id },
          },
          { returnDocument: "after", session },
        );
        if (!ride) {
          throw new AppError("The shared ride no longer has enough seats.", {
            statusCode: 409,
            code: "RIDE_CAPACITY_EXCEEDED",
          });
        }
      } else {
        assertBookingCompatibleWithRoadsidePassengers({
          roadsidePassengers,
          bookedSeats: 0,
          maximumCapacity: driver.vehicleId.maximumPassengerCapacity,
          booking,
        });
        const [newRide] = await Ride.create(
          [
            {
              driverId: driver._id,
              vehicleId: driver.vehicleId._id,
              rideType: booking.rideType,
              bookingIds: [booking._id],
              maximumCapacity: driver.vehicleId.maximumPassengerCapacity,
              occupiedSeats: booking.passengerCount,
            },
          ],
          { session },
        );
        const claimedDriver = await Driver.findOneAndUpdate(
          { _id: driver._id, currentRideId: null },
          {
            $set: {
              currentRideId: newRide._id,
              availabilityStatus: DRIVER_AVAILABILITY.ON_RIDE,
            },
          },
          { returnDocument: "after", session },
        );
        if (!claimedDriver) {
          throw new AppError(
            "The driver already has a conflicting assignment.",
            {
              statusCode: 409,
              code: "DRIVER_BUSY",
            },
          );
        }
        ride = newRide;
      }

      booking.rideId = ride._id;
      await booking.save({ session });
      await BookingStatusHistory.create(
        [
          historyRecord(
            booking,
            BOOKING_STATUS.SEARCHING,
            BOOKING_STATUS.ACCEPTED,
            driver.userId,
            "driver",
          ),
        ],
        { session },
      );
      await createAcceptanceNotifications({ booking, driver, session });
      await addOutboxEvents(
        [
          {
            eventType: "booking:removed",
            aggregateType: "booking",
            aggregateId: booking._id,
            rooms: ["drivers:available:victoria", "drivers:shared:victoria"],
            payload: bookingPayload(booking),
          },
          {
            eventType: "booking:accepted",
            aggregateType: "booking",
            aggregateId: booking._id,
            rooms: [`user:${booking.commuterId}`, `driver:${driver._id}`],
            payload: bookingPayload(booking),
          },
          {
            eventType: "admin:booking_updated",
            aggregateType: "booking",
            aggregateId: booking._id,
            rooms: ["admin"],
            payload: bookingPayload(booking),
          },
        ],
        session,
      );
      accepted = booking.toObject();
    });
    return accepted;
  },

  async transitionByDriver({ bookingId, driverUserId, targetStatus }) {
    let transitioned;
    await mongoose.connection.transaction(async (session) => {
      const driver = await Driver.findOne({ userId: driverUserId }).session(
        session,
      );
      if (!driver) throw notFoundError("Driver profile");
      const booking = await Booking.findById(bookingId).session(session);
      if (!booking) throw notFoundError("Booking");
      if (String(booking.assignedDriverId) !== String(driver._id)) {
        logger.warn(
          {
            bookingId,
            attemptedBy: driverUserId,
            assignedDriverId: booking.assignedDriverId,
          },
          "Unauthorized booking transition attempt",
        );
        throw new AppError(
          "Only the assigned driver may update this booking.",
          {
            statusCode: 403,
            code: "BOOKING_NOT_ASSIGNED_TO_DRIVER",
          },
        );
      }
      const previousStatus = booking.status;
      assertTransition(previousStatus, targetStatus);
      booking.status = targetStatus;
      const now = new Date();
      if (targetStatus === BOOKING_STATUS.DRIVER_ARRIVING)
        booking.arrivingAt = now;
      if (targetStatus === BOOKING_STATUS.PICKED_UP) booking.pickedUpAt = now;
      if (targetStatus === BOOKING_STATUS.COMPLETED) {
        booking.completedAt = now;
        booking.finalFare = booking.estimatedFare;
      }
      await booking.save({ session });

      if (targetStatus === BOOKING_STATUS.COMPLETED) {
        const ride = await Ride.findOneAndUpdate(
          { _id: booking.rideId, status: RIDE_STATUS.ACTIVE },
          { $inc: { occupiedSeats: -booking.passengerCount } },
          { returnDocument: "after", session },
        );
        await Driver.updateOne(
          { _id: driver._id },
          {
            $inc: {
              totalCompletedBookings: 1,
              totalEarnings: booking.finalFare,
            },
          },
          { session },
        );
        const remaining = await Booking.countDocuments({
          rideId: booking.rideId,
          status: mongoose.trusted({ $in: ACTIVE_BOOKING_STATUSES }),
        }).session(session);
        if (remaining === 0 || ride?.occupiedSeats === 0) {
          await Ride.updateOne(
            { _id: booking.rideId },
            {
              $set: {
                status: RIDE_STATUS.COMPLETED,
                completedAt: now,
                occupiedSeats: 0,
              },
            },
            { session },
          );
          await Driver.updateOne(
            { _id: driver._id, currentRideId: booking.rideId },
            {
              $set: {
                currentRideId: null,
                availabilityStatus: DRIVER_AVAILABILITY.AVAILABLE,
              },
            },
            { session },
          );
        }
      }

      await BookingStatusHistory.create(
        [
          historyRecord(
            booking,
            previousStatus,
            targetStatus,
            driver.userId,
            "driver",
          ),
        ],
        { session },
      );
      const statusMessages = {
        [BOOKING_STATUS.DRIVER_ARRIVING]: [
          "Driver on the way",
          "Your driver is heading to pickup.",
        ],
        [BOOKING_STATUS.PICKED_UP]: [
          "Ride started",
          "Your pickup was confirmed. Have a safe ride!",
        ],
        [BOOKING_STATUS.COMPLETED]: [
          "Ride completed",
          "Your ride has been completed. Thank you for choosing RYDORA.",
        ],
      };
      const [title, message] = statusMessages[targetStatus];
      await Notification.create(
        [
          {
            userId: booking.commuterId,
            type: `booking_${targetStatus}`,
            title,
            message,
            data: { bookingId: booking._id },
          },
        ],
        { session },
      );
      await addOutboxEvents(
        [
          {
            eventType: "booking:status_changed",
            aggregateType: "booking",
            aggregateId: booking._id,
            rooms: [
              `user:${booking.commuterId}`,
              `driver:${driver._id}`,
              `booking:${booking._id}`,
            ],
            payload: bookingPayload(booking),
          },
          {
            eventType: "admin:booking_updated",
            aggregateType: "booking",
            aggregateId: booking._id,
            rooms: ["admin"],
            payload: bookingPayload(booking),
          },
        ],
        session,
      );
      transitioned = booking.toObject();
    });
    return transitioned;
  },
};
