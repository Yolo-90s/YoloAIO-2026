import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fab,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import LockIcon from '@mui/icons-material/Lock';
import PublicIcon from '@mui/icons-material/Public';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { FeatureScaffold } from '../../ui/FeatureScaffold.jsx';
import { QuoteCard } from './QuoteCard.jsx';
import { presetQuotes } from './presetQuotes.js';
import {
  observeMyQuotes,
  observeCommunityQuotes,
  deleteQuote,
} from './quoteRepository.js';
import { auth } from '../../data/firebase.js';
import { routes } from '../../routes.js';

const TABS = [
  { key: 'mine', label: 'My quotes' },
  { key: 'community', label: 'Community' },
  { key: 'presets', label: 'Presets' },
];

export function QuotesScreen() {
  const navigate = useNavigate();
  const me = auth?.currentUser?.uid;
  const [tab, setTab] = useState('mine');
  const [mine, setMine] = useState([]);
  const [community, setCommunity] = useState([]);
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => observeMyQuotes(setMine), []);
  useEffect(() => observeCommunityQuotes(setCommunity), []);

  let list = [];
  if (tab === 'mine') list = mine;
  else if (tab === 'community') list = community;
  else list = presetQuotes;

  return (
    <FeatureScaffold
      title="Quotes"
      actions={
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate(routes.quoteEditor)}
          sx={{ borderRadius: '14px' }}
        >
          New quote
        </Button>
      }
    >
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        {TABS.map((t) => (
          <Tab key={t.key} value={t.key} label={t.label} />
        ))}
      </Tabs>

      {list.length === 0 ? (
        <EmptyState tab={tab} onCreate={() => navigate(routes.quoteEditor)} />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))',
            gap: 2,
          }}
        >
          {list.map((q) => (
            <QuoteListCard
              key={q.id}
              quote={q}
              canDelete={tab === 'mine' && (q.visibility !== 'public' || q.ownerUid === me)}
              onDelete={() => setPendingDelete(q)}
            />
          ))}
        </Box>
      )}

      <Fab
        color="primary"
        onClick={() => navigate(routes.quoteEditor)}
        sx={{ position: 'fixed', bottom: 28, right: 28, display: { md: 'none' } }}
        aria-label="New quote"
      >
        <AddIcon />
      </Fab>

      <Dialog open={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)}>
        <DialogTitle>Delete quote?</DialogTitle>
        <DialogContent>
          <Typography>
            This permanently removes the quote. {pendingDelete?.visibility === 'public' && 'It will disappear from the Community feed for everyone.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
          <Button
            color="error"
            onClick={async () => {
              const target = pendingDelete;
              setPendingDelete(null);
              try {
                await deleteQuote(target);
              } catch (e) {
                // swallow — UI doesn't have an inline error spot here
                console.error(e);
              }
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </FeatureScaffold>
  );
}

function QuoteListCard({ quote, canDelete, onDelete }) {
  return (
    <Box sx={{ position: 'relative' }}>
      <QuoteCard quote={quote} fontScale={0.7} sx={{ minHeight: 220 }} />
      <Stack
        direction="row"
        spacing={0.5}
        sx={{ position: 'absolute', top: 8, right: 8 }}
      >
        {quote.visibility === 'public' ? (
          <Chip
            size="small"
            icon={<PublicIcon />}
            label={quote.ownerName ? `by ${quote.ownerName}` : 'Public'}
            sx={{ backgroundColor: 'rgba(0,0,0,0.45)', color: '#fff' }}
          />
        ) : quote.isCustom ? (
          <Chip
            size="small"
            icon={<LockIcon />}
            label="Private"
            sx={{ backgroundColor: 'rgba(0,0,0,0.45)', color: '#fff' }}
          />
        ) : null}
        {canDelete && (
          <IconButton
            size="small"
            onClick={onDelete}
            sx={{ backgroundColor: 'rgba(0,0,0,0.45)', color: '#fff', '&:hover': { backgroundColor: 'rgba(0,0,0,0.6)' } }}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>
    </Box>
  );
}

function EmptyState({ tab, onCreate }) {
  const msg = tab === 'mine'
    ? "You haven't created any quotes yet. Tap New quote to start."
    : tab === 'community'
    ? 'No public quotes yet. Be the first to share one — set visibility to Public when you save.'
    : '';
  return (
    <Stack alignItems="center" spacing={2} sx={{ py: 8, textAlign: 'center' }}>
      <Typography variant="h6" sx={{ fontWeight: 600 }}>
        Nothing here
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380 }}>
        {msg}
      </Typography>
      {tab === 'mine' && (
        <Button variant="contained" startIcon={<AddIcon />} onClick={onCreate}>
          New quote
        </Button>
      )}
    </Stack>
  );
}
