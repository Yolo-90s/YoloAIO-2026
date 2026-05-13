// Mirror of Routes.kt — path constants and builders for typed navigation.
// Kept here as one source of truth so links never go out of sync with the
// Compose route table.

export const routes = {
  auth: '/auth',
  home: '/',
  settings: '/settings',
  privacy: '/settings/privacy',
  audioTrimmer: '/audio-trimmer',
  chat: '/chat',
  chatConversation: (userId) => `/chat/${encodeURIComponent(userId)}`,
  chatConversationPattern: '/chat/:userId',
  music: '/music',
  movies: '/movies',
  movieDetail: (movieId) => `/movies/${encodeURIComponent(movieId)}`,
  movieDetailPattern: '/movies/:movieId',
  moviePlayer: (movieId) => `/movies/${encodeURIComponent(movieId)}/play`,
  moviePlayerPattern: '/movies/:movieId/play',
  tvDetail: (tvId) => `/tv/${encodeURIComponent(tvId)}`,
  tvDetailPattern: '/tv/:tvId',
  tvPlayer: (tvId, season, episode) =>
    `/tv/${encodeURIComponent(tvId)}/play/${season}/${episode}`,
  tvPlayerPattern: '/tv/:tvId/play/:season/:episode',
  quotes: '/quotes',
  quoteEditor: '/quotes/new',
  wallpaper: '/wallpaper',
  wallpaperFavorites: '/wallpaper/favorites',
  wallpaperDetail: (id) => `/wallpaper/${encodeURIComponent(id)}`,
  wallpaperDetailPattern: '/wallpaper/:wallpaperId',
  ringtones: '/ringtones',
  ringtoneFavorites: '/ringtones/favorites',
  weather: '/weather',
  wifiLab: '/wifi-lab',
  community: '/community',
};
