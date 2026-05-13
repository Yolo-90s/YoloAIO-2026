// Mirrors TmdbClient.kt. Supports both v3 (apiKey query param) and v4
// (bearer token) auth — auto-detected by the "eyJ" prefix that JWTs have.

const API_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p';

export function posterUrl(path, size = 'w342') {
  if (!path || path === 'null') return null;
  return `${IMG_BASE}/${size}${path}`;
}
export function backdropUrl(path, size = 'w780') {
  if (!path || path === 'null') return null;
  return `${IMG_BASE}/${size}${path}`;
}
export function stillUrl(path, size = 'w300') {
  if (!path || path === 'null') return null;
  return `${IMG_BASE}/${size}${path}`;
}

function build(path, params, auth) {
  const isBearer = auth.startsWith('eyJ');
  const merged = { ...params };
  if (!isBearer) merged.api_key = auth;
  const qs = new URLSearchParams(merged).toString();
  return `${API_BASE}${path}${qs ? `?${qs}` : ''}`;
}

async function fetchJson(url, auth) {
  const headers = { Accept: 'application/json' };
  if (auth.startsWith('eyJ')) headers.Authorization = `Bearer ${auth}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`TMDB HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

function parseRow(o, media) {
  const dateField = media === 'tv' ? o.first_air_date : o.release_date;
  const year = dateField?.length >= 4 ? Number(dateField.slice(0, 4)) || 0 : 0;
  return {
    id: o.id,
    mediaType: media,
    title: o.title || o.name || '',
    year,
    rating: o.vote_average ?? 0,
    overview: o.overview ?? '',
    posterPath: o.poster_path && o.poster_path !== 'null' ? o.poster_path : null,
    backdropPath: o.backdrop_path && o.backdrop_path !== 'null' ? o.backdrop_path : null,
    runtimeMinutes: 0,
    genres: [],
    seasons: [],
  };
}

async function getList(path, params, auth, media) {
  if (!auth) throw new Error('Missing TMDB API key');
  const url = build(path, params, auth);
  const data = await fetchJson(url, auth);
  return (data.results ?? []).map((o) => parseRow(o, media));
}

export const TMDB = {
  popular(media, auth, page = 1) {
    return getList(`/${media}/popular`, { page, language: 'en-US' }, auth, media);
  },
  topRated(media, auth, page = 1) {
    return getList(`/${media}/top_rated`, { page, language: 'en-US' }, auth, media);
  },
  trending(media, auth, window = 'week') {
    return getList(`/trending/${media}/${window}`, { language: 'en-US' }, auth, media);
  },
  async search(media, query, auth, page = 1) {
    if (!query?.trim()) return [];
    return getList(
      `/search/${media}`,
      { query: query.trim(), page, include_adult: 'false', language: 'en-US' },
      auth,
      media
    );
  },
  async details(media, id, auth) {
    if (!auth) throw new Error('Missing TMDB API key');
    const data = await fetchJson(build(`/${media}/${id}`, {}, auth), auth);
    const base = parseRow(data, media);
    const genres = (data.genres ?? []).map((g) => g.name).filter(Boolean);
    let runtime = 0;
    if (media === 'movie') runtime = data.runtime ?? 0;
    else if (Array.isArray(data.episode_run_time) && data.episode_run_time.length > 0)
      runtime = data.episode_run_time[0] ?? 0;
    let seasons = [];
    if (media === 'tv') {
      seasons = (data.seasons ?? [])
        .filter((s) => (s.season_number ?? -1) >= 1)
        .map((s) => ({
          seasonNumber: s.season_number,
          name: s.name,
          episodeCount: s.episode_count ?? 0,
          airDate: s.air_date ?? '',
          posterPath: s.poster_path && s.poster_path !== 'null' ? s.poster_path : null,
        }));
    }
    return { ...base, runtimeMinutes: runtime, genres, seasons };
  },
  async seasonEpisodes(tvId, seasonNumber, auth) {
    if (!auth) throw new Error('Missing TMDB API key');
    const data = await fetchJson(build(`/tv/${tvId}/season/${seasonNumber}`, {}, auth), auth);
    return (data.episodes ?? []).map((e) => ({
      episodeNumber: e.episode_number,
      seasonNumber: e.season_number ?? seasonNumber,
      name: e.name ?? '',
      airDate: e.air_date ?? '',
      overview: e.overview ?? '',
      stillPath: e.still_path && e.still_path !== 'null' ? e.still_path : null,
      rating: e.vote_average ?? 0,
      runtimeMinutes: e.runtime ?? 0,
    }));
  },
};

const cache = new Map();
export const tmdbCache = {
  setList(list) {
    list.forEach((t) => cache.set(t.id, t));
  },
  put(title) {
    cache.set(title.id, title);
  },
  byId(id) {
    return cache.get(Number(id)) ?? null;
  },
};
