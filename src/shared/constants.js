export const ROLES = Object.freeze({
  ADMIN: 'admin',
  DRIVER: 'driver',
  COMMUTER: 'commuter',
});

export const ACCOUNT_STATUS = Object.freeze({
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
});

export const DRIVER_APPROVAL = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

export const DRIVER_AVAILABILITY = Object.freeze({
  OFFLINE: 'offline',
  AVAILABLE: 'available',
  ON_RIDE: 'on_ride',
});

export const RIDE_TYPE = Object.freeze({
  SHARED: 'shared',
  NON_SHARED: 'non_shared',
});

export const BOOKING_STATUS = Object.freeze({
  SEARCHING: 'searching',
  ACCEPTED: 'accepted',
  DRIVER_ARRIVING: 'driver_arriving',
  PICKED_UP: 'picked_up',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
});

export const ACTIVE_BOOKING_STATUSES = Object.freeze([
  BOOKING_STATUS.ACCEPTED,
  BOOKING_STATUS.DRIVER_ARRIVING,
  BOOKING_STATUS.PICKED_UP,
]);

export const RIDE_STATUS = Object.freeze({
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

export const ROADSIDE_SIGNAL_STATUS = Object.freeze({
  WAITING: 'waiting',
  CLAIMED: 'claimed',
  PICKED_UP: 'picked_up',
  DROPPED_OFF: 'dropped_off',
  CANCELLED: 'cancelled',
});

