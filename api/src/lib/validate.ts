import { z } from 'zod';
import { ApiError, type FieldIssue } from './errors.js';

/**
 * Parse untrusted input with a Zod schema and convert failures into a 422 with a
 * field-by-field breakdown, so the client can render errors next to the right input.
 */
export function parseOrThrow<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown,
  message = 'Request validation failed',
): z.infer<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const details: FieldIssue[] = result.error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));

  throw ApiError.validation(message, details);
}
