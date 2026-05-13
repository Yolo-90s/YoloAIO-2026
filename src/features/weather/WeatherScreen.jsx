import { useEffect, useState } from 'react';
import { Box, Button, CircularProgress, IconButton, Stack, Typography } from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import LocationOffIcon from '@mui/icons-material/LocationOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import NightlightIcon from '@mui/icons-material/Nightlight';
import CloudIcon from '@mui/icons-material/Cloud';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import UmbrellaIcon from '@mui/icons-material/Umbrella';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import BlurOnIcon from '@mui/icons-material/BlurOn';
import AirIcon from '@mui/icons-material/Air';
import OpacityIcon from '@mui/icons-material/Opacity';
import SpeedIcon from '@mui/icons-material/Speed';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import { FeatureScaffold } from '../../ui/FeatureScaffold.jsx';
import { useAppConfig } from '../../data/AppConfig.jsx';
import { fetchWeather, Conditions } from './weatherClient.js';

export function WeatherScreen() {
  const config = useAppConfig();
  const [state, setState] = useState({ kind: 'idle' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!config.weatherApiKey) {
        setState({ kind: 'missingKey' });
        return;
      }
      if (!navigator.geolocation) {
        setState({ kind: 'noGeolocation' });
        return;
      }
      setState({ kind: 'loading' });

      const coords = await getPosition();
      if (cancelled) return;
      if (!coords) {
        setState({ kind: 'permission' });
        return;
      }
      try {
        const info = await fetchWeather(coords.latitude, coords.longitude, config.weatherApiKey);
        if (!cancelled) setState({ kind: 'ready', info });
      } catch (e) {
        if (!cancelled) setState({ kind: 'error', message: e.message });
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [config.weatherApiKey, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  return (
    <FeatureScaffold title="Weather">
      {state.kind === 'ready' ? (
        <WeatherContent info={state.info} onRefresh={reload} />
      ) : state.kind === 'loading' || state.kind === 'idle' ? (
        <Centered><CircularProgress /></Centered>
      ) : state.kind === 'missingKey' ? (
        <ErrorPanel
          icon={<CloudOffIcon sx={{ fontSize: 56 }} />}
          title="Weather key missing"
          message="Add `weatherApiKey` to the Firestore config/app document. Get a free key at openweathermap.org/api."
        />
      ) : state.kind === 'noGeolocation' ? (
        <ErrorPanel
          icon={<LocationOffIcon sx={{ fontSize: 56 }} />}
          title="Geolocation not supported"
          message="Your browser doesn't expose the Geolocation API."
        />
      ) : state.kind === 'permission' ? (
        <ErrorPanel
          icon={<LocationOffIcon sx={{ fontSize: 56 }} />}
          title="Allow location for weather"
          message="We send a single lat/lon to OpenWeatherMap to fetch local conditions — nothing else leaves your browser."
          actionLabel="Try again"
          onAction={reload}
        />
      ) : (
        <ErrorPanel
          icon={<CloudOffIcon sx={{ fontSize: 56 }} />}
          title="Couldn't load"
          message={state.message}
          actionLabel="Retry"
          onAction={reload}
        />
      )}
    </FeatureScaffold>
  );
}

// Wraps `navigator.geolocation.getCurrentPosition` in a promise that
// resolves to null on any failure (user denied, timeout, no fix). The
// screen treats every non-coord result as "needs permission" since the
// distinction doesn't change what the user has to do.
function getPosition() {
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 }
    );
  });
}

function WeatherContent({ info, onRefresh }) {
  return (
    <Stack
      spacing={2}
      sx={{
        position: 'relative',
        p: { xs: 2, md: 3 },
        borderRadius: '24px',
        background: gradientFor(info.condition),
        color: '#fff',
        minHeight: 480,
      }}
    >
      <LocationHeader info={info} onRefresh={onRefresh} />
      <Hero info={info} />
      <QuickStats info={info} />
      {info.hourly.length > 0 && <HourlyCard hourly={info.hourly} />}
      {info.daily.length > 0 && <DailyCard daily={info.daily} />}
      <DetailsCard info={info} />
      <SunArcCard info={info} />
      <Typography variant="caption" sx={{ opacity: 0.6, textAlign: 'center' }}>
        Updated {formatRelative(info.observedAtEpochMs)}
      </Typography>
    </Stack>
  );
}

function LocationHeader({ info, onRefresh }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <LocationOnIcon sx={{ fontSize: 20 }} />
      <Stack sx={{ flex: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {info.locationName}
        </Typography>
        {info.countryCode && (
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            {info.countryCode}
          </Typography>
        )}
      </Stack>
      <IconButton onClick={onRefresh} sx={{ color: '#fff' }} aria-label="Refresh">
        <RefreshIcon />
      </IconButton>
    </Stack>
  );
}

function Hero({ info }) {
  const Icon = iconFor(info.condition);
  return (
    <Stack alignItems="center" sx={{ py: 2 }}>
      <Stack direction="row" alignItems="flex-start">
        <Typography sx={{ fontSize: { xs: 80, md: 110 }, fontWeight: 200, lineHeight: 1 }}>
          {Math.round(info.tempC)}
        </Typography>
        <Typography sx={{ fontSize: 28, fontWeight: 200, opacity: 0.85, mt: 2 }}>°C</Typography>
      </Stack>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Icon sx={{ fontSize: 22 }} />
        <Typography variant="subtitle1">{info.description}</Typography>
      </Stack>
    </Stack>
  );
}

function QuickStats({ info }) {
  return (
    <Stack direction="row" spacing={1}>
      <Chip label="Feels like" value={`${Math.round(info.feelsLikeC)}°`} />
      <Chip label="High" value={`${Math.round(info.tempMaxC)}°`} />
      <Chip label="Low" value={`${Math.round(info.tempMinC)}°`} />
    </Stack>
  );
}

function Chip({ label, value }) {
  return (
    <Stack
      alignItems="center"
      sx={{
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.16)',
        border: '0.5px solid rgba(255,255,255,0.25)',
        borderRadius: '14px',
        px: 1.5,
        py: 1.25,
      }}
    >
      <Typography variant="caption" sx={{ opacity: 0.7 }}>
        {label}
      </Typography>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        {value}
      </Typography>
    </Stack>
  );
}

function GlassPanel({ children }) {
  return (
    <Box
      sx={{
        backgroundColor: 'rgba(0,0,0,0.25)',
        border: '0.5px solid rgba(255,255,255,0.18)',
        borderRadius: '20px',
        overflow: 'hidden',
      }}
    >
      {children}
    </Box>
  );
}

function SectionTitle({ children, sx }) {
  return (
    <Typography variant="body2" sx={{ fontWeight: 600, opacity: 0.85, ...sx }}>
      {children}
    </Typography>
  );
}

function HourlyCard({ hourly }) {
  return (
    <GlassPanel>
      <Box sx={{ py: 1.5 }}>
        <SectionTitle sx={{ px: 2 }}>Next 24 hours</SectionTitle>
        <Box
          sx={{
            mt: 1,
            px: 2,
            overflowX: 'auto',
            display: 'flex',
            gap: 1.25,
            '&::-webkit-scrollbar': { height: 6 },
            '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3 },
          }}
        >
          {hourly.map((h) => (
            <HourCell key={h.timeEpochMs} entry={h} />
          ))}
        </Box>
      </Box>
    </GlassPanel>
  );
}

function HourCell({ entry }) {
  const Icon = iconFor(entry.condition);
  return (
    <Stack alignItems="center" sx={{ width: 64, py: 0.5 }}>
      <Typography variant="caption" sx={{ opacity: 0.85 }}>
        {formatHour(entry.timeEpochMs)}
      </Typography>
      <Icon sx={{ fontSize: 26, mt: 0.75 }} />
      <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.75 }}>
        {Math.round(entry.tempC)}°
      </Typography>
      {entry.popPct >= 20 && (
        <Stack direction="row" alignItems="center" spacing={0.25}>
          <UmbrellaIcon sx={{ fontSize: 11, color: '#80D8FF' }} />
          <Typography variant="caption" sx={{ color: '#80D8FF', fontSize: '0.7rem' }}>
            {entry.popPct}%
          </Typography>
        </Stack>
      )}
    </Stack>
  );
}

function DailyCard({ daily }) {
  const overallMin = Math.min(...daily.map((d) => d.minC));
  const overallMax = Math.max(...daily.map((d) => d.maxC));
  return (
    <GlassPanel>
      <Box sx={{ p: 2 }}>
        <SectionTitle>5-day forecast</SectionTitle>
        <Stack spacing={1} sx={{ mt: 1.5 }}>
          {daily.map((day) => (
            <DayRow key={day.dateEpochMs} day={day} overallMin={overallMin} overallMax={overallMax} />
          ))}
        </Stack>
      </Box>
    </GlassPanel>
  );
}

function DayRow({ day, overallMin, overallMax }) {
  const Icon = iconFor(day.condition);
  const range = Math.max(overallMax - overallMin, 1);
  const startPct = ((day.minC - overallMin) / range) * 100;
  const endPct = ((day.maxC - overallMin) / range) * 100;
  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Typography variant="body2" sx={{ width: 56, fontWeight: 600 }}>
        {formatDay(day.dateEpochMs)}
      </Typography>
      <Icon sx={{ fontSize: 22 }} />
      <Box sx={{ width: 36 }}>
        {day.popPct >= 20 && (
          <Typography variant="caption" sx={{ color: '#80D8FF' }}>
            {day.popPct}%
          </Typography>
        )}
      </Box>
      <Typography variant="body2" sx={{ width: 34, opacity: 0.7 }}>
        {Math.round(day.minC)}°
      </Typography>
      <Box sx={{ flex: 1, height: 6, position: 'relative' }}>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(255,255,255,0.18)',
            borderRadius: 999,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${startPct}%`,
            width: `${Math.max(endPct - startPct, 4)}%`,
            background: 'linear-gradient(90deg, #4FC3F7, #FFB300, #FF7043)',
            borderRadius: 999,
          }}
        />
      </Box>
      <Typography variant="body2" sx={{ width: 34, fontWeight: 600, textAlign: 'right' }}>
        {Math.round(day.maxC)}°
      </Typography>
    </Stack>
  );
}

function DetailsCard({ info }) {
  return (
    <GlassPanel>
      <Box sx={{ p: 2 }}>
        <SectionTitle>Details</SectionTitle>
        <Stack direction="row" justifyContent="space-between" sx={{ mt: 1.5 }}>
          <Stat icon={<OpacityIcon />} label="Humidity" value={`${info.humidityPct}%`} />
          <Stat icon={<AirIcon />} label="Wind" value={`${Math.round(info.windKph)} km/h`} />
          <Stat icon={<SpeedIcon />} label="Pressure" value={`${info.pressureHpa} hPa`} />
        </Stack>
        <Stack direction="row" justifyContent="space-between" sx={{ mt: 2 }}>
          <Stat icon={<CloudIcon />} label="Clouds" value={`${info.cloudsPct}%`} />
          <Stat
            icon={<VisibilityIcon />}
            label="Visibility"
            value={info.visibilityKm > 0 ? `${info.visibilityKm.toFixed(1)} km` : '—'}
          />
          <Stat icon={<ThermostatIcon />} label="Feels like" value={`${Math.round(info.feelsLikeC)}°`} />
        </Stack>
      </Box>
    </GlassPanel>
  );
}

function Stat({ icon, label, value }) {
  return (
    <Stack alignItems="center" spacing={0.5}>
      <Box sx={{ '& svg': { fontSize: 20 } }}>{icon}</Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        {value}
      </Typography>
      <Typography variant="caption" sx={{ opacity: 0.7 }}>
        {label}
      </Typography>
    </Stack>
  );
}

function SunArcCard({ info }) {
  if (info.sunriseEpochMs <= 0 || info.sunsetEpochMs <= 0) return null;
  const length = Math.max(info.sunsetEpochMs - info.sunriseEpochMs, 1);
  const progress = Math.max(0, Math.min(1, (info.observedAtEpochMs - info.sunriseEpochMs) / length));
  return (
    <GlassPanel>
      <Box sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <WbSunnyIcon sx={{ color: '#FFB300', fontSize: 18 }} />
          <SectionTitle>Sun</SectionTitle>
        </Stack>
        <SunSvg progress={progress} />
        <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
          <Stack>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              Sunrise
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {formatTime(info.sunriseEpochMs)}
            </Typography>
          </Stack>
          <Stack alignItems="flex-end">
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              Sunset
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {formatTime(info.sunsetEpochMs)}
            </Typography>
          </Stack>
        </Stack>
      </Box>
    </GlassPanel>
  );
}

function SunSvg({ progress }) {
  // Half-sine arc; the dot rides along the same path so its (cx, cy)
  // matches what the eye expects.
  const W = 100, H = 50;
  const xAt = (t) => t * W;
  const yAt = (t) => H - Math.sin(t * Math.PI) * (H - 4);
  const dotX = xAt(progress);
  const dotY = yAt(progress);

  // Build the dashed full arc and the filled "done" portion as SVG paths.
  const points = [];
  for (let i = 0; i <= 50; i++) {
    const t = i / 50;
    points.push(`${xAt(t).toFixed(2)},${yAt(t).toFixed(2)}`);
  }
  const fullPath = `M ${points.join(' L ')}`;
  const doneSteps = Math.max(1, Math.floor(50 * progress));
  const donePoints = [];
  for (let i = 0; i <= doneSteps; i++) {
    const t = i / 50;
    donePoints.push(`${xAt(t).toFixed(2)},${yAt(t).toFixed(2)}`);
  }
  const donePath = `M ${donePoints.join(' L ')}`;

  return (
    <Box sx={{ mt: 1.5, width: '100%', maxWidth: 520 }}>
      <svg viewBox={`0 0 ${W} ${H + 6}`} preserveAspectRatio="none" style={{ width: '100%', display: 'block' }}>
        <line x1="0" y1={H} x2={W} y2={H} stroke="rgba(255,255,255,0.3)" strokeWidth="0.3" />
        <path d={fullPath} stroke="rgba(255,255,255,0.25)" strokeWidth="0.6" fill="none" strokeDasharray="2 2" />
        <path d={donePath} stroke="url(#sunGrad)" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <defs>
          <linearGradient id="sunGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FFB300" />
            <stop offset="100%" stopColor="#FFE082" />
          </linearGradient>
        </defs>
        <circle cx={dotX} cy={dotY} r="3" fill="#FFE082" opacity="0.35" />
        <circle cx={dotX} cy={dotY} r="1.6" fill="#FFB300" />
      </svg>
    </Box>
  );
}

function Centered({ children }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320 }}>
      {children}
    </Box>
  );
}

function ErrorPanel({ icon, title, message, actionLabel, onAction }) {
  return (
    <Stack alignItems="center" spacing={2} sx={{ py: 8, textAlign: 'center', color: '#fff' }}>
      {icon}
      <Typography variant="h6" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      <Typography variant="body2" sx={{ opacity: 0.85, maxWidth: 460 }}>
        {message}
      </Typography>
      {actionLabel && onAction && (
        <Button variant="contained" onClick={onAction} sx={{ borderRadius: '14px' }}>
          {actionLabel}
        </Button>
      )}
    </Stack>
  );
}

function iconFor(condition) {
  switch (condition) {
    case Conditions.ClearDay: return WbSunnyIcon;
    case Conditions.ClearNight: return NightlightIcon;
    case Conditions.Cloudy: return CloudIcon;
    case Conditions.Rain: return UmbrellaIcon;
    case Conditions.Thunderstorm: return FlashOnIcon;
    case Conditions.Snow: return AcUnitIcon;
    case Conditions.Mist: return BlurOnIcon;
    default: return CloudIcon;
  }
}

function gradientFor(condition) {
  switch (condition) {
    case Conditions.ClearDay: return 'linear-gradient(180deg, #2196F3 0%, #6FB1FF 100%)';
    case Conditions.ClearNight: return 'linear-gradient(180deg, #0D1B2A 0%, #1B263B 100%)';
    case Conditions.Cloudy: return 'linear-gradient(180deg, #455A64 0%, #78909C 100%)';
    case Conditions.Rain: return 'linear-gradient(180deg, #37474F 0%, #546E7A 100%)';
    case Conditions.Thunderstorm: return 'linear-gradient(180deg, #1A1A2E 0%, #16213E 100%)';
    case Conditions.Snow: return 'linear-gradient(180deg, #B0BEC5 0%, #ECEFF1 100%)';
    case Conditions.Mist: return 'linear-gradient(180deg, #607D8B 0%, #90A4AE 100%)';
    default: return 'linear-gradient(180deg, #1B263B 0%, #415A77 100%)';
  }
}

function formatTime(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatHour(ms) {
  return new Date(ms)
    .toLocaleTimeString(undefined, { hour: 'numeric', hour12: true })
    .toLowerCase()
    .replace(/\s/g, '');
}

function formatDay(ms) {
  const now = new Date();
  const date = new Date(ms);
  if (
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate()
  ) return 'Today';
  return date.toLocaleDateString(undefined, { weekday: 'short' });
}

function formatRelative(ms) {
  if (!ms) return '—';
  const delta = Math.floor((Date.now() - ms) / 1000);
  if (delta < 30) return 'just now';
  if (delta < 90) return '1 min ago';
  if (delta < 3600) return `${Math.floor(delta / 60)} min ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)} h ago`;
  return new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
