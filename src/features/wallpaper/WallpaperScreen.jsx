import { useEffect, useMemo, useState } from 'react';
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
  const [state, setState] = useState({ kind: 'loading' });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!config.unsplashAccessKey) {
        setState({ kind: 'missingKey' });
        return;
      }
      setState({ kind: 'loading' });
      const effectiveQuery = debouncedQuery || unsplashQuery(config.wallpapersUrl);
      try {
        const photos = await searchPhotos({
          query: effectiveQuery,
          accessKey: config.unsplashAccessKey,
          orientation,
        });
        if (cancelled) return;
        wallpaperCache.set(photos);
        setState({ kind: 'ready', photos });
      } catch (e) {
        if (!cancelled) setState({ kind: 'error', message: e.message });
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, orientation, config.unsplashAccessKey, config.wallpapersUrl, reload]);

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
        <PinterestGrid photos={filteredPhotos} onClick={(id) => navigate(routes.wallpaperDetail(id))} />
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
