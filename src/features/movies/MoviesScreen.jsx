import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import MovieIcon from '@mui/icons-material/Movie';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import StarIcon from '@mui/icons-material/Star';
import { FeatureScaffold } from '../../ui/FeatureScaffold.jsx';
import { SearchField } from '../../ui/SearchField.jsx';
import { FilterButton } from '../../ui/FilterButton.jsx';
import { useAppConfig, tmdbAuth } from '../../data/AppConfig.jsx';
import { TMDB, posterUrl, tmdbCache } from './tmdbClient.js';
import { routes } from '../../routes.js';

const CATEGORIES = [
  { key: 'popular', label: 'Popular' },
  { key: 'top_rated', label: 'Top Rated' },
  { key: 'trending', label: 'Trending' },
];

export function MoviesScreen() {
  const navigate = useNavigate();
  const config = useAppConfig();
  const auth = tmdbAuth(config);

  const [media, setMedia] = useState('movie');
  const [category, setCategory] = useState('popular');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [state, setState] = useState({ kind: 'loading' });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!auth) {
        setState({ kind: 'missingKey' });
        return;
      }
      setState({ kind: 'loading' });
      try {
        let titles;
        if (debouncedQuery) {
          titles = await TMDB.search(media, debouncedQuery, auth);
        } else if (category === 'popular') {
          titles = await TMDB.popular(media, auth);
        } else if (category === 'top_rated') {
          titles = await TMDB.topRated(media, auth);
        } else {
          titles = await TMDB.trending(media, auth);
        }
        if (cancelled) return;
        tmdbCache.setList(titles);
        setState({ kind: 'ready', titles });
      } catch (e) {
        if (!cancelled) setState({ kind: 'error', message: e.message });
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [media, category, debouncedQuery, auth, reload]);

  // The Movies/TV toggle is a primary mode switch (it changes what's even
  // *possible* to show), so it stays prominent under the header. Category
  // ("Popular / Top Rated / Trending") is a softer choice — fits the filter
  // popover. A non-default category lights the filter badge.
  const categoryBadge = !debouncedQuery && category !== 'popular' ? 1 : 0;

  return (
    <FeatureScaffold
      title="Movies & TV"
      search={
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder={`Search ${media === 'tv' ? 'TV shows' : 'movies'}`}
        />
      }
      filter={
        <FilterButton badgeCount={categoryBadge} ariaLabel="Category filter">
          <CategoryFilterPanel category={category} setCategory={setCategory} />
        </FilterButton>
      }
    >
      <Tabs value={media} onChange={(_, v) => setMedia(v)} sx={{ mb: 2 }}>
        <Tab value="movie" label="Movies" />
        <Tab value="tv" label="TV" />
      </Tabs>

      {state.kind === 'loading' ? (
        <Centered><CircularProgress /></Centered>
      ) : state.kind === 'missingKey' ? (
        <ErrorPanel
          icon={<MovieIcon sx={{ fontSize: 56 }} />}
          title="TMDB key missing"
          message="Add tmdbApiKey (v3) or tmdbAccessToken (v4 bearer) to the Firestore config/app document."
        />
      ) : state.kind === 'error' ? (
        <ErrorPanel
          icon={<CloudOffIcon sx={{ fontSize: 56 }} />}
          title="Couldn't load"
          message={state.message}
          actionLabel="Retry"
          onAction={() => setReload((k) => k + 1)}
        />
      ) : state.titles.length === 0 ? (
        <ErrorPanel
          icon={<SearchIcon sx={{ fontSize: 56 }} />}
          title="No results"
          message={debouncedQuery ? `Nothing matches "${debouncedQuery}"` : "Couldn't find anything in this list."}
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(160px, 100%), 1fr))',
            gap: 2,
          }}
        >
          {state.titles.map((t) => (
            <PosterTile
              key={`${t.mediaType}-${t.id}`}
              title={t}
              onClick={() =>
                navigate(t.mediaType === 'tv' ? routes.tvDetail(t.id) : routes.movieDetail(t.id))
              }
            />
          ))}
        </Box>
      )}
    </FeatureScaffold>
  );
}

function CategoryFilterPanel({ category, setCategory }) {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
        Browse by
      </Typography>
      <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
        {CATEGORIES.map((c) => (
          <Chip
            key={c.key}
            label={c.label}
            size="small"
            onClick={() => setCategory(c.key)}
            color={category === c.key ? 'primary' : 'default'}
            variant={category === c.key ? 'filled' : 'outlined'}
          />
        ))}
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.25 }}>
        Ignored while you have a search active.
      </Typography>
    </Box>
  );
}

function PosterTile({ title, onClick }) {
  const url = posterUrl(title.posterPath);
  return (
    <Stack
      onClick={onClick}
      sx={{
        cursor: 'pointer',
        transition: 'transform 200ms ease',
        '&:hover': { transform: 'translateY(-2px)' },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          aspectRatio: '2 / 3',
          borderRadius: '14px',
          overflow: 'hidden',
          backgroundColor: 'rgba(255,255,255,0.06)',
        }}
      >
        {url ? (
          <Box component="img" src={url} alt={title.title} loading="lazy" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: 'text.secondary' }}>
            <MovieIcon sx={{ fontSize: 40 }} />
          </Box>
        )}
        {title.rating > 0 && (
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.5}
            sx={{
              position: 'absolute',
              top: 8,
              left: 8,
              px: 0.75,
              py: 0.25,
              borderRadius: 0.75,
              backgroundColor: 'rgba(0,0,0,0.6)',
              color: '#fff',
            }}
          >
            <StarIcon sx={{ fontSize: 12, color: '#FFB300' }} />
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              {title.rating.toFixed(1)}
            </Typography>
          </Stack>
        )}
      </Box>
      <Typography variant="body2" sx={{ mt: 1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title.title}
      </Typography>
      {title.year > 0 && (
        <Typography variant="caption" color="text.secondary">
          {title.year}
        </Typography>
      )}
    </Stack>
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
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 460 }}>
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
