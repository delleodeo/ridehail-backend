import mongoose from 'mongoose';
import { Booking } from '../modules/bookings/booking.model.js';
import { Driver } from '../modules/drivers/driver.model.js';
import {
  ACTIVE_BOOKING_STATUSES,
  DRIVER_APPROVAL,
  DRIVER_AVAILABILITY,
  RIDE_TYPE,
  ROLES,
} from '../shared/constants.js';

export async function joinAuthorizedRooms(socket) {
  const { userId, role } = socket.data.auth;
  socket.join(`user:${userId}`);

  if (role === ROLES.ADMIN) socket.join('admin');
  if (role === ROLES.DRIVER) {
    const driver = await Driver.findOne({ userId })
      .select('_id approvalStatus availabilityStatus currentRideId')
      .populate('currentRideId', 'rideType occupiedSeats maximumCapacity status');
    if (!driver) return;
    socket.join(`driver:${driver._id}`);
    if (
      driver.approvalStatus === DRIVER_APPROVAL.APPROVED &&
      driver.availabilityStatus === DRIVER_AVAILABILITY.AVAILABLE
    ) {
      socket.join('drivers:available:victoria');
    }
    if (
      driver.approvalStatus === DRIVER_APPROVAL.APPROVED &&
      driver.availabilityStatus === DRIVER_AVAILABILITY.ON_RIDE &&
      driver.currentRideId?.status === 'active' &&
      driver.currentRideId.rideType === RIDE_TYPE.SHARED &&
      driver.currentRideId.occupiedSeats < driver.currentRideId.maximumCapacity
    ) {
      socket.join('drivers:shared:victoria');
    }
    const active = await Booking.find({
      assignedDriverId: driver._id,
      status: mongoose.trusted({ $in: ACTIVE_BOOKING_STATUSES }),
    })
      .select('_id')
      .lean();
    for (const booking of active) socket.join(`booking:${booking._id}`);
  }

  if (role === ROLES.COMMUTER) {
    const active = await Booking.find({
      commuterId: userId,
      status: mongoose.trusted({ $in: ACTIVE_BOOKING_STATUSES }),
    })
      .select('_id')
      .lean();
    for (const booking of active) socket.join(`booking:${booking._id}`);
  }
}

