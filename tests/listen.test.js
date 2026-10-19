import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { listen } from '../src/shared/utils/listen.js';

const servers = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise((resolve) => {
          if (!server.listening) return resolve();
          server.close(resolve);
        }),
    ),
  );
});

describe('HTTP server listener', () => {
  it('resolves with the bound address after listening', async () => {
    const server = http.createServer();
    servers.push(server);

    const address = await listen(server, 0, '127.0.0.1');

    expect(address).toMatchObject({ address: '127.0.0.1', family: 'IPv4' });
    expect(address.port).toBeGreaterThan(0);
  });

  it('rejects a duplicate port with EADDRINUSE instead of emitting an unhandled error', async () => {
    const first = http.createServer();
    const duplicate = http.createServer();
    servers.push(first, duplicate);
    const address = await listen(first, 0, '127.0.0.1');

    await expect(listen(duplicate, address.port, '127.0.0.1')).rejects.toMatchObject({
      code: 'EADDRINUSE',
      port: address.port,
    });
  });
});
