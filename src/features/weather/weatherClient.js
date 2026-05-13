// Mirrors WeatherClient.kt — current + 5-day/3-hour forecast in parallel,
// fanned out into the same WeatherInfo shape the screen expects. If the
// forecast call fails we still return the current snapshot, just without
// hourly/daily arrays.

const BASE_CURRENT = 'https://api.openweathermap.org/data/2.5/weather';
const BASE_FORECAST = 'https://api.openweathermap.org/data/2.5/forecast';

export const Conditions = {
  ClearDay: 'ClearDay',
  ClearNight: 'ClearNight',
  Cloudy: 'Cloudy',
  Rain: 'Rain',
  Thunderstorm: 'Thunderstorm',
  Snow: 'Snow',
  Mist: 'Mist',
};

export async function fetchWeather(lat, lon, apiKey) {
  if (!apiKey) throw new Error('Weather API key missing');

  const currentPromise = fetchJson(
    `${BASE_CURRENT}?lat=${lat}&lon=${lon}&units=metric&appid=${encodeURIComponent(apiKey)}`
  );
  const forecastPromise = fetchJson(
    `${BASE_FORECAST}?lat=${lat}&lon=${lon}&units=metric&appid=${encodeURIComponent(apiKey)}`
  ).catch(() => null);

  const [current, forecast] = await Promise.all([currentPromise, forecastPromise]);
  const info = parseCurrent(current);
  if (forecast) {
    const { hourly, daily } = parseForecast(forecast);
    info.hourly = hourly;
    info.daily = daily;
  }
  return info;
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} · ${body.slice(0, 200)}`);
  }
  return res.json();
}

function parseCurrent(root) {
  const main = root.main ?? {};
  const weather = root.weather?.[0] ?? {};
  const sys = root.sys ?? {};
  const wind = root.wind ?? {};
  const clouds = root.clouds ?? {};

  const nowMs = Date.now();
  const sunriseMs = (sys.sunrise ?? 0) * 1000;
  const sunsetMs = (sys.sunset ?? 0) * 1000;
  const isDay = sunriseMs > 0 && sunsetMs > 0 ? nowMs >= sunriseMs && nowMs <= sunsetMs : true;

  const descRaw = (weather.description ?? '').toString();
  const description = descRaw ? descRaw[0].toUpperCase() + descRaw.slice(1) : '';

  return {
    locationName: root.name?.trim() || 'Your location',
    countryCode: sys.country ?? '',
    tempC: main.temp ?? 0,
    feelsLikeC: main.feels_like ?? 0,
    tempMinC: main.temp_min ?? 0,
    tempMaxC: main.temp_max ?? 0,
    humidityPct: main.humidity ?? 0,
    windKph: (wind.speed ?? 0) * 3.6,
    pressureHpa: main.pressure ?? 0,
    description,
    condition: mapCondition(weather.main ?? '', isDay),
    sunriseEpochMs: sunriseMs,
    sunsetEpochMs: sunsetMs,
    observedAtEpochMs: nowMs,
    cloudsPct: clouds.all ?? 0,
    visibilityKm: (root.visibility ?? 0) / 1000,
    hourly: [],
    daily: [],
  };
}

function parseForecast(root) {
  const list = root.list ?? [];
  if (!list.length) return { hourly: [], daily: [] };

  const hourly = list.slice(0, 8).map((entry) => {
    const dtMs = (entry.dt ?? 0) * 1000;
    const main = entry.weather?.[0]?.main ?? '';
    return {
      timeEpochMs: dtMs,
      tempC: entry.main?.temp ?? 0,
      condition: mapCondition(main, hourIsDay(dtMs)),
      popPct: clamp(Math.round((entry.pop ?? 0) * 100), 0, 100),
    };
  });

  // Bucket by local date.
  const buckets = new Map();
  list.forEach((entry) => {
    const date = new Date((entry.dt ?? 0) * 1000);
    const key = date.getFullYear() * 1000 + dayOfYear(date);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(entry);
  });

  const daily = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .slice(0, 5)
    .map(([, entries]) => {
      const temps = entries.map((e) => e.main?.temp).filter((t) => typeof t === 'number');
      const minC = temps.length ? Math.min(...temps) : 0;
      const maxC = temps.length ? Math.max(...temps) : 0;
      // Pick entry closest to local noon for the condition icon.
      const noonEntry = entries.reduce((best, cur) => {
        const h = new Date((cur.dt ?? 0) * 1000).getHours();
        const d = Math.abs(h - 12);
        if (!best) return { entry: cur, d };
        return d < best.d ? { entry: cur, d } : best;
      }, null);
      const target = noonEntry?.entry ?? entries[0];
      const main = target.weather?.[0]?.main ?? '';
      const popPct = clamp(
        Math.max(...entries.map((e) => Math.round((e.pop ?? 0) * 100))),
        0,
        100
      );
      return {
        dateEpochMs: (target.dt ?? 0) * 1000,
        minC,
        maxC,
        condition: mapCondition(main, true),
        popPct,
      };
    });

  return { hourly, daily };
}

function mapCondition(main, isDay) {
  switch (main) {
    case 'Clear':
      return isDay ? Conditions.ClearDay : Conditions.ClearNight;
    case 'Clouds':
      return Conditions.Cloudy;
    case 'Rain':
    case 'Drizzle':
      return Conditions.Rain;
    case 'Thunderstorm':
      return Conditions.Thunderstorm;
    case 'Snow':
      return Conditions.Snow;
    case 'Mist':
    case 'Smoke':
    case 'Haze':
    case 'Dust':
    case 'Fog':
    case 'Sand':
    case 'Ash':
    case 'Squall':
    case 'Tornado':
      return Conditions.Mist;
    default:
      return isDay ? Conditions.Cloudy : Conditions.ClearNight;
  }
}

function hourIsDay(epochMs) {
  const h = new Date(epochMs).getHours();
  return h >= 6 && h <= 18;
}

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}
