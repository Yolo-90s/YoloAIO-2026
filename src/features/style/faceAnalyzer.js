// Face landmark detection + face-shape classification.
//
// MediaPipe FaceLandmarker is loaded lazily — it pulls ~3 MB of WASM and
// ~5 MB of model weights from the CDN, so we only initialize when the
// user actually opens Style Yourself. The instance is cached
// module-locally so subsequent analyses reuse the warm WASM context.
//
// The 468-point face mesh gives us enough geometry to compute the
// standard ratios used in face-shape classification without any further
// ML model:
//
//   facial thirds    — forehead, midface, lower face
//   width ratios     — forehead / cheekbone / jawline
//   chin angle       — pointed vs rounded vs square
//   length-to-width  — distinguishes Oval from Round, Rectangle from Square
//
// Index map (MediaPipe canonical face mesh):
//
//   10                — center of hairline / top forehead
//   152               — chin tip
//   234, 454          — left/right temple (forehead width sample)
//   127, 356          — outer cheekbones (widest face point on most faces)
//   172, 397          — jaw angles (gonial)
//   58, 288           — outer jawline mid-point
//   18                — chin point above jawline (for angle measurement)
//
// We average a small neighborhood at each anchor for robustness against
// landmark jitter.

let landmarkerPromise = null;

async function loadLandmarker() {
  if (landmarkerPromise) return landmarkerPromise;
  landmarkerPromise = (async () => {
    const vision = await import('@mediapipe/tasks-vision');
    const { FilesetResolver, FaceLandmarker } = vision;
    // MediaPipe ships the WASM and model on its CDN. Loading from CDN
    // avoids us having to copy the binary into /public.
    const filesetResolver = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
    );
    const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'IMAGE',
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    });
    return landmarker;
  })();
  return landmarkerPromise;
}

// Wrap a raw image (HTMLImageElement or HTMLCanvasElement) into a
// landmark detection. Returns { ok, landmarks, error }.
export async function detectLandmarks(image) {
  try {
    const lm = await loadLandmarker();
    const result = lm.detect(image);
    if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
      return { ok: false, error: 'No face found in the photo' };
    }
    return { ok: true, landmarks: result.faceLandmarks[0] };
  } catch (e) {
    return { ok: false, error: e?.message || 'Face detection failed' };
  }
}

// Compute key measurements + face shape from landmarks.
// Landmarks are normalized [0..1] x, y, z coordinates relative to the
// input image. We work in those same units — ratios are scale-free.
export function analyzeFromLandmarks(landmarks) {
  const p = (i) => landmarks[i];
  const dist = (a, b) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  };
  const avg = (...pts) => ({
    x: pts.reduce((s, q) => s + q.x, 0) / pts.length,
    y: pts.reduce((s, q) => s + q.y, 0) / pts.length,
  });

  // Anchor points (averaged for robustness).
  const hairline   = avg(p(10), p(151), p(9));         // top of forehead
  const chin       = avg(p(152), p(199), p(175));      // chin tip
  const foreheadL  = avg(p(54), p(103), p(67));        // upper-left forehead
  const foreheadR  = avg(p(284), p(332), p(297));      // upper-right forehead
  const cheekL     = avg(p(234), p(227), p(116));      // left widest cheek
  const cheekR     = avg(p(454), p(447), p(345));      // right widest cheek
  const jawL       = avg(p(172), p(58), p(132));       // left jaw angle
  const jawR       = avg(p(397), p(288), p(361));      // right jaw angle
  const browCenter = avg(p(168), p(6));                // between brows
  const noseTip    = p(1);

  // Distances (normalized image units).
  const faceLength      = dist(hairline, chin);
  const foreheadWidth   = dist(foreheadL, foreheadR);
  const cheekboneWidth  = dist(cheekL, cheekR);
  const jawWidth        = dist(jawL, jawR);
  const midface         = dist(browCenter, noseTip);
  const lowerFace       = dist(noseTip, chin);
  const upperFace       = dist(hairline, browCenter);

  // Ratios.
  const lengthToWidth   = faceLength / cheekboneWidth;
  const foreheadToCheek = foreheadWidth / cheekboneWidth;
  const jawToCheek      = jawWidth / cheekboneWidth;
  const foreheadToJaw   = foreheadWidth / jawWidth;

  // Chin angle — how pointed the chin is. Vector from jaw-mid down to chin
  // vs straight-down gives us the chin angle in degrees.
  const jawMid = avg(jawL, jawR);
  const vChinX = chin.x - jawMid.x;
  const vChinY = chin.y - jawMid.y;
  const chinDrop = Math.sqrt(vChinX * vChinX + vChinY * vChinY);
  // Angle relative to face width — small ratio = sharp/pointed, large = blunt.
  const chinSharpness = chinDrop / cheekboneWidth;

  const shape = classifyShape({
    lengthToWidth,
    foreheadToCheek,
    jawToCheek,
    foreheadToJaw,
    chinSharpness,
  });

  // Score the top three candidates so the UI can show confidence-style
  // rankings even though we don't have a probabilistic model.
  const alternatives = scoreAllShapes({
    lengthToWidth,
    foreheadToCheek,
    jawToCheek,
    foreheadToJaw,
    chinSharpness,
  });

  return {
    faceShape: shape,
    confidence: alternatives[0].score,
    alternatives,
    measurements: {
      lengthToWidth: round(lengthToWidth, 3),
      foreheadToCheek: round(foreheadToCheek, 3),
      jawToCheek: round(jawToCheek, 3),
      foreheadToJaw: round(foreheadToJaw, 3),
      chinSharpness: round(chinSharpness, 3),
      upperFace: round(upperFace, 3),
      midface: round(midface, 3),
      lowerFace: round(lowerFace, 3),
    },
    // Qualitative descriptors derived from the same ratios — these feed
    // the recommendation engine and the "facial structure summary" UI.
    profile: {
      foreheadWidth:  qualWidth(foreheadToCheek),
      jawWidth:       qualWidth(jawToCheek),
      faceLength:     lengthToWidth >= 1.5 ? 'Long' : lengthToWidth >= 1.25 ? 'Balanced' : 'Short',
      chinShape:      chinSharpness < 0.28 ? 'Pointed' : chinSharpness < 0.40 ? 'Rounded' : 'Square',
      cheekboneEmph:  cheekboneWidth > foreheadWidth && cheekboneWidth > jawWidth ? 'High' : 'Moderate',
    },
  };
}

function classifyShape(r) {
  return scoreAllShapes(r)[0].shape;
}

// Score each shape based on how well the measurements match its
// canonical signature. Each shape has rules; we sum positive matches.
// Higher score = stronger match. Returned scores normalized to [0..1]
// for display.
function scoreAllShapes(r) {
  const { lengthToWidth, foreheadToCheek, jawToCheek, foreheadToJaw, chinSharpness } = r;

  const shapes = [
    {
      shape: 'Oval',
      score:
        score(lengthToWidth, 1.4, 1.6, 1) +              // length ~1.5× width
        score(foreheadToCheek, 0.88, 0.96, 1) +          // forehead slightly less than cheek
        score(jawToCheek, 0.80, 0.92, 1) +               // jaw narrower than cheek
        score(chinSharpness, 0.30, 0.40, 0.7),
    },
    {
      shape: 'Round',
      score:
        score(lengthToWidth, 0.95, 1.15, 1.2) +          // length ≈ width
        score(foreheadToCheek, 0.92, 1.02, 1) +
        score(jawToCheek, 0.88, 1.00, 1) +
        score(chinSharpness, 0.32, 0.46, 0.8),           // soft chin
    },
    {
      shape: 'Square',
      score:
        score(lengthToWidth, 0.98, 1.18, 1) +
        score(foreheadToCheek, 0.96, 1.06, 1) +
        score(jawToCheek, 0.96, 1.08, 1.2) +             // jaw ≈ cheekbone
        score(chinSharpness, 0.36, 0.50, 1),             // square chin
    },
    {
      shape: 'Rectangle',
      score:
        score(lengthToWidth, 1.45, 1.75, 1.3) +          // long face
        score(foreheadToCheek, 0.94, 1.04, 1) +
        score(jawToCheek, 0.92, 1.04, 1) +
        score(chinSharpness, 0.35, 0.48, 0.7),
    },
    {
      shape: 'Oblong',
      score:
        score(lengthToWidth, 1.65, 2.0, 1.5) +           // very long
        score(foreheadToCheek, 0.92, 1.02, 0.7) +
        score(jawToCheek, 0.88, 1.00, 0.7),
    },
    {
      shape: 'Heart',
      score:
        score(lengthToWidth, 1.25, 1.55, 1) +
        score(foreheadToJaw, 1.10, 1.30, 1.4) +          // forehead wider than jaw
        score(chinSharpness, 0.20, 0.30, 1.2),           // pointed chin
    },
    {
      shape: 'Diamond',
      score:
        score(lengthToWidth, 1.30, 1.55, 0.9) +
        score(foreheadToCheek, 0.78, 0.90, 1.2) +        // narrow forehead
        score(jawToCheek, 0.78, 0.90, 1.2) +             // narrow jaw
        score(chinSharpness, 0.22, 0.32, 1),
    },
    {
      shape: 'Triangle',
      score:
        score(lengthToWidth, 1.25, 1.55, 1) +
        score(foreheadToJaw, 0.78, 0.92, 1.4),           // jaw wider than forehead
    },
  ];

  shapes.sort((a, b) => b.score - a.score);
  // Normalize to [0..1] for display.
  const maxScore = shapes[0].score || 1;
  return shapes.map((s) => ({
    shape: s.shape,
    score: Math.max(0, Math.min(1, s.score / maxScore)),
  }));
}

// Bell-curve-ish weighting: 1.0 at the center of the [lo..hi] range,
// 0 outside ±50 % of the range. weight scales the contribution.
function score(value, lo, hi, weight) {
  const mid = (lo + hi) / 2;
  const halfRange = (hi - lo) / 2;
  if (halfRange <= 0) return 0;
  const distance = Math.abs(value - mid) / halfRange;
  if (distance >= 2) return 0;
  return weight * Math.max(0, 1 - distance / 2);
}

function qualWidth(ratio) {
  if (ratio >= 1.02) return 'Wide';
  if (ratio >= 0.92) return 'Balanced';
  return 'Narrow';
}

function round(v, d) {
  const p = Math.pow(10, d);
  return Math.round(v * p) / p;
}

// Free the cached MediaPipe instance and release WASM memory. Called
// when the user explicitly deletes their photo or leaves the screen.
export function disposeAnalyzer() {
  if (!landmarkerPromise) return;
  landmarkerPromise.then((lm) => {
    try { lm.close(); } catch {}
  });
  landmarkerPromise = null;
}
