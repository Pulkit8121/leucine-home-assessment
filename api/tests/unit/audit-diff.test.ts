import { describe, expect, it } from 'vitest';
import {
  diffFields,
  diffForCreate,
  normaliseAuditValue,
  type AuditableSnapshot,
} from '../../src/lib/audit-diff.js';

describe('normaliseAuditValue', () => {
  it('renders dates as ISO-8601 UTC strings', () => {
    expect(normaliseAuditValue(new Date('2026-02-01T10:30:00.000Z'))).toBe(
      '2026-02-01T10:30:00.000Z',
    );
  });

  it('collapses null and undefined to null', () => {
    expect(normaliseAuditValue(null)).toBeNull();
    expect(normaliseAuditValue(undefined)).toBeNull();
  });

  it('stringifies numbers and booleans', () => {
    expect(normaliseAuditValue(42)).toBe('42');
    expect(normaliseAuditValue(false)).toBe('false');
  });
});

describe('diffFields', () => {
  const before: AuditableSnapshot = {
    cleanedBy: 'Priya Nair',
    cleanedAt: new Date('2026-02-01T10:00:00.000Z'),
    method: 'CIP - Alkaline wash',
    notes: null,
    status: 'PENDING',
  };

  it('returns only the fields that actually changed', () => {
    const changes = diffFields(before, { status: 'VERIFIED', method: 'CIP - Alkaline wash' });

    expect(changes).toEqual([{ field: 'status', oldValue: 'PENDING', newValue: 'VERIFIED' }]);
  });

  it('ignores fields absent from the patch (PATCH semantics)', () => {
    // `notes` is not mentioned, so it must not appear as a change to undefined/null.
    const changes = diffFields(before, { method: 'Manual swab + IPA 70%' });

    expect(changes.map((c) => c.field)).toEqual(['method']);
  });

  it('records clearing an optional field as value -> null', () => {
    const withNotes = { ...before, notes: 'Batch changeover' };
    const changes = diffFields(withNotes, { notes: null });

    expect(changes).toEqual([{ field: 'notes', oldValue: 'Batch changeover', newValue: null }]);
  });

  it('records populating an empty field as null -> value', () => {
    const changes = diffFields(before, { notes: 'Visual inspection passed' });

    expect(changes).toEqual([
      { field: 'notes', oldValue: null, newValue: 'Visual inspection passed' },
    ]);
  });

  it('treats equal instants as unchanged even across Date instances', () => {
    const changes = diffFields(before, { cleanedAt: new Date('2026-02-01T10:00:00.000Z') });

    expect(changes).toEqual([]);
  });

  it('detects a real timestamp change', () => {
    const changes = diffFields(before, { cleanedAt: new Date('2026-02-01T12:15:00.000Z') });

    expect(changes).toEqual([
      {
        field: 'cleanedAt',
        oldValue: '2026-02-01T10:00:00.000Z',
        newValue: '2026-02-01T12:15:00.000Z',
      },
    ]);
  });

  it('returns an empty list when nothing changed', () => {
    expect(diffFields(before, { status: 'PENDING', cleanedBy: 'Priya Nair' })).toEqual([]);
  });

  it('honours the field allow-list and ignores everything else', () => {
    const changes = diffFields(
      { ...before, id: 'abc' },
      { id: 'xyz', status: 'VERIFIED' },
      ['cleanedBy', 'cleanedAt', 'method', 'notes', 'status'],
    );

    expect(changes.map((c) => c.field)).toEqual(['status']);
  });

  it('preserves the order of the allow-list, not of the patch', () => {
    const changes = diffFields(
      before,
      { status: 'VERIFIED', method: 'WFI final rinse' },
      ['cleanedBy', 'cleanedAt', 'method', 'notes', 'status'],
    );

    expect(changes.map((c) => c.field)).toEqual(['method', 'status']);
  });
});

describe('diffForCreate', () => {
  it('records every populated field as null -> value', () => {
    const changes = diffForCreate({
      cleanedBy: 'Priya Nair',
      cleanedAt: new Date('2026-02-01T10:00:00.000Z'),
      method: 'CIP - Acid rinse',
      notes: null,
      status: 'PENDING',
    });

    expect(changes).toEqual([
      { field: 'cleanedBy', oldValue: null, newValue: 'Priya Nair' },
      { field: 'cleanedAt', oldValue: null, newValue: '2026-02-01T10:00:00.000Z' },
      { field: 'method', oldValue: null, newValue: 'CIP - Acid rinse' },
      { field: 'status', oldValue: null, newValue: 'PENDING' },
    ]);
  });

  it('omits fields that were never set', () => {
    const changes = diffForCreate({ method: 'SIP', notes: null });

    expect(changes.map((c) => c.field)).toEqual(['method']);
  });
});
