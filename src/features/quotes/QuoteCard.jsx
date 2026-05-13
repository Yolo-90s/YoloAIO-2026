import { Box, Typography } from '@mui/material';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import {
  bgCss,
  colorToCss,
  textAlignCss,
  ALIGN_END,
} from './quoteModel.js';

// Visual renderer for a single Quote — mirrors QuoteContent.kt. Used by
// both the grid cards (smaller fontScale) and the editor preview.
export function QuoteCard({ quote, fontScale = 1, sx, onClick }) {
  const style = quote.style ?? {};
  const align = textAlignCss(style.alignment);
  const textColor = colorToCss(style.textColor);
  const iconAlign = style.alignment === ALIGN_END ? 'flex-end' : 'flex-start';
  const size = Math.max(18, (style.fontSize ?? 28) * fontScale);
  const authorSize = Math.max(10, size * 0.55);

  return (
    <Box
      onClick={onClick}
      sx={{
        position: 'relative',
        background: bgCss(style),
        color: textColor,
        borderRadius: '20px',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        p: 2.5,
        minHeight: 200,
        textAlign: align,
        alignItems: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
        ...sx,
      }}
    >
      <Box sx={{ alignSelf: iconAlign, opacity: 0.35, mb: 1, lineHeight: 0 }}>
        <FormatQuoteIcon sx={{ fontSize: Math.max(18, size * 1.2) }} />
      </Box>
      <Typography
        sx={{
          fontSize: `${size}px`,
          fontStyle: style.italic ? 'italic' : 'normal',
          fontWeight: style.bold ? 600 : 400,
          lineHeight: 1.25,
          wordBreak: 'break-word',
        }}
      >
        {quote.text}
      </Typography>
      {quote.author && (
        <Typography
          sx={{
            mt: 1,
            fontSize: `${authorSize}px`,
            opacity: 0.85,
            fontWeight: 500,
          }}
        >
          — {quote.author}
        </Typography>
      )}
    </Box>
  );
}
