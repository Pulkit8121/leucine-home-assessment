import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { equipmentApi } from '../api/endpoints';
import { ApiRequestError } from '../api/client';
import type { Equipment, EquipmentStatus } from '../api/types';
import { EquipmentStatusBadge } from './StatusBadge';
import { Modal } from './Modal';
import { FlaskIcon, PlusIcon, SearchIcon } from './icons';

interface EquipmentListProps {
  selectedId: string | null;
  onSelect: (equipment: Equipment) => void;
  canEdit: boolean;
}

export function EquipmentList({ selectedId, onSelect, canEdit }: EquipmentListProps) {
  const [statusFilter, setStatusFilter] = useState<EquipmentStatus | ''>('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const query = useQuery({
    queryKey: ['equipment', { status: statusFilter, search }],
    queryFn: () =>
      equipmentApi.list({
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(search ? { search } : {}),
      }),
  });

  return (
    <section className="panel" aria-labelledby="equipment-heading">
      <div className="panel-header">
        <h2 id="equipment-heading">Equipment</h2>
        {canEdit ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
            <PlusIcon size={14} />
            Add
          </button>
        ) : null}
      </div>

      <div className="toolbar">
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="equipment-search">Search</label>
          <div className="input-with-icon">
            <SearchIcon size={15} className="input-icon" />
            <input
              id="equipment-search"
              type="search"
              placeholder="Name or code"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="equipment-status">Status</label>
          <select
            id="equipment-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as EquipmentStatus | '')}
          >
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="RETIRED">Retired</option>
          </select>
        </div>
      </div>

      {query.isPending ? (
        <div className="skeleton-list">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton-row" />
          ))}
        </div>
      ) : null}
      {query.isError ? <p className="empty">Could not load equipment.</p> : null}
      {query.data?.length === 0 ? <p className="empty">No equipment matches.</p> : null}

      {query.data && query.data.length > 0 ? (
        <ul className="equipment-list">
          {query.data.map((item) => (
            <li key={item.id} className="equipment-item">
              <button
                type="button"
                onClick={() => onSelect(item)}
                aria-current={item.id === selectedId}
              >
                <span className={`equipment-icon status-${item.status.toLowerCase()}`}>
                  <FlaskIcon size={16} />
                </span>
                <span className="equipment-info">
                  <span className="name-row">
                    <span className="name">{item.name}</span>
                    <EquipmentStatusBadge status={item.status} />
                  </span>
                  <span className="code">{item.code}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {creating ? <EquipmentForm onClose={() => setCreating(false)} /> : null}
    </section>
  );
}

function EquipmentForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<EquipmentStatus>('ACTIVE');

  const mutation = useMutation({
    mutationFn: () => equipmentApi.create({ name, code, status }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['equipment'] });
      onClose();
    },
  });

  const error = mutation.error instanceof ApiRequestError ? mutation.error : null;

  return (
    <Modal
      title="Add equipment"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="equipment-form"
            className="btn btn-primary"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form
        id="equipment-form"
        className="modal-body"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        {error && error.details.length === 0 ? <p className="alert">{error.message}</p> : null}

        <div className="field">
          <label htmlFor="equipment-name">Name</label>
          <input
            id="equipment-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          {error?.fieldError('name') ? (
            <span className="error">{error.fieldError('name')}</span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="equipment-code">Code</label>
          <input
            id="equipment-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="MIX-001"
            required
          />
          {error?.fieldError('code') ? (
            <span className="error">{error.fieldError('code')}</span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="equipment-form-status">Status</label>
          <select
            id="equipment-form-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as EquipmentStatus)}
          >
            <option value="ACTIVE">Active</option>
            <option value="RETIRED">Retired</option>
          </select>
        </div>
      </form>
    </Modal>
  );
}
