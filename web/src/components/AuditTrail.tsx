import { useQuery } from '@tanstack/react-query';
import { cleaningRecordsApi } from '../api/endpoints';
import type { CleaningRecord } from '../api/types';
import { useKeysetPagination } from '../hooks/useKeysetPagination';
import { fieldLabel, formatAuditValue, formatDateTime } from '../lib/format';
import { AuditActionBadge } from './StatusBadge';
import { Modal } from './Modal';

const PAGE_SIZE = 10;

/**
 * The regulatory view: every change to this record, newest first, with the exact
 * old -> new value for each field that moved.
 */
export function AuditTrail({ record, onClose }: { record: CleaningRecord; onClose: () => void }) {
  const pagination = useKeysetPagination();

  const query = useQuery({
    queryKey: ['audit', record.id, pagination.cursor],
    queryFn: () =>
      cleaningRecordsApi.audit(record.id, { limit: PAGE_SIZE, cursor: pagination.cursor }),
  });

  return (
    <Modal
      title={`Audit trail — ${record.method}`}
      onClose={onClose}
      wide
      footer={
        <>
          <span style={{ marginRight: 'auto', color: 'var(--text-muted)', fontSize: 13 }}>
            Page {pagination.page}
          </span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={pagination.previous}
            disabled={!pagination.canGoBack}
          >
            Previous
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => pagination.next(query.data?.pageInfo.nextCursor ?? null)}
            disabled={!query.data?.pageInfo.hasNextPage}
          >
            Next
          </button>
        </>
      }
    >
      <div className="modal-body">
        {query.isPending ? <p className="loading">Loading history…</p> : null}
        {query.isError ? <p className="alert">Could not load the audit trail.</p> : null}
        {query.data?.data.length === 0 ? <p className="empty">No history for this record.</p> : null}

        {query.data?.data.map((entry) => (
          <article key={entry.id} className="audit-entry">
            <div className="audit-meta">
              <AuditActionBadge action={entry.action} />
              <strong>{entry.actor.name}</strong>
              <span>({entry.actor.email})</span>
              <span>·</span>
              <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
            </div>

            <ul className="audit-changes">
              {entry.changes.map((change) => (
                <li key={`${entry.id}-${change.field}`} className="audit-change">
                  <span className="field-name">{fieldLabel(change.field)}</span>
                  <span>
                    <span className="old">{formatAuditValue(change.field, change.oldValue)}</span>
                    <span className="arrow" aria-label="changed to">
                      →
                    </span>
                    <span className="new">{formatAuditValue(change.field, change.newValue)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </Modal>
  );
}
