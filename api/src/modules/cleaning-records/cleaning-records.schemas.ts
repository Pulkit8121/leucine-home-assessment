import { z } from 'zod';
import { env } from '../../config/env.js';

export const cleaningStatusSchema = z.enum(['PENDING', 'VERIFIED']);

const isoDateTime = z
  .string()
  .datetime({ offset: true, message: 'Must be an ISO-8601 date-time' })
  .or(z.string().datetime({ message: 'Must be an ISO-8601 date-time' }))
  .transform((value) => new Date(value))
  .refine((date) => date.getTime() <= Date.now() + 60_000, {
    message: 'cleanedAt cannot be in the future',
  });

export const createCleaningRecordSchema = z.object({
  // Optional: defaults to the authenticated user, which is the normal case.
  cleanedBy: z.string().trim().min(1).max(120).optional(),
  cleanedAt: isoDateTime,
  method: z.string().trim().min(1, 'Method is required').max(120),
  notes: z.string().trim().max(2000).nullish(),
  status: cleaningStatusSchema.default('PENDING'),
});

export const updateCleaningRecordSchema = z
  .object({
    cleanedBy: z.string().trim().min(1).max(120),
    cleanedAt: isoDateTime,
    method: z.string().trim().min(1).max(120),
    notes: z.string().trim().max(2000).nullable(),
    status: cleaningStatusSchema,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

export const listCleaningRecordsQuerySchema = z.object({
  status: cleaningStatusSchema.optional(),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(env.MAX_PAGE_SIZE, `limit cannot exceed ${env.MAX_PAGE_SIZE}`)
    .default(env.DEFAULT_PAGE_SIZE),
  cursor: z.string().min(1).optional(),
});

export const auditHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(env.MAX_PAGE_SIZE).default(env.DEFAULT_PAGE_SIZE),
  cursor: z.string().min(1).optional(),
});

export const equipmentIdParamSchema = z.object({
  equipmentId: z.string().uuid('Must be a valid UUID'),
});

export const recordIdParamSchema = z.object({
  recordId: z.string().uuid('Must be a valid UUID'),
});

export type CreateCleaningRecordInput = z.infer<typeof createCleaningRecordSchema>;
export type UpdateCleaningRecordInput = z.infer<typeof updateCleaningRecordSchema>;
export type ListCleaningRecordsQuery = z.infer<typeof listCleaningRecordsQuerySchema>;
