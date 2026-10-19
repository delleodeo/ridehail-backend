import { z } from 'zod';

const email = z.string().trim().toLowerCase().email().max(180);
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{10,15}$/, 'Enter a valid phone number.');
const password = z
  .string()
  .min(8)
  .max(72)
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, {
    message: 'Password must be 72 UTF-8 bytes or fewer.',
  });

export const registerSchema = z.object({
  body: z
    .object({
      firstName: z.string().trim().min(1).max(80),
      lastName: z.string().trim().min(1).max(80),
      email: email.optional(),
      phone: phone.optional(),
      password,
      accountType: z.enum(['commuter', 'driver']).default('commuter'),
    })
    .refine((value) => value.email || value.phone, {
      message: 'An email address or phone number is required.',
      path: ['email'],
    }),
  params: z.object({}),
  query: z.object({}),
});

export const loginSchema = z.object({
  body: z.object({
    identifier: z.string().trim().min(3).max(180),
    password,
  }),
  params: z.object({}),
  query: z.object({}),
});

