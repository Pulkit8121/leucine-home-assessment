import type { AuditAction, CleaningStatus } from '../api/types';

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatDateTime(value: string | Date | null): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? '—' : dateTimeFormatter.format(date);
}

/**
 * `<input type="datetime-local">` needs a local-time string without a timezone, while
 * the API speaks ISO-8601 UTC. These two helpers are the only place that conversion
 * happens, so the offset bug can only exist in one spot.
 */
export function toDateTimeLocalValue(iso: string | null): string {
  const date = iso ? new Date(iso) : new Date();
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function fromDateTimeLocalValue(value: string): string {
  return new Date(value).toISOString();
}

/** Human labels for the audit trail's field names. */
const FIELD_LABELS: Record<string, string> = {
  cleanedBy: 'Cleaned by',
  cleanedAt: 'Cleaned at',
  method: 'Method',
  notes: 'Notes',
  status: 'Status',
};

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

/** Timestamps in the audit trail are stored as ISO strings; render them readably. */
export function formatAuditValue(field: string, value: string | null): string {
  if (value === null) return '—';
  if (field === 'cleanedAt') return formatDateTime(value);
  return value;
}

export function statusLabel(status: CleaningStatus): string {
  return status === 'VERIFIED' ? 'Verified' : 'Pending';
}

export function actionLabel(action: AuditAction): string {
  return action === 'CREATE' ? 'Created' : 'Updated';
}
