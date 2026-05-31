import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import DeleteIcon from '@mui/icons-material/Delete';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadIcon from '@mui/icons-material/Download';
import CompareIcon from '@mui/icons-material/Compare';
import GridViewIcon from '@mui/icons-material/GridView';
import { FeatureScaffold } from '../../ui/FeatureScaffold.jsx';
import { useAppConfig } from '../../data/AppConfig.jsx';
import { detectLandmarks, analyzeFromLandmarks, disposeAnalyzer } from './faceAnalyzer.js';
import { recommendHairstyles } from './recommender.js';
import {
  observeFavoriteHairstyles,
  addFavoriteHairstyle,
  removeFavoriteHairstyle,
} from './styleFavoritesRepository.js';
import {
  prepPhotoForUpload,
  generatePreview,
  generatePreviewsParallel,
  clearPreviewCache,
} from './stylePreviewClient.js';

// Phase machine: 'idle' → 'uploaded' → 'analyzing' → 'done' → (back to idle on reset).
// Errors land in 'error' which lets the user retry without re-uploading.

export function StyleYourselfScreen() {
  const config = useAppConfig();
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState('');
  const [photoUrl, setPhotoUrl] = useState(null);   // object URL of the upload
  const [photoSize, setPhotoSize] = useState(null); // { w, h }
  const [analysis, setAnalysis] = useState(null);
  const [prefs, setPrefs] = useState({ gender: '', length: '', texture: '' });
  const [favorites, setFavorites] = useState([]);
  const [previewStyle, setPreviewStyle] = useState(null); // hairstyle object for modal
  const [compareOpen, setCompareOpen] = useState(false);
  // Per-session backend choice. Defaults to the AppConfig value but lets
  // the user flip backends without an admin edit. Persisted to
  // localStorage so the choice survives a refresh.
  const [backend, setBackend] = useState(() => {
    try { return localStorage.getItem('yoloaio.stylePreviewBackend') || ''; } catch { return ''; }
  });
  const effectiveBackend = backend || config.stylePreviewBackend || 'gemini';
  const setBackendPersist = (b) => {
    setBackend(b);
    try { localStorage.setItem('yoloaio.stylePreviewBackend', b); } catch {}
    clearPreviewCache(); // cache is per-backend; clear when switching
  };

  // Prepped (downscaled) photo for upload, cached in a ref so the same
  // photo isn't re-encoded for every preview request.
  const preppedPhotoRef = useRef(null);

  // Track favorite ids as a set for O(1) lookup.
  const favoriteIds = useMemo(
    () => new Set(favorites.map((f) => f.hairstyleId || f.id)),
    [favorites]
  );

  useEffect(() => observeFavoriteHairstyles(setFavorites), []);

  // Cleanup object URL when the photo changes or component unmounts —
  // otherwise we leak memory + the privacy promise gets weaker.
  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      disposeAnalyzer();
      clearPreviewCache();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFile = (file) => {
    if (!file || !file.type?.startsWith('image/')) {
      setError('Please choose an image file');
      return;
    }
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
    setAnalysis(null);
    setError('');
    setPhase('uploaded');
    // Invalidate prepped photo + any cached previews when the photo changes.
    preppedPhotoRef.current = null;
    clearPreviewCache();
    // Preload to grab natural dimensions for the analysis canvas.
    const img = new Image();
    img.onload = () => setPhotoSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
  };

  // Prep the downscaled photo lazily on first preview request. Cached in
  // a ref + tagged with a fingerprint so the preview client can use it
  // as a cache key.
  const getPreppedPhoto = async () => {
    if (preppedPhotoRef.current) return preppedPhotoRef.current;
    if (!photoUrl) return null;
    const prepped = await prepPhotoForUpload(photoUrl, { maxDim: 768, quality: 0.85 });
    prepped.fingerprint = photoUrl; // unique per upload (object URLs are random)
    preppedPhotoRef.current = prepped;
    return prepped;
  };

  const analyze = async () => {
    if (!photoUrl) return;
    setPhase('analyzing');
    setError('');
    try {
      const img = await loadImage(photoUrl);
      const result = await detectLandmarks(img);
      if (!result.ok) {
        setError(result.error);
        setPhase('error');
        return;
      }
      const a = analyzeFromLandmarks(result.landmarks);
      setAnalysis(a);
      setPhase('done');
    } catch (e) {
      setError(e?.message || 'Analysis failed');
      setPhase('error');
    }
  };

  const deletePhoto = () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null);
    setPhotoSize(null);
    setAnalysis(null);
    setError('');
    setPhase('idle');
    preppedPhotoRef.current = null;
    clearPreviewCache();
  };

  const toggleFavorite = async (style) => {
    if (favoriteIds.has(style.id)) {
      await removeFavoriteHairstyle(style.id);
    } else {
      await addFavoriteHairstyle(style, {
        faceShape: analysis?.faceShape,
        score: style.score,
      });
    }
  };

  return (
    <FeatureScaffold title="Style Yourself" maxWidth={900}>
      <Stack spacing={3}>
        <PrivacyBanner />

        {phase === 'idle' && <UploadPanel onFile={handleFile} />}

        {phase !== 'idle' && photoUrl && (
          <PhotoPanel
            photoUrl={photoUrl}
            photoSize={photoSize}
            phase={phase}
            onAnalyze={analyze}
            onDelete={deletePhoto}
            onReplace={() => setPhase('idle')}
          />
        )}

        {phase === 'analyzing' && <AnalyzingPanel />}

        {error && (
          <Alert severity="error" onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {phase === 'done' && analysis && (
          <>
            <ScanDashboard analysis={analysis} />

            <PreferencesPanel prefs={prefs} onChange={setPrefs} />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                startIcon={<GridViewIcon />}
                onClick={() => setCompareOpen(true)}
                disabled={!config.styleApiBaseUrl}
                sx={{ borderRadius: '12px' }}
              >
                Compare top picks
              </Button>
            </Box>

            <RecommendationsList
              analysis={analysis}
              prefs={prefs}
              favoriteIds={favoriteIds}
              onToggleFavorite={toggleFavorite}
              onPreview={setPreviewStyle}
            />
          </>
        )}

        {favorites.length > 0 && phase !== 'done' && (
          <FavoritesPreview favorites={favorites} />
        )}
      </Stack>

      <PreviewDialog
        open={!!previewStyle}
        style={previewStyle}
        photoUrl={photoUrl}
        baseUrl={config.styleApiBaseUrl}
        getPhoto={getPreppedPhoto}
        backend={effectiveBackend}
        setBackend={setBackendPersist}
        cloudflareAccountId={config.cloudflareAccountId}
        onClose={() => setPreviewStyle(null)}
      />

      <CompareDialog
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        analysis={analysis}
        prefs={prefs}
        photoUrl={photoUrl}
        baseUrl={config.styleApiBaseUrl}
        getPhoto={getPreppedPhoto}
        backend={effectiveBackend}
        setBackend={setBackendPersist}
        cloudflareAccountId={config.cloudflareAccountId}
      />
    </FeatureScaffold>
  );
}

// ── Privacy banner ─────────────────────────────────────────────────

function PrivacyBanner() {
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: '14px',
        backgroundColor: 'rgba(124,156,255,0.10)',
        border: '1px solid rgba(124,156,255,0.25)',
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
        Your photo stays on your device.
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Face analysis runs entirely in your browser using on-device computer
        vision. The image is never uploaded or stored. Hit "Delete photo" any
        time to clear it from memory immediately.
      </Typography>
    </Box>
  );
}

// ── Upload panel ───────────────────────────────────────────────────

function UploadPanel({ onFile }) {
  const fileRef = useRef(null);
  const cameraRef = useRef(null);
  return (
    <Box
      sx={{
        p: 4,
        borderRadius: '20px',
        backgroundColor: 'rgba(255,255,255,0.03)',
        border: '1px dashed rgba(255,255,255,0.15)',
        textAlign: 'center',
      }}
    >
      <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
        Upload a face photo
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 420, mx: 'auto' }}>
        A front-facing photo with good lighting works best. The face should fill
        most of the frame and be roughly straight-on.
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center">
        <Button
          variant="contained"
          startIcon={<CloudUploadIcon />}
          onClick={() => fileRef.current?.click()}
          sx={{ borderRadius: '14px' }}
        >
          Choose photo
        </Button>
        <Button
          variant="outlined"
          startIcon={<PhotoCameraIcon />}
          onClick={() => cameraRef.current?.click()}
          sx={{ borderRadius: '14px' }}
        >
          Take photo
        </Button>
      </Stack>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="user"
        style={{ display: 'none' }}
        onChange={(e) => onFile(e.target.files?.[0])}
      />
    </Box>
  );
}

// ── Photo + actions ────────────────────────────────────────────────

function PhotoPanel({ photoUrl, photoSize, phase, onAnalyze, onDelete, onReplace }) {
  const aspect = photoSize ? photoSize.w / photoSize.h : 1;
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      alignItems={{ xs: 'stretch', sm: 'center' }}
      sx={{
        p: 2,
        borderRadius: '16px',
        backgroundColor: 'rgba(255,255,255,0.04)',
      }}
    >
      <Box
        sx={{
          width: { xs: '100%', sm: 180 },
          aspectRatio: `${Math.max(0.5, Math.min(2, aspect))}`,
          maxHeight: 240,
          borderRadius: '12px',
          overflow: 'hidden',
          backgroundColor: 'rgba(0,0,0,0.3)',
          flexShrink: 0,
        }}
      >
        <Box
          component="img"
          src={photoUrl}
          alt="Your photo"
          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </Box>
      <Stack spacing={1} sx={{ flex: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Photo loaded
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {photoSize ? `${photoSize.w} × ${photoSize.h} px` : 'Reading...'}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ pt: 1, flexWrap: 'wrap', rowGap: 1 }}>
          {phase === 'uploaded' && (
            <Button
              variant="contained"
              startIcon={<AutoAwesomeIcon />}
              onClick={onAnalyze}
              sx={{ borderRadius: '12px' }}
            >
              Analyze face
            </Button>
          )}
          {phase === 'done' && (
            <Button
              variant="outlined"
              startIcon={<RestartAltIcon />}
              onClick={onReplace}
              sx={{ borderRadius: '12px' }}
            >
              Use a different photo
            </Button>
          )}
          <Button
            variant="text"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={onDelete}
            sx={{ borderRadius: '12px' }}
          >
            Delete photo
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
}

function AnalyzingPanel() {
  return (
    <Box sx={{ p: 3, borderRadius: '14px', backgroundColor: 'rgba(255,255,255,0.04)' }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
        <CircularProgress size={24} />
        <Typography sx={{ fontWeight: 600 }}>Analyzing facial structure...</Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        Loading the face mesh model and measuring 468 landmark points. First run
        downloads the model (~5 MB) — subsequent scans are instant.
      </Typography>
      <LinearProgress />
    </Box>
  );
}

// ── Scan result dashboard ──────────────────────────────────────────

function ScanDashboard({ analysis }) {
  const { faceShape, confidence, alternatives, profile } = analysis;
  return (
    <Box
      sx={{
        p: 3,
        borderRadius: '20px',
        background:
          'linear-gradient(135deg, rgba(255,122,182,0.12) 0%, rgba(184,90,193,0.08) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
        <Stack spacing={0.5} sx={{ flex: 1 }}>
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 1.2 }}>
            Face shape
          </Typography>
          <Typography variant="h3" sx={{ fontSize: { xs: '2.25rem', md: '2.75rem' }, fontWeight: 800 }}>
            {faceShape}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {Math.round(confidence * 100)}% match · also looks a bit like{' '}
            {alternatives.slice(1, 3).map((s) => s.shape).join(' / ')}
          </Typography>
        </Stack>
        <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />
        <Stack spacing={0.75} sx={{ flex: 1.2 }}>
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 1.2 }}>
            Facial structure
          </Typography>
          <ProfileRow label="Forehead"   value={profile.foreheadWidth} />
          <ProfileRow label="Cheekbones" value={profile.cheekboneEmph} />
          <ProfileRow label="Jawline"    value={profile.jawWidth} />
          <ProfileRow label="Face length" value={profile.faceLength} />
          <ProfileRow label="Chin"       value={profile.chinShape} />
        </Stack>
      </Stack>
    </Box>
  );
}

function ProfileRow({ label, value }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Typography variant="caption" color="text.secondary" sx={{ width: 96 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {value}
      </Typography>
    </Stack>
  );
}

// ── Preferences ────────────────────────────────────────────────────

function PreferencesPanel({ prefs, onChange }) {
  return (
    <Box sx={{ p: 2, borderRadius: '14px', backgroundColor: 'rgba(255,255,255,0.03)' }}>
      <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 1.2 }}>
        Filter recommendations
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 1 }}>
        <PrefSelect
          label="Gender"
          value={prefs.gender}
          onChange={(v) => onChange({ ...prefs, gender: v })}
          options={[
            { value: '', label: 'Any' },
            { value: 'm', label: "Men's" },
            { value: 'w', label: "Women's" },
          ]}
        />
        <PrefSelect
          label="Length"
          value={prefs.length}
          onChange={(v) => onChange({ ...prefs, length: v })}
          options={[
            { value: '', label: 'Any' },
            { value: 'short', label: 'Short' },
            { value: 'medium', label: 'Medium' },
            { value: 'long', label: 'Long' },
          ]}
        />
        <PrefSelect
          label="Hair texture"
          value={prefs.texture}
          onChange={(v) => onChange({ ...prefs, texture: v })}
          options={[
            { value: '', label: 'Any' },
            { value: 'straight', label: 'Straight' },
            { value: 'wavy', label: 'Wavy' },
            { value: 'curly', label: 'Curly' },
            { value: 'coily', label: 'Coily' },
          ]}
        />
      </Stack>
    </Box>
  );
}

function PrefSelect({ label, value, onChange, options }) {
  return (
    <Box sx={{ flex: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      <Select
        size="small"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        fullWidth
        sx={{ borderRadius: '10px' }}
      >
        {options.map((o) => (
          <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
        ))}
      </Select>
    </Box>
  );
}

// ── Recommendations grid ───────────────────────────────────────────

function RecommendationsList({ analysis, prefs, favoriteIds, onToggleFavorite, onPreview }) {
  // recommendHairstyles is pure — recompute when prefs change.
  const ranked = useMemo(
    () => recommendHairstyles(analysis, prefs),
    [analysis, prefs]
  );
  const recommended = ranked.filter((r) => r.score >= 55).slice(0, 12);
  const avoid = ranked.filter((r) => r.score < 40).slice(-3);

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 1.2 }}>
          Recommended for you ({recommended.length})
        </Typography>
        <Box
          sx={{
            mt: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))',
            gap: 1.75,
          }}
        >
          {recommended.map((style) => (
            <HairstyleCard
              key={style.id}
              style={style}
              isFavorite={favoriteIds.has(style.id)}
              onToggleFavorite={() => onToggleFavorite(style)}
              onPreview={() => onPreview(style)}
            />
          ))}
        </Box>
      </Box>

      {avoid.length > 0 && (
        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 1.2 }}>
            Probably not your best look
          </Typography>
          <Stack spacing={1} sx={{ mt: 1 }}>
            {avoid.map((style) => (
              <Box
                key={style.id}
                sx={{
                  p: 1.5,
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255,110,64,0.06)',
                  border: '1px solid rgba(255,110,64,0.2)',
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {style.name}
                </Typography>
                {style.reasons[0] && (
                  <Typography variant="caption" color="text.secondary">
                    {style.reasons[0]}
                  </Typography>
                )}
              </Box>
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}

function HairstyleCard({ style, isFavorite, onToggleFavorite, onPreview }) {
  const matchColor =
    style.match === 'Excellent' ? '#00E5A8' :
    style.match === 'Great'     ? '#7C9CFF' :
    style.match === 'Good'      ? '#FFC36B' :
    style.match === 'Fair'      ? '#FF9F73' : '#FF6E40';

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: '16px',
        backgroundColor: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        <HairstyleGlyph kind={style.illustration} />
        <Stack sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            {style.name}
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ mt: 0.25 }}>
            <Chip
              size="small"
              label={style.match}
              sx={{
                height: 18,
                fontSize: 10,
                fontWeight: 700,
                backgroundColor: `${matchColor}22`,
                color: matchColor,
              }}
            />
            <Chip
              size="small"
              label={`${style.score}%`}
              sx={{ height: 18, fontSize: 10, backgroundColor: 'rgba(255,255,255,0.06)' }}
            />
          </Stack>
        </Stack>
        <Tooltip title={isFavorite ? 'Remove favorite' : 'Save as favorite'}>
          <IconButton size="small" onClick={onToggleFavorite}>
            {isFavorite ? (
              <FavoriteIcon fontSize="small" sx={{ color: '#FF66D4' }} />
            ) : (
              <FavoriteBorderIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </Stack>

      <Typography variant="caption" color="text.secondary">
        {style.description}
      </Typography>

      {style.reasons.length > 0 && (
        <Box sx={{ pt: 0.5 }}>
          {style.reasons.slice(0, 2).map((r, i) => (
            <Typography
              key={i}
              variant="caption"
              sx={{ display: 'block', fontSize: 11.5, color: 'rgba(255,255,255,0.7)' }}
            >
              • {r}
            </Typography>
          ))}
        </Box>
      )}

      <Stack direction="row" spacing={1} sx={{ mt: 'auto', pt: 1 }}>
        <DifficultyDots label="Style" value={style.difficulty} />
        <DifficultyDots label="Upkeep" value={style.maintenance} />
      </Stack>

      <Button
        size="small"
        variant="outlined"
        startIcon={<VisibilityIcon />}
        onClick={onPreview}
        sx={{ borderRadius: '10px', mt: 0.5 }}
      >
        Preview on me
      </Button>
    </Box>
  );
}

function DifficultyDots({ label, value }) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
        {label}
      </Typography>
      {[1, 2, 3].map((i) => (
        <Box
          key={i}
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: i <= value ? '#FF66D4' : 'rgba(255,255,255,0.15)',
          }}
        />
      ))}
    </Stack>
  );
}

// Tiny SVG glyph per style — keeps the catalog visual without bundling
// 25 stock photos. When the AI preview backend lands, these get
// replaced with real generated images.
function HairstyleGlyph({ kind }) {
  return (
    <Box
      sx={{
        width: 44,
        height: 44,
        borderRadius: '12px',
        background: 'linear-gradient(135deg, #FF7AB6 0%, #B85AC1 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: '#fff',
      }}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        {hairstylePath(kind)}
      </svg>
    </Box>
  );
}

function hairstylePath(kind) {
  // Each glyph is a stylized silhouette — purely decorative. The visual
  // contract is "this is a hairstyle icon", not "this is what the cut
  // looks like".
  switch (kind) {
    case 'buzz':
      return <path d="M6 14c0-3 3-7 6-7s6 4 6 7v2H6v-2zm2 0h8v-1H8v1z" />;
    case 'crew':
      return <path d="M5 14c0-4 3-8 7-8s7 4 7 8v2H5v-2zm2 0h10v-2c0-1-1-2-2-2h-6c-1 0-2 1-2 2v2z" />;
    case 'fade':
      return <path d="M5 14c0-4 3-8 7-8s7 4 7 8v2H5v-2zm0 1h14M7 11h10" />;
    case 'crop':
      return <path d="M5 9c0-2 3-4 7-4s7 2 7 4v3l-4 1H9l-4-1V9z" />;
    case 'quiff':
      return <path d="M6 14c-1-5 2-9 6-9s7 4 7 9v2H6v-2zm6-7c-2 0-3 2-3 4v3h2V8h2v6h2v-3c0-2-1-4-3-4z" />;
    case 'pomp':
      return <path d="M6 14c0-6 3-10 6-10 3 0 7 4 7 10v2H6v-2zm5-9c-2 1-3 3-3 5v4h8V9c0-2-2-4-5-4z" />;
    case 'sidepart':
      return <path d="M5 14c0-4 3-9 7-9s7 5 7 9v2H5v-2zm3 0h8l-2-7-3 3-3-3v7z" />;
    case 'slick':
      return <path d="M5 14c0-3 3-7 7-7s7 4 7 7v2H5v-2zm14-3l-6 2-6-2" />;
    case 'mullet':
      return <path d="M5 14c0-4 3-7 7-7s7 3 7 7v2H5v-2zm14 0v3c0 1-1 2-2 2h-1l-1-3" />;
    case 'curls':
      return <path d="M7 9c0-3 2-5 5-5s5 2 5 5c0 2-1 3-2 4l1 2-2-1-1 2-2-2-1 1-1-2c-1-1-2-2-2-4z" />;
    case 'undercut':
      return <path d="M6 14c0-4 3-9 7-9s6 4 6 8v3H6v-2zm0 1h13M8 12h8" />;
    case 'bob':
      return <path d="M5 14c0-5 3-9 7-9s7 4 7 9v2H5v-2zm0 0h14v-1H5v1z" />;
    case 'lob':
      return <path d="M5 14c0-5 3-9 7-9s7 4 7 9v4H5v-4zm0 4h14v-1H5v1z" />;
    case 'pixie':
      return <path d="M6 13c0-4 2-8 6-8s6 4 6 8v3H6v-3zm3 0h6v-2H9v2z" />;
    case 'layers':
      return <path d="M5 14c0-5 3-9 7-9s7 4 7 9v6H5v-6zm0 3h14M5 18h14" />;
    case 'curtain':
      return <path d="M5 13c0-5 3-9 7-9s7 4 7 9v3H5v-3zm5 0l2-3 2 3" />;
    case 'waves':
      return <path d="M5 14c0-5 3-9 7-9s7 4 7 9v6H5v-6zm1 1c2-1 4 1 6 0s4-1 6 0M6 17c2-1 4 1 6 0s4-1 6 0" />;
    case 'wolf':
      return <path d="M5 13c0-5 3-9 7-9s7 4 7 9v5H5v-5zm3 0c-1 2 0 4 1 5M16 13c1 2 0 4-1 5" />;
    case 'butterfly':
      return <path d="M5 14c0-5 3-9 7-9s7 4 7 9v6H5v-6zm1 2c2 0 4 2 6 2s4-2 6-2" />;
    case 'shag':
      return <path d="M5 13c0-5 3-9 7-9s7 4 7 9v5l-2 2-2-1-2 2-1-2-2 1-2-2-2-2v-3z" />;
    case 'pony':
      return <path d="M6 12c0-4 3-7 6-7s6 3 6 7v2h-3l-1 5-2-5h-6v-2z" />;
    case 'beach':
      return <path d="M5 14c0-5 3-9 7-9s7 4 7 9v6H5v-6zm1 2q3-2 6 0t6 0M6 18q3-2 6 0t6 0" />;
    default:
      return <circle cx="12" cy="12" r="6" />;
  }
}

// ── Saved-favorites strip (shown on idle screen) ───────────────────

function FavoritesPreview({ favorites }) {
  return (
    <Box>
      <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 1.2 }}>
        Your saved hairstyles ({favorites.length})
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mt: 1, overflowX: 'auto', pb: 1 }}>
        {favorites.map((f) => (
          <Box
            key={f.id}
            sx={{
              minWidth: 140,
              p: 1.5,
              borderRadius: '12px',
              backgroundColor: 'rgba(255,255,255,0.04)',
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {f.name}
            </Typography>
            {f.faceShape && (
              <Typography variant="caption" color="text.secondary">
                For {f.faceShape} · {f.score}%
              </Typography>
            )}
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

// ── Helpers ────────────────────────────────────────────────────────

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = url;
  });
}

// ── Real preview dialog (Gemini-powered) ───────────────────────────
//
// Opens with the user's original photo on the left and a placeholder on
// the right. When the user hits Generate, posts to the proxy and swaps
// the placeholder for the returned image. A before/after slider lets
// them compare interactively. Styling-studio controls (color / volume /
// length / texture override) re-fire generation when changed.
//
// State lives in the dialog so closing/reopening with the same style +
// options pulls from the in-module cache (zero quota burn).

function PreviewDialog({
  open, style, photoUrl, baseUrl, getPhoto, onClose,
  backend, setBackend, cloudflareAccountId,
}) {
  const [phase, setPhase] = useState('idle'); // 'idle' | 'loading' | 'done' | 'error'
  const [dataUrl, setDataUrl] = useState(null);
  const [err, setErr] = useState('');
  const [opts, setOpts] = useState({ color: 'natural', volume: '', length: '', texture: '' });

  // Reset on style or backend change.
  useEffect(() => {
    setPhase('idle');
    setDataUrl(null);
    setErr('');
  }, [style?.id, backend]);

  if (!style) return null;
  const configured = !!baseUrl;

  const generate = async () => {
    setPhase('loading');
    setErr('');
    try {
      const photo = await getPhoto();
      if (!photo) { setPhase('error'); setErr('Photo not ready'); return; }
      const r = await generatePreview({
        baseUrl, style, photo, options: opts,
        backend, cloudflareAccountId,
      });
      if (r.ok) { setDataUrl(r.dataUrl); setPhase('done'); }
      else      { setPhase('error'); setErr(r.error); }
    } catch (e) {
      setPhase('error');
      setErr(e?.message || 'Unknown error');
    }
  };

  const download = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `yoloaio-${style.id}.png`;
    a.click();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <HairstyleGlyph kind={style.illustration} />
          <Stack sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {style.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Preview · {style.match} match · {style.score}%
            </Typography>
          </Stack>
        </Stack>
      </DialogTitle>
      <DialogContent>
        {!configured && (
          <Alert severity="info" sx={{ mb: 2 }}>
            AI preview is not configured yet. Set <code>styleApiBaseUrl</code> in
            the app config to your proxy URL and add the relevant API key
            (<code>GEMINI_API_KEY</code> and/or <code>CLOUDFLARE_API_TOKEN</code>)
            to the proxy's environment.
          </Alert>
        )}

        <BackendPicker
          backend={backend}
          setBackend={setBackend}
          cloudflareConfigured={!!cloudflareAccountId}
        />

        {phase !== 'done' ? (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <PreviewTile src={photoUrl} label="Original" />
            <PreviewTile
              label={
                phase === 'loading' ? 'Generating…' :
                phase === 'error'   ? 'Generation failed' :
                'Tap Generate to preview'
              }
              loading={phase === 'loading'}
              error={phase === 'error'}
            />
          </Stack>
        ) : (
          <BeforeAfterSlider before={photoUrl} after={dataUrl} />
        )}

        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>{err}</Alert>}

        <StylingStudio opts={opts} onChange={setOpts} />

        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 1.2, display: 'block', mt: 2 }}>
          About this style
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {style.description}
        </Typography>
        {style.reasons.length > 0 && (
          <Box sx={{ mt: 1 }}>
            {style.reasons.map((r, i) => (
              <Typography key={i} variant="caption" sx={{ display: 'block' }}>
                • {r}
              </Typography>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {phase === 'done' && (
          <Button
            startIcon={<DownloadIcon />}
            onClick={download}
            sx={{ mr: 'auto' }}
          >
            Download
          </Button>
        )}
        <Button onClick={onClose}>Close</Button>
        <Button
          variant="contained"
          startIcon={<AutoAwesomeIcon />}
          onClick={generate}
          disabled={!configured || phase === 'loading'}
          sx={{ borderRadius: '12px' }}
        >
          {phase === 'done' ? 'Regenerate' : 'Generate'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function PreviewTile({ src, label, loading, error }) {
  return (
    <Box
      sx={{
        flex: 1,
        aspectRatio: '1 / 1',
        borderRadius: '12px',
        overflow: 'hidden',
        backgroundColor: 'rgba(0,0,0,0.3)',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {src ? (
        <Box component="img" src={src} alt={label} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <Stack alignItems="center" spacing={1} sx={{ p: 2, textAlign: 'center' }}>
          {loading ? <CircularProgress size={28} /> : (
            <AutoAwesomeIcon sx={{ fontSize: 36, color: error ? '#FF6E40' : 'rgba(255,255,255,0.4)' }} />
          )}
          <Typography variant="caption" color="text.secondary">{label}</Typography>
        </Stack>
      )}
    </Box>
  );
}

// Pointer-driven before/after comparison. The "after" image sits on top
// inside a clip-path that's controlled by the cursor / touch X.
function BeforeAfterSlider({ before, after }) {
  const ref = useRef(null);
  const [pct, setPct] = useState(50);
  const dragging = useRef(false);

  const updateFromEvent = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const p = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setPct(p);
  };

  const onDown = (e) => {
    dragging.current = true;
    updateFromEvent(e);
  };
  const onMove = (e) => {
    if (!dragging.current) return;
    updateFromEvent(e);
  };
  const onUp = () => { dragging.current = false; };

  useEffect(() => {
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
  }, []);

  return (
    <Box
      ref={ref}
      onMouseDown={onDown}
      onMouseMove={onMove}
      onTouchStart={onDown}
      onTouchMove={onMove}
      sx={{
        position: 'relative',
        width: '100%',
        aspectRatio: '1 / 1',
        maxHeight: 480,
        mx: 'auto',
        borderRadius: '14px',
        overflow: 'hidden',
        userSelect: 'none',
        touchAction: 'none',
        cursor: 'ew-resize',
        mb: 2,
        backgroundColor: 'rgba(0,0,0,0.3)',
      }}
    >
      <Box component="img" src={before} alt="Before" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          clipPath: `inset(0 0 0 ${pct}%)`,
        }}
      >
        <Box component="img" src={after} alt="After" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </Box>
      {/* Handle */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${pct}%`,
          width: 2,
          backgroundColor: '#fff',
          boxShadow: '0 0 10px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: `${pct}%`,
          transform: 'translate(-50%, -50%)',
          width: 36,
          height: 36,
          borderRadius: '50%',
          backgroundColor: '#fff',
          color: '#222',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          pointerEvents: 'none',
        }}
      >
        <CompareIcon fontSize="small" />
      </Box>
      <Chip
        size="small"
        label="Before"
        sx={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff', fontWeight: 600 }}
      />
      <Chip
        size="small"
        label="After"
        sx={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff', fontWeight: 600 }}
      />
    </Box>
  );
}

// Picks which AI backend to use for previews. Showed in both the single
// preview dialog and the compare dialog so users can switch on the fly
// when one backend's quota runs out.
function BackendPicker({ backend, setBackend, cloudflareConfigured }) {
  const items = [
    {
      id: 'gemini',
      label: 'Gemini',
      blurb: 'Best identity preservation. Free tier is tight — burns ~10 images then locks for the day.',
    },
    {
      id: 'cloudflare',
      label: 'Cloudflare SDXL',
      blurb: cloudflareConfigured
        ? 'Truly free (10K neurons/day). Identity drifts a bit but works for casual try-ons.'
        : 'Not configured — add cloudflareAccountId in app config + CLOUDFLARE_API_TOKEN in proxy env.',
    },
  ];
  return (
    <Box sx={{ mb: 2, p: 1.25, borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.03)' }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 1, mr: 0.5 }}>
          BACKEND
        </Typography>
        {items.map((it) => (
          <Chip
            key={it.id}
            label={it.label}
            size="small"
            clickable
            color={backend === it.id ? 'primary' : 'default'}
            onClick={() => setBackend(it.id)}
            disabled={it.id === 'cloudflare' && !cloudflareConfigured}
            sx={{ borderRadius: '10px', fontWeight: 600 }}
          />
        ))}
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, fontSize: 11 }}>
        {items.find((i) => i.id === backend)?.blurb}
      </Typography>
    </Box>
  );
}

// Virtual styling studio — hair color + volume + length/texture overrides.
// Optional; if left blank the prompt uses the catalog defaults.
function StylingStudio({ opts, onChange }) {
  const colors = ['natural', 'Black', 'Brown', 'Dark Brown', 'Blonde', 'Platinum Blonde', 'Red', 'Auburn', 'Gray', 'White', 'Pastel Pink', 'Pastel Blue'];
  return (
    <Box sx={{ mt: 1, p: 2, borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.03)' }}>
      <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 1.2 }}>
        Styling studio
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', rowGap: 1 }}>
        <StudioSelect label="Color"   value={opts.color}   onChange={(v) => onChange({ ...opts, color: v })}
          options={colors.map((c) => ({ value: c, label: c === 'natural' ? 'Natural' : c }))}
        />
        <StudioSelect label="Length"  value={opts.length}  onChange={(v) => onChange({ ...opts, length: v })}
          options={[{ value: '', label: 'Default' }, { value: 'short', label: 'Short' }, { value: 'medium', label: 'Medium' }, { value: 'long', label: 'Long' }]}
        />
        <StudioSelect label="Texture" value={opts.texture} onChange={(v) => onChange({ ...opts, texture: v })}
          options={[{ value: '', label: 'Default' }, { value: 'straight', label: 'Straight' }, { value: 'wavy', label: 'Wavy' }, { value: 'curly', label: 'Curly' }, { value: 'coily', label: 'Coily' }]}
        />
        <StudioSelect label="Volume"  value={opts.volume}  onChange={(v) => onChange({ ...opts, volume: v })}
          options={[{ value: '', label: 'Default' }, { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]}
        />
      </Stack>
    </Box>
  );
}

function StudioSelect({ label, value, onChange, options }) {
  return (
    <Box sx={{ minWidth: 130 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      <Select
        size="small"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        sx={{ borderRadius: '10px', width: '100%' }}
      >
        {options.map((o) => (
          <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
        ))}
      </Select>
    </Box>
  );
}

// ── Compare grid — generate top picks in parallel ──────────────────
//
// Free-tier Gemini Flash Image is fast enough that firing 4-6 requests
// in parallel doesn't take much longer than firing one. Each tile shows
// its own loading state and populates the moment its request returns.

function CompareDialog({
  open, onClose, analysis, prefs, photoUrl, baseUrl, getPhoto,
  backend, setBackend, cloudflareAccountId,
}) {
  const [count, setCount] = useState(4);
  const [items, setItems] = useState({}); // styleId → { phase, dataUrl, error }
  const [running, setRunning] = useState(false);

  const ranked = useMemo(() => {
    if (!analysis) return [];
    return recommendHairstyles(analysis, prefs).slice(0, 9);
  }, [analysis, prefs]);
  const selected = ranked.slice(0, count);

  const run = async () => {
    setRunning(true);
    const initial = {};
    selected.forEach((s) => { initial[s.id] = { phase: 'pending' }; });
    setItems(initial);
    const photo = await getPhoto();
    if (!photo) { setRunning(false); return; }
    await generatePreviewsParallel({
      baseUrl,
      styles: selected,
      photo,
      options: {},
      backend,
      cloudflareAccountId,
      onUpdate: (id, state) => setItems((prev) => ({ ...prev, [id]: state })),
    });
    setRunning(false);
  };

  // Reset items when closed.
  useEffect(() => {
    if (!open) {
      setItems({});
      setRunning(false);
    }
  }, [open]);

  const cols = count <= 4 ? 2 : count <= 6 ? 3 : 3;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <GridViewIcon />
          <Stack sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Compare top picks</Typography>
            <Typography variant="caption" color="text.secondary">
              Generates your best matches side-by-side. Free-tier-friendly — runs in parallel.
            </Typography>
          </Stack>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <BackendPicker
          backend={backend}
          setBackend={setBackend}
          cloudflareConfigured={!!cloudflareAccountId}
        />
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          {[4, 6, 9].map((n) => (
            <Chip
              key={n}
              label={`${n} styles`}
              clickable
              color={count === n ? 'primary' : 'default'}
              onClick={() => setCount(n)}
              sx={{ borderRadius: '10px' }}
            />
          ))}
          <Box sx={{ flex: 1 }} />
          <Button
            variant="contained"
            startIcon={<AutoAwesomeIcon />}
            onClick={run}
            disabled={!baseUrl || running}
            sx={{ borderRadius: '12px' }}
          >
            {running ? 'Generating…' : `Generate ${count}`}
          </Button>
        </Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 1.5 }}>
          {selected.map((style) => {
            const it = items[style.id];
            return (
              <Box
                key={style.id}
                sx={{
                  borderRadius: '12px',
                  overflow: 'hidden',
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  aspectRatio: '1 / 1',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Box sx={{ flex: 1, position: 'relative', backgroundColor: 'rgba(0,0,0,0.3)' }}>
                  {it?.phase === 'done' && (
                    <Box component="img" src={it.dataUrl} alt={style.name}
                      sx={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                  )}
                  {(!it || it.phase === 'pending' || it.phase === 'loading') && (
                    <Stack alignItems="center" justifyContent="center" sx={{ position: 'absolute', inset: 0 }}>
                      {it?.phase === 'loading'
                        ? <CircularProgress size={24} />
                        : <AutoAwesomeIcon sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 28 }} />}
                    </Stack>
                  )}
                  {it?.phase === 'error' && (
                    <Stack alignItems="center" justifyContent="center" sx={{ position: 'absolute', inset: 0, p: 1, textAlign: 'center' }}>
                      <Typography variant="caption" color="error">{it.error?.slice(0, 80) || 'Failed'}</Typography>
                    </Stack>
                  )}
                </Box>
                <Box sx={{ p: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                    {style.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                    {style.match} · {style.score}%
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
