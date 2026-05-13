import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StarIcon from '@mui/icons-material/Star';
import { FeatureScaffold } from '../../ui/FeatureScaffold.jsx';
import { useAppConfig, tmdbAuth } from '../../data/AppConfig.jsx';
import { TMDB, posterUrl, backdropUrl, stillUrl, tmdbCache } from './tmdbClient.js';
import { routes } from '../../routes.js';

export function TvDetailScreen() {
  const navigate = useNavigate();
  const { tvId } = useParams();
  const config = useAppConfig();
  const auth = tmdbAuth(config);
  const [title, setTitle] = useState(() => tmdbCache.byId(tvId));
  const [loading, setLoading] = useState(!title);
  const [error, setError] = useState(null);
  const [season, setSeason] = useState(1);
  const [episodes, setEpisodes] = useState([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);

  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    setLoading(true);
    TMDB.details('tv', tvId, auth)
      .then((d) => {
        if (cancelled) return;
        tmdbCache.put(d);
        setTitle(d);
        const firstSeason = d.seasons?.[0]?.seasonNumber ?? 1;
        setSeason(firstSeason);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [tvId, auth]);

  useEffect(() => {
    if (!auth || !title) return;
    let cancelled = false;
    setEpisodesLoading(true);
    TMDB.seasonEpisodes(tvId, season, auth)
      .then((eps) => !cancelled && setEpisodes(eps))
      .catch(() => !cancelled && setEpisodes([]))
      .finally(() => !cancelled && setEpisodesLoading(false));
    return () => {
      cancelled = true;
    };
  }, [tvId, season, auth, title]);

  if (!title && loading) {
    return (
      <FeatureScaffold title="TV Show">
        <Centered><CircularProgress /></Centered>
      </FeatureScaffold>
    );
  }
  if (!title) {
    return (
      <FeatureScaffold title="TV Show">
        <Typography color="text.secondary">{error ?? "Couldn't load this show."}</Typography>
      </FeatureScaffold>
    );
  }

  return (
    <FeatureScaffold title={title.title}>
      <Backdrop path={title.backdropPath} />

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={3}
        alignItems={{ xs: 'center', sm: 'flex-start' }}
      >
        <Box
          component="img"
          src={posterUrl(title.posterPath, 'w500') ?? ''}
          alt={title.title}
          sx={{
            width: { xs: 180, sm: 200 },
            height: { xs: 270, sm: 300 },
            borderRadius: '14px',
            objectFit: 'cover',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            backgroundColor: 'rgba(255,255,255,0.05)',
            flexShrink: 0,
          }}
        />
        <Stack spacing={2} sx={{ flex: 1, minWidth: 0, width: '100%' }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {title.title}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            {title.rating > 0 && (
              <Chip size="small" icon={<StarIcon sx={{ color: '#FFB300 !important' }} />} label={title.rating.toFixed(1)} />
            )}
            {title.year > 0 && <Chip size="small" label={title.year} />}
            {title.runtimeMinutes > 0 && <Chip size="small" label={`${title.runtimeMinutes} min/ep`} />}
            {title.genres.map((g) => (
              <Chip key={g} size="small" label={g} variant="outlined" />
            ))}
          </Box>
          <Typography variant="body1" color="text.secondary">
            {title.overview}
          </Typography>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 4, mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>Season</Typography>
        <Select
          value={season}
          onChange={(e) => setSeason(Number(e.target.value))}
          size="small"
          sx={{ minWidth: 120 }}
        >
          {(title.seasons ?? []).map((s) => (
            <MenuItem key={s.seasonNumber} value={s.seasonNumber}>
              {s.name || `Season ${s.seasonNumber}`}
            </MenuItem>
          ))}
        </Select>
      </Stack>

      {episodesLoading ? (
        <Centered><CircularProgress /></Centered>
      ) : (
        <Stack spacing={1}>
          {episodes.map((ep) => (
            <Stack
              key={ep.episodeNumber}
              direction="row"
              spacing={1.5}
              alignItems="center"
              onClick={() => navigate(routes.tvPlayer(title.id, season, ep.episodeNumber))}
              sx={{
                p: 1.5,
                borderRadius: '14px',
                backgroundColor: 'rgba(255,255,255,0.04)',
                cursor: 'pointer',
                '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)' },
              }}
            >
              {stillUrl(ep.stillPath) ? (
                <Box
                  component="img"
                  src={stillUrl(ep.stillPath)}
                  alt={ep.name}
                  loading="lazy"
                  sx={{ width: 140, height: 80, borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <Box sx={{ width: 140, height: 80, borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
              )}
              <Stack sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {ep.episodeNumber}. {ep.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {ep.airDate}{ep.runtimeMinutes ? ` · ${ep.runtimeMinutes} min` : ''}
                </Typography>
                {ep.overview && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                  >
                    {ep.overview}
                  </Typography>
                )}
              </Stack>
              <IconButton sx={{ color: 'primary.main' }}>
                <PlayArrowIcon />
              </IconButton>
            </Stack>
          ))}
        </Stack>
      )}
    </FeatureScaffold>
  );
}

function Backdrop({ path }) {
  const url = backdropUrl(path, 'w1280');
  return (
    <Box
      sx={{
        height: { xs: 180, sm: 240, md: 320 },
        borderRadius: '20px',
        overflow: 'hidden',
        mb: 3,
        background: url
          ? `linear-gradient(180deg, rgba(14,11,20,0) 40%, rgba(14,11,20,0.85) 100%), url(${url}) center/cover`
          : 'rgba(255,255,255,0.05)',
      }}
    />
  );
}

function Centered({ children }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>{children}</Box>
  );
}
