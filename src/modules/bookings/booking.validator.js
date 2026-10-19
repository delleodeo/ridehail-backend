import { z } from 'zod';
import { RIDE_TYPE } from '../../shared/constants.js';

const coordinates = z
  .tuple([
    z.number().min(-180).max(180),
    z.number().min(-90).max(90),
  ])
  .describe('[longitude, latitude]');

export const locationSchema = z
  .object({
    type: z.literal('Point').default('Point'),
    coordinates,
    label: z.string().trim().min(1).max(180),
    address: z.string().trim().max(300).optional(),
  })
  .strict();

const bookingInput = z.object({
  rideType: z.enum(Object.values(RIDE_TYPE)),
  passengerCount: z.number().int().min(1).max(8).default(1),
  pickupLocation: locationSchema,
  dropoffLocation: locationSchema,
});

export const estimateBookingSchema = z.object({
  body: bookingInput,
  params: z.object({}),
  query: z.object({}),
});

export const createBookingSchema = estimateBookingSchema;

export const bookingIdSchema = z.object({
  body: z.object({}),
  params: z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid booking ID.') }),
  query: z.object({}),
});

export const cancelBookingSchema = z.object({
  body: z.object({ reason: z.string().trim().min(3).max(300).optional() }),
  params: z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid booking ID.') }),
  query: z.object({}),
});

export const listBookingsSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
});

