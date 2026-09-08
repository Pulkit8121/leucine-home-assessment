import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cleaningRecordsApi } from '../api/endpoints';
import type { CleaningRecord, CleaningStatus, Equipment } from '../api/types';
import { useKeysetPagination } from '../hooks/useKeysetPagination';
import { formatDateTime } from '../lib/format';
import { AuditTrail } from './AuditTrail';
import { CleaningRecordForm } from './CleaningRecordForm';
import { CleaningStatusBadge } from './StatusBadge';

const PAGE_SIZE = 10;

interface CleaningRecordsPanelProps {
  equipment: Equipment;
  currentUserName: string | null;
}

export function CleaningRecordsPanel({ equipment, currentUserName }: CleaningRecordsPanelProps) {
  const [statusFilter, setStatusFilter] = useState<CleaningStatus | ''>('');
  const [editing, setEditing] = useState<CleaningRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [auditFor, setAuditFor] = useState<CleaningRecord | null>(null);

  const pagination = useKeysetPagination();
  const { reset } = pagination;

  // Changing equipment or the filter changes the result set, so any cursor we hold
  // points into the old one and must be discarded.
  useEffect(() => {
    reset();
  }, [equipment.id, statusFilter, reset]);

  const query = useQuery({
    queryKey: ['cleaning-records', equipment.id, statusFilter, pagination.cursor],
    queryFn: () =>
      cleaningRecordsApi.list(equipment.id, {
        limit: PAGE_SIZE,
        cursor: pagination.cursor,
        ...(statusFilter ? { status: statusFilter } : {}),
      }),
    // Keeps the previous page on screen while the next one loads, instead of flashing
    // an empty table on every page change.
    placeholderData: (previous) => previous,
  });

  const records = query.data?.data ?? [];
  const total = query.data?.total ?? 0;
  const rangeStart = total === 0 ? 0 : (pagination.page - 1) * PAGE_SIZE + 1;
  const rangeEnd = rangeStart === 0 ? 0 : rangeStart + records.length - 1;

  return (
    <section className="panel" aria-labelledby="records-heading">
      <div className="panel-header">
        <div>
          <h2 id="records-heading">{equipment.name}</h2>
          <span className="subtitle">{equipment.code} · cleaning records</span>
        </div>
        {currentUserName ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
            Add cleaning record
          </button>
        ) : null}
      </div>

      <div className="toolbar">
        <div className="field">
          <label htmlFor="record-status-filter">Status</label>
          <select
            id="record-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CleaningStatus | '')}
          >
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="VERIFIED">Verified</option>
          </select>
        </div>
      </div>

      {query.isPending ? <p className="loading">Loading records…</p> : null}
      {query.isError ? <p className="alert" style={{ margin: 16 }}>Could not load records.</p> : null}
      {!query.isPending && records.length === 0 ? (
        <p className="empty">No cleaning records{statusFilter ? ' with this status' : ''} yet.</p>
      ) : null}

      {records.length > 0 ? (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th scope="col">Cleaned at</th>
                <th scope="col">Cleaned by</th>
                <th scope="col">Method</th>
                <th scope="col">Notes</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} aria-selected={auditFor?.id === record.id}>
                  <td>
                    <time dateTime={record.cleanedAt}>{formatDateTime(record.cleanedAt)}</time>
                  </td>
                  <td>{record.cleanedBy}</td>
                  <td>{record.method}</td>
                  <td className="notes">{record.notes ?? '—'}</td>
                  <td>
                    <CleaningStatusBadge status={record.status} />
                  </td>
                  <td className="actions">
                    {currentUserName ? (
                      <button type="button" className="btn-link" onClick={() => setEditing(record)}>
                        Edit
                      </button>
                    ) : null}
                    <button type="button" className="btn-link" onClick={() => setAuditFor(record)}>
                      History
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="pagination">
        <span>
          {total > 0 ? `Showing ${rangeStart}–${rangeEnd} of ${total}` : 'No records'}
          {query.isFetching ? ' · updating…' : ''}
        </span>
        <div className="controls">
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
        </div>
      </div>

      {creating ? (
        <CleaningRecordForm
          equipmentId={equipment.id}
          defaultCleanedBy={currentUserName ?? ''}
          onClose={() => setCreating(false)}
        />
      ) : null}

      {editing ? (
        <CleaningRecordForm
          equipmentId={equipment.id}
          record={editing}
          defaultCleanedBy={currentUserName ?? ''}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {auditFor ? <AuditTrail record={auditFor} onClose={() => setAuditFor(null)} /> : null}
    </section>
  );
}
