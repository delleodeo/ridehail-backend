import mongoose from 'mongoose';
import { Booking } from '../bookings/booking.model.js';
import { Driver } from '../drivers/driver.model.js';
import { FareSettings } from '../fares/fareSettings.model.js';
import { Ride } from '../rides/ride.model.js';
import { ServiceArea } from '../locations/serviceArea.model.js';
import { User } from '../users/user.model.js';
import {
  BOOKING_STATUS,
  DRIVER_AVAILABILITY,
  ROLES,
} from '../../shared/constants.js';
import { AppError, notFoundError } from '../../shared/errors/AppError.js';

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function getDashboard() {
  const [
    totalCommuters,
    totalDrivers,
    onlineDrivers,
    availableDrivers,
    waitingBookings,
    activeRides,
    completedBookings,
    cancelledBookings,
  ] = await Promise.all([
    User.countDocuments({ role: ROLES.COMMUTER }),
    User.countDocuments({ role: ROLES.DRIVER }),
    Driver.countDocuments({
      availabilityStatus: mongoose.trusted({ $ne: DRIVER_AVAILABILITY.OFFLINE }),
    }),
    Driver.countDocuments({ availabilityStatus: DRIVER_AVAILABILITY.AVAILABLE }),
    Booking.countDocuments({ status: BOOKING_STATUS.SEARCHING }),
    Ride.countDocuments({ status: 'active' }),
    Booking.countDocuments({ status: BOOKING_STATUS.COMPLETED }),
    Booking.countDocuments({ status: BOOKING_STATUS.CANCELLED }),
  ]);
  return {
    totalCommuters,
    totalDrivers,
    onlineDrivers,
    availableDrivers,
    waitingBookings,
    activeRides,
    completedBookings,
    cancelledBookings,
  };
}

export async function listUsers({ page, limit, search, role, status }) {
  const filter = {};
  if (role) filter.role = role;
  if (status) filter.accountStatus = status;
  if (search) {
    const safe = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ firstName: safe }, { lastName: safe }, { email: safe }, { phone: safe }];
  }
  const [items, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);
  return { items, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function setUserStatus(userId, status, actingAdminId) {
  if (userId === actingAdminId) {
    throw new AppError('You cannot suspend your own account.', {
      statusCode: 409,
      code: 'SELF_SUSPENSION_NOT_ALLOWED',
    });
  }
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { accountStatus: status } },
    { returnDocument: 'after', runValidators: true },
  ).lean();
  if (!user) throw notFoundError('User');
  if (status === 'suspended' && user.role === ROLES.DRIVER) {
    await Driver.updateOne(
      { userId: user._id, currentRideId: null },
      { $set: { availabilityStatus: DRIVER_AVAILABILITY.OFFLINE } },
    );
  }
  return user;
}

export async function listDrivers({ page, limit, approvalStatus }) {
  const filter = approvalStatus ? { approvalStatus } : {};
  const [items, total] = await Promise.all([
    Driver.find(filter)
      .populate('userId', 'firstName lastName email phone avatar accountStatus')
      .populate('vehicleId')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Driver.countDocuments(filter),
  ]);
  return { items, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function setDriverApproval(driverId, status) {
  const driver = await Driver.findById(driverId);
  if (!driver) throw notFoundError('Driver');
  if (status === 'approved' && !driver.vehicleId) {
    throw new AppError('A driver must register a vehicle before approval.', {
      statusCode: 409,
      code: 'DRIVER_VEHICLE_REQUIRED',
    });
  }
  driver.approvalStatus = status;
  if (status !== 'approved') driver.availabilityStatus = DRIVER_AVAILABILITY.OFFLINE;
  await driver.save();
  return driver.toObject();
}

export async function listBookings({ page, limit, status, rideType, driverId, from, to }) {
  const filter = {};
  if (status) filter.status = status;
  if (rideType) filter.rideType = rideType;
  if (driverId) filter.assignedDriverId = driverId;
  if (from || to) {
    filter.createdAt = mongoose.trusted({
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lte: to } : {}),
    });
  }
  const [items, total] = await Promise.all([
    Booking.find(filter)
      .populate('commuterId', 'firstName lastName email phone')
      .populate({
        path: 'assignedDriverId',
        select: 'userId vehicleId',
        populate: { path: 'userId', select: 'firstName lastName' },
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Booking.countDocuments(filter),
  ]);
  return { items, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getReports() {
  const since = new Date();
  since.setDate(since.getDate() - 29);
  since.setHours(0, 0, 0, 0);
  const [daily, rideTypes, totals] = await Promise.all([
    Booking.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Manila' } },
          bookings: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', BOOKING_STATUS.COMPLETED] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', BOOKING_STATUS.CANCELLED] }, 1, 0] } },
          fareTotal: { $sum: { $ifNull: ['$finalFare', 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Booking.aggregate([{ $group: { _id: '$rideType', count: { $sum: 1 } } }]),
    Booking.aggregate([
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          fareTotal: { $sum: { $ifNull: ['$finalFare', 0] } },
        },
      },
    ]),
  ]);
  return { daily, rideTypes, totals: totals[0] ?? { totalBookings: 0, fareTotal: 0 } };
}

export async function getFares() {
  return FareSettings.find({ isActive: true }).sort({ rideType: 1 }).lean();
}

export async function updateFare(fareId, input, adminId) {
  let created;
  await mongoose.connection.transaction(async (session) => {
    const previous = await FareSettings.findById(fareId).session(session);
    if (!previous) throw notFoundError('Fare settings');
    previous.isActive = false;
    await previous.save({ session });
    [created] = await FareSettings.create(
      [
        {
          ...input,
          rideType: previous.rideType,
          isActive: true,
          updatedBy: adminId,
        },
      ],
      { session },
    );
  });
  return created.toObject();
}

export async function getServiceArea() {
  return ServiceArea.findOne({ isActive: true }).lean();
}

export async function replaceServiceArea(input, adminId) {
  const firstRing = input.geometry.coordinates[0];
  const first = firstRing[0];
  const last = firstRing.at(-1);
  if (first[0] !== last[0] || first[1] !== last[1]) {
    throw new AppError('The GeoJSON polygon ring must be closed.', {
      statusCode: 422,
      code: 'INVALID_GEOJSON_RING',
    });
  }
  let created;
  await mongoose.connection.transaction(async (session) => {
    await ServiceArea.updateMany({ isActive: true }, { $set: { isActive: false } }, { session });
    [created] = await ServiceArea.create(
      [{ ...input, isActive: true, updatedBy: adminId }],
      { session },
    );
  });
  return created.toObject();
}

