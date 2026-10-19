import { describe, expect, it } from 'vitest';
import { readSocketAccessToken } from '../src/sockets/socketAuth.js';

describe('Socket.IO cookie authentication', () => {
  it('reads the access token from a Cookie request header', () => {
    expect(
      readSocketAccessToken('theme=light; rydora_access=header.payload.signature; other=value'),
    ).toBe('header.payload.signature');
  });

  it('returns undefined when the access cookie is absent', () => {
    expect(readSocketAccessToken('theme=light')).toBeUndefined();
  });
});
