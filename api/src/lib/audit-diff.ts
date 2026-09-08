/**
 * Field-level audit diffing.
 *
 * This is deliberately a pure, storage-agnostic module: given a "before" snapshot and
 * an "after" snapshot it returns exactly the fields that changed, each as an
 * old -> new pair of *text* values. Keeping it pure is what makes the regulatory
 * behaviour cheap to test (see tests/unit/audit-diff.test.ts).
 *
 * Rules, and why:
 *  - Values are normalised to strings (or null) before comparison, so a Date read back
 *    from Postgres and a Date parsed from JSON compare equal when they represent the
 *    same instant, and `2` vs `"2"` never produce a phantom change.
 *  - Only keys present in the "after" object are considered. A PATCH that omits `notes`
 *    means "leave notes alone", not "set notes to undefined".
 *  - `undefined` and `null` both normalise to null, so clearing an optional field is a
 *    real change (value -> null) but omitting it is not a change at all.
 */

export interface FieldChange {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

export type AuditableValue = string | number | boolean | Date | null | undefined;
export type AuditableSnapshot = Record<string, AuditableValue>;

/**
 * Normalise a value into the text representation stored in the audit trail.
 * Dates become ISO-8601 UTC strings so ordering and equality are unambiguous.
 */
export function normaliseAuditValue(value: AuditableValue): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null;
  return value;
}

/**
 * Compare two snapshots and return one entry per changed field.
 *
 * @param before  Values as they exist now (use `{}` for a create).
 * @param after   Proposed values. Only the keys present here are inspected.
 * @param fields  Optional allow-list. When given, only these fields are diffed, which
 *                keeps internal columns (id, createdAt, ...) out of the audit trail.
 */
export function diffFields(
  before: AuditableSnapshot,
  after: AuditableSnapshot,
  fields?: readonly string[],
): FieldChange[] {
  const candidates = fields ?? Object.keys(after);
  const changes: FieldChange[] = [];

  for (const field of candidates) {
    if (!(field in after)) continue;

    const oldValue = normaliseAuditValue(before[field]);
    const newValue = normaliseAuditValue(after[field]);

    if (oldValue === newValue) continue;

    changes.push({ field, oldValue, newValue });
  }

  return changes;
}

/**
 * Diff for a newly created row: every populated field is recorded as null -> value.
 * Fields that start out empty are not recorded, because "nothing was set" is not an
 * interesting audit fact and would bloat every create entry.
 */
export function diffForCreate(
  created: AuditableSnapshot,
  fields?: readonly string[],
): FieldChange[] {
  return diffFields({}, created, fields);
}
