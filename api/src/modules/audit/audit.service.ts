import type { AuditAction } from '@prisma/client';
import { prisma, type PrismaTransaction } from '../../db/prisma.js';
import { ApiError } from '../../lib/errors.js';
import type { FieldChange } from '../../lib/audit-diff.js';
import { buildPage, decodeCursor, type Page } from '../../lib/pagination.js';
import type { AuthUser } from '../auth/auth.types.js';

export interface RecordAuditInput {
  cleaningRecordId: string;
  action: AuditAction;
  actor: AuthUser;
  changes: FieldChange[];
}

/**
 * Persist one audit entry plus a row per changed field.
 *
 * Takes the transaction client as an argument rather than using the global one: the
 * audit entry must be committed atomically with the change it describes, otherwise a
 * crash between the two writes leaves an untraceable mutation in the log.
 *
 * An UPDATE that changed nothing writes no entry at all — a no-op save is not an event.
 */
export async function recordAudit(tx: PrismaTransaction, input: RecordAuditInput): Promise<void> {
  if (input.changes.length === 0) return;

  await tx.auditEntry.create({
    data: {
      cleaningRecordId: input.cleaningRecordId,
      action: input.action,
      actorId: input.actor.id,
      actorName: input.actor.name,
      actorEmail: input.actor.email,
      changes: {
        create: input.changes.map((change) => ({
          field: change.field,
          oldValue: change.oldValue,
          newValue: change.newValue,
        })),
      },
    },
  });
}

export interface AuditHistoryQuery {
  limit: number;
  cursor?: string;
}

export interface AuditEntryDto {
  id: string;
  action: AuditAction;
  actor: { id: string | null; name: string; email: string };
  createdAt: Date;
  changes: { field: string; oldValue: string | null; newValue: string | null }[];
}

/**
 * Audit history for one cleaning record, newest first, keyset-paginated on
 * (createdAt DESC, id DESC) — the same ordering the index is built for.
 */
export async function getAuditHistory(
  cleaningRecordId: string,
  query: AuditHistoryQuery,
): Promise<Page<AuditEntryDto>> {
  const exists = await prisma.cleaningRecord.findUnique({
    where: { id: cleaningRecordId },
    select: { id: true },
  });
  if (!exists) throw ApiError.notFound('Cleaning record not found');

  const cursor = query.cursor ? decodeCursor(query.cursor) : null;

  const rows = await prisma.auditEntry.findMany({
    where: {
      cleaningRecordId,
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: new Date(cursor.sortValue) } },
              { createdAt: new Date(cursor.sortValue), id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
    include: { changes: { orderBy: { field: 'asc' } } },
  });

  return buildPage(
    rows.map(
      (row): AuditEntryDto => ({
        id: row.id,
        action: row.action,
        actor: { id: row.actorId, name: row.actorName, email: row.actorEmail },
        createdAt: row.createdAt,
        changes: row.changes.map((c) => ({
          field: c.field,
          oldValue: c.oldValue,
          newValue: c.newValue,
        })),
      }),
    ),
    query.limit,
    (row) => ({ sortValue: row.createdAt.toISOString(), id: row.id }),
  );
}
