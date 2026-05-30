import { useCallback, useEffect, useMemo, useState } from 'react';
import { useInfinitePagination } from '../../ui/useInfinitePagination.js';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import WallpaperIcon from '@mui/icons-material/Wallpaper';
import { FeatureScaffold } from '../../ui/FeatureScaffold.jsx';
import { SearchField } from '../../ui/SearchField.jsx';
import { FilterButton } from '../../ui/FilterButton.jsx';
import { useAppConfig, unsplashQuery } from '../../data/AppConfig.jsx';
import {
  searchPhotos,
  resolutionAccepts,
  wallpaperCache,
  ORIENTATIONS,
  RESOLUTIONS,
} from './unsplashClient.js';
import { routes } from '../../routes.js';

export function WallpaperScreen() {
  const navigate = useNavigate();
  const config = useAppConfig();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [orientation, setOrientation] = useState('portrait');
  const [resolution, setResolution] = useState('any');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  const effectiveQuery = debouncedQuery || unsplashQuery(config.wallpapersUrl);

  // Per-page fetch — Unsplash returns the same shape regardless of page.
  // Resolution is applied client-side (filteredPhotos below) because the
  // Unsplash search endpoint doesn't expose a min-resolution filter.
  const fetchUnsplashPage = useCallback(
    (page) =>
      searchPhotos({
        query: effectiveQuery,
        accessKey: config.unsplashAccessKey,
        orientation,
        page,
      }),
    [effectiveQuery, config.unsplashAccessKey, orientation]
  );

  const depsKey = `${effectiveQuery}|${orientation}|${reload}`;

  const {
    items: photos,
    loading,
    loadingMore,
    error,
    done,
    sentinelRef,
  } = useInfinitePagination({
    fetchPage: fetchUnsplashPage,
    depsKey,
    keyOf: (p) => p.id,
    pageSize: 30, // matches the perPage default in searchPhotos
    enabled: Boolean(config.unsplashAccessKey),
  });

  useEffect(() => {
    if (photos.length > 0) wallpaperCache.set(photos);
  }, [photos]);

  // Shape kept identical to the prior render machine so the JSX below
  // still works without bigger churn.
  const state = !config.unsplashAccessKey
    ? { kind: 'missingKey' }
    : loading
    ? { kind: 'loading' }
    : error
    ? { kind: 'error', message: error }
    : { kind: 'ready', photos };

  const filteredPhotos = useMemo(() => {
    if (state.kind !== 'ready') return [];
    return state.photos.filter((p) => resolutionAccepts(resolution, p));
  }, [state, resolution]);

  // Non-default filter values activate the badge.
  const filterBadge =
    (orientation !== 'portrait' ? 1 : 0) + (resolution !== 'any' ? 1 : 0);

  return (
    <FeatureScaffold
      title="Wallpaper"
      search={<SearchField value={query} onChange={setQuery} placeholder="Search wallpapers" />}
      filter={
        <FilterButton badgeCount={filterBadge} ariaLabel="Wallpaper filters">
          <WallpaperFilterPanel
            orientation={orientation}
            setOrientation={setOrientation}
            resolution={resolution}
            setResolution={setResolution}
          />
        </FilterButton>
      }
      actions={
        <IconButton
          onClick={() => navigate(routes.wallpaperFavorites)}
          sx={{ color: 'primary.main' }}
          aria-label="Favorites"
        >
          <BookmarkIcon />
        </IconButton>
      }
    >
      {state.kind === 'loading' ? (
        <Centered><CircularProgress /></Centered>
      ) : state.kind === 'missingKey' ? (
        <ErrorPanel
          icon={<WallpaperIcon sx={{ fontSize: 56 }} />}
          title="Wallpapers not configured"
          message="Set unsplashAccessKey in the Firestore config/app document to browse images."
        />
      ) : state.kind === 'error' ? (
        <ErrorPanel
          icon={<CloudOffIcon sx={{ fontSize: 56 }} />}
          title="Couldn't load"
          message={state.message}
          actionLabel="Retry"
          onAction={() => setReload((k) => k + 1)}
        />
      ) : filteredPhotos.length === 0 ? (
        <ErrorPanel
          icon={<SearchIcon sx={{ fontSize: 56 }} />}
          title="Nothing matches these filters"
          message="Try a wider resolution filter or a different orientation."
        />
      ) : (
        <>
          <PinterestGrid photos={filteredPhotos} onClick={(id) => navigate(routes.wallpaperDetail(id))} />
          {/* Sentinel — IntersectionObserver in useInfinitePagination
              fires loadMore when this enters the viewport. */}
          <Box ref={sentinelRef} sx={{ height: 1 }} />
          {loadingMore && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={28} />
            </Box>
          )}
          {done && filteredPhotos.length > 0 && (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="caption" color="text.secondary">
                You've reached the end · {filteredPhotos.length} photos
              </Typography>
            </Box>
          )}
        </>
      )}
    </FeatureScaffold>
  );
}

function WallpaperFilterPanel({ orientation, setOrientation, resolution, setResolution }) {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
        Orientation
      </Typography>
      <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
        {ORIENTATIONS.map((o) => {
          const active = orientation === (o.api ?? 'any');
          return (
            <Chip
              key={o.key}
              label={o.label}
              size="small"
              onClick={() => setOrientation(o.api ?? 'any')}
              color={active ? 'primary' : 'default'}
              variant={active ? 'filled' : 'outlined'}
            />
          );
        })}
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
        Minimum resolution
      </Typography>
      <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
        {RESOLUTIONS.map((r) => (
          <Chip
            key={r.key}
            label={r.label}
            size="small"
            onClick={() => setResolution(r.key)}
            color={resolution === r.key ? 'secondary' : 'default'}
            variant={resolution === r.key ? 'filled' : 'outlined'}
          />
        ))}
      </Stack>
    </Box>
  );
}

// CSS columns produce a pseudo-Pinterest layout without needing a JS
// masonry library — works at any column count, keeps natural aspect
// ratios, and stays cheap as the photo list grows.
function PinterestGrid({ photos, onClick }) {
  return (
    <Box
      sx={{
        columnCount: { xs: 2, sm: 3, md: 4, lg: 5 },
        columnGap: '12px',
      }}
    >
      {photos.map((p) => (
        <Box
          key={p.id}
          onClick={() => onClick(p.id)}
          sx={{
            breakInside: 'avoid',
            mb: '12px',
            borderRadius: '16px',
            overflow: 'hidden',
            cursor: 'pointer',
            backgroundColor: 'rgba(255,255,255,0.05)',
            transition: 'transform 200ms ease',
            '&:hover': { transform: 'translateY(-2px)' },
          }}
        >
          <Box
            component="img"
            src={p.smallUrl}
            alt={p.description || 'Wallpaper'}
            loading="lazy"
            sx={{ display: 'block', width: '100%', height: 'auto' }}
          />
        </Box>
      ))}
    </Box>
  );
}

function Centered({ children }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>{children}</Box>
  );
}

function ErrorPanel({ icon, title, message, actionLabel, onAction }) {
  return (
    <Stack alignItems="center" spacing={2} sx={{ py: 8, textAlign: 'center' }}>
      <Box sx={{ color: 'text.secondary' }}>{icon}</Box>
      <Typography variant="h6" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
        {message}
      </Typography>
      {actionLabel && onAction && (
        <Button variant="contained" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Stack>
  );
}
