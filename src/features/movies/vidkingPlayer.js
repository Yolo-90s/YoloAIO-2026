// Mirrors VidkingPlayer.kt — same embed URL shape. The Android side wraps
// the iframe in a WebView; on web we use the iframe directly.

const BASE = 'https://www.vidking.net/embed';

export function movieEmbedUrl({ tmdbId, primaryColorHex = 'B85AC1', autoPlay = true, progressSeconds = null }) {
  const params = [`color=${primaryColorHex}`];
  if (autoPlay) params.push('autoPlay=true');
  if (progressSeconds && progressSeconds > 0) params.push(`progress=${progressSeconds}`);
  return `${BASE}/movie/${tmdbId}?${params.join('&')}`;
}

export function tvEmbedUrl({
  tmdbId,
  season,
  episode,
  primaryColorHex = 'B85AC1',
  autoPlay = true,
  nextEpisode = true,
  episodeSelector = true,
  progressSeconds = null,
}) {
  const params = [`color=${primaryColorHex}`];
  if (autoPlay) params.push('autoPlay=true');
  if (nextEpisode) params.push('nextEpisode=true');
  if (episodeSelector) params.push('episodeSelector=true');
  if (progressSeconds && progressSeconds > 0) params.push(`progress=${progressSeconds}`);
  return `${BASE}/tv/${tmdbId}/${season}/${episode}?${params.join('&')}`;
}
