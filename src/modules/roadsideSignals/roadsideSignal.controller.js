import { sendSuccess } from '../../shared/utils/apiResponse.js';
import * as roadsideSignalService from './roadsideSignal.service.js';

export async function publish(req, res) {
  const signal = await roadsideSignalService.publishRoadsideSignal(
    req.auth.userId,
    req.validated.body,
  );
  return sendSuccess(res, { signal });
}

export async function mine(req, res) {
  const signal = await roadsideSignalService.getMyActiveRoadsideSignal(req.auth.userId);
  return sendSuccess(res, { signal });
}

export async function stop(req, res) {
  const signal = await roadsideSignalService.stopRoadsideSignal(req.auth.userId);
  return sendSuccess(res, { signal });
}

export async function nearby(req, res) {
  const signals = await roadsideSignalService.getNearbyRoadsideSignals(req.auth.userId);
  return sendSuccess(res, { signals });
}

export async function claimed(req, res) {
  const signals = await roadsideSignalService.getActiveRoadsideSignals(req.auth.userId);
  return sendSuccess(res, { signals });
}

export const active = claimed;

export async function claim(req, res) {
  const signal = await roadsideSignalService.claimRoadsideCommuter(
    req.validated.params.id,
    req.auth.userId,
  );
  return sendSuccess(res, {
    signal: { id: String(signal._id), status: signal.status },
  });
}

export async function pickup(req, res) {
  const signal = await roadsideSignalService.markRoadsidePassengerPickedUp(
    req.validated.params.id,
    req.auth.userId,
  );
  return sendSuccess(res, {
    signal: { id: String(signal._id), status: signal.status },
  });
}

export async function dropoff(req, res) {
  const signal = await roadsideSignalService.dropOffRoadsidePassenger(
    req.validated.params.id,
    req.auth.userId,
  );
  return sendSuccess(res, {
    signal: { id: String(signal._id), status: signal.status },
  });
}
