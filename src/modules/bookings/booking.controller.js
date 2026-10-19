import { sendSuccess } from '../../shared/utils/apiResponse.js';
import { bookingService } from './booking.service.js';

export async function estimate(req, res) {
  const result = await bookingService.estimate(req.validated.body);
  return sendSuccess(res, result);
}

export async function create(req, res) {
  const result = await bookingService.create(req.validated.body, {
    commuterId: req.auth.userId,
    idempotencyKey: req.get('idempotency-key'),
  });
  return sendSuccess(
    res,
    { booking: result.booking, route: result.route },
    { statusCode: result.created ? 201 : 200 },
  );
}

export async function listMine(req, res) {
  const result = await bookingService.listForCommuter(req.auth.userId, req.validated.query);
  return sendSuccess(res, result.items, {
    meta: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      pages: result.pages,
    },
  });
}

export async function getById(req, res) {
  const booking = await bookingService.getAuthorized(req.validated.params.id, req.auth);
  return sendSuccess(res, { booking });
}

export async function cancel(req, res) {
  const booking = await bookingService.cancel(
    req.validated.params.id,
    req.auth.userId,
    req.validated.body.reason,
  );
  return sendSuccess(res, { booking });
}

