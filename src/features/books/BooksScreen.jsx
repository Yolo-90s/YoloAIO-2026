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
import BookmarkIcon from '@mui/icons-material/Bookmark';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import { FeatureScaffold } from '../../ui/FeatureScaffold.jsx';
import { SearchField } from '../../ui/SearchField.jsx';
import { routes } from '../../routes.js';
import { BOOK_TOPICS, bookCache, searchBooks } from './gutendexClient.js';

export function BooksScreen() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [topicLabel, setTopicLabel] = useState(BOOK_TOPICS[0].label);
  const [state, setState] = useState({ kind: 'loading' });

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    const topic = BOOK_TOPICS.find((t) => t.label === topicLabel)?.topic ?? null;
    searchBooks({ query: debounced, topic })
      .then((books) => {
        if (cancelled) return;
        bookCache.merge(books);
        setState({ kind: 'ready', books });
      })
      .catch((e) => {
        if (!cancelled) {
          setState({ kind: 'error', message: e.message || "Couldn't reach Gutendex" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, topicLabel]);

  return (
    <FeatureScaffold
      title="Books"
      search={
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search by title or author"
        />
      }
      actions={
        <IconButton
          onClick={() => navigate(routes.booksFavorites)}
          sx={{ color: 'text.secondary' }}
          aria-label="Saved books"
        >
          <BookmarkIcon />
        </IconButton>
      }
    >
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        {BOOK_TOPICS.map((t) => (
          <Chip
            key={t.label}
            label={t.label}
            size="small"
            onClick={() => setTopicLabel(t.label)}
            color={t.label === topicLabel ? 'primary' : 'default'}
            variant={t.label === topicLabel ? 'filled' : 'outlined'}
          />
        ))}
      </Box>

      {state.kind === 'loading' && (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress />
        </Stack>
      )}

      {state.kind === 'error' && (
        <Stack alignItems="center" spacing={2} sx={{ py: 6, textAlign: 'center' }}>
          <CloudOffIcon sx={{ fontSize: 56, color: 'text.secondary' }} />
          <Typography variant="h6">Couldn't load books</Typography>
          <Typography variant="body2" color="text.secondary">
            {state.message}
          </Typography>
          <Button variant="outlined" onClick={() => setDebounced((q) => q + '')}>
            Retry
          </Button>
        </Stack>
      )}

      {state.kind === 'ready' && state.books.length === 0 && (
        <Stack alignItems="center" spacing={1.5} sx={{ py: 6, textAlign: 'center' }}>
          <MenuBookIcon sx={{ fontSize: 56, color: 'text.secondary' }} />
          <Typography variant="h6">
            {debounced ? `No matches for "${debounced}"` : 'No books found'}
          </Typography>
        </Stack>
      )}

      {state.kind === 'ready' && state.books.length > 0 && (
        <BookGrid books={state.books} onOpen={(id) => navigate(routes.bookReader(id))} />
      )}
    </FeatureScaffold>
  );
}

export function BookGrid({ books, onOpen }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: 2,
      }}
    >
      {books.map((book) => (
        <BookTile key={book.id} book={book} onClick={() => onOpen(book.id)} />
      ))}
    </Box>
  );
}

export function BookTile({ book, onClick }) {
  return (
    <Stack
      onClick={onClick}
      sx={{
        cursor: 'pointer',
        '&:hover': { transform: 'translateY(-2px)' },
        transition: 'transform 120ms ease',
      }}
    >
      <Box
        sx={{
          aspectRatio: '2 / 3',
          borderRadius: '12px',
          overflow: 'hidden',
          backgroundColor: 'rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {book.coverUrl ? (
          <Box
            component="img"
            src={book.coverUrl}
            alt={book.title}
            loading="lazy"
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <MenuBookIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
        )}
      </Box>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 600,
          mt: 1,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {book.title}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {book.displayAuthor}
      </Typography>
    </Stack>
  );
}
