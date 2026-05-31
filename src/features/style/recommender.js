import { HAIRSTYLES } from './hairstyleData.js';

// Rule-based recommendation engine. Given a face-shape analysis, returns
// the hairstyle catalog sorted by suitability for that user, each
// annotated with:
//
//   score    0..100 — how strongly this style suits them
//   match    'Excellent' | 'Great' | 'Good' | 'Fair' | 'Avoid'
//   reasons  short bullet-list explaining the choice
//
// Inputs:
//   analysis     { faceShape, profile: { foreheadWidth, jawWidth, faceLength, ... } }
//   preferences  optional { gender, length, texture }
//                If supplied, styles outside the preference get a penalty
//                rather than being filtered — the user still sees what
//                they're missing in the "not recommended" tail.

export function recommendHairstyles(analysis, preferences = {}) {
  const { faceShape, profile } = analysis;
  const { gender, length, texture } = preferences;

  const ranked = HAIRSTYLES.map((style) => {
    const reasons = [];
    let score = 50; // baseline — neutral

    // ── Face shape match ──
    if (style.suitsShapes?.includes(faceShape)) {
      score += 30;
      reasons.push(
        style.whyItWorks?.[faceShape] ||
        `Complements ${faceShape.toLowerCase()} face shapes.`
      );
    }
    if (style.avoidsShapes?.includes(faceShape)) {
      score -= 25;
      reasons.push(
        `Tends to clash with ${faceShape.toLowerCase()} face proportions.`
      );
    }

    // ── Forehead / jaw width nudges ──
    if (profile?.foreheadWidth === 'Wide' && /pompadour|quiff|pomp|slick/i.test(style.id)) {
      score -= 5;
      reasons.push('Big top volume can exaggerate a wide forehead.');
    }
    if (profile?.foreheadWidth === 'Narrow' && /pompadour|quiff/i.test(style.id)) {
      score += 5;
      reasons.push('Adds visual width to a narrow forehead.');
    }
    if (profile?.jawWidth === 'Wide' && (style.length === 'short' && style.id !== 'french-crop' && style.id !== 'textured-crop')) {
      score -= 4;
    }
    if (profile?.faceLength === 'Long' && style.length === 'long' && !style.id.includes('bangs')) {
      score -= 6;
      reasons.push('Long without bangs lengthens an already long face.');
    }
    if (profile?.faceLength === 'Long' && /bangs|crop|fringe/i.test(style.id + ' ' + style.name)) {
      score += 6;
      reasons.push('Front fringe visually shortens a long face.');
    }
    if (profile?.faceLength === 'Short' && style.length === 'long') {
      score += 3;
    }

    // ── Preferences ──
    if (gender && style.gender !== 'u' && style.gender !== gender) {
      score -= 18;
    }
    if (length && style.length !== length) {
      score -= 5;
    }
    if (texture && style.texture && !style.texture.includes(texture)) {
      score -= 8;
      reasons.push(`Works best on ${style.texture.join(' or ')} hair — yours is ${texture}.`);
    }

    score = Math.max(0, Math.min(100, score));
    return {
      ...style,
      score,
      match: rankLabel(score),
      reasons,
    };
  });

  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

function rankLabel(score) {
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Great';
  if (score >= 55) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Avoid';
}
