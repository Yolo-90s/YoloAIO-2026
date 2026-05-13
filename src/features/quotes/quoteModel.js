// Mirrors Quote.kt + QuoteStyle.kt. ARGB longs come in from Firestore — we
// convert them to plain hex strings for CSS at the render layer.

export const VISIBILITY_PRIVATE = 'private';
export const VISIBILITY_PUBLIC = 'public';

export const ALIGN_START = 'start';
export const ALIGN_CENTER = 'center';
export const ALIGN_END = 'end';

export const BG_GRADIENT = 'gradient';
export const BG_SOLID = 'solid';
export const BG_IMAGE = 'image';

export const defaultStyle = () => ({
  textColor: 0xffffffff,
  fontSize: 28,
  bold: false,
  italic: true,
  alignment: ALIGN_CENTER,
  backgroundType: BG_GRADIENT,
  backgroundColors: [0xff1a237e, 0xff4a148c],
  backgroundImageUrl: null,
});

// ARGB long → "#RRGGBB". Drops alpha because Firestore stores it but the
// app always treats colors as opaque.
export function colorToCss(raw) {
  if (typeof raw === 'string') return raw;
  if (typeof raw !== 'number') return '#FFFFFF';
  const hex = (raw >>> 0).toString(16).padStart(8, '0');
  return `#${hex.substring(2)}`;
}

export function bgCss(style) {
  const colors = (style.backgroundColors ?? []).map(colorToCss);
  if (style.backgroundType === BG_SOLID) return colors[0] ?? '#000';
  if (style.backgroundType === BG_IMAGE) {
    return style.backgroundImageUrl
      ? `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url(${style.backgroundImageUrl}) center/cover`
      : (colors[0] ?? '#000');
  }
  if (colors.length === 1) return colors[0];
  return `linear-gradient(135deg, ${colors.join(', ')})`;
}

export function textAlignCss(alignment) {
  if (alignment === ALIGN_START) return 'left';
  if (alignment === ALIGN_END) return 'right';
  return 'center';
}
