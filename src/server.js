import http from 'node:http';
import { app } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { listen } from './shared/utils/listen.js';
import {
  startOutboxDispatcher,
  stopOutboxDispatcher,
} from './shared/events/outboxDispatcher.js';
import { createSocketServer } from './sockets/socketServer.js';

const httpServer = http.createServer(app);
const io = createSocketServer(httpServer);

async function start() {
  await connectDatabase();
  startOutboxDispatcher();
  await listen(httpServer, env.PORT);
  logger.info({ port: env.PORT }, 'RYDORA API listening');
}

async function shutdown(signal) {
  logger.info({ signal }, 'Graceful shutdown started');
  stopOutboxDispatcher();
  io.close();
  httpServer.close(async () => {
    await disconnectDatabase();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch(async (error) => {
  stopOutboxDispatcher();
  await disconnectDatabase().catch(() => {});
  const message =
    error.code === 'EADDRINUSE'
      ? `Port ${env.PORT} is already in use. Stop the existing API process or configure a different PORT.`
      : 'Failed to start RYDORA API';
  logger.fatal({ err: error, port: env.PORT }, message);
  process.exit(1);
});

