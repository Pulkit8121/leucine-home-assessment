import { z } from 'zod';

export const equipmentStatusSchema = z.enum(['ACTIVE', 'RETIRED']);

export const createEquipmentSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  // Asset codes are uppercase alphanumeric with dashes, e.g. "MIX-001".
  code: z
    .string()
    .trim()
    .min(1, 'Code is required')
    .max(40)
    .regex(/^[A-Za-z0-9-]+$/, 'Code may only contain letters, numbers and dashes')
    .transform((value) => value.toUpperCase()),
  status: equipmentStatusSchema.default('ACTIVE'),
});

export const updateEquipmentSchema = createEquipmentSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'At least one field must be provided' },
);

export const listEquipmentQuerySchema = z.object({
  status: equipmentStatusSchema.optional(),
  search: z.string().trim().min(1).max(120).optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid('Must be a valid UUID') });

export type CreateEquipmentInput = z.infer<typeof createEquipmentSchema>;
export type UpdateEquipmentInput = z.infer<typeof updateEquipmentSchema>;
export type ListEquipmentQuery = z.infer<typeof listEquipmentQuerySchema>;
