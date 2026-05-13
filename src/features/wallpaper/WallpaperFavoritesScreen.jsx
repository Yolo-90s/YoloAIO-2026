import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Stack, Typography } from '@mui/material';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import { FeatureScaffold } from '../../ui/FeatureScaffold.jsx';
import {
  observeFavorites,
  favoriteToPhoto,
} from './wallpaperFavoritesRepository.js';
import { wallpaperCache } from './unsplashClient.js';
import { routes } from '../../routes.js';

export function WallpaperFavoritesScreen() {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const off = observeFavorites((favs) => {
      setFavorites(favs);
      // Prime the in-memory cache so the detail screen renders without
      // needing a fresh Unsplash fetch when clicking through.
      wallpaperCache.merge(favs.map(favoriteToPhoto));
      setLoaded(true);
    });
    return off;
  }, []);

  return (
    <FeatureScaffold title="Favorites">
      {!loaded ? null : favorites.length === 0 ? (
        <Stack alignItems="center" spacing={2} sx={{ py: 10, textAlign: 'center' }}>
          <BookmarkBorderIcon sx={{ fontSize: 56, color: 'text.secondary' }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            No favorites yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
            Tap the bookmark icon on any wallpaper to save it here.
          </Typography>
        </Stack>
      ) : (
        <Box
          sx={{
            columnCount: { xs: 2, sm: 3, md: 4, lg: 5 },
            columnGap: '12px',
          }}
        >
          {favorites.map((f) => (
            <Box
              key={f.id}
              onClick={() => navigate(routes.wallpaperDetail(f.photoId || f.id))}
              sx={{
                breakInside: 'avoid',
                mb: '12px',
                borderRadius: '16px',
                overflow: 'hidden',
                cursor: 'pointer',
                backgroundColor: 'rgba(255,255,255,0.05)',
              }}
            >
              <Box
                component="img"
                src={f.smallUrl}
                alt={f.description || 'Wallpaper'}
                loading="lazy"
                sx={{ display: 'block', width: '100%' }}
              />
            </Box>
          ))}
        </Box>
      )}
    </FeatureScaffold>
  );
}
