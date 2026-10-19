import { logger } from '../../config/logger.js';
import { OutboxEvent } from './outboxEvent.model.js';

let socketServer = null;
let timer = null;

export function attachSocketServer(io) {
  socketServer = io;
}

export function emitEphemeral(rooms, eventType, payload) {
  if (!socketServer) return;
  for (const room of rooms) socketServer.to(room).emit(eventType, payload);
}

async function publish(event) {
  if (!socketServer) return false;
  for (const room of event.rooms) {
    socketServer.to(room).emit(event.eventType, event.payload);
  }
  await OutboxEvent.updateOne(
    { _id: event._id, publishedAt: null },
    { $set: { publishedAt: new Date(), lastError: null }, $inc: { attempts: 1 } },
  );
  return true;
}

export async function publishPendingEvents({ aggregateId, limit = 100 } = {}) {
  if (!socketServer) return;
  const filter = { publishedAt: null, ...(aggregateId ? { aggregateId } : {}) };
  const events = await OutboxEvent.find(filter).sort({ createdAt: 1 }).limit(limit).lean();
  for (const event of events) {
    try {
      await publish(event);
    } catch (error) {
      logger.error({ err: error, eventId: event._id }, 'Outbox event publication failed');
      await OutboxEvent.updateOne(
        { _id: event._id },
        { $set: { lastError: error.message }, $inc: { attempts: 1 } },
      );
    }
  }
}

export function startOutboxDispatcher(intervalMs = 2_000) {
  if (timer) return;
  timer = setInterval(() => publishPendingEvents().catch(() => {}), intervalMs);
  timer.unref();
}

export function stopOutboxDispatcher() {
  if (timer) clearInterval(timer);
  timer = null;
}

