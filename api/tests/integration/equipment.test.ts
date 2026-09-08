import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/db/prisma.js';
import { api, createTestEquipment, createTestUser, resetDatabase, type TestUser } from '../helpers.js';

describe('equipment CRUD', () => {
  let user: TestUser;

  beforeEach(async () => {
    await resetDatabase();
    user = await createTestUser();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates equipment and uppercases the code', async () => {
    const response = await api()
      .post('/api/equipment')
      .set(...user.authHeader)
      .send({ name: 'Granulation Mixer 1', code: 'mix-001' })
      .expect(201);

    expect(response.body.data).toMatchObject({
      name: 'Granulation Mixer 1',
      code: 'MIX-001',
      status: 'ACTIVE',
    });
  });

  it('rejects a duplicate code with 409', async () => {
    await createTestEquipment({ code: 'MIX-001' });

    const response = await api()
      .post('/api/equipment')
      .set(...user.authHeader)
      .send({ name: 'Another mixer', code: 'MIX-001' })
      .expect(409);

    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('rejects an invalid code with a field-level message', async () => {
    const response = await api()
      .post('/api/equipment')
      .set(...user.authHeader)
      .send({ name: 'Bad code', code: 'MIX 001!' })
      .expect(422);

    expect(response.body.error.details).toContainEqual({
      field: 'code',
      message: 'Code may only contain letters, numbers and dashes',
    });
  });

  it('requires authentication to mutate', async () => {
    await api().post('/api/equipment').send({ name: 'X', code: 'X-1' }).expect(401);
  });

  it('lists equipment ordered by code and filters by status', async () => {
    await createTestEquipment({ code: 'TAB-002', name: 'Tablet Press 2' });
    await createTestEquipment({ code: 'MIX-001', name: 'Granulation Mixer 1' });
    await createTestEquipment({ code: 'CTR-009', name: 'Centrifuge 9', status: 'RETIRED' });

    const all = await api().get('/api/equipment').expect(200);
    expect(all.body.data.map((e: { code: string }) => e.code)).toEqual([
      'CTR-009',
      'MIX-001',
      'TAB-002',
    ]);

    const active = await api().get('/api/equipment').query({ status: 'ACTIVE' }).expect(200);
    expect(active.body.data).toHaveLength(2);
  });

  it('searches by name or code, case-insensitively', async () => {
    await createTestEquipment({ code: 'MIX-001', name: 'Granulation Mixer 1' });
    await createTestEquipment({ code: 'TAB-002', name: 'Tablet Press 2' });

    const response = await api().get('/api/equipment').query({ search: 'mixer' }).expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].code).toBe('MIX-001');
  });

  it('updates and retires equipment', async () => {
    const equipment = await createTestEquipment({ code: 'MIX-001' });

    const response = await api()
      .patch(`/api/equipment/${equipment.id}`)
      .set(...user.authHeader)
      .send({ status: 'RETIRED' })
      .expect(200);

    expect(response.body.data.status).toBe('RETIRED');
  });

  it('deletes equipment and cascades to its cleaning records', async () => {
    const equipment = await createTestEquipment({ code: 'MIX-001' });
    await api()
      .post(`/api/equipment/${equipment.id}/cleaning-records`)
      .set(...user.authHeader)
      .send({ cleanedAt: '2026-02-01T10:00:00.000Z', method: 'CIP' })
      .expect(201);

    await api()
      .delete(`/api/equipment/${equipment.id}`)
      .set(...user.authHeader)
      .expect(204);

    expect(await prisma.cleaningRecord.count({ where: { equipmentId: equipment.id } })).toBe(0);
    expect(await prisma.auditEntry.count()).toBe(0);
  });

  it('404s for an unknown id and 422s for a non-uuid id', async () => {
    await api().get('/api/equipment/11111111-1111-4111-8111-111111111111').expect(404);
    await api().get('/api/equipment/not-a-uuid').expect(422);
  });
});
