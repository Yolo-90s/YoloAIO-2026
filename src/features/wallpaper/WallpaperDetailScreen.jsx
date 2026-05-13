import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button, CircularProgress, IconButton, Stack, Typography } from '@mui/material';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { FeatureScaffold } from '../../ui/FeatureScaffold.jsx';
import { wallpaperCache } from './unsplashClient.js';
import {
  isFavorited,
  addFavorite,
  removeFavorite,
} from './wallpaperFavoritesRepository.js';

export function WallpaperDetailScreen() {
  const navigate = useNavigate();
  const { wallpaperId } = useParams();
  const photo = wallpaperCache.byId(wallpaperId);
  const [fav, setFav] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    isFavorited(wallpaperId).then(setFav);
  }, [wallpaperId]);

  // If the user reloaded this page directly we lost the in-memory cache;
  // bounce them back to the grid rather than render a blank screen.
  if (!photo) {
    return (
      <FeatureScaffold title="Wallpaper">
        <Stack alignItems="center" spacing={2} sx={{ py: 8 }}>
          <CircularProgress />
          <Typography color="text.secondary">
            Open this wallpaper from the grid — its data isn't cached for direct links yet.
          </Typography>
          <Button variant="outlined" onClick={() => navigate(-1)}>
            Back
          </Button>
        </Stack>
      </FeatureScaffold>
    );
  }

  const toggleFav = async () => {
    setBusy(true);
    try {
      if (fav) {
        await removeFavorite(photo.id);
        setFav(false);
      } else {
        await addFavorite(photo);
        setFav(true);
      }
    } finally {
      setBusy(false);
    }
  };

  // Browsers can't programmatically "set wallpaper" — we offer a direct
  // download instead, with the Unsplash filename so it lands cleanly in
  // the user's Downloads folder.
  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = photo.fullUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.download = `unsplash-${photo.id}.jpg`;
    a.click();
  };

  return (
    <FeatureScaffold title="Wallpaper">
      <Stack spacing={3}>
        <Box
          sx={{
            borderRadius: '20px',
            overflow: 'hidden',
            backgroundColor: 'rgba(255,255,255,0.05)',
            maxHeight: '70vh',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Box
            component="img"
            src={photo.regularUrl}
            alt={photo.description || 'Wallpaper'}
            sx={{ maxWidth: '100%', maxHeight: '70vh', display: 'block', objectFit: 'contain' }}
          />
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <Stack sx={{ flex: 1 }}>
            <Typography variant="body2" color="text.secondary">
              by {photo.authorName} · Unsplash
            </Typography>
            {photo.description && <Typography variant="body1">{photo.description}</Typography>}
            <Typography variant="caption" color="text.secondary">
              {photo.width} × {photo.height}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <IconButton
              onClick={toggleFav}
              disabled={busy}
              sx={{ color: fav ? 'primary.main' : 'text.primary' }}
              aria-label="Favorite"
            >
              {fav ? <BookmarkIcon /> : <BookmarkBorderIcon />}
            </IconButton>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handleDownload}
              sx={{ borderRadius: '14px' }}
            >
              Download
            </Button>
            <Button
              variant="outlined"
              startIcon={<OpenInNewIcon />}
              href={photo.fullUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ borderRadius: '14px' }}
            >
              Open
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </FeatureScaffold>
  );
}
