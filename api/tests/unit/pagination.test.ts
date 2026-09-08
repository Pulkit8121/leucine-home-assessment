import { describe, expect, it } from 'vitest';
import { ApiError } from '../../src/lib/errors.js';
import { buildPage, decodeCursor, encodeCursor } from '../../src/lib/pagination.js';

interface Row {
  id: string;
  cleanedAt: Date;
}

const toCursor = (row: Row) => ({ sortValue: row.cleanedAt.toISOString(), id: row.id });

function rows(count: number): Row[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `id-${i}`,
    cleanedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, count - i)),
  }));
}

describe('cursor encoding', () => {
  it('round-trips a cursor', () => {
    const cursor = { sortValue: '2026-02-01T10:00:00.000Z', id: 'abc-123' };

    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it('produces a URL-safe token', () => {
    const token = encodeCursor({ sortValue: '2026-02-01T10:00:00.000Z', id: 'abc-123' });

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('rejects a token that is not valid base64 JSON', () => {
    expect(() => decodeCursor('not-a-cursor')).toThrow(ApiError);
  });

  it('rejects a structurally wrong cursor', () => {
    const token = Buffer.from(JSON.stringify({ foo: 'bar' })).toString('base64url');

    expect(() => decodeCursor(token)).toThrow(/Malformed cursor/);
  });

  it('rejects a cursor whose sort value is not a date', () => {
    const token = encodeCursor({ sortValue: 'yesterday', id: 'abc' });

    expect(() => decodeCursor(token)).toThrow(/Malformed cursor/);
  });
});

describe('buildPage', () => {
  it('trims the over-fetched row and exposes a next cursor', () => {
    // 11 rows fetched for a limit of 10 -> the 11th only signals "there is more".
    const page = buildPage(rows(11), 10, toCursor);

    expect(page.data).toHaveLength(10);
    expect(page.pageInfo.hasNextPage).toBe(true);
    expect(page.pageInfo.nextCursor).not.toBeNull();
    expect(decodeCursor(page.pageInfo.nextCursor!).id).toBe('id-9');
  });

  it('reports the last page when the extra row is absent', () => {
    const page = buildPage(rows(7), 10, toCursor);

    expect(page.data).toHaveLength(7);
    expect(page.pageInfo.hasNextPage).toBe(false);
    expect(page.pageInfo.nextCursor).toBeNull();
  });

  it('handles an exactly-full final page', () => {
    const page = buildPage(rows(10), 10, toCursor);

    expect(page.data).toHaveLength(10);
    expect(page.pageInfo.hasNextPage).toBe(false);
    expect(page.pageInfo.nextCursor).toBeNull();
  });

  it('handles an empty result set', () => {
    const page = buildPage([], 10, toCursor);

    expect(page.data).toEqual([]);
    expect(page.pageInfo.hasNextPage).toBe(false);
    expect(page.pageInfo.nextCursor).toBeNull();
  });
});
