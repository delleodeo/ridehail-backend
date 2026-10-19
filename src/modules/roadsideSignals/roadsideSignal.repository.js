import mongoose from "mongoose";
import { OutboxEvent } from "../../shared/events/outboxEvent.model.js";
import { ROADSIDE_SIGNAL_STATUS } from "../../shared/constants.js";
import { RoadsideSignal } from "./roadsideSignal.model.js";

const driverRooms = ["drivers:available:victoria", "drivers:shared:victoria"];

function eventFor(signal, action) {
  const rooms = new Set([...driverRooms, `user:${signal.commuterId}`]);
  if (signal.claimedByDriverId) rooms.add(`driver:${signal.claimedByDriverId}`);
  return {
    eventType: "roadside:changed",
    aggregateType: "roadside_signal",
    aggregateId: signal._id,
    rooms: [...rooms],
    payload: {
      signalId: String(signal._id),
      action,
      status: signal.status,
    },
  };
}

export function buildNearbyRoadsideSignalFilter(
  origin,
  radiusKm,
  now = new Date(),
) {
  return {
    status: ROADSIDE_SIGNAL_STATUS.WAITING,
    expiresAt: mongoose.trusted({ $gt: now }),
    location: mongoose.trusted({
      $near: {
        $geometry: { type: "Point", coordinates: [...origin.coordinates] },
        $maxDistance: radiusKm * 1000,
      },
    }),
  };
}

export function buildClaimableRoadsideSignalFilter(signalId, now = new Date()) {
  return {
    _id: signalId,
    status: ROADSIDE_SIGNAL_STATUS.WAITING,
    expiresAt: mongoose.trusted({ $gt: now }),
  };
}

export function buildActiveRoadsideSignalFilter(driverId, now = new Date()) {
  return {
    claimedByDriverId: driverId,
    $or: [
      {
        status: ROADSIDE_SIGNAL_STATUS.CLAIMED,
        expiresAt: mongoose.trusted({ $gt: now }),
      },
      { status: ROADSIDE_SIGNAL_STATUS.PICKED_UP },
    ],
  };
}

export function buildActiveCommuterRoadsideSignalFilter(
  commuterId,
  now = new Date(),
) {
  return {
    commuterId,
    $or: [
      {
        status: mongoose.trusted({
          $in: [ROADSIDE_SIGNAL_STATUS.WAITING, ROADSIDE_SIGNAL_STATUS.CLAIMED],
        }),
        expiresAt: mongoose.trusted({ $gt: now }),
      },
      { status: ROADSIDE_SIGNAL_STATUS.PICKED_UP },
    ],
  };
}

export function toDriverRoadsideSignal(signal) {
  const commuter = signal.commuterId;
  const displayName = commuter?.firstName
    ? `${commuter.firstName}${commuter.lastName ? ` ${commuter.lastName[0]}.` : ""}`
    : "Commuter";
  return {
    id: String(signal._id),
    commuter: {
      displayName,
      avatar: commuter?.avatar ?? null,
    },
    location: signal.location,
    destinationNote: signal.destinationNote,
    status: signal.status,
    pickupRouteDistanceKm: signal.pickupRouteDistanceKm ?? null,
    pickupRouteDurationMinutes: signal.pickupRouteDurationMinutes ?? null,
    pickupRouteGeometry: signal.pickupRouteGeometry ?? null,
    expiresAt: signal.expiresAt,
    createdAt: signal.createdAt,
  };
}

export function toCommuterRoadsideSignal(signal) {
  if (!signal) return null;
  const driver = signal.claimedByDriverId;
  return {
    id: String(signal._id),
    status: signal.status,
    location: signal.location,
    destinationNote: signal.destinationNote,
    expiresAt: signal.expiresAt,
    pickupRouteDistanceKm: signal.pickupRouteDistanceKm ?? null,
    pickupRouteDurationMinutes: signal.pickupRouteDurationMinutes ?? null,
    pickupRouteGeometry: signal.pickupRouteGeometry ?? null,
    driver: driver?._id
      ? {
          id: String(driver._id),
          name: driver.userId
            ? `${driver.userId.firstName} ${driver.userId.lastName}`
            : "Your driver",
          avatar: driver.userId?.avatar ?? null,
          currentLocation: driver.currentLocation ?? null,
          vehicle: driver.vehicleId
            ? {
                plateNumber: driver.vehicleId.plateNumber,
                bodyNumber: driver.vehicleId.bodyNumber,
              }
            : null,
        }
      : null,
  };
}

export const roadsideSignalRepository = {
  async publish({ commuterId, location, destinationNote, expiresAt }) {
    let saved;
    await mongoose.connection.transaction(async (session) => {
      const signal = await RoadsideSignal.findOneAndUpdate(
        {
          commuterId,
          status: mongoose.trusted({
            $nin: [
              ROADSIDE_SIGNAL_STATUS.CLAIMED,
              ROADSIDE_SIGNAL_STATUS.PICKED_UP,
            ],
          }),
        },
        {
          $set: {
            location,
            destinationNote,
            expiresAt,
            status: ROADSIDE_SIGNAL_STATUS.WAITING,
            claimedByDriverId: null,
            claimedAt: null,
            pickupRouteDistanceKm: null,
            pickupRouteDurationMinutes: null,
            pickupRouteGeometry: null,
            pickedUpAt: null,
            droppedOffAt: null,
            cancelledAt: null,
          },
        },
        {
          upsert: true,
          returnDocument: "after",
          runValidators: true,
          setDefaultsOnInsert: true,
          session,
        },
      );
      await OutboxEvent.create([eventFor(signal, "published")], {
        session,
        ordered: true,
      });
      saved = signal.toObject();
    });
    return saved;
  },

  findActiveForCommuter(commuterId, now = new Date()) {
    return RoadsideSignal.findOne(
      buildActiveCommuterRoadsideSignalFilter(commuterId, now),
    )
      .populate({
        path: "claimedByDriverId",
        select: "userId vehicleId currentLocation",
        populate: [
          { path: "userId", select: "firstName lastName avatar" },
          { path: "vehicleId", select: "plateNumber bodyNumber" },
        ],
      })
      .lean();
  },

  async stop(commuterId) {
    let stopped = null;
    await mongoose.connection.transaction(async (session) => {
      const signal = await RoadsideSignal.findOneAndUpdate(
        { commuterId, status: ROADSIDE_SIGNAL_STATUS.WAITING },
        {
          $set: {
            status: ROADSIDE_SIGNAL_STATUS.CANCELLED,
            cancelledAt: new Date(),
          },
        },
        { returnDocument: "after", session },
      );
      if (!signal) return;
      await OutboxEvent.create([eventFor(signal, "removed")], {
        session,
        ordered: true,
      });
      stopped = signal.toObject();
    });
    return stopped;
  },

  listNearby(origin, radiusKm) {
    return RoadsideSignal.find(
      buildNearbyRoadsideSignalFilter(origin, radiusKm),
    )
      .populate("commuterId", "firstName lastName avatar")
      .limit(50)
      .lean();
  },

  findActiveById(signalId, now = new Date()) {
    return RoadsideSignal.findOne({
      _id: signalId,
      status: ROADSIDE_SIGNAL_STATUS.WAITING,
      expiresAt: mongoose.trusted({ $gt: now }),
    }).lean();
  },

  listClaimedByDriver(driverId, now = new Date()) {
    return RoadsideSignal.find({
      claimedByDriverId: driverId,
      status: ROADSIDE_SIGNAL_STATUS.CLAIMED,
      expiresAt: mongoose.trusted({ $gt: now }),
    })
      .populate("commuterId", "firstName lastName avatar")
      .lean();
  },

  listActiveByDriver(driverId, now = new Date()) {
    return RoadsideSignal.find(buildActiveRoadsideSignalFilter(driverId, now))
      .populate("commuterId", "firstName lastName avatar")
      .sort({ pickedUpAt: 1, claimedAt: 1 })
      .lean();
  },

  countActiveByDriver(driverId, now = new Date()) {
    return RoadsideSignal.countDocuments(
      buildActiveRoadsideSignalFilter(driverId, now),
    );
  },

  async claim({ signalId, driverId, route, expiresAt }) {
    let claimed = null;
    await mongoose.connection.transaction(async (session) => {
      const signal = await RoadsideSignal.findOneAndUpdate(
        buildClaimableRoadsideSignalFilter(signalId),
        {
          $set: {
            status: ROADSIDE_SIGNAL_STATUS.CLAIMED,
            claimedByDriverId: driverId,
            claimedAt: new Date(),
            pickupRouteDistanceKm: route.distanceKm,
            pickupRouteDurationMinutes: route.durationMinutes,
            pickupRouteGeometry: route.geometry,
            expiresAt,
          },
        },
        { returnDocument: "after", session },
      );
      if (!signal) return;
      await OutboxEvent.create([eventFor(signal, "claimed")], {
        session,
        ordered: true,
      });
      claimed = signal.toObject();
    });
    return claimed;
  },

  async markPickedUp({ signalId, driverId }) {
    let pickedUp = null;
    await mongoose.connection.transaction(async (session) => {
      const signal = await RoadsideSignal.findOneAndUpdate(
        {
          _id: signalId,
          claimedByDriverId: driverId,
          status: ROADSIDE_SIGNAL_STATUS.CLAIMED,
        },
        {
          $set: {
            status: ROADSIDE_SIGNAL_STATUS.PICKED_UP,
            pickedUpAt: new Date(),
            expiresAt: null,
          },
        },
        { returnDocument: "after", session },
      );
      if (!signal) return;
      await OutboxEvent.create([eventFor(signal, "picked_up")], {
        session,
        ordered: true,
      });
      pickedUp = signal.toObject();
    });
    return pickedUp;
  },

  async dropOff({ signalId, driverId }) {
    let droppedOff = null;
    await mongoose.connection.transaction(async (session) => {
      const signal = await RoadsideSignal.findOneAndUpdate(
        {
          _id: signalId,
          claimedByDriverId: driverId,
          status: ROADSIDE_SIGNAL_STATUS.PICKED_UP,
        },
        {
          $set: {
            status: ROADSIDE_SIGNAL_STATUS.DROPPED_OFF,
            droppedOffAt: new Date(),
          },
        },
        { returnDocument: "after", session },
      );
      if (!signal) return;
      await OutboxEvent.create([eventFor(signal, "dropped_off")], {
        session,
        ordered: true,
      });
      droppedOff = signal.toObject();
    });
    return droppedOff;
  },
};
