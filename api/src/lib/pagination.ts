import { ApiError } from './errors.js';

/**
 * Keyset ("cursor") pagination.
 *
 * Why keyset instead of OFFSET/LIMIT: a cleaning log is append-heavy and read newest
 * first. With OFFSET, inserting a row while a user pages shifts every later page by
 * one, so rows get skipped or repeated; and the database still has to walk and discard
 * all the skipped rows, so page N costs O(N * pageSize). A keyset cursor turns each
 * page into an index range scan on (cleanedAt DESC, id DESC) with constant cost, and
 * the result set is stable regardless of concurrent writes.
 *
 * The cursor is the sort key of the last row on the page, base64url-encoded so callers
 * treat it as opaque and we stay free to change the sort key later.
 */

export interface Cursor {
  /** ISO-8601 timestamp of the last row on the previous page. */
  sortValue: string;
  /** Row id, the tie-breaker that makes the sort key unique and the scan stable. */
  id: string;
}

export interface Page<T> {
  data: T[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
    limit: number;
  };
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeCursor(raw: string): Cursor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    throw ApiError.badRequest('Malformed cursor');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as Cursor).sortValue !== 'string' ||
    typeof (parsed as Cursor).id !== 'string'
  ) {
    throw ApiError.badRequest('Malformed cursor');
  }

  const cursor = parsed as Cursor;
  if (Number.isNaN(Date.parse(cursor.sortValue))) {
    throw ApiError.badRequest('Malformed cursor');
  }

  return cursor;
}

/**
 * Turn an over-fetched result set (limit + 1 rows) into a page.
 * Fetching one extra row is how we know whether a next page exists without a COUNT.
 */
export function buildPage<T>(
  rows: T[],
  limit: number,
  toCursor: (row: T) => Cursor,
): Page<T> {
  const hasNextPage = rows.length > limit;
  const data = hasNextPage ? rows.slice(0, limit) : rows;
  const last = data[data.length - 1];

  return {
    data,
    pageInfo: {
      nextCursor: hasNextPage && last ? encodeCursor(toCursor(last)) : null,
      hasNextPage,
      limit,
    },
  };
}
