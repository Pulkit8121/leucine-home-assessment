import type { CleaningRecord, Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { diffFields, diffForCreate, type AuditableSnapshot } from '../../lib/audit-diff.js';
import { buildPage, decodeCursor, type Page } from '../../lib/pagination.js';
import { recordAudit } from '../audit/audit.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import type {
  CreateCleaningRecordInput,
  ListCleaningRecordsQuery,
  UpdateCleaningRecordInput,
} from './cleaning-records.schemas.js';

/**
 * The single source of truth for which columns are user-visible and therefore auditable.
 * Anything not in this list (id, equipmentId, createdAt, updatedAt) is either immutable
 * or machine-generated and would only add noise to the trail.
 */
export const AUDITED_FIELDS = ['cleanedBy', 'cleanedAt', 'method', 'notes', 'status'] as const;

function auditSnapshot(record: CleaningRecord): AuditableSnapshot {
  return {
    cleanedBy: record.cleanedBy,
    cleanedAt: record.cleanedAt,
    method: record.method,
    notes: record.notes,
    status: record.status,
  };
}

async function assertEquipmentExists(equipmentId: string): Promise<void> {
  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: { id: true },
  });
  if (!equipment) throw ApiError.notFound('Equipment not found');
}

/**
 * List cleaning records for one equipment, newest cleaning first, keyset-paginated.
 *
 * The WHERE clause implements the keyset predicate
 *   (cleanedAt, id) < (cursor.cleanedAt, cursor.id)
 * as an explicit OR because Prisma has no row-value comparison. It maps to the same
 * index range scan on (equipmentId, cleanedAt DESC, id DESC).
 */
export async function listCleaningRecords(
  equipmentId: string,
  query: ListCleaningRecordsQuery,
): Promise<Page<CleaningRecord> & { total: number }> {
  await assertEquipmentExists(equipmentId);

  const cursor = query.cursor ? decodeCursor(query.cursor) : null;

  const baseWhere: Prisma.CleaningRecordWhereInput = {
    equipmentId,
    ...(query.status ? { status: query.status } : {}),
  };

  const where: Prisma.CleaningRecordWhereInput = {
    ...baseWhere,
    ...(cursor
      ? {
          OR: [
            { cleanedAt: { lt: new Date(cursor.sortValue) } },
            { cleanedAt: new Date(cursor.sortValue), id: { lt: cursor.id } },
          ],
        }
      : {}),
  };

  // total is counted against the unpaginated filter so the UI can show "x of y".
  // It is the one thing keyset pagination does not give for free; it is a separate,
  // index-only count rather than something that constrains the page query.
  const [rows, total] = await Promise.all([
    prisma.cleaningRecord.findMany({
      where,
      orderBy: [{ cleanedAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    }),
    prisma.cleaningRecord.count({ where: baseWhere }),
  ]);

  const page = buildPage(rows, query.limit, (row) => ({
    sortValue: row.cleanedAt.toISOString(),
    id: row.id,
  }));

  return { ...page, total };
}

export async function getCleaningRecord(recordId: string): Promise<CleaningRecord> {
  const record = await prisma.cleaningRecord.findUnique({ where: { id: recordId } });
  if (!record) throw ApiError.notFound('Cleaning record not found');
  return record;
}

export async function createCleaningRecord(
  equipmentId: string,
  input: CreateCleaningRecordInput,
  actor: AuthUser,
): Promise<CleaningRecord> {
  await assertEquipmentExists(equipmentId);

  // The record and its CREATE audit entry are written in one transaction: a cleaning
  // event that exists without a trail would be an audit finding, not a bug we can fix later.
  return prisma.$transaction(async (tx) => {
    const record = await tx.cleaningRecord.create({
      data: {
        equipmentId,
        cleanedBy: input.cleanedBy ?? actor.name,
        cleanedById: actor.id,
        cleanedAt: input.cleanedAt,
        method: input.method,
        notes: input.notes ?? null,
        status: input.status,
      },
    });

    await recordAudit(tx, {
      cleaningRecordId: record.id,
      action: 'CREATE',
      actor,
      changes: diffForCreate(auditSnapshot(record), AUDITED_FIELDS),
    });

    return record;
  });
}

export async function updateCleaningRecord(
  recordId: string,
  input: UpdateCleaningRecordInput,
  actor: AuthUser,
): Promise<CleaningRecord> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.cleaningRecord.findUnique({ where: { id: recordId } });
    if (!existing) throw ApiError.notFound('Cleaning record not found');

    const changes = diffFields(auditSnapshot(existing), input as AuditableSnapshot, AUDITED_FIELDS);

    // Nothing actually changed: skip the write and the audit entry, and return the row
    // unchanged so the client still gets a 200 with the current state.
    if (changes.length === 0) return existing;

    const updated = await tx.cleaningRecord.update({
      where: { id: recordId },
      data: input,
    });

    await recordAudit(tx, {
      cleaningRecordId: updated.id,
      action: 'UPDATE',
      actor,
      changes,
    });

    return updated;
  });
}
