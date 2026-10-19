import { z } from 'zod';

export const updateProfileSchema = z.object({
  body: z
    .object({
      firstName: z.string().trim().min(1).max(80).optional(),
      lastName: z.string().trim().min(1).max(80).optional(),
      phone: z
        .string()
        .trim()
        .regex(/^\+?[0-9]{10,15}$/)
        .optional(),
      avatar: z.url().max(500).nullable().optional(),
    })
    .refine((value) => Object.keys(value).length > 0, 'At least one field is required.'),
  params: z.object({}),
  query: z.object({}),
});

