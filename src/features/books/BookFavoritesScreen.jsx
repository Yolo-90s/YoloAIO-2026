import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Stack, Typography } from '@mui/material';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import { FeatureScaffold } from '../../ui/FeatureScaffold.jsx';
import { routes } from '../../routes.js';
import {
  favoriteToBook,
  observeFavoriteBooks,
} from './bookFavoritesRepository.js';
import { bookCache } from './gutendexClient.js';
import { BookGrid } from './BooksScreen.jsx';

export function BookFavoritesScreen() {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState([]);

  useEffect(() => observeFavoriteBooks(setFavorites), []);

  // Push the favourite snapshots into the in-memory cache so the
  // reader screen can open them without a Gutendex re-fetch.
  const books = favorites.map(favoriteToBook);
  if (books.length) bookCache.merge(books);

  return (
    <FeatureScaffold title="Saved books">
      {books.length === 0 ? (
        <Stack alignItems="center" spacing={1.5} sx={{ py: 6, textAlign: 'center' }}>
          <BookmarkBorderIcon sx={{ fontSize: 56, color: 'text.secondary' }} />
          <Typography variant="h6">No saved books yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
            Tap the bookmark icon while reading a book to save it here. Saved
            books sync across devices via Firestore.
          </Typography>
        </Stack>
      ) : (
        <BookGrid books={books} onOpen={(id) => navigate(routes.bookReader(id))} />
      )}
    </FeatureScaffold>
  );
}
