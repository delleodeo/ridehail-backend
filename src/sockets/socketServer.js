import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { attachSocketServer } from '../shared/events/outboxDispatcher.js';
import { socketAuth } from './socketAuth.js';
import { joinAuthorizedRooms } from './socketRooms.js';

export function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.CLIENT_ORIGIN, credentials: true },
    transports: ['websocket', 'polling'],
  });
  io.use(socketAuth);
  io.on('connection', async (socket) => {
    try {
      await joinAuthorizedRooms(socket);
      socket.emit('session:ready', { connectedAt: new Date().toISOString() });
    } catch (error) {
      logger.warn({ err: error, socketId: socket.id }, 'Socket room reconciliation failed');
      socket.disconnect(true);
    }
  });
  attachSocketServer(io);
  return io;
}

