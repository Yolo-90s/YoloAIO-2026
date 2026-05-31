import { useEffect, useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

/**
 * Netflix-style horizontal category strip — one of these per row in
 * the Movies browse view. Each row fetches its own first page from
 * TMDb (~20 titles) and renders posters in a scroll-snap container.
 *
 * The fetcher is passed as a prop so the same component handles
 * Trending / Top Rated / "Action" / "Comedy" / etc. without hardcoding
 * endpoints. "See all" surfaces the row in full-grid view (handled
 * by the parent via onSeeAll).
 */
export function CategoryRow({ title, fetchRow, PosterTile, onSelect, onSeeAll }) {
  const [titles, setTitles] = useState([]);
  const [state, setState] = useState('loading'); // 'loading' | 'ready' | 'error'

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    fetchRow()
      .then((items) => {
        if (cancelled) return;
        setTitles(items);
        setState(items.length > 0 ? 'ready' : 'empty');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [fetchRow]);

  // Don't render the row at all if it errored or came back empty —
  // an empty row with just a title would look broken.
  if (state === 'error' || state === 'empty') return null;

  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, flex: 1 }}>
          {title}
        </Typography>
        {onSeeAll && state === 'ready' && (
          <Button
            size="small"
            onClick={onSeeAll}
            endIcon={<ChevronRightIcon />}
            sx={{ minWidth: 0, color: 'text.secondary', textTransform: 'none' }}
          >
            See all
          </Button>
        )}
      </Stack>
      <Box
        sx={{
          display: 'flex',
          gap: 1.5,
          overflowX: 'auto',
          // CSS scroll-snap keeps poster edges flush after a flick —
          // matches Netflix / Disney+ horizontal-row behaviour.
          scrollSnapType: 'x mandatory',
          pb: 1,
          // Hide scrollbar across browsers; the snap behaviour gives
          // enough visual cue that the row is scrollable.
          '&::-webkit-scrollbar': { display: 'none' },
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {state === 'loading'
          ? // Skeleton placeholders so the row doesn't pop in.
            Array.from({ length: 8 }).map((_, i) => (
              <Box
                key={i}
                sx={{
                  flex: '0 0 auto',
                  width: 140,
                  aspectRatio: '2 / 3',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                }}
              />
            ))
          : titles.map((t) => (
              <Box
                key={`${t.mediaType}-${t.id}`}
                sx={{
                  flex: '0 0 auto',
                  width: 140,
                  scrollSnapAlign: 'start',
                }}
              >
                <PosterTile title={t} onClick={() => onSelect(t)} />
              </Box>
            ))}
      </Box>
    </Box>
  );
}
