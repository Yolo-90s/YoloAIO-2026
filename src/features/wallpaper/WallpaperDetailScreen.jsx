import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button, CircularProgress, IconButton, Stack, Typography } from '@mui/material';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ShareIcon from '@mui/icons-material/Share';
import { Snackbar } from '@mui/material';
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
  const [toast, setToast] = useState(null);

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

  // Three-tier share: file via Web Share API (mobile), URL via Web Share
  // API (desktop browsers that support it), or clipboard copy as last resort.
  const handleShare = async () => {
    const shareUrl = photo.fullUrl;
    const title = photo.description || 'Wallpaper from Unsplash';
    const text = `Wallpaper by ${photo.authorName} on Unsplash`;

    if (typeof navigator.share === 'function') {
      try {
        // Try sharing the actual file first — only on platforms that allow it.
        if (typeof navigator.canShare === 'function') {
          try {
            const res = await fetch(photo.regularUrl);
            const blob = await res.blob();
            const file = new File([blob], `unsplash-${photo.id}.jpg`, {
              type: blob.type || 'image/jpeg',
            });
            if (navigator.canShare({ files: [file] })) {
              await navigator.share({ title, text, files: [file] });
              return;
            }
          } catch {
            // Fall through to URL share.
          }
        }
        await navigator.share({ title, text, url: shareUrl });
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setToast('Link copied to clipboard');
    } catch {
      setToast("Couldn't share — copy the URL manually");
    }
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
              startIcon={<ShareIcon />}
              onClick={handleShare}
              sx={{ borderRadius: '14px' }}
            >
              Share
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
      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={2500}
        onClose={() => setToast(null)}
        message={toast || ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </FeatureScaffold>
  );
}
