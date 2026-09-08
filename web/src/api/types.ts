/**
 * Wire types. These mirror the API's responses; they are hand-written rather than
 * generated to keep the exercise self-contained, and the API's own Zod schemas remain
 * the single source of truth for validation.
 */
export type EquipmentStatus = 'ACTIVE' | 'RETIRED';
export type CleaningStatus = 'PENDING' | 'VERIFIED';
export type AuditAction = 'CREATE' | 'UPDATE';

export interface Equipment {
  id: string;
  name: string;
  code: string;
  status: EquipmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CleaningRecord {
  id: string;
  equipmentId: string;
  cleanedBy: string;
  cleanedById: string | null;
  cleanedAt: string;
  method: string;
  notes: string | null;
  status: CleaningStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AuditChange {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface AuditEntry {
  id: string;
  action: AuditAction;
  actor: { id: string | null; name: string; email: string };
  createdAt: string;
  changes: AuditChange[];
}

export interface PageInfo {
  nextCursor: string | null;
  hasNextPage: boolean;
  limit: number;
}

export interface Paginated<T> {
  data: T[];
  pageInfo: PageInfo;
}

export interface CleaningRecordPage extends Paginated<CleaningRecord> {
  total: number;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface FieldIssue {
  field: string;
  message: string;
}
