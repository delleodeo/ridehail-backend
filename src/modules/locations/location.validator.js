import { z } from 'zod';

export const locationSearchSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({ q: z.string().trim().min(3).max(120) }),
});

