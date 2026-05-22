import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Slider,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import LockIcon from '@mui/icons-material/Lock';
import PublicIcon from '@mui/icons-material/Public';
import { FeatureScaffold } from '../../ui/FeatureScaffold.jsx';
import { QuoteCard } from './QuoteCard.jsx';
import {
  ALIGN_CENTER,
  ALIGN_END,
  ALIGN_START,
  BG_GRADIENT,
  BG_IMAGE,
  BG_SOLID,
  VISIBILITY_PRIVATE,
  VISIBILITY_PUBLIC,
  colorToCss,
  defaultStyle,
} from './quoteModel.js';
import {
  gradientPresets,
  solidPresets,
  textColorPresets,
} from './presetQuotes.js';
import { saveQuote } from './quoteRepository.js';
import { usePrivacyPrefs } from '../settings/privacyPrefs.js';
import { searchPhotos } from '../wallpaper/unsplashClient.js';
import { useAppConfig, unsplashQuery } from '../../data/AppConfig.jsx';

export function QuoteEditorScreen() {
  const navigate = useNavigate();
  const prefs = usePrivacyPrefs();
  const [text, setText] = useState('');
  const [author, setAuthor] = useState('');
  const [style, setStyle] = useState(defaultStyle());
  const [visibility, setVisibility] = useState(prefs.defaultVisibility);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const update = (patch) => setStyle((s) => ({ ...s, ...patch }));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveQuote({ text, author, style, visibility });
      navigate(-1);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  const previewQuote = {
    id: 'preview',
    text: text || 'Your quote goes here',
    author,
    style,
    visibility,
    ownerUid: '',
    ownerName: '',
    isCustom: true,
    createdAt: 0,
  };

  return (
    <FeatureScaffold
      title="New quote"
      actions={
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || !text.trim()}
          sx={{ borderRadius: '14px' }}
        >
          {saving ? <CircularProgress size={20} color="inherit" /> : 'Save'}
        </Button>
      }
    >
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <QuoteCard quote={previewQuote} sx={{ minHeight: 360 }} />
          {error && (
            <Typography color="error" variant="body2" sx={{ mt: 1 }}>
              {error}
            </Typography>
          )}
        </Box>
        <Stack spacing={2.5} sx={{ width: { xs: '100%', md: 380 } }}>
          <TextField
            label="Quote"
            value={text}
            onChange={(e) => setText(e.target.value)}
            multiline
            minRows={3}
            fullWidth
          />
          <TextField
            label="Author (optional)"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            fullWidth
          />

          <Box>
            <Typography variant="caption" color="text.secondary">
              Font size · {style.fontSize}
            </Typography>
            <Slider
              value={style.fontSize}
              min={14}
              max={56}
              onChange={(_, v) => update({ fontSize: v })}
              size="small"
            />
          </Box>

          <Stack direction="row" spacing={1}>
            <ToggleButtonGroup
              value={style.alignment}
              exclusive
              onChange={(_, v) => v && update({ alignment: v })}
              size="small"
            >
              <ToggleButton value={ALIGN_START}><FormatAlignLeftIcon /></ToggleButton>
              <ToggleButton value={ALIGN_CENTER}><FormatAlignCenterIcon /></ToggleButton>
              <ToggleButton value={ALIGN_END}><FormatAlignRightIcon /></ToggleButton>
            </ToggleButtonGroup>
            <ToggleButton
              value="bold"
              selected={style.bold}
              onChange={() => update({ bold: !style.bold })}
              size="small"
            >
              <FormatBoldIcon />
            </ToggleButton>
            <ToggleButton
              value="italic"
              selected={style.italic}
              onChange={() => update({ italic: !style.italic })}
              size="small"
            >
              <FormatItalicIcon />
            </ToggleButton>
          </Stack>

          <Box>
            <Typography variant="caption" color="text.secondary">
              Text color
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 1 }}>
              {textColorPresets.map((c) => (
                <Swatch
                  key={c}
                  color={colorToCss(c)}
                  selected={style.textColor === c}
                  onClick={() => update({ textColor: c })}
                />
              ))}
            </Stack>
          </Box>

          <ToggleButtonGroup
            value={style.backgroundType}
            exclusive
            onChange={(_, v) => {
              if (!v) return;
              if (v === BG_GRADIENT) {
                update({
                  backgroundType: BG_GRADIENT,
                  backgroundColors:
                    style.backgroundColors?.length >= 2
                      ? style.backgroundColors
                      : gradientPresets[0],
                  backgroundImageUrl: null,
                });
              } else if (v === BG_SOLID) {
                update({
                  backgroundType: BG_SOLID,
                  backgroundColors: [style.backgroundColors?.[0] ?? solidPresets[0]],
                  backgroundImageUrl: null,
                });
              } else {
                update({ backgroundType: BG_IMAGE });
              }
            }}
            size="small"
            fullWidth
          >
            <ToggleButton value={BG_GRADIENT}>Gradient</ToggleButton>
            <ToggleButton value={BG_SOLID}>Solid</ToggleButton>
            <ToggleButton value={BG_IMAGE}>Image</ToggleButton>
          </ToggleButtonGroup>

          {style.backgroundType === BG_GRADIENT && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                Gradient
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 1, gap: 1 }}>
                {gradientPresets.map((g, i) => (
                  <Box
                    key={i}
                    onClick={() => update({ backgroundColors: g, backgroundType: BG_GRADIENT })}
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: '10px',
                      background: `linear-gradient(135deg, ${colorToCss(g[0])}, ${colorToCss(g[1])})`,
                      cursor: 'pointer',
                      outline:
                        JSON.stringify(style.backgroundColors) === JSON.stringify(g)
                          ? '2px solid #fff'
                          : '1px solid rgba(255,255,255,0.2)',
                    }}
                  />
                ))}
              </Stack>
            </Box>
          )}
          {style.backgroundType === BG_SOLID && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                Color
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 1, gap: 1 }}>
                {solidPresets.map((c) => (
                  <Swatch
                    key={c}
                    color={colorToCss(c)}
                    selected={style.backgroundColors?.[0] === c}
                    onClick={() => update({ backgroundColors: [c], backgroundType: BG_SOLID })}
                  />
                ))}
              </Stack>
            </Box>
          )}
          {style.backgroundType === BG_IMAGE && (
            <BackgroundImagePicker
              selectedUrl={style.backgroundImageUrl}
              onPick={(url) => update({ backgroundImageUrl: url, backgroundType: BG_IMAGE })}
            />
          )}

          <ToggleButtonGroup
            value={visibility}
            exclusive
            onChange={(_, v) => v && setVisibility(v)}
            size="small"
            fullWidth
          >
            <ToggleButton value={VISIBILITY_PRIVATE}><LockIcon sx={{ mr: 1 }} fontSize="small" />Private</ToggleButton>
            <ToggleButton value={VISIBILITY_PUBLIC}><PublicIcon sx={{ mr: 1 }} fontSize="small" />Public</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Stack>
    </FeatureScaffold>
  );
}

function Swatch({ color, selected, onClick }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: color,
        cursor: 'pointer',
        outline: selected ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
        outlineOffset: 2,
      }}
    />
  );
}

function BackgroundImagePicker({ selectedUrl, onPick }) {
  const config = useAppConfig();
  const initial = unsplashQuery(config.wallpapersUrl);
  const [query, setQuery] = useState(initial);
  const [debounced, setDebounced] = useState(initial);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!config.unsplashAccessKey) {
      setError('Set unsplashAccessKey in Firestore config/app to browse images.');
      return;
    }
    if (!debounced) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    searchPhotos({
      query: debounced,
      accessKey: config.unsplashAccessKey,
      perPage: 20,
      orientation: 'portrait',
    })
      .then((list) => {
        if (!cancelled) setPhotos(list);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'Failed to load images');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, config.unsplashAccessKey]);

  return (
    <Stack spacing={1}>
      <Typography variant="caption" color="text.secondary">
        Background image
      </Typography>
      <TextField
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search Unsplash"
        size="small"
        fullWidth
      />
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}
      {!loading && error && (
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      )}
      {!loading && !error && photos.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No images yet — type a search above.
        </Typography>
      )}
      {!loading && photos.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            overflowX: 'auto',
            pb: 1,
            mx: -0.5,
            px: 0.5,
          }}
        >
          {photos.map((photo) => {
            const isSelected = selectedUrl === photo.regularUrl;
            return (
              <Box
                key={photo.id}
                onClick={() => onPick(photo.regularUrl)}
                sx={{
                  flex: '0 0 auto',
                  width: 80,
                  height: 100,
                  borderRadius: '10px',
                  backgroundImage: `url(${photo.smallUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  cursor: 'pointer',
                  outline: isSelected
                    ? '3px solid #fff'
                    : '1px solid rgba(255,255,255,0.3)',
                  outlineOffset: -1,
                }}
                title={photo.description}
              />
            );
          })}
        </Box>
      )}
    </Stack>
  );
}
