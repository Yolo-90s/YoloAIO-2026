// Mirrors MovieEmbedPlayer.kt — same embed URL shape. The Android side wraps
// the iframe in a WebView; on web we use the iframe directly.
//
// Switched from vidking.net to vidlink.pro: vidking.net's DNS delegation is
// dead (its nameservers refuse to answer at all), not a code bug on our
// end. Query params below are vidlink.pro's own documented ones — the two
// providers don't share a param vocabulary.

const BASE = 'https://vidlink.pro';

export function movieEmbedUrl({ tmdbId, primaryColorHex = 'B85AC1', autoPlay = true, progressSeconds = null }) {
  const params = [`primaryColor=${primaryColorHex}`, `autoplay=${autoPlay}`, 'title=false'];
  if (progressSeconds && progressSeconds > 0) params.push(`startAt=${progressSeconds}`);
  return `${BASE}/movie/${tmdbId}?${params.join('&')}`;
}

export function tvEmbedUrl({
  tmdbId,
  season,
  episode,
  primaryColorHex = 'B85AC1',
  autoPlay = true,
  nextEpisode = true,
  // No equivalent toggle on vidlink.pro (its player always shows one) —
  // kept so call sites don't need to change.
  episodeSelector = true, // eslint-disable-line no-unused-vars
  progressSeconds = null,
}) {
  const params = [`primaryColor=${primaryColorHex}`, `autoplay=${autoPlay}`, 'title=false'];
  if (nextEpisode) params.push('nextbutton=true');
  if (progressSeconds && progressSeconds > 0) params.push(`startAt=${progressSeconds}`);
  return `${BASE}/tv/${tmdbId}/${season}/${episode}?${params.join('&')}`;
}
