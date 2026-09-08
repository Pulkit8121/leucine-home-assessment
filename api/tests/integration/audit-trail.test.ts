import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/db/prisma.js';
import { api, createTestEquipment, createTestUser, resetDatabase, type TestUser } from '../helpers.js';

describe('audit trail', () => {
  let user: TestUser;
  let equipmentId: string;

  beforeEach(async () => {
    await resetDatabase();
    user = await createTestUser();
    equipmentId = (await createTestEquipment()).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createRecord(body: Record<string, unknown> = {}) {
    const response = await api()
      .post(`/api/equipment/${equipmentId}/cleaning-records`)
      .set(...user.authHeader)
      .send({
        cleanedAt: '2026-02-01T10:00:00.000Z',
        method: 'CIP - Alkaline wash',
        status: 'PENDING',
        ...body,
      })
      .expect(201);

    return response.body.data;
  }

  it('writes a CREATE entry listing every populated field as null -> value', async () => {
    const record = await createRecord({ notes: 'Batch changeover #1001' });

    const response = await api().get(`/api/cleaning-records/${record.id}/audit`).expect(200);

    expect(response.body.data).toHaveLength(1);
    const entry = response.body.data[0];
    expect(entry.action).toBe('CREATE');
    expect(entry.actor).toMatchObject({ id: user.id, name: user.name, email: user.email });
    expect(entry.changes).toEqual([
      { field: 'cleanedAt', oldValue: null, newValue: '2026-02-01T10:00:00.000Z' },
      { field: 'cleanedBy', oldValue: null, newValue: user.name },
      { field: 'method', oldValue: null, newValue: 'CIP - Alkaline wash' },
      { field: 'notes', oldValue: null, newValue: 'Batch changeover #1001' },
      { field: 'status', oldValue: null, newValue: 'PENDING' },
    ]);
  });

  it('omits fields left empty at creation', async () => {
    const record = await createRecord();

    const response = await api().get(`/api/cleaning-records/${record.id}/audit`).expect(200);

    expect(response.body.data[0].changes.map((c: { field: string }) => c.field)).not.toContain(
      'notes',
    );
  });

  it('records only the changed fields on update, with correct old -> new values', async () => {
    const record = await createRecord({ notes: 'Initial note' });

    await api()
      .patch(`/api/cleaning-records/${record.id}`)
      .set(...user.authHeader)
      .send({ status: 'VERIFIED', notes: 'Verified against SOP-CLN-014' })
      .expect(200);

    const response = await api().get(`/api/cleaning-records/${record.id}/audit`).expect(200);

    // Newest first: the UPDATE precedes the CREATE.
    expect(response.body.data).toHaveLength(2);
    const [update, create] = response.body.data;

    expect(create.action).toBe('CREATE');
    expect(update.action).toBe('UPDATE');
    expect(update.changes).toEqual([
      { field: 'notes', oldValue: 'Initial note', newValue: 'Verified against SOP-CLN-014' },
      { field: 'status', oldValue: 'PENDING', newValue: 'VERIFIED' },
    ]);
  });

  it('does not write an audit entry when the update changes nothing', async () => {
    const record = await createRecord({ notes: 'Initial note' });

    await api()
      .patch(`/api/cleaning-records/${record.id}`)
      .set(...user.authHeader)
      .send({ status: 'PENDING', method: 'CIP - Alkaline wash' })
      .expect(200);

    const response = await api().get(`/api/cleaning-records/${record.id}/audit`).expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].action).toBe('CREATE');
  });

  it('records clearing a field as value -> null', async () => {
    const record = await createRecord({ notes: 'Will be cleared' });

    await api()
      .patch(`/api/cleaning-records/${record.id}`)
      .set(...user.authHeader)
      .send({ notes: null })
      .expect(200);

    const response = await api().get(`/api/cleaning-records/${record.id}/audit`).expect(200);

    expect(response.body.data[0].changes).toEqual([
      { field: 'notes', oldValue: 'Will be cleared', newValue: null },
    ]);
  });

  it('attributes each entry to the user who made that change', async () => {
    const record = await createRecord();
    const supervisor = await createTestUser({
      email: 'supervisor@test.local',
      name: 'Marcus Vogel',
    });

    await api()
      .patch(`/api/cleaning-records/${record.id}`)
      .set(...supervisor.authHeader)
      .send({ status: 'VERIFIED' })
      .expect(200);

    const response = await api().get(`/api/cleaning-records/${record.id}/audit`).expect(200);

    expect(response.body.data[0].actor.email).toBe('supervisor@test.local');
    expect(response.body.data[1].actor.email).toBe(user.email);
  });

  it('rolls the audit entry back with the record when the transaction fails', async () => {
    const record = await createRecord();

    // A method longer than the validator allows must be rejected before any write.
    await api()
      .patch(`/api/cleaning-records/${record.id}`)
      .set(...user.authHeader)
      .send({ method: 'x'.repeat(500) })
      .expect(422);

    const entries = await prisma.auditEntry.count({ where: { cleaningRecordId: record.id } });
    expect(entries).toBe(1);
  });

  it('returns 404 for the audit history of an unknown record', async () => {
    await api()
      .get('/api/cleaning-records/11111111-1111-4111-8111-111111111111/audit')
      .expect(404);
  });

  it('paginates the audit history newest first', async () => {
    const record = await createRecord();

    for (const method of ['CIP - Acid rinse', 'Manual swab + IPA 70%', 'WFI final rinse']) {
      await api()
        .patch(`/api/cleaning-records/${record.id}`)
        .set(...user.authHeader)
        .send({ method })
        .expect(200);
    }

    const first = await api()
      .get(`/api/cleaning-records/${record.id}/audit`)
      .query({ limit: 2 })
      .expect(200);

    expect(first.body.data).toHaveLength(2);
    expect(first.body.pageInfo.hasNextPage).toBe(true);

    const second = await api()
      .get(`/api/cleaning-records/${record.id}/audit`)
      .query({ limit: 2, cursor: first.body.pageInfo.nextCursor })
      .expect(200);

    // 1 CREATE + 3 UPDATEs = 4 entries across two pages, with no overlap.
    expect(second.body.data).toHaveLength(2);
    expect(second.body.pageInfo.hasNextPage).toBe(false);

    const ids = [...first.body.data, ...second.body.data].map((e: { id: string }) => e.id);
    expect(new Set(ids).size).toBe(4);
    expect(second.body.data[1].action).toBe('CREATE');
  });
});
