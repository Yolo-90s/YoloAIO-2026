import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import { FeatureScaffold } from '../../ui/FeatureScaffold.jsx';
import { GlassCard } from '../../ui/GlassCard.jsx';
import { SearchField } from '../../ui/SearchField.jsx';
import { useAppConfig } from '../../data/AppConfig.jsx';
import { routes } from '../../routes.js';
import { formatFileSize, formatVideoDuration, listVideos } from './driveVideosClient.js';

export function VideosScreen() {
  const navigate = useNavigate();
  const config = useAppConfig();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!config.videosApiBaseUrl) {
      setLoading(false);
      setError(null);
      setVideos([]);
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    listVideos(config.videosApiBaseUrl, { signal: ac.signal })
      .then((vs) => setVideos(vs))
      .catch((e) => {
        if (e?.name === 'AbortError') return;
        setError(e?.message || 'Failed to load videos.');
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [config.videosApiBaseUrl]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return videos;
    return videos.filter((v) => v.name.toLowerCase().includes(q));
  }, [videos, query]);

  return (
    <FeatureScaffold
      title="Videos"
      search={<SearchField value={query} onChange={setQuery} placeholder="Search videos" />}
    >
      {!config.videosApiBaseUrl ? (
        <GlassCard contentPadding={3}>
          <Stack spacing={1.5}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Drive videos proxy isn't configured
            </Typography>
            <Typography variant="body2" color="text.secondary">
              In Firestore, edit <code>config/app</code> and set <code>videosApiBaseUrl</code> to
              your deployed proxy URL. The proxy lives in <code>videos-proxy/</code> at the
              project root — its README walks through the Drive service-account setup.
            </Typography>
          </Stack>
        </GlassCard>
      ) : loading ? (
        <Stack alignItems="center" sx={{ py: 8 }}>
          <CircularProgress />
        </Stack>
      ) : error ? (
        <Alert severity="error" variant="outlined" sx={{ borderRadius: '12px' }}>
          {error}
        </Alert>
      ) : filtered.length === 0 ? (
        <GlassCard contentPadding={4}>
          <Stack alignItems="center" spacing={1.5} sx={{ textAlign: 'center', py: 3 }}>
            <VideoFileIcon sx={{ fontSize: 56, color: 'text.secondary' }} />
            <Typography variant="body1" color="text.secondary">
              {query
                ? `No videos match "${query}".`
                : 'No videos in the shared Drive folder yet.'}
            </Typography>
            {!query && (
              <Typography variant="caption" color="text.secondary">
                Drop video files into the folder you shared with the service account, then refresh.
              </Typography>
            )}
          </Stack>
        </GlassCard>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))',
            gap: { xs: 1.75, md: 2.25 },
          }}
        >
          {filtered.map((v) => (
            <VideoTile key={v.id} video={v} onClick={() => navigate(routes.videoEditor(v.id))} />
          ))}
        </Box>
      )}
    </FeatureScaffold>
  );
}

function VideoTile({ video, onClick }) {
  const duration = formatVideoDuration(video.durationMs);
  const size = formatFileSize(video.sizeBytes);
  const meta = [duration, size].filter(Boolean).join(' · ');
  return (
    <GlassCard onClick={onClick} contentPadding={0} radius={2.5}>
      <Box
        sx={{
          position: 'relative',
          aspectRatio: '16 / 9',
          backgroundColor: 'rgba(255,255,255,0.04)',
          backgroundImage: video.thumbnailUrl ? `url(${video.thumbnailUrl})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {!video.thumbnailUrl && <VideoFileIcon sx={{ fontSize: 56, color: 'text.secondary' }} />}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(0,0,0,0) 60%, rgba(0,0,0,0.55) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0,
            transition: 'opacity 160ms ease',
            '.MuiPaper-root:hover &': { opacity: 1 },
          }}
        >
          <PlayCircleIcon sx={{ fontSize: 64, color: '#fff', filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.5))' }} />
        </Box>
        {duration && (
          <Typography
            variant="caption"
            sx={{
              position: 'absolute',
              right: 8,
              bottom: 8,
              backgroundColor: 'rgba(0,0,0,0.7)',
              color: '#fff',
              px: 0.75,
              py: 0.25,
              borderRadius: '4px',
              fontWeight: 600,
              fontSize: '0.7rem',
            }}
          >
            {duration}
          </Typography>
        )}
      </Box>
      <Box sx={{ p: 1.5 }}>
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {video.name}
        </Typography>
        {meta && (
          <Typography variant="caption" color="text.secondary">
            {meta}
          </Typography>
        )}
      </Box>
    </GlassCard>
  );
}
