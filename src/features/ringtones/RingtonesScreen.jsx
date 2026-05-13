import { useEffect, useState } from 'react';
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
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import DownloadIcon from '@mui/icons-material/Download';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import { FeatureScaffold } from '../../ui/FeatureScaffold.jsx';
import { SearchField } from '../../ui/SearchField.jsx';
import { FilterButton } from '../../ui/FilterButton.jsx';
import { useAppConfig } from '../../data/AppConfig.jsx';
import { searchTones, formatDuration, CATEGORIES } from './freesoundClient.js';
import {
  observeFavorites,
  addFavorite,
  removeFavorite,
} from './ringtoneFavoritesRepository.js';
import { useRingtonePlayer } from './ringtonePlayer.js';
import { routes } from '../../routes.js';

const DEFAULT_CATEGORY = 'ringtone';

export function RingtonesScreen() {
  const navigate = useNavigate();
  const config = useAppConfig();
  const player = useRingtonePlayer();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [state, setState] = useState({ kind: 'loading' });
  const [reload, setReload] = useState(0);
  const [favorites, setFavorites] = useState([]);

  useEffect(() => observeFavorites(setFavorites), []);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!config.freesoundApiKey) {
        setState({ kind: 'missingKey' });
        return;
      }
      setState({ kind: 'loading' });
      try {
        const tones = await searchTones({
          query: debouncedQuery,
          categoryKey: category,
          apiKey: config.freesoundApiKey,
        });
        if (!cancelled) setState({ kind: 'ready', tones });
      } catch (e) {
        if (!cancelled) setState({ kind: 'error', message: e.message });
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, category, config.freesoundApiKey, reload]);

  const favoriteIds = new Set(favorites.map((f) => f.toneId || f.id));
  const categoryBadge = category !== DEFAULT_CATEGORY ? 1 : 0;

  return (
    <FeatureScaffold
      title="Ringtones"
      search={<SearchField value={query} onChange={setQuery} placeholder="Search tones" />}
      filter={
        <FilterButton badgeCount={categoryBadge} ariaLabel="Category filter">
          <CategoryFilterPanel category={category} setCategory={setCategory} />
        </FilterButton>
      }
      actions={
        <IconButton
          onClick={() => navigate(routes.ringtoneFavorites)}
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
          icon={<MusicNoteIcon sx={{ fontSize: 56 }} />}
          title="Freesound key missing"
          message="Get a free token at freesound.org/apiv2/apply and add freesoundApiKey to the Firestore config/app document."
        />
      ) : state.kind === 'error' ? (
        <ErrorPanel
          icon={<CloudOffIcon sx={{ fontSize: 56 }} />}
          title="Couldn't load"
          message={state.message}
          actionLabel="Retry"
          onAction={() => setReload((k) => k + 1)}
        />
      ) : state.tones.length === 0 ? (
        <ErrorPanel
          icon={<SearchIcon sx={{ fontSize: 56 }} />}
          title={debouncedQuery ? `No results for "${debouncedQuery}"` : 'No tones here'}
          message="Try a different category or search term."
        />
      ) : (
        <ToneList
          tones={state.tones}
          player={player}
          favoriteIds={favoriteIds}
          onToggleFav={async (tone) => {
            if (favoriteIds.has(tone.id)) await removeFavorite(tone.id);
            else await addFavorite(tone);
          }}
        />
      )}
    </FeatureScaffold>
  );
}

function CategoryFilterPanel({ category, setCategory }) {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
        Category
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
    </Box>
  );
}

export function ToneList({ tones, player, favoriteIds, onToggleFav }) {
  return (
    <Stack divider={<Box sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)', ml: 9.5 }} />}>
      {tones.map((tone) => (
        <ToneRow
          key={tone.id}
          tone={tone}
          isCurrent={player.playingId === tone.id}
          isPlaying={player.playingId === tone.id && player.isPlaying}
          isLoading={player.playingId === tone.id && player.loading}
          fav={favoriteIds.has(tone.id)}
          onToggle={() => player.toggle(tone.id, tone.streamUrl)}
          onToggleFav={() => onToggleFav(tone)}
        />
      ))}
    </Stack>
  );
}

function ToneRow({ tone, isCurrent, isPlaying, isLoading, fav, onToggle, onToggleFav }) {
  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = tone.streamUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.download = `${(tone.name || 'tone').replace(/[^a-z0-9-_]+/gi, '-')}.${tone.fileExtension || 'mp3'}`;
    a.click();
  };
  return (
    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ py: 1.25, px: 1 }}>
      <IconButton
        onClick={onToggle}
        sx={{
          width: 48,
          height: 48,
          backgroundColor: isCurrent ? 'primary.main' : 'rgba(255,255,255,0.08)',
          color: isCurrent ? 'primary.contrastText' : 'text.primary',
          '&:hover': { backgroundColor: isCurrent ? 'primary.dark' : 'rgba(255,255,255,0.16)' },
        }}
      >
        {isLoading ? (
          <CircularProgress size={20} color="inherit" />
        ) : isPlaying ? (
          <PauseIcon />
        ) : (
          <PlayArrowIcon />
        )}
      </IconButton>
      <Stack sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body1" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {tone.name}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {tone.subtitle ? `${tone.subtitle} · ` : ''}
          {formatDuration(tone.durationSec)}
          {tone.tags?.length ? ` · ${tone.tags.slice(0, 3).join(', ')}` : ''}
        </Typography>
      </Stack>
      <IconButton onClick={onToggleFav} sx={{ color: fav ? 'primary.main' : 'text.secondary' }}>
        {fav ? <BookmarkIcon /> : <BookmarkBorderIcon />}
      </IconButton>
      <IconButton onClick={handleDownload} sx={{ color: 'text.secondary' }} title="Download (browsers can't set ringtones directly)">
        <DownloadIcon />
      </IconButton>
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
