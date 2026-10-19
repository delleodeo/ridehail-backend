import { ACTIVE_BOOKING_STATUSES, BOOKING_STATUS } from '../../shared/constants.js';

export function reconcileDriverSnapshot({ availableBookings, activeAssignments }) {
  return {
    availableBookings: availableBookings.filter(
      (booking) =>
        booking.status === BOOKING_STATUS.SEARCHING && !booking.assignedDriverId,
    ),
    activeAssignments: activeAssignments.filter((booking) =>
      ACTIVE_BOOKING_STATUSES.includes(booking.status),
    ),
  };
}

