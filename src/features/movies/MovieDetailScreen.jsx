import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StarIcon from '@mui/icons-material/Star';
import { FeatureScaffold } from '../../ui/FeatureScaffold.jsx';
import { useAppConfig, tmdbAuth } from '../../data/AppConfig.jsx';
import { TMDB, posterUrl, backdropUrl, tmdbCache } from './tmdbClient.js';
import { routes } from '../../routes.js';

export function MovieDetailScreen() {
  const navigate = useNavigate();
  const { movieId } = useParams();
  const config = useAppConfig();
  const auth = tmdbAuth(config);
  const [title, setTitle] = useState(() => tmdbCache.byId(movieId));
  const [loading, setLoading] = useState(!title);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    setLoading(true);
    TMDB.details('movie', movieId, auth)
      .then((d) => {
        if (cancelled) return;
        tmdbCache.put(d);
        setTitle(d);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [movieId, auth]);

  if (!title && loading) {
    return (
      <FeatureScaffold title="Movie">
        <Centered><CircularProgress /></Centered>
      </FeatureScaffold>
    );
  }

  if (!title) {
    return (
      <FeatureScaffold title="Movie">
        <Typography color="text.secondary">{error ?? "Couldn't load this title."}</Typography>
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
              <Chip
                size="small"
                icon={<StarIcon sx={{ color: '#FFB300 !important' }} />}
                label={title.rating.toFixed(1)}
              />
            )}
            {title.year > 0 && <Chip size="small" label={title.year} />}
            {title.runtimeMinutes > 0 && <Chip size="small" label={`${title.runtimeMinutes} min`} />}
            {title.genres.map((g) => (
              <Chip key={g} size="small" label={g} variant="outlined" />
            ))}
          </Box>

          <Typography variant="body1" color="text.secondary">
            {title.overview}
          </Typography>

          <Box>
            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrowIcon />}
              onClick={() => navigate(routes.moviePlayer(title.id))}
              sx={{ borderRadius: '14px' }}
            >
              Play
            </Button>
          </Box>
        </Stack>
      </Stack>
    </FeatureScaffold>
  );
}

// Backdrop banner. Plain image with a bottom gradient that fades into the
// page background so it never visually "cuts" against the content below.
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
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>{children}</Box>
  );
}
