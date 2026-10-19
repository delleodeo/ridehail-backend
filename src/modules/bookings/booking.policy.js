import { BOOKING_STATUS, RIDE_TYPE } from '../../shared/constants.js';
import { AppError } from '../../shared/errors/AppError.js';

const transitions = Object.freeze({
  [BOOKING_STATUS.SEARCHING]: [BOOKING_STATUS.ACCEPTED, BOOKING_STATUS.CANCELLED],
  [BOOKING_STATUS.ACCEPTED]: [
    BOOKING_STATUS.DRIVER_ARRIVING,
    BOOKING_STATUS.PICKED_UP,
  ],
  [BOOKING_STATUS.DRIVER_ARRIVING]: [BOOKING_STATUS.PICKED_UP],
  [BOOKING_STATUS.PICKED_UP]: [BOOKING_STATUS.COMPLETED],
  [BOOKING_STATUS.COMPLETED]: [],
  [BOOKING_STATUS.CANCELLED]: [],
  [BOOKING_STATUS.EXPIRED]: [],
});

export function canTransition(from, to) {
  return Boolean(transitions[from]?.includes(to));
}

export function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    throw new AppError(`Booking cannot move from ${from} to ${to}.`, {
      statusCode: 409,
      code: 'INVALID_BOOKING_TRANSITION',
      details: { from, to },
    });
  }
}

export function assertRideCanAcceptBooking(ride, booking) {
  if (ride.rideType !== RIDE_TYPE.SHARED || booking.rideType !== RIDE_TYPE.SHARED) {
    throw new AppError('A non-shared ride cannot accept another booking.', {
      statusCode: 409,
      code: 'DRIVER_BUSY',
    });
  }
  if (ride.occupiedSeats + booking.passengerCount > ride.maximumCapacity) {
    throw new AppError('The shared ride no longer has enough seats.', {
      statusCode: 409,
      code: 'RIDE_CAPACITY_EXCEEDED',
    });
  }
}

export function assertBookingCompatibleWithRoadsidePassengers({
  roadsidePassengers,
  bookedSeats,
  maximumCapacity,
  booking,
}) {
  if (roadsidePassengers > 0 && booking.rideType !== RIDE_TYPE.SHARED) {
    throw new AppError(
      'A driver carrying roadside passengers can only accept shared bookings.',
      {
        statusCode: 409,
        code: 'NON_SHARED_BOOKING_WITH_ROADSIDE_PASSENGERS',
      },
    );
  }
  if (roadsidePassengers + bookedSeats + booking.passengerCount > maximumCapacity) {
    throw new AppError('The shared ride no longer has enough seats.', {
      statusCode: 409,
      code: 'RIDE_CAPACITY_EXCEEDED',
    });
  }
}

