import { sendSuccess } from '../../shared/utils/apiResponse.js';
import * as driverService from './driver.service.js';

export async function getMe(req, res) {
  return sendSuccess(res, { driver: await driverService.getDriverProfile(req.auth.userId) });
}

export async function nearby(req, res) {
  const { longitude, latitude, limit, radiusKm } = req.validated.query;
  return sendSuccess(res, {
    drivers: await driverService.getNearbyAvailableDrivers(
      [longitude, latitude],
      { limit, radiusKm },
    ),
  });
}

export async function updateAvailability(req, res) {
  const driver = await driverService.updateAvailability(
    req.auth.userId,
    req.validated.body.status,
  );
  return sendSuccess(res, { driver });
}

export async function updateLocation(req, res) {
  return sendSuccess(
    res,
    await driverService.updateLocation(req.auth.userId, req.validated.body.coordinates),
  );
}

export async function upsertVehicle(req, res) {
  return sendSuccess(res, {
    vehicle: await driverService.upsertVehicle(req.auth.userId, req.validated.body),
  });
}

export async function availableBookings(req, res) {
  return sendSuccess(res, {
    bookings: await driverService.getAvailableBookings(req.auth.userId),
  });
}

export async function activeAssignments(req, res) {
  return sendSuccess(res, {
    bookings: await driverService.getActiveAssignments(req.auth.userId),
  });
}

export async function earnings(req, res) {
  return sendSuccess(res, await driverService.getEarnings(req.auth.userId));
}

export async function history(req, res) {
  return sendSuccess(res, {
    bookings: await driverService.getBookingHistory(req.auth.userId),
  });
}

export async function accept(req, res) {
  return sendSuccess(res, {
    booking: await driverService.acceptBooking(req.validated.params.id, req.auth.userId),
  });
}

export async function arriving(req, res) {
  return sendSuccess(res, {
    booking: await driverService.markArriving(req.validated.params.id, req.auth.userId),
  });
}

export async function pickup(req, res) {
  return sendSuccess(res, {
    booking: await driverService.markPickedUp(req.validated.params.id, req.auth.userId),
  });
}

export async function complete(req, res) {
  return sendSuccess(res, {
    booking: await driverService.completeBooking(req.validated.params.id, req.auth.userId),
  });
}

