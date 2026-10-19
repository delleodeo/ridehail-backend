import { z } from 'zod';
import { BOOKING_STATUS, RIDE_TYPE } from '../../shared/constants.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier.');
const pagination = {
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

export const listUsersSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    ...pagination,
    search: z.string().trim().max(80).optional(),
    role: z.enum(['commuter', 'driver', 'admin']).optional(),
    status: z.enum(['active', 'suspended']).optional(),
  }),
});

export const listDriversSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    ...pagination,
    approvalStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
  }),
});

export const userStatusSchema = z.object({
  body: z.object({ status: z.enum(['active', 'suspended']) }),
  params: z.object({ id: objectId }),
  query: z.object({}),
});

export const driverApprovalSchema = z.object({
  body: z.object({ status: z.enum(['approved', 'rejected']) }),
  params: z.object({ id: objectId }),
  query: z.object({}),
});

export const listAdminBookingsSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    ...pagination,
    status: z.enum(Object.values(BOOKING_STATUS)).optional(),
    rideType: z.enum(Object.values(RIDE_TYPE)).optional(),
    driverId: objectId.optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  }),
});

export const fareUpdateSchema = z.object({
  body: z
    .object({
      minimumFare: z.number().min(0),
      baseFare: z.number().min(0),
      baseDistanceKm: z.number().min(0),
      perKilometerRate: z.number().min(0),
      sharedPassengerDiscountRate: z.number().min(0).max(0.8).default(0),
      effectiveFrom: z.coerce.date().default(() => new Date()),
    })
    .refine((value) => value.baseFare >= value.minimumFare * 0.5, {
      message: 'Base fare is unexpectedly low relative to the minimum fare.',
      path: ['baseFare'],
    }),
  params: z.object({ id: objectId }),
  query: z.object({}),
});

const linearRing = z
  .array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]))
  .min(4);

export const serviceAreaUpdateSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(120),
    geometry: z.object({
      type: z.literal('Polygon'),
      coordinates: z.array(linearRing).min(1),
    }),
  }),
  params: z.object({}),
  query: z.object({}),
});

