import { buildQuery, request } from './client';
import type {
  AuthUser,
  CleaningRecord,
  CleaningRecordPage,
  CleaningStatus,
  Equipment,
  EquipmentStatus,
  Paginated,
  AuditEntry,
} from './types';

interface Envelope<T> {
  data: T;
}

export const auth = {
  login: (email: string, password: string) =>
    request<Envelope<{ token: string; user: AuthUser }>>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }).then((r) => r.data),

  me: () => request<Envelope<AuthUser>>('/api/auth/me').then((r) => r.data),
};

export const equipmentApi = {
  list: (params: { status?: EquipmentStatus; search?: string } = {}) =>
    request<Envelope<Equipment[]>>(`/api/equipment${buildQuery(params)}`).then((r) => r.data),

  create: (input: { name: string; code: string; status?: EquipmentStatus }) =>
    request<Envelope<Equipment>>('/api/equipment', {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((r) => r.data),

  update: (id: string, input: Partial<{ name: string; code: string; status: EquipmentStatus }>) =>
    request<Envelope<Equipment>>(`/api/equipment/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }).then((r) => r.data),

  remove: (id: string) => request<void>(`/api/equipment/${id}`, { method: 'DELETE' }),
};

export interface CleaningRecordInput {
  cleanedBy?: string;
  cleanedAt: string;
  method: string;
  notes?: string | null;
  status?: CleaningStatus;
}

export const cleaningRecordsApi = {
  list: (
    equipmentId: string,
    params: { limit?: number; cursor?: string | null; status?: CleaningStatus } = {},
  ) =>
    request<CleaningRecordPage>(
      `/api/equipment/${equipmentId}/cleaning-records${buildQuery(params)}`,
    ),

  create: (equipmentId: string, input: CleaningRecordInput) =>
    request<Envelope<CleaningRecord>>(`/api/equipment/${equipmentId}/cleaning-records`, {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((r) => r.data),

  update: (recordId: string, input: Partial<CleaningRecordInput>) =>
    request<Envelope<CleaningRecord>>(`/api/cleaning-records/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }).then((r) => r.data),

  audit: (recordId: string, params: { limit?: number; cursor?: string | null } = {}) =>
    request<Paginated<AuditEntry>>(`/api/cleaning-records/${recordId}/audit${buildQuery(params)}`),
};
