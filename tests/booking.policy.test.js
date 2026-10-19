import { describe, expect, it } from 'vitest';
import { BOOKING_STATUS, RIDE_TYPE } from '../src/shared/constants.js';
import {
  assertBookingCompatibleWithRoadsidePassengers,
  assertRideCanAcceptBooking,
  assertTransition,
  canTransition,
} from '../src/modules/bookings/booking.policy.js';

describe('booking state policy', () => {
  it('allows only the defined forward lifecycle transitions', () => {
    expect(canTransition(BOOKING_STATUS.SEARCHING, BOOKING_STATUS.ACCEPTED)).toBe(true);
    expect(canTransition(BOOKING_STATUS.ACCEPTED, BOOKING_STATUS.PICKED_UP)).toBe(true);
    expect(canTransition(BOOKING_STATUS.PICKED_UP, BOOKING_STATUS.COMPLETED)).toBe(true);
    expect(canTransition(BOOKING_STATUS.COMPLETED, BOOKING_STATUS.ACCEPTED)).toBe(false);
    expect(() =>
      assertTransition(BOOKING_STATUS.COMPLETED, BOOKING_STATUS.PICKED_UP),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_BOOKING_TRANSITION' }));
  });

  it('prevents shared rides from exceeding passenger capacity', () => {
    const ride = {
      rideType: RIDE_TYPE.SHARED,
      occupiedSeats: 2,
      maximumCapacity: 3,
    };
    expect(() =>
      assertRideCanAcceptBooking(ride, {
        rideType: RIDE_TYPE.SHARED,
        passengerCount: 1,
      }),
    ).not.toThrow();
    expect(() =>
      assertRideCanAcceptBooking(ride, {
        rideType: RIDE_TYPE.SHARED,
        passengerCount: 2,
      }),
    ).toThrowError(expect.objectContaining({ code: 'RIDE_CAPACITY_EXCEEDED' }));
  });

  it('prevents any additional passenger from joining a non-shared ride', () => {
    expect(() =>
      assertRideCanAcceptBooking(
        { rideType: RIDE_TYPE.NON_SHARED, occupiedSeats: 1, maximumCapacity: 3 },
        { rideType: RIDE_TYPE.SHARED, passengerCount: 1 },
      ),
    ).toThrowError(expect.objectContaining({ code: 'DRIVER_BUSY' }));
  });

  it('allows only shared bookings when roadside passengers occupy the vehicle', () => {
    const state = {
      roadsidePassengers: 1,
      bookedSeats: 0,
      maximumCapacity: 3,
    };

    expect(() =>
      assertBookingCompatibleWithRoadsidePassengers({
        ...state,
        booking: { rideType: RIDE_TYPE.SHARED, passengerCount: 1 },
      }),
    ).not.toThrow();
    expect(() =>
      assertBookingCompatibleWithRoadsidePassengers({
        ...state,
        booking: { rideType: RIDE_TYPE.NON_SHARED, passengerCount: 1 },
      }),
    ).toThrowError(
      expect.objectContaining({ code: 'NON_SHARED_BOOKING_WITH_ROADSIDE_PASSENGERS' }),
    );
  });

  it('counts roadside and booked passengers against the same vehicle capacity', () => {
    expect(() =>
      assertBookingCompatibleWithRoadsidePassengers({
        roadsidePassengers: 2,
        bookedSeats: 1,
        maximumCapacity: 3,
        booking: { rideType: RIDE_TYPE.SHARED, passengerCount: 1 },
      }),
    ).toThrowError(expect.objectContaining({ code: 'RIDE_CAPACITY_EXCEEDED' }));
  });
});

