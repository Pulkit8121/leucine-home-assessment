import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/db/prisma.js';
import { api, createTestEquipment, createTestUser, resetDatabase, type TestUser } from '../helpers.js';

const BASE = Date.UTC(2026, 1, 1, 12, 0, 0);

describe('cleaning record pagination', () => {
  let user: TestUser;
  let equipmentId: string;

  beforeEach(async () => {
    await resetDatabase();
    user = await createTestUser();
    equipmentId = (await createTestEquipment()).id;

    // 25 records, one hour apart, alternating status. Newest is index 0.
    await prisma.cleaningRecord.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        equipmentId,
        cleanedBy: user.name,
        cleanedById: user.id,
        cleanedAt: new Date(BASE - i * 60 * 60 * 1000),
        method: `Method ${i}`,
        notes: null,
        status: i % 2 === 0 ? ('PENDING' as const) : ('VERIFIED' as const),
      })),
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function list(query: Record<string, unknown>) {
    return api().get(`/api/equipment/${equipmentId}/cleaning-records`).query(query);
  }

  it('returns the newest page first with a next cursor', async () => {
    const response = await list({ limit: 10 }).expect(200);

    expect(response.body.data).toHaveLength(10);
    expect(response.body.total).toBe(25);
    expect(response.body.pageInfo.hasNextPage).toBe(true);
    expect(response.body.pageInfo.nextCursor).toBeTruthy();
    expect(response.body.data[0].method).toBe('Method 0');
    expect(response.body.data[9].method).toBe('Method 9');
  });

  it('walks every page exactly once with no gaps or duplicates', async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;

    do {
      const response: { body: any } = await list({
        limit: 10,
        ...(cursor ? { cursor } : {}),
      }).expect(200);

      seen.push(...response.body.data.map((r: { id: string }) => r.id));
      cursor = response.body.pageInfo.nextCursor;
      pages += 1;
    } while (cursor && pages < 10);

    expect(pages).toBe(3);
    expect(seen).toHaveLength(25);
    expect(new Set(seen).size).toBe(25);
  });

  it('keeps the page stable when a newer row is inserted mid-pagination', async () => {
    // The failure mode this guards against: with OFFSET, inserting at the top of the
    // ordering shifts every later page by one and the reader silently re-sees a row.
    const first = await list({ limit: 10 }).expect(200);

    await prisma.cleaningRecord.create({
      data: {
        equipmentId,
        cleanedBy: user.name,
        cleanedById: user.id,
        cleanedAt: new Date(BASE + 60 * 60 * 1000),
        method: 'Inserted while paging',
        status: 'PENDING',
      },
    });

    const second = await list({ limit: 10, cursor: first.body.pageInfo.nextCursor }).expect(200);

    const firstIds = first.body.data.map((r: { id: string }) => r.id);
    const secondIds = second.body.data.map((r: { id: string }) => r.id);

    expect(secondIds.some((id: string) => firstIds.includes(id))).toBe(false);
    expect(second.body.data[0].method).toBe('Method 10');
  });

  it('applies the status filter to both the page and the total', async () => {
    const response = await list({ limit: 10, status: 'VERIFIED' }).expect(200);

    expect(response.body.total).toBe(12);
    expect(response.body.data).toHaveLength(10);
    expect(
      response.body.data.every((r: { status: string }) => r.status === 'VERIFIED'),
    ).toBe(true);
  });

  it('keeps the filter applied across pages', async () => {
    const first = await list({ limit: 10, status: 'VERIFIED' }).expect(200);
    const second = await list({
      limit: 10,
      status: 'VERIFIED',
      cursor: first.body.pageInfo.nextCursor,
    }).expect(200);

    expect(second.body.data).toHaveLength(2);
    expect(second.body.pageInfo.hasNextPage).toBe(false);
    expect(
      second.body.data.every((r: { status: string }) => r.status === 'VERIFIED'),
    ).toBe(true);
  });

  it('breaks ties by id when several rows share a timestamp', async () => {
    const equipment = await createTestEquipment({ code: 'TIE-001' });
    const sameInstant = new Date(BASE);

    await prisma.cleaningRecord.createMany({
      data: Array.from({ length: 5 }, (_, i) => ({
        equipmentId: equipment.id,
        cleanedBy: user.name,
        cleanedAt: sameInstant,
        method: `Tied ${i}`,
        status: 'PENDING' as const,
      })),
    });

    const seen: string[] = [];
    let cursor: string | null = null;

    do {
      const response: { body: any } = await api()
        .get(`/api/equipment/${equipment.id}/cleaning-records`)
        .query({ limit: 2, ...(cursor ? { cursor } : {}) })
        .expect(200);

      seen.push(...response.body.data.map((r: { id: string }) => r.id));
      cursor = response.body.pageInfo.nextCursor;
    } while (cursor);

    expect(new Set(seen).size).toBe(5);
  });

  it('falls back to the default page size when limit is omitted', async () => {
    const response = await list({}).expect(200);

    expect(response.body.data).toHaveLength(10);
    expect(response.body.pageInfo.limit).toBe(10);
  });

  it('rejects a limit above the configured maximum', async () => {
    const response = await list({ limit: 500 }).expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details[0].field).toBe('limit');
  });

  it('rejects a malformed cursor with 400 rather than 500', async () => {
    const response = await list({ cursor: 'definitely-not-a-cursor' }).expect(400);

    expect(response.body.error.message).toMatch(/Malformed cursor/);
  });

  it('returns an empty page for equipment with no records', async () => {
    const empty = await createTestEquipment({ code: 'EMP-001' });

    const response = await api()
      .get(`/api/equipment/${empty.id}/cleaning-records`)
      .expect(200);

    expect(response.body.data).toEqual([]);
    expect(response.body.total).toBe(0);
    expect(response.body.pageInfo.hasNextPage).toBe(false);
    expect(response.body.pageInfo.nextCursor).toBeNull();
  });

  it('404s for an unknown equipment id', async () => {
    await api()
      .get('/api/equipment/11111111-1111-4111-8111-111111111111/cleaning-records')
      .expect(404);
  });
});
