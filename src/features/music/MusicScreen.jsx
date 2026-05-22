import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  Popover,
  Radio,
  Slider,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import AlbumIcon from '@mui/icons-material/Album';
import QueueMusicIcon from '@mui/icons-material/QueueMusic';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import { FeatureScaffold } from '../../ui/FeatureScaffold.jsx';
import { SearchField } from '../../ui/SearchField.jsx';
import { FilterButton } from '../../ui/FilterButton.jsx';
import { useAppConfig } from '../../data/AppConfig.jsx';
import {
  searchSongs,
  searchAlbums,
  searchPlaylists,
  fetchAlbum,
  fetchPlaylist,
  formatTrackDuration,
  MusicProxyMissing,
} from './jiosaavnClient.js';
import { MUSIC_LANGUAGES, DEFAULT_LANGUAGE } from './musicLanguages.js';
import {
  togglePlayPause,
  seekTo,
  usePlayer,
  playTrack,
  next as playerNext,
  previous as playerPrevious,
  cycleRepeatMode,
  toggleShuffle,
  addToPlayNext,
  removeFromPlayNext,
} from './musicPlayer.js';
import { BeatVisualizer } from './BeatVisualizer.jsx';
import { FullPlayer } from './FullPlayer.jsx';
import {
  observeFavoriteTracks,
  addFavoriteTrack,
  removeFavoriteTrack,
} from './favoriteTracksRepository.js';
import {
  MUSIC_QUALITIES,
  setMusicQuality,
  useMusicQuality,
} from './musicQuality.js';
import { CastButton } from './CastButton.jsx';
import { subscribeCast } from './castManager.js';

const LANG_KEY = 'yolo_music_prefs.selected_languages';

function loadLanguages() {
  if (typeof window === 'undefined') return [DEFAULT_LANGUAGE.code];
  const raw = localStorage.getItem(LANG_KEY);
  if (!raw) return [DEFAULT_LANGUAGE.code];
  const valid = new Set(MUSIC_LANGUAGES.map((l) => l.code));
  const parsed = raw.split(',').map((s) => s.trim()).filter((c) => valid.has(c));
  return parsed.length ? parsed : [DEFAULT_LANGUAGE.code];
}

export function MusicScreen() {
  const config = useAppConfig();
  const baseUrl = config.musicApiBaseUrl?.trim();
  const player = usePlayer();

  const [tab, setTab] = useState('songs');
  const [languages, setLanguages] = useState(loadLanguages);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showFavorites, setShowFavorites] = useState(false);
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  const [reload, setReload] = useState(0);

  // Per-tab fetch state.
  const [songsState, setSongsState] = useState({ kind: 'loading' });
  const [albumsState, setAlbumsState] = useState({ kind: 'loading' });
  const [playlistsState, setPlaylistsState] = useState({ kind: 'loading' });

  // When an album or playlist is opened, we render that detail view
  // instead of the grid. Clearing this returns to the grid.
  const [selected, setSelected] = useState(null);
  const [selectedState, setSelectedState] = useState({ kind: 'idle' });

  const [favorites, setFavorites] = useState([]);

  useEffect(() => observeFavoriteTracks(setFavorites), []);
  useEffect(() => {
    localStorage.setItem(LANG_KEY, languages.join(','));
  }, [languages]);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  const primaryLang = languages[0] ?? DEFAULT_LANGUAGE.code;

  // Songs tab fetch
  useEffect(() => {
    if (tab !== 'songs') return;
    let cancelled = false;
    async function run() {
      if (!baseUrl) {
        setSongsState({ kind: 'missingProxy' });
        return;
      }
      setSongsState({ kind: 'loading' });
      try {
        const tracks = await searchSongs({ baseUrl, query: debouncedQuery, languageCode: primaryLang });
        if (!cancelled) setSongsState({ kind: 'ready', tracks });
      } catch (e) {
        if (cancelled) return;
        if (e instanceof MusicProxyMissing) setSongsState({ kind: 'missingProxy' });
        else setSongsState({ kind: 'error', message: e.message });
      }
    }
    run();
    return () => { cancelled = true; };
  }, [tab, baseUrl, debouncedQuery, primaryLang, reload]);

  // Albums tab fetch
  useEffect(() => {
    if (tab !== 'albums') return;
    let cancelled = false;
    async function run() {
      if (!baseUrl) { setAlbumsState({ kind: 'missingProxy' }); return; }
      setAlbumsState({ kind: 'loading' });
      try {
        const items = await searchAlbums({ baseUrl, query: debouncedQuery });
        if (!cancelled) setAlbumsState({ kind: 'ready', items });
      } catch (e) {
        if (cancelled) return;
        if (e instanceof MusicProxyMissing) setAlbumsState({ kind: 'missingProxy' });
        else setAlbumsState({ kind: 'error', message: e.message });
      }
    }
    run();
    return () => { cancelled = true; };
  }, [tab, baseUrl, debouncedQuery, reload]);

  // Playlists tab fetch
  useEffect(() => {
    if (tab !== 'playlists') return;
    let cancelled = false;
    async function run() {
      if (!baseUrl) { setPlaylistsState({ kind: 'missingProxy' }); return; }
      setPlaylistsState({ kind: 'loading' });
      try {
        const items = await searchPlaylists({ baseUrl, query: debouncedQuery });
        if (!cancelled) setPlaylistsState({ kind: 'ready', items });
      } catch (e) {
        if (cancelled) return;
        if (e instanceof MusicProxyMissing) setPlaylistsState({ kind: 'missingProxy' });
        else setPlaylistsState({ kind: 'error', message: e.message });
      }
    }
    run();
    return () => { cancelled = true; };
  }, [tab, baseUrl, debouncedQuery, reload]);

  // Selected album / playlist detail fetch
  useEffect(() => {
    if (!selected) { setSelectedState({ kind: 'idle' }); return; }
    let cancelled = false;
    async function run() {
      setSelectedState({ kind: 'loading' });
      try {
        const { tracks, ...rest } =
          selected.kind === 'album'
            ? await fetchAlbum({ baseUrl, id: selected.id })
            : await fetchPlaylist({ baseUrl, id: selected.id });
        if (!cancelled) setSelectedState({ kind: 'ready', tracks, meta: rest });
      } catch (e) {
        if (!cancelled) setSelectedState({ kind: 'error', message: e.message });
      }
    }
    run();
    return () => { cancelled = true; };
  }, [selected, baseUrl]);

  const favoriteIds = useMemo(
    () => new Set(favorites.map((f) => f.trackId || f.id)),
    [favorites]
  );

  const toggleLanguage = (code) => {
    setLanguages((prev) => {
      if (prev.includes(code)) {
        const next = prev.filter((c) => c !== code);
        return next.length ? next : prev;
      }
      return [...prev, code];
    });
  };

  // Songs visible after multi-language + favorites filtering.
  const visibleSongs = useMemo(() => {
    if (showFavorites) {
      return favorites.map((f) => ({
        id: f.trackId || f.id,
        title: f.title,
        artist: f.artist,
        durationSec: f.durationSec,
        artworkUrlSmall: f.artworkUrlSmall,
        artworkUrlLarge: f.artworkUrlLarge,
        language: f.language,
        year: f.year,
        streamUrl: f.streamUrl,
      }));
    }
    const fetched = songsState.kind === 'ready' ? songsState.tracks : [];
    if (languages.length <= 1) return fetched;
    const set = new Set(languages.map((c) => c.toLowerCase()));
    const matched = fetched.filter((t) => set.has((t.language || '').toLowerCase()));
    return matched.length > 0 ? matched : fetched;
  }, [songsState, favorites, languages, showFavorites]);

  const langBadge = languages.length > 1 ? languages.length : 0;
  const playingTrack = player.track;
  const isCurrentFav = playingTrack ? favoriteIds.has(playingTrack.id) : false;

  // The search/filter row only makes sense at the top level — when a
  // specific album or playlist is open, hide them so the inner list isn't
  // re-searchable through the same input.
  const showSearchControls = !selected && !showFavorites;

  // When a collection is open, the FeatureScaffold's back arrow returns
  // to the grid (one back action, not two competing ones), and the title
  // shows the album / playlist name.
  const detailMeta =
    selected && selectedState.kind === 'ready'
      ? selectedState.meta?.[selected.kind] ?? null
      : null;
  const scaffoldTitle = detailMeta?.title || 'Music';
  const scaffoldOnBack = selected ? () => setSelected(null) : undefined;

  return (
    <Box sx={{ pb: playingTrack ? '120px' : 0 }}>
      <FeatureScaffold
        title={scaffoldTitle}
        onBack={scaffoldOnBack}
        search={
          showSearchControls ? (
            <SearchField value={query} onChange={setQuery} placeholder={searchPlaceholder(tab)} />
          ) : undefined
        }
        filter={
          showSearchControls && tab === 'songs' ? (
            <FilterButton badgeCount={langBadge} ariaLabel="Language filter">
              <LanguageFilterPanel
                languages={languages}
                onToggle={toggleLanguage}
                onClear={() => setLanguages([DEFAULT_LANGUAGE.code])}
              />
            </FilterButton>
          ) : undefined
        }
        actions={
          <>
            <CastButton />
            <QualityPickerButton />
            <IconButton
              onClick={() => {
                setShowFavorites((v) => !v);
                setSelected(null);
              }}
              sx={{ color: showFavorites ? 'primary.main' : 'text.secondary' }}
              aria-label="Favorites"
            >
              {showFavorites ? <BookmarkIcon /> : <BookmarkBorderIcon />}
            </IconButton>
          </>
        }
      >
        {selected ? (
          <CollectionDetail
            kind={selected.kind}
            state={selectedState}
            playerTrackId={player.track?.id}
            isPlaying={player.isPlaying}
            isLoading={player.isLoading}
            favoriteIds={favoriteIds}
            onToggle={(t, queue) => togglePlayPause(t, queue)}
            onAddNext={addToPlayNext}
            onToggleFav={async (t) => {
              if (favoriteIds.has(t.id)) await removeFavoriteTrack(t.id);
              else await addFavoriteTrack(t);
            }}
          />
        ) : (
          <>
            {!showFavorites && (
              <Tabs
                value={tab}
                onChange={(_, v) => {
                  setTab(v);
                  setQuery('');
                }}
                sx={{ mb: 2 }}
              >
                <Tab value="songs" icon={<MusicNoteIcon fontSize="small" />} iconPosition="start" label="Songs" />
                <Tab value="albums" icon={<AlbumIcon fontSize="small" />} iconPosition="start" label="Albums" />
                <Tab value="playlists" icon={<QueueMusicIcon fontSize="small" />} iconPosition="start" label="Playlists" />
              </Tabs>
            )}

            {showFavorites ? (
              visibleSongs.length === 0 ? (
                <ErrorPanel
                  icon={<BookmarkBorderIcon sx={{ fontSize: 56 }} />}
                  title="No favorite tracks yet"
                  message="Tap the bookmark on any track to save it here."
                />
              ) : (
                <TrackList
                  tracks={visibleSongs}
                  playerTrackId={player.track?.id}
                  isPlaying={player.isPlaying}
                  isLoading={player.isLoading}
                  favoriteIds={favoriteIds}
                  onToggle={(t) => togglePlayPause(t, visibleSongs)}
                  onAddNext={addToPlayNext}
                  onToggleFav={async (t) => {
                    if (favoriteIds.has(t.id)) await removeFavoriteTrack(t.id);
                    else await addFavoriteTrack(t);
                  }}
                />
              )
            ) : tab === 'songs' ? (
              <SongsTabBody
                state={songsState}
                visibleTracks={visibleSongs}
                debouncedQuery={debouncedQuery}
                onRetry={() => setReload((k) => k + 1)}
                playerTrackId={player.track?.id}
                isPlaying={player.isPlaying}
                isLoading={player.isLoading}
                favoriteIds={favoriteIds}
                onToggle={(t) => togglePlayPause(t, visibleSongs)}
                onAddNext={addToPlayNext}
                onToggleFav={async (t) => {
                  if (favoriteIds.has(t.id)) await removeFavoriteTrack(t.id);
                  else await addFavoriteTrack(t);
                }}
              />
            ) : tab === 'albums' ? (
              <CollectionGrid
                state={albumsState}
                kind="album"
                emptyMessage={debouncedQuery ? `No albums for "${debouncedQuery}"` : 'No albums found'}
                onSelect={(item) => setSelected({ kind: 'album', id: item.id })}
                onRetry={() => setReload((k) => k + 1)}
              />
            ) : (
              <CollectionGrid
                state={playlistsState}
                kind="playlist"
                emptyMessage={debouncedQuery ? `No playlists for "${debouncedQuery}"` : 'No playlists found'}
                onSelect={(item) => setSelected({ kind: 'playlist', id: item.id })}
                onRetry={() => setReload((k) => k + 1)}
              />
            )}
          </>
        )}
      </FeatureScaffold>

      {playingTrack && !showFullPlayer && (
        <MiniPlayer
          track={playingTrack}
          isPlaying={player.isPlaying}
          isLoading={player.isLoading}
          positionSec={player.positionSec}
          durationSec={player.durationSec}
          onOpen={() => setShowFullPlayer(true)}
          onToggle={(e) => {
            e.stopPropagation();
            togglePlayPause(playingTrack);
          }}
          onSeek={seekTo}
        />
      )}

      <FullPlayer
        open={showFullPlayer}
        onClose={() => setShowFullPlayer(false)}
        player={player}
        onToggle={() => playingTrack && togglePlayPause(playingTrack)}
        onSeek={seekTo}
        onNext={playerNext}
        onPrevious={playerPrevious}
        onCycleRepeat={cycleRepeatMode}
        onToggleShuffle={toggleShuffle}
        onRemoveFromPlayNext={removeFromPlayNext}
        isFavorite={isCurrentFav}
        onToggleFavorite={
          playingTrack
            ? async () => {
                if (isCurrentFav) await removeFavoriteTrack(playingTrack.id);
                else await addFavoriteTrack(playingTrack);
              }
            : undefined
        }
      />
    </Box>
  );
}

function searchPlaceholder(tab) {
  if (tab === 'albums') return 'Search albums';
  if (tab === 'playlists') return 'Search playlists';
  return 'Search songs';
}

// ── Songs tab body ────────────────────────────────────────────────────────

function SongsTabBody({
  state,
  visibleTracks,
  debouncedQuery,
  onRetry,
  playerTrackId,
  isPlaying,
  isLoading,
  favoriteIds,
  onToggle,
  onToggleFav,
}) {
  if (state.kind === 'loading') return <Centered><CircularProgress /></Centered>;
  if (state.kind === 'missingProxy') return <ProxyMissingPanel />;
  if (state.kind === 'error') {
    return (
      <ErrorPanel
        icon={<CloudOffIcon sx={{ fontSize: 56 }} />}
        title="Couldn't load"
        message={state.message}
        actionLabel="Retry"
        onAction={onRetry}
      />
    );
  }
  if (visibleTracks.length === 0) {
    return (
      <ErrorPanel
        icon={<SearchIcon sx={{ fontSize: 56 }} />}
        title={debouncedQuery ? `No results for "${debouncedQuery}"` : 'Nothing here'}
        message="Try a different search or pick more languages from the filter."
      />
    );
  }
  return (
    <TrackList
      tracks={visibleTracks}
      playerTrackId={playerTrackId}
      isPlaying={isPlaying}
      isLoading={isLoading}
      favoriteIds={favoriteIds}
      onToggle={onToggle}
      onToggleFav={onToggleFav}
    />
  );
}

// ── Album / Playlist grid ─────────────────────────────────────────────────

function CollectionGrid({ state, kind, emptyMessage, onSelect, onRetry }) {
  if (state.kind === 'loading') return <Centered><CircularProgress /></Centered>;
  if (state.kind === 'missingProxy') return <ProxyMissingPanel />;
  if (state.kind === 'error') {
    return (
      <ErrorPanel
        icon={<CloudOffIcon sx={{ fontSize: 56 }} />}
        title="Couldn't load"
        message={state.message}
        actionLabel="Retry"
        onAction={onRetry}
      />
    );
  }
  if (!state.items?.length) {
    return (
      <ErrorPanel
        icon={<SearchIcon sx={{ fontSize: 56 }} />}
        title={emptyMessage}
        message="Try a different search term."
      />
    );
  }
  return (
    <Box
      sx={{
        display: 'grid',
        // Adaptive: as many ~180px tiles as fit, all equal size. Beats
        // hand-tuned breakpoints because it scales smoothly to any width.
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(180px, 100%), 1fr))',
        gap: 2,
        alignItems: 'start',
      }}
    >
      {state.items.map((item) => (
        <CollectionCard key={item.id} item={item} kind={kind} onClick={() => onSelect(item)} />
      ))}
    </Box>
  );
}

// All tiles share the exact same height: square cover + a fixed
// 44px text slot below for title + subtitle. Locking the text slot keeps
// the grid visually even even when one title is missing or shorter.
function CollectionCard({ item, kind, onClick }) {
  return (
    <Stack
      onClick={onClick}
      sx={{
        cursor: 'pointer',
        transition: 'transform 200ms ease',
        '&:hover': { transform: 'translateY(-2px)' },
        height: '100%',
      }}
    >
      <Box
        sx={{
          aspectRatio: '1 / 1',
          borderRadius: '14px',
          overflow: 'hidden',
          backgroundColor: 'rgba(255,255,255,0.06)',
          boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
        }}
      >
        {item.artworkUrlLarge || item.artworkUrlSmall ? (
          <Box
            component="img"
            src={item.artworkUrlLarge || item.artworkUrlSmall}
            alt={item.title}
            loading="lazy"
            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <Stack alignItems="center" justifyContent="center" sx={{ width: '100%', height: '100%', color: 'text.secondary' }}>
            {kind === 'album' ? <AlbumIcon sx={{ fontSize: 40 }} /> : <QueueMusicIcon sx={{ fontSize: 40 }} />}
          </Stack>
        )}
      </Box>
      <Box sx={{ mt: 1, height: 44, overflow: 'hidden' }}>
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}
        >
          {item.title}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}
        >
          {kind === 'album' ? item.artist : item.curator}
          {item.songCount > 0 ? ` · ${item.songCount} songs` : ''}
        </Typography>
      </Box>
    </Stack>
  );
}

// ── Selected album / playlist detail ──────────────────────────────────────

function CollectionDetail({
  kind,
  state,
  playerTrackId,
  isPlaying,
  isLoading,
  favoriteIds,
  onToggle,
  onAddNext,
  onToggleFav,
}) {
  if (state.kind === 'loading') return <Centered><CircularProgress /></Centered>;
  if (state.kind === 'error') {
    return (
      <ErrorPanel
        icon={<CloudOffIcon sx={{ fontSize: 56 }} />}
        title="Couldn't load"
        message={state.message}
      />
    );
  }
  if (state.kind !== 'ready') return null;

  const meta = state.meta?.[kind] ?? {};
  const art = meta.artworkUrlLarge || meta.artworkUrlSmall || '';
  const title = meta.title || (kind === 'album' ? 'Album' : 'Playlist');
  const subtitle = kind === 'album' ? meta.artist : meta.curator;
  const tracks = state.tracks;
  const yearLabel = kind === 'album' && meta.year ? meta.year : null;

  const handlePlayAll = () => {
    if (tracks.length > 0) playTrack(tracks[0], { queue: tracks });
  };
  const handleShuffle = () => {
    if (tracks.length > 0) {
      const idx = Math.floor(Math.random() * tracks.length);
      playTrack(tracks[idx], { queue: tracks });
    }
  };

  return (
    <Box>
      <CollectionHero
        kind={kind}
        art={art}
        title={title}
        subtitle={subtitle}
        year={yearLabel}
        songCount={tracks.length}
        onPlayAll={handlePlayAll}
        onShuffle={handleShuffle}
        canPlay={tracks.length > 0}
      />

      {tracks.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          No playable tracks in this {kind}.
        </Typography>
      ) : (
        <NumberedTrackList
          tracks={tracks}
          playerTrackId={playerTrackId}
          isPlaying={isPlaying}
          isLoading={isLoading}
          favoriteIds={favoriteIds}
          onToggle={(t) => onToggle(t, tracks)}
          onAddNext={onAddNext}
          onToggleFav={onToggleFav}
        />
      )}
    </Box>
  );
}

// Spotify-ish hero: blurred album art forms an ambient backdrop; the
// foreground holds the cover, title, meta, and play/shuffle buttons.
// Extends to the screen edges on mobile, rounded card on desktop.
function CollectionHero({ kind, art, title, subtitle, year, songCount, onPlayAll, onShuffle, canPlay }) {
  return (
    <Box
      sx={{
        position: 'relative',
        borderRadius: { xs: 0, sm: '20px' },
        overflow: 'hidden',
        mx: { xs: -2, sm: 0 },
        mb: 4,
        minHeight: { xs: 320, sm: 280 },
      }}
    >
      {art && (
        <>
          <Box
            sx={{
              position: 'absolute',
              inset: -30,
              backgroundImage: `url(${art})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(50px) brightness(0.45)',
              transform: 'scale(1.3)',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(180deg, rgba(14,11,20,0.45) 0%, rgba(14,11,20,0.9) 100%)',
            }}
          />
        </>
      )}

      <Box sx={{ position: 'relative', p: { xs: 2.5, sm: 3.5 } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 2.5, sm: 3 }}
          alignItems={{ xs: 'center', sm: 'flex-end' }}
        >
          <Box
            sx={{
              width: { xs: 180, sm: 220 },
              height: { xs: 180, sm: 220 },
              borderRadius: '14px',
              overflow: 'hidden',
              boxShadow: '0 16px 40px rgba(0,0,0,0.55)',
              backgroundColor: 'rgba(255,255,255,0.06)',
              flexShrink: 0,
            }}
          >
            {art ? (
              <Box
                component="img"
                src={art}
                alt=""
                sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <Stack
                alignItems="center"
                justifyContent="center"
                sx={{ width: '100%', height: '100%', color: 'text.secondary' }}
              >
                {kind === 'album' ? <AlbumIcon sx={{ fontSize: 56 }} /> : <QueueMusicIcon sx={{ fontSize: 56 }} />}
              </Stack>
            )}
          </Box>

          <Stack
            spacing={1.5}
            sx={{
              flex: 1,
              minWidth: 0,
              textAlign: { xs: 'center', sm: 'left' },
              alignItems: { xs: 'center', sm: 'flex-start' },
            }}
          >
            <Typography
              variant="overline"
              sx={{ color: '#fff', opacity: 0.7, letterSpacing: 2, fontWeight: 700 }}
            >
              {kind === 'album' ? 'ALBUM' : 'PLAYLIST'}
            </Typography>
            <Typography
              variant="h3"
              sx={{
                color: '#fff',
                fontWeight: 800,
                fontSize: { xs: '1.75rem', sm: '2.25rem', md: '2.5rem' },
                lineHeight: 1.15,
                wordBreak: 'break-word',
              }}
            >
              {title}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.78)' }}>
              {subtitle}
              {year ? ` · ${year}` : ''}
              {songCount > 0 ? ` · ${songCount} ${songCount === 1 ? 'song' : 'songs'}` : ''}
            </Typography>

            <Stack direction="row" spacing={1.25} sx={{ pt: 1, flexWrap: 'wrap', gap: 1 }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<PlayArrowIcon />}
                onClick={onPlayAll}
                disabled={!canPlay}
                sx={{ borderRadius: '14px', minWidth: 140 }}
              >
                Play all
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<ShuffleIcon />}
                onClick={onShuffle}
                disabled={!canPlay}
                sx={{
                  borderRadius: '14px',
                  color: '#fff',
                  borderColor: 'rgba(255,255,255,0.4)',
                  '&:hover': { borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.08)' },
                }}
              >
                Shuffle
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}

// Track list variant for inside an album / playlist. Tracks share the
// collection's cover art, so each row shows its index instead of a thumbnail
// — when the row is the currently-playing track, the number flips to a
// play/pause indicator.
function NumberedTrackList({
  tracks,
  playerTrackId,
  isPlaying,
  isLoading,
  favoriteIds,
  onToggle,
  onAddNext,
  onToggleFav,
}) {
  return (
    <Stack>
      {tracks.map((track, idx) => {
        const isCurrent = playerTrackId === track.id;
        const fav = favoriteIds.has(track.id);
        return (
          <Stack
            key={track.id}
            direction="row"
            alignItems="center"
            spacing={1.5}
            onClick={() => onToggle(track)}
            sx={{
              py: 1.25,
              px: 1,
              borderRadius: '10px',
              cursor: 'pointer',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.05)' },
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}
          >
            <Box
              sx={{
                width: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isCurrent ? 'primary.main' : 'text.secondary',
                flexShrink: 0,
              }}
            >
              {isCurrent && isLoading ? (
                <CircularProgress size={16} color="inherit" />
              ) : isCurrent && isPlaying ? (
                <PauseIcon fontSize="small" />
              ) : isCurrent ? (
                <PlayArrowIcon fontSize="small" />
              ) : (
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}
                >
                  {idx + 1}
                </Typography>
              )}
            </Box>
            <Stack sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="body1"
                sx={{
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: isCurrent ? 'primary.main' : 'text.primary',
                }}
              >
                {track.title}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {track.artist}
              </Typography>
            </Stack>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontVariantNumeric: 'tabular-nums', minWidth: 40, textAlign: 'right' }}
            >
              {track.durationSec ? formatTrackDuration(track.durationSec) : ''}
            </Typography>
            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                onToggleFav(track);
              }}
              sx={{ color: fav ? 'primary.main' : 'text.secondary' }}
            >
              {fav ? <BookmarkIcon /> : <BookmarkBorderIcon />}
            </IconButton>
            {onAddNext && (
              <Box onClick={(e) => e.stopPropagation()}>
                <TrackMoreMenu track={track} onAddNext={onAddNext} />
              </Box>
            )}
          </Stack>
        );
      })}
    </Stack>
  );
}

function QualityPickerButton() {
  const [anchor, setAnchor] = useState(null);
  const quality = useMusicQuality();
  return (
    <>
      <IconButton
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ color: 'text.secondary' }}
        aria-label="Audio quality"
      >
        <GraphicEqIcon />
      </IconButton>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ p: 1.5, minWidth: 240 }}>
          <Typography variant="caption" color="text.secondary" sx={{ px: 1, fontWeight: 600 }}>
            Audio quality
          </Typography>
          <Stack sx={{ mt: 0.5 }}>
            {MUSIC_QUALITIES.map((q) => {
              const selected = quality === q.code;
              return (
                <Stack
                  key={q.code}
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  onClick={() => {
                    setMusicQuality(q.code);
                    setAnchor(null);
                  }}
                  sx={{
                    px: 1,
                    py: 1,
                    cursor: 'pointer',
                    borderRadius: '8px',
                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.05)' },
                  }}
                >
                  <Radio checked={selected} size="small" />
                  <Stack sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {q.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {q.description}
                    </Typography>
                  </Stack>
                </Stack>
              );
            })}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 1, mt: 0.5 }}>
            Applies on the next track.
          </Typography>
        </Box>
      </Popover>
    </>
  );
}

function TrackMoreMenu({ track, onAddNext }) {
  const [anchor, setAnchor] = useState(null);
  return (
    <>
      <IconButton
        onClick={(e) => {
          e.stopPropagation();
          setAnchor(e.currentTarget);
        }}
        sx={{ color: 'text.secondary' }}
        aria-label="Track menu"
      >
        <MoreVertIcon />
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            onAddNext(track);
            setAnchor(null);
          }}
        >
          <PlaylistPlayIcon fontSize="small" sx={{ mr: 1 }} />
          Play next
        </MenuItem>
      </Menu>
    </>
  );
}

// ── Language filter ───────────────────────────────────────────────────────

function LanguageFilterPanel({ languages, onToggle, onClear }) {
  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          Languages · {languages.length} selected
        </Typography>
        {languages.length > 1 && (
          <Button size="small" onClick={onClear} sx={{ minWidth: 0, p: 0, textTransform: 'none' }}>
            Reset
          </Button>
        )}
      </Stack>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {MUSIC_LANGUAGES.map((l) => {
          const active = languages.includes(l.code);
          return (
            <Chip
              key={l.code}
              label={l.label}
              size="small"
              onClick={() => onToggle(l.code)}
              color={active ? 'primary' : 'default'}
              variant={active ? 'filled' : 'outlined'}
            />
          );
        })}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.25 }}>
        Pick one language for a focused list, or several to mix.
      </Typography>
    </Box>
  );
}

// ── Track list ────────────────────────────────────────────────────────────

function TrackList({ tracks, playerTrackId, isPlaying, isLoading, favoriteIds, onToggle, onAddNext, onToggleFav }) {
  return (
    <Stack>
      {tracks.map((track) => {
        const isCurrent = playerTrackId === track.id;
        const fav = favoriteIds.has(track.id);
        return (
          <Stack
            key={track.id}
            direction="row"
            alignItems="center"
            spacing={1.5}
            sx={{
              py: 1.25,
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.04)' },
            }}
          >
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: '10px',
                overflow: 'hidden',
                backgroundColor: 'rgba(255,255,255,0.06)',
                flexShrink: 0,
              }}
            >
              {track.artworkUrlSmall ? (
                <Box component="img" src={track.artworkUrlSmall} alt={track.title} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Stack alignItems="center" justifyContent="center" sx={{ width: '100%', height: '100%', color: 'text.secondary' }}>
                  <MusicNoteIcon />
                </Stack>
              )}
            </Box>
            <Stack sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="body1"
                sx={{
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: isCurrent ? 'primary.main' : 'text.primary',
                }}
              >
                {track.title}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {track.artist}{track.durationSec ? ` · ${formatTrackDuration(track.durationSec)}` : ''}
              </Typography>
            </Stack>
            <IconButton onClick={() => onToggleFav(track)} sx={{ color: fav ? 'primary.main' : 'text.secondary' }}>
              {fav ? <BookmarkIcon /> : <BookmarkBorderIcon />}
            </IconButton>
            {onAddNext && <TrackMoreMenu track={track} onAddNext={onAddNext} />}
            <IconButton
              onClick={() => onToggle(track)}
              sx={{
                width: 44,
                height: 44,
                backgroundColor: isCurrent ? 'primary.main' : 'rgba(255,255,255,0.08)',
                color: isCurrent ? 'primary.contrastText' : 'text.primary',
                '&:hover': { backgroundColor: isCurrent ? 'primary.dark' : 'rgba(255,255,255,0.16)' },
              }}
            >
              {isCurrent && isLoading ? (
                <CircularProgress size={18} color="inherit" />
              ) : isCurrent && isPlaying ? (
                <PauseIcon />
              ) : (
                <PlayArrowIcon />
              )}
            </IconButton>
          </Stack>
        );
      })}
    </Stack>
  );
}

// ── Mini player ───────────────────────────────────────────────────────────

function MiniPlayer({ track, isPlaying, isLoading, positionSec, durationSec, onOpen, onToggle, onSeek }) {
  return (
    <Box
      onClick={onOpen}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        backgroundColor: 'rgba(14,11,20,0.92)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        px: 2,
        py: 1.25,
        cursor: 'pointer',
        '&:hover': { backgroundColor: 'rgba(20,14,30,0.94)' },
      }}
    >
      <Box sx={{ maxWidth: 1080, mx: 'auto' }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '10px',
              overflow: 'hidden',
              backgroundColor: 'rgba(255,255,255,0.06)',
              flexShrink: 0,
            }}
          >
            {track.artworkUrlSmall && (
              <Box component="img" src={track.artworkUrlSmall} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
          </Box>
          <Stack sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {track.title}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {track.artist}
            </Typography>
          </Stack>
          <Box sx={{ flex: 0, width: { xs: 0, sm: 140 }, display: { xs: 'none', sm: 'block' } }}>
            <BeatVisualizer height={32} bars={20} active={isPlaying} />
          </Box>
          <IconButton
            onClick={onToggle}
            sx={{
              width: 44,
              height: 44,
              backgroundColor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': { backgroundColor: 'primary.dark' },
            }}
          >
            {isLoading ? <CircularProgress size={18} color="inherit" /> : isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
          </IconButton>
        </Stack>
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ mt: 0.5 }}
          onClick={(e) => e.stopPropagation()}
        >
          <Typography variant="caption" color="text.secondary" sx={{ width: 36, textAlign: 'right' }}>
            {formatTrackDuration(positionSec)}
          </Typography>
          <Slider
            value={positionSec}
            max={durationSec || 1}
            onChange={(_, v) => onSeek(v)}
            size="small"
            sx={{ flex: 1 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ width: 36 }}>
            {formatTrackDuration(durationSec)}
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}

// ── Shared chrome ─────────────────────────────────────────────────────────

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

function ProxyMissingPanel() {
  return (
    <ErrorPanel
      icon={<MusicNoteIcon sx={{ fontSize: 56 }} />}
      title="Music proxy not set up yet"
      message={
        <>
          Deploy the proxy in <code>proxy/</code> to Vercel (<code>cd proxy &amp;&amp; npx vercel --prod</code>) and paste the
          deployment URL into the Firestore <code>config/app</code> doc as <code>musicApiBaseUrl</code>.
        </>
      }
    />
  );
}
