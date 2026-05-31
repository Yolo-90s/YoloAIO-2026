import { useCallback, useEffect, useState } from 'react';
import { useInfinitePagination } from '../../ui/useInfinitePagination.js';
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
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { TMDB, posterUrl, tmdbCache, genresFor } from './tmdbClient.js';
import { CategoryRow } from './CategoryRow.jsx';
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
  const [reload, setReload] = useState(0);
  // When the user clicks "See all" on a Browse-mode category row, we
  // flip into grid mode filtered to that source. The object holds
  // either { kind: 'trending' | 'top_rated' } or
  // { kind: 'genre', id, name }. null = follow normal category state.
  const [seeAllSource, setSeeAllSource] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  // Clear the "See all" pin when the user switches between movies/TV
  // or starts a search — both are mode-shifts where the previous
  // "Action movies" context no longer makes sense.
  useEffect(() => {
    setSeeAllSource(null);
  }, [media, debouncedQuery]);

  // Per-page TMDB fetch — closed over the current media/category/query
  // via useCallback so the hook re-runs whenever those change.
  // Are we showing the Netflix-style category rows (the default
  // landing) or the flat infinite-scroll grid? Browse mode is on when
  // the user has no search query, hasn't picked a non-default
  // category, and isn't drilled into a "See all" row.
  const isBrowseMode =
    !debouncedQuery && category === 'popular' && !seeAllSource;

  const fetchTmdbPage = useCallback(
    async (page) => {
      if (debouncedQuery) return TMDB.search(media, debouncedQuery, auth, page);
      // "See all" override takes precedence over the category chip.
      if (seeAllSource) {
        if (seeAllSource.kind === 'trending') return TMDB.trending(media, auth, page);
        if (seeAllSource.kind === 'top_rated') return TMDB.topRated(media, auth, page);
        if (seeAllSource.kind === 'genre')
          return TMDB.discover(media, auth, { with_genres: seeAllSource.id }, page);
      }
      if (category === 'popular') return TMDB.popular(media, auth, page);
      if (category === 'top_rated') return TMDB.topRated(media, auth, page);
      return TMDB.trending(media, auth, page);
    },
    [auth, media, category, debouncedQuery, seeAllSource]
  );

  // Cache-bust the pager whenever the user changes media/category/query/seeAll
  // OR taps Retry. Including reload in the key resets pagination.
  const seeAllKey = seeAllSource
    ? `${seeAllSource.kind}-${seeAllSource.id ?? ''}`
    : '';
  const depsKey = `${media}|${category}|${seeAllKey}|${debouncedQuery}|${reload}`;

  const {
    items: titles,
    loading,
    loadingMore,
    error,
    done,
    sentinelRef,
  } = useInfinitePagination({
    fetchPage: fetchTmdbPage,
    depsKey,
    keyOf: (t) => `${t.mediaType}-${t.id}`,
    pageSize: 20, // TMDb returns 20 results per page
    enabled: Boolean(auth) && !isBrowseMode,
  });

  // Keep the in-memory cache fed so detail screens can pick up titles
  // without a re-fetch.
  useEffect(() => {
    if (titles.length > 0) tmdbCache.setList(titles);
  }, [titles]);

  // Build the state-machine shape the rest of the JSX already
  // understands. Keeps the render branches identical to before.
  const state = !auth
    ? { kind: 'missingKey' }
    : loading
    ? { kind: 'loading' }
    : error
    ? { kind: 'error', message: error }
    : { kind: 'ready', titles };

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

      {/* If user is drilled into a "See all" row, show a small back
          chip so they can return to the browse view. */}
      {seeAllSource && (
        <Stack direction="row" alignItems="center" sx={{ mb: 2 }} spacing={1}>
          <Button
            size="small"
            onClick={() => setSeeAllSource(null)}
            startIcon={<ArrowBackIcon />}
            sx={{ textTransform: 'none' }}
          >
            Back to browse
          </Button>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {seeAllSource.kind === 'trending'
              ? 'Trending'
              : seeAllSource.kind === 'top_rated'
              ? 'Top Rated'
              : `${seeAllSource.name} ${media === 'tv' ? 'shows' : 'movies'}`}
          </Typography>
        </Stack>
      )}

      {!auth ? (
        <ErrorPanel
          icon={<MovieIcon sx={{ fontSize: 56 }} />}
          title="TMDB key missing"
          message="Add tmdbApiKey (v3) or tmdbAccessToken (v4 bearer) to the Firestore config/app document."
        />
      ) : isBrowseMode ? (
        <BrowseRows
          media={media}
          auth={auth}
          onSelect={(t) =>
            navigate(t.mediaType === 'tv' ? routes.tvDetail(t.id) : routes.movieDetail(t.id))
          }
          onSeeAll={setSeeAllSource}
        />
      ) : state.kind === 'loading' ? (
        <Centered><CircularProgress /></Centered>
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
        <>
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
          {/* Sentinel — when this box scrolls into view the hook fetches the
              next page. The 320px rootMargin in useInfinitePagination means
              loading starts before the user hits the bottom. */}
          <Box ref={sentinelRef} sx={{ height: 1 }} />
          {loadingMore && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={28} />
            </Box>
          )}
          {done && state.titles.length > 0 && (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="caption" color="text.secondary">
                You've reached the end · {state.titles.length} titles
              </Typography>
            </Box>
          )}
        </>
      )}
    </FeatureScaffold>
  );
}

/**
 * Browse view — Netflix-style vertical stack of horizontal category
 * rows. The fixed rows (Trending / Top Rated) sit at the top so the
 * landing screen always has something "above the fold"; one row per
 * genre follows. Each row is independent — failures in one don't
 * cascade, and rows with zero results hide themselves rather than
 * showing a sad placeholder.
 */
function BrowseRows({ media, auth, onSelect, onSeeAll }) {
  const genres = genresFor(media);
  const noun = media === 'tv' ? 'shows' : 'movies';
  return (
    <Box>
      <CategoryRow
        title={`Trending this week`}
        fetchRow={() => TMDB.trending(media, auth, 1)}
        PosterTile={PosterTile}
        onSelect={onSelect}
        onSeeAll={() => onSeeAll({ kind: 'trending' })}
      />
      <CategoryRow
        title="Top Rated"
        fetchRow={() => TMDB.topRated(media, auth, 1)}
        PosterTile={PosterTile}
        onSelect={onSelect}
        onSeeAll={() => onSeeAll({ kind: 'top_rated' })}
      />
      {genres.map((g) => (
        <CategoryRow
          key={g.id}
          title={`${g.name} ${noun}`}
          // Each row fetches independently — a closure over `g.id` so
          // CategoryRow's useEffect re-runs when the genre changes
          // (it won't in practice because rows are mounted once, but
          // the closure makes intent clear).
          fetchRow={() => TMDB.discover(media, auth, { with_genres: g.id }, 1)}
          PosterTile={PosterTile}
          onSelect={onSelect}
          onSeeAll={() => onSeeAll({ kind: 'genre', id: g.id, name: g.name })}
        />
      ))}
    </Box>
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
