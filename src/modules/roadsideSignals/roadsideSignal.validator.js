import { z } from 'zod';

const coordinates = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);

const location = z
  .object({
    type: z.literal('Point').default('Point'),
    coordinates,
    label: z.string().trim().min(1).max(180),
  })
  .strict();

const emptyObject = z.object({});

export const publishRoadsideSignalSchema = z.object({
  body: z.object({
    location,
    destinationNote: z.string().trim().min(2).max(180),
  }),
  params: emptyObject,
  query: emptyObject,
});

export const emptyRoadsideSignalSchema = z.object({
  body: emptyObject,
  params: emptyObject,
  query: emptyObject,
});

export const roadsideSignalIdSchema = z.object({
  body: emptyObject,
  params: z.object({
    id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid roadside signal ID.'),
  }),
  query: emptyObject,
});
