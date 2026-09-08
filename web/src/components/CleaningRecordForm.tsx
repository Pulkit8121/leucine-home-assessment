import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cleaningRecordsApi, type CleaningRecordInput } from '../api/endpoints';
import { ApiRequestError } from '../api/client';
import type { CleaningRecord, CleaningStatus } from '../api/types';
import { fromDateTimeLocalValue, toDateTimeLocalValue } from '../lib/format';
import { Modal } from './Modal';

interface CleaningRecordFormProps {
  equipmentId: string;
  /** Present when editing; absent when adding. */
  record?: CleaningRecord;
  defaultCleanedBy: string;
  onClose: () => void;
}

export function CleaningRecordForm({
  equipmentId,
  record,
  defaultCleanedBy,
  onClose,
}: CleaningRecordFormProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(record);

  const [cleanedBy, setCleanedBy] = useState(record?.cleanedBy ?? defaultCleanedBy);
  const [cleanedAt, setCleanedAt] = useState(toDateTimeLocalValue(record?.cleanedAt ?? null));
  const [method, setMethod] = useState(record?.method ?? '');
  const [notes, setNotes] = useState(record?.notes ?? '');
  const [status, setStatus] = useState<CleaningStatus>(record?.status ?? 'PENDING');

  const mutation = useMutation({
    mutationFn: () => {
      const payload: CleaningRecordInput = {
        cleanedBy,
        cleanedAt: fromDateTimeLocalValue(cleanedAt),
        method,
        // An empty textarea means "no notes", which the API records as an explicit null
        // so the audit trail shows value -> null rather than value -> "".
        notes: notes.trim() === '' ? null : notes,
        status,
      };

      return record
        ? cleaningRecordsApi.update(record.id, payload)
        : cleaningRecordsApi.create(equipmentId, payload);
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ['cleaning-records', equipmentId] });
      await queryClient.invalidateQueries({ queryKey: ['audit', saved.id] });
      onClose();
    },
  });

  const error = mutation.error instanceof ApiRequestError ? mutation.error : null;

  return (
    <Modal
      title={isEdit ? 'Edit cleaning record' : 'Add cleaning record'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="cleaning-record-form"
            className="btn btn-primary"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Saving…' : 'Save record'}
          </button>
        </>
      }
    >
      <form
        id="cleaning-record-form"
        className="modal-body"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        {error && error.details.length === 0 ? <p className="alert">{error.message}</p> : null}

        <div className="field">
          <label htmlFor="record-cleanedBy">Cleaned by</label>
          <input
            id="record-cleanedBy"
            value={cleanedBy}
            onChange={(e) => setCleanedBy(e.target.value)}
            required
          />
          {error?.fieldError('cleanedBy') ? (
            <span className="error">{error.fieldError('cleanedBy')}</span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="record-cleanedAt">Cleaned at</label>
          <input
            id="record-cleanedAt"
            type="datetime-local"
            value={cleanedAt}
            onChange={(e) => setCleanedAt(e.target.value)}
            required
          />
          {error?.fieldError('cleanedAt') ? (
            <span className="error">{error.fieldError('cleanedAt')}</span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="record-method">Method</label>
          <input
            id="record-method"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            placeholder="CIP - Alkaline wash"
            required
          />
          {error?.fieldError('method') ? (
            <span className="error">{error.fieldError('method')}</span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="record-notes">Notes</label>
          <textarea
            id="record-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          {error?.fieldError('notes') ? (
            <span className="error">{error.fieldError('notes')}</span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="record-status">Status</label>
          <select
            id="record-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as CleaningStatus)}
          >
            <option value="PENDING">Pending</option>
            <option value="VERIFIED">Verified</option>
          </select>
        </div>
      </form>
    </Modal>
  );
}
