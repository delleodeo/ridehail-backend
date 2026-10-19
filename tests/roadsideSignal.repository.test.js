import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import {
  buildActiveCommuterRoadsideSignalFilter,
  buildActiveRoadsideSignalFilter,
  buildClaimableRoadsideSignalFilter,
  buildNearbyRoadsideSignalFilter,
  toCommuterRoadsideSignal,
  toDriverRoadsideSignal,
} from "../src/modules/roadsideSignals/roadsideSignal.repository.js";
import { RoadsideSignal } from "../src/modules/roadsideSignals/roadsideSignal.model.js";

describe("roadside signal driver projection", () => {
  it("returns only the public commuter identity and destination details", () => {
    const result = toDriverRoadsideSignal({
      _id: "signal-1",
      commuterId: {
        firstName: "Maria",
        lastName: "Santos",
        avatar: null,
        email: "private@example.com",
        phone: "+639170000002",
      },
      location: {
        type: "Point",
        coordinates: [121.2788, 13.1734],
        label: "Roadside",
      },
      destinationNote: "Public market",
      status: "claimed",
      pickupRouteDistanceKm: 1.2,
      pickupRouteDurationMinutes: 4,
      expiresAt: new Date("2026-10-20T01:00:00Z"),
      createdAt: new Date("2026-10-20T00:45:00Z"),
    });

    expect(result).toMatchObject({
      id: "signal-1",
      commuter: { displayName: "Maria S.", avatar: null },
      destinationNote: "Public market",
      status: "claimed",
      pickupRouteDistanceKm: 1.2,
    });
    expect(result.commuter).not.toHaveProperty("email");
    expect(result.commuter).not.toHaveProperty("phone");
  });

  it("returns only safe driver tracking details to the commuter", () => {
    const result = toCommuterRoadsideSignal({
      _id: "signal-1",
      status: "claimed",
      location: { type: "Point", coordinates: [121.2788, 13.1734] },
      destinationNote: "MinSu main entrance",
      claimedByDriverId: {
        _id: "driver-1",
        currentLocation: { type: "Point", coordinates: [121.28, 13.17] },
        userId: {
          firstName: "Juan",
          lastName: "Dela Cruz",
          avatar: null,
          email: "private@example.com",
          phone: "+639170000001",
        },
        vehicleId: {
          plateNumber: "ABC-1234",
          bodyNumber: "VIC-001",
          driverLicenseNumber: "private-license",
        },
      },
    });

    expect(result).toMatchObject({
      id: "signal-1",
      status: "claimed",
      driver: {
        id: "driver-1",
        name: "Juan Dela Cruz",
        vehicle: { plateNumber: "ABC-1234", bodyNumber: "VIC-001" },
      },
    });
    expect(result.driver).not.toHaveProperty("email");
    expect(result.driver).not.toHaveProperty("phone");
    expect(result.driver.vehicle).not.toHaveProperty("driverLicenseNumber");
  });

  it("keeps the server-owned geospatial selector after filter sanitization", () => {
    const origin = { type: "Point", coordinates: [121.2788, 13.1734] };
    const filter = buildNearbyRoadsideSignalFilter(
      origin,
      8,
      new Date("2026-10-20T00:45:00Z"),
    );

    mongoose.sanitizeFilter(filter);

    expect(filter.location).toMatchObject({
      $near: {
        $geometry: origin,
        $maxDistance: 8000,
      },
    });
    expect(filter.expiresAt).toHaveProperty("$gt");
  });

  it("only permits an unexpired waiting signal to be claimed", () => {
    const now = new Date("2026-10-20T00:45:00Z");
    const filter = buildClaimableRoadsideSignalFilter("signal-1", now);

    mongoose.sanitizeFilter(filter);

    expect(filter).toMatchObject({
      _id: "signal-1",
      status: "waiting",
    });
    expect(filter.expiresAt).toHaveProperty("$gt", now);
  });

  it("keeps picked-up passengers active until explicit drop-off without a TTL", () => {
    const now = new Date("2026-10-20T00:45:00Z");
    const commuterFilter = buildActiveCommuterRoadsideSignalFilter(
      "commuter-1",
      now,
    );
    const driverFilter = buildActiveRoadsideSignalFilter("driver-1", now);

    expect(commuterFilter.$or).toContainEqual({ status: "picked_up" });
    expect(driverFilter.$or).toContainEqual({ status: "picked_up" });
    expect(
      commuterFilter.$or.find((item) => item.status === "picked_up"),
    ).not.toHaveProperty("expiresAt");
  });

  it("preserves nested active-signal operators through sanitization and schema casting", () => {
    const now = new Date("2026-10-20T00:45:00Z");
    const commuterId = new mongoose.Types.ObjectId();
    const driverId = new mongoose.Types.ObjectId();
    const commuterFilter = buildActiveCommuterRoadsideSignalFilter(
      commuterId,
      now,
    );
    const driverFilter = buildActiveRoadsideSignalFilter(driverId, now);

    mongoose.sanitizeFilter(commuterFilter);
    mongoose.sanitizeFilter(driverFilter);

    expect(commuterFilter.$or[0].status).toHaveProperty("$in");
    expect(commuterFilter.$or[0].expiresAt).toHaveProperty("$gt", now);
    expect(driverFilter.$or[0].expiresAt).toHaveProperty("$gt", now);
    expect(() =>
      RoadsideSignal.find(commuterFilter).cast(RoadsideSignal),
    ).not.toThrow();
    expect(() =>
      RoadsideSignal.find(driverFilter).cast(RoadsideSignal),
    ).not.toThrow();
  });
});
