import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Shared infinite-scroll hook for the Movies / Music / Wallpaper grids.
 *
 * Given a fetch function that takes a page number and returns a list of
 * items, this hook:
 *
 *   - calls fetchPage(1) on mount (or when the deps key changes)
 *   - exposes `items`, `loading`, `loadingMore`, `error`, `done`
 *   - returns a `sentinelRef` — attach it to a div at the bottom of the
 *     list and the hook will load the next page each time that div
 *     scrolls into view
 *   - de-duplicates items by `keyOf(item)` so accidental overlap between
 *     pages doesn't render duplicate rows
 *
 * The `depsKey` parameter is the cache-bust signal — change it (e.g.
 * when the search query or filter category changes) to reset and fetch
 * from page 1.
 */
export function useInfinitePagination({
  fetchPage,
  depsKey,
  keyOf,
  pageSize,
  enabled = true,
}) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  // Track inflight state via refs so the IntersectionObserver callback
  // doesn't race with React re-renders. Without these, scrolling
  // quickly can fire a dozen overlapping fetches in the same frame.
  const inflightRef = useRef(false);
  const doneRef = useRef(false);
  const pageRef = useRef(1);
  const seenKeysRef = useRef(new Set());

  // Reset everything when the cache-bust key changes. This is the
  // "user typed a new search query" case.
  useEffect(() => {
    pageRef.current = 1;
    doneRef.current = false;
    inflightRef.current = false;
    seenKeysRef.current = new Set();
    setItems([]);
    setPage(1);
    setDone(false);
    setError(null);

    if (!enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    inflightRef.current = true;
    (async () => {
      try {
        const first = await fetchPage(1);
        if (cancelled) return;
        const fresh = dedupe(first, seenKeysRef.current, keyOf);
        setItems(fresh);
        if (pageSize != null && first.length < pageSize) {
          doneRef.current = true;
          setDone(true);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load');
      } finally {
        if (!cancelled) {
          inflightRef.current = false;
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, enabled]);

  // Load next page — called by the sentinel's IntersectionObserver and
  // exposed for manual "load more" buttons.
  const loadMore = useCallback(async () => {
    if (inflightRef.current || doneRef.current) return;
    inflightRef.current = true;
    setLoadingMore(true);
    const nextPage = pageRef.current + 1;
    try {
      const more = await fetchPage(nextPage);
      const fresh = dedupe(more, seenKeysRef.current, keyOf);
      if (fresh.length === 0) {
        // Either we hit the end of the catalog or every item on this
        // page was a dupe of what we already had — same outcome:
        // there's nothing new to show.
        doneRef.current = true;
        setDone(true);
      } else {
        setItems((prev) => prev.concat(fresh));
        pageRef.current = nextPage;
        setPage(nextPage);
        if (pageSize != null && more.length < pageSize) {
          doneRef.current = true;
          setDone(true);
        }
      }
    } catch (e) {
      setError(e.message || 'Failed to load more');
    } finally {
      inflightRef.current = false;
      setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPage, keyOf, pageSize]);

  // Sentinel — attach via ref to a div at the bottom of the rendered
  // list. When the div enters the viewport, load the next page.
  const sentinelRef = useRef(null);
  const setSentinel = useCallback(
    (node) => {
      sentinelRef.current = node;
      if (!node) return;
      // We re-create the observer per node attach. Cleaner than tracking
      // a singleton observer across re-renders.
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) loadMore();
        },
        { rootMargin: '320px' } // start loading 320px before the sentinel hits the viewport
      );
      observer.observe(node);
      // Stash the disconnect on the node itself so React's ref callback
      // can clean up when the node unmounts.
      node._cleanupObserver = () => observer.disconnect();
    },
    [loadMore]
  );

  // Cleanup when the sentinel is detached.
  useEffect(() => {
    return () => {
      sentinelRef.current?._cleanupObserver?.();
    };
  }, []);

  return {
    items,
    page,
    loading,
    loadingMore,
    error,
    done,
    sentinelRef: setSentinel,
    loadMore,
  };
}

function dedupe(incoming, seenKeys, keyOf) {
  const out = [];
  for (const item of incoming) {
    const k = keyOf(item);
    if (k == null) continue;
    if (seenKeys.has(k)) continue;
    seenKeys.add(k);
    out.push(item);
  }
  return out;
}
