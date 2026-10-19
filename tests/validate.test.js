import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { validate } from '../src/middlewares/validate.js';

const getSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
  }),
});

describe('request validation middleware', () => {
  it('normalizes a missing GET request body to an empty object', () => {
    const req = { body: undefined, params: {}, query: {} };
    const next = vi.fn();

    validate(getSchema)(req, {}, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.validated).toEqual({ body: {}, params: {}, query: { page: 1 } });
  });

  it('still rejects invalid query values after normalization', () => {
    const req = { body: undefined, params: {}, query: { page: '0' } };
    const next = vi.fn();

    validate(getSchema)(req, {}, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 422, code: 'VALIDATION_ERROR' }),
    );
    expect(req.validated).toBeUndefined();
  });
});
