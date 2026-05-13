import { useEffect, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import { FeatureScaffold } from '../../ui/FeatureScaffold.jsx';
import { ToneList } from './RingtonesScreen.jsx';
import {
  observeFavorites,
  favoriteToTone,
  addFavorite,
  removeFavorite,
} from './ringtoneFavoritesRepository.js';
import { useRingtonePlayer } from './ringtonePlayer.js';

export function RingtoneFavoritesScreen() {
  const player = useRingtonePlayer();
  const [favorites, setFavorites] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const off = observeFavorites((favs) => {
      setFavorites(favs);
      setLoaded(true);
    });
    return off;
  }, []);

  const tones = favorites.map(favoriteToTone);
  const favoriteIds = new Set(favorites.map((f) => f.toneId || f.id));

  return (
    <FeatureScaffold title="Favorites">
      {!loaded ? null : tones.length === 0 ? (
        <Stack alignItems="center" spacing={2} sx={{ py: 10, textAlign: 'center' }}>
          <BookmarkBorderIcon sx={{ fontSize: 56, color: 'text.secondary' }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            No favorite tones yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
            Tap the bookmark icon on any tone to save it here.
          </Typography>
        </Stack>
      ) : (
        <ToneList
          tones={tones}
          player={player}
          favoriteIds={favoriteIds}
          onToggleFav={async (tone) => {
            if (favoriteIds.has(tone.id)) await removeFavorite(tone.id);
            else await addFavorite(tone);
          }}
        />
      )}
      <Box sx={{ pt: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Browsers can't set system ringtones directly — use the download icon and apply the file from your phone.
        </Typography>
      </Box>
    </FeatureScaffold>
  );
}
