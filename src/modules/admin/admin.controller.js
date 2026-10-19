import { sendSuccess } from '../../shared/utils/apiResponse.js';
import * as service from './admin.service.js';

function paged(res, result) {
  return sendSuccess(res, result.items, {
    meta: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      pages: result.pages,
    },
  });
}

export async function dashboard(_req, res) {
  return sendSuccess(res, await service.getDashboard());
}
export async function users(req, res) {
  return paged(res, await service.listUsers(req.validated.query));
}
export async function updateUser(req, res) {
  return sendSuccess(res, {
    user: await service.setUserStatus(
      req.validated.params.id,
      req.validated.body.status,
      req.auth.userId,
    ),
  });
}
export async function drivers(req, res) {
  return paged(res, await service.listDrivers(req.validated.query));
}
export async function approveDriver(req, res) {
  return sendSuccess(res, {
    driver: await service.setDriverApproval(
      req.validated.params.id,
      req.validated.body.status,
    ),
  });
}
export async function bookings(req, res) {
  return paged(res, await service.listBookings(req.validated.query));
}
export async function reports(_req, res) {
  return sendSuccess(res, await service.getReports());
}
export async function fares(_req, res) {
  return sendSuccess(res, { fares: await service.getFares() });
}
export async function updateFare(req, res) {
  return sendSuccess(res, {
    fare: await service.updateFare(
      req.validated.params.id,
      req.validated.body,
      req.auth.userId,
    ),
  });
}
export async function serviceArea(_req, res) {
  return sendSuccess(res, { serviceArea: await service.getServiceArea() });
}
export async function updateServiceArea(req, res) {
  return sendSuccess(res, {
    serviceArea: await service.replaceServiceArea(req.validated.body, req.auth.userId),
  });
}

