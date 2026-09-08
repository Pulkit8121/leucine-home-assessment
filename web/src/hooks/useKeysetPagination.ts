import { useCallback, useState } from 'react';

/**
 * Keyset pagination is naturally forward-only: the server hands back the cursor for the
 * *next* page and nothing else. To offer a "Previous" button we keep the cursors we
 * have already used on a stack — going back is popping it, not asking the server for a
 * backwards cursor. Resetting (on filter or equipment change) clears the stack so page
 * numbering starts at 1 again.
 */
export interface KeysetPagination {
  cursor: string | null;
  page: number;
  canGoBack: boolean;
  next: (nextCursor: string | null) => void;
  previous: () => void;
  reset: () => void;
}

export function useKeysetPagination(): KeysetPagination {
  const [stack, setStack] = useState<(string | null)[]>([null]);

  const cursor = stack[stack.length - 1] ?? null;

  const next = useCallback((nextCursor: string | null) => {
    if (!nextCursor) return;
    setStack((current) => [...current, nextCursor]);
  }, []);

  const previous = useCallback(() => {
    setStack((current) => (current.length > 1 ? current.slice(0, -1) : current));
  }, []);

  const reset = useCallback(() => setStack([null]), []);

  return {
    cursor,
    page: stack.length,
    canGoBack: stack.length > 1,
    next,
    previous,
    reset,
  };
}
