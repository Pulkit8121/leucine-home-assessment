import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/db/prisma.js';
import { api, createTestEquipment, createTestUser, resetDatabase, type TestUser } from '../helpers.js';

describe('cleaning records', () => {
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

  const validBody = {
    cleanedAt: '2026-02-01T10:00:00.000Z',
    method: 'CIP - Alkaline wash',
    notes: 'Batch changeover',
    status: 'PENDING' as const,
  };

  function create(body: Record<string, unknown> = {}) {
    return api()
      .post(`/api/equipment/${equipmentId}/cleaning-records`)
      .set(...user.authHeader)
      .send({ ...validBody, ...body });
  }

  it('creates a record and defaults cleanedBy to the authenticated user', async () => {
    const response = await create().expect(201);

    expect(response.body.data).toMatchObject({
      equipmentId,
      cleanedBy: user.name,
      cleanedById: user.id,
      method: 'CIP - Alkaline wash',
      status: 'PENDING',
    });
  });

  it('accepts an explicit cleanedBy for a record entered on behalf of an operator', async () => {
    const response = await create({ cleanedBy: 'Night shift operator' }).expect(201);

    expect(response.body.data.cleanedBy).toBe('Night shift operator');
    // The account that entered it is still recorded separately.
    expect(response.body.data.cleanedById).toBe(user.id);
  });

  it('requires authentication', async () => {
    await api()
      .post(`/api/equipment/${equipmentId}/cleaning-records`)
      .send(validBody)
      .expect(401);
  });

  it('rejects a future cleanedAt', async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const response = await create({ cleanedAt: tomorrow }).expect(422);

    expect(response.body.error.details[0].field).toBe('cleanedAt');
  });

  it('rejects a missing method with a field-level error', async () => {
    const response = await api()
      .post(`/api/equipment/${equipmentId}/cleaning-records`)
      .set(...user.authHeader)
      .send({ cleanedAt: validBody.cleanedAt })
      .expect(422);

    expect(response.body.error.details.map((d: { field: string }) => d.field)).toContain('method');
  });

  it('rejects an unknown status value', async () => {
    await create({ status: 'APPROVED' }).expect(422);
  });

  it('404s when creating against unknown equipment', async () => {
    await api()
      .post('/api/equipment/11111111-1111-4111-8111-111111111111/cleaning-records')
      .set(...user.authHeader)
      .send(validBody)
      .expect(404);
  });

  it('updates a record', async () => {
    const created = await create().expect(201);

    const response = await api()
      .patch(`/api/cleaning-records/${created.body.data.id}`)
      .set(...user.authHeader)
      .send({ status: 'VERIFIED' })
      .expect(200);

    expect(response.body.data.status).toBe('VERIFIED');
  });

  it('rejects an empty patch', async () => {
    const created = await create().expect(201);

    await api()
      .patch(`/api/cleaning-records/${created.body.data.id}`)
      .set(...user.authHeader)
      .send({})
      .expect(422);
  });

  it('404s when updating an unknown record', async () => {
    await api()
      .patch('/api/cleaning-records/11111111-1111-4111-8111-111111111111')
      .set(...user.authHeader)
      .send({ status: 'VERIFIED' })
      .expect(404);
  });

  it('fetches a single record', async () => {
    const created = await create().expect(201);

    const response = await api()
      .get(`/api/cleaning-records/${created.body.data.id}`)
      .expect(200);

    expect(response.body.data.id).toBe(created.body.data.id);
  });

  it('trims whitespace out of text fields', async () => {
    const response = await create({ method: '  SIP  ', notes: '  spaced  ' }).expect(201);

    expect(response.body.data.method).toBe('SIP');
    expect(response.body.data.notes).toBe('spaced');
  });

  it('persists exactly one record per successful create', async () => {
    await create().expect(201);
    await create().expect(201);

    expect(await prisma.cleaningRecord.count({ where: { equipmentId } })).toBe(2);
  });
});
