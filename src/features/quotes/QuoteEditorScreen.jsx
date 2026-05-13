import { useState } from 'react';
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
            onChange={(_, v) => v && update({ backgroundType: v })}
            size="small"
            fullWidth
          >
            <ToggleButton value={BG_GRADIENT}>Gradient</ToggleButton>
            <ToggleButton value={BG_SOLID}>Solid</ToggleButton>
          </ToggleButtonGroup>

          {style.backgroundType === BG_GRADIENT ? (
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
          ) : (
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
