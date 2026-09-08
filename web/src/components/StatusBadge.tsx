import type { AuditAction, CleaningStatus, EquipmentStatus } from '../api/types';
import { actionLabel, statusLabel } from '../lib/format';

const CLEANING_STATUS_HINT: Record<CleaningStatus, string> = {
  PENDING: 'Logged but not yet checked off by a supervisor',
  VERIFIED: 'Confirmed correct by a supervisor',
};

export function CleaningStatusBadge({ status }: { status: CleaningStatus }) {
  return (
    <span className={`badge badge-${status.toLowerCase()}`} title={CLEANING_STATUS_HINT[status]}>
      <span className="badge-dot" aria-hidden="true" />
      {statusLabel(status)}
    </span>
  );
}

export function EquipmentStatusBadge({ status }: { status: EquipmentStatus }) {
  if (status === 'ACTIVE') return null;
  return (
    <span className="badge badge-retired" title="No longer in use; kept for historical records">
      <span className="badge-dot" aria-hidden="true" />
      Retired
    </span>
  );
}

export function AuditActionBadge({ action }: { action: AuditAction }) {
  return (
    <span className={`badge badge-${action.toLowerCase()}`}>
      <span className="badge-dot" aria-hidden="true" />
      {actionLabel(action)}
    </span>
  );
}
