import type { AuditAction, CleaningStatus, EquipmentStatus } from '../api/types';
import { actionLabel, statusLabel } from '../lib/format';

export function CleaningStatusBadge({ status }: { status: CleaningStatus }) {
  return (
    <span className={`badge badge-${status.toLowerCase()}`}>{statusLabel(status)}</span>
  );
}

export function EquipmentStatusBadge({ status }: { status: EquipmentStatus }) {
  if (status === 'ACTIVE') return null;
  return <span className="badge badge-retired">Retired</span>;
}

export function AuditActionBadge({ action }: { action: AuditAction }) {
  return (
    <span className={`badge badge-${action.toLowerCase()}`}>{actionLabel(action)}</span>
  );
}
