// Hairstyle catalog used by the recommender + the preview grid.
//
// Each entry has:
//   id              stable kebab-case slug
//   name            display name
//   gender          'm' | 'w' | 'u' (unisex)
//   length          'short' | 'medium' | 'long'
//   texture         which natural textures it works well with (any of:
//                   'straight', 'wavy', 'curly', 'coily')
//   suitsShapes     array of face shape names this style flatters most
//   avoidsShapes    array of shapes where it tends to clash
//   difficulty      1..3 — how hard to style each morning
//   maintenance     1..3 — how often you need a barber visit
//   description     short blurb shown on the card
//   whyItWorks      lookup keyed by face shape, used in the recommendation
//                   explanation. Falls back to a generic line if missing.
//   illustration    inline SVG identifier — we draw a simple silhouette
//                   placeholder rather than ship 30 stock photos. When the
//                   AI preview backend lands these are replaced with real
//                   generated images.

export const HAIRSTYLES = [
  // ── Men's ──
  {
    id: 'crew-cut', name: 'Crew Cut', gender: 'm', length: 'short',
    texture: ['straight', 'wavy'],
    suitsShapes: ['Oval', 'Square', 'Round', 'Diamond'],
    avoidsShapes: ['Oblong'],
    difficulty: 1, maintenance: 3,
    description: 'Short, tapered sides with slightly longer top. Clean and military-tidy.',
    whyItWorks: {
      Square: 'Softens a strong jawline by adding length only on top.',
      Round:  'Vertical top lift makes round faces look slimmer.',
      Oval:   'Universally flattering — the safest short cut.',
    },
    illustration: 'crew',
  },
  {
    id: 'buzz-cut', name: 'Buzz Cut', gender: 'm', length: 'short',
    texture: ['straight', 'wavy', 'curly', 'coily'],
    suitsShapes: ['Oval', 'Square', 'Diamond'],
    avoidsShapes: ['Oblong', 'Rectangle', 'Heart'],
    difficulty: 1, maintenance: 3,
    description: 'Uniform short clip — the lowest-maintenance cut you can get.',
    whyItWorks: {
      Square: 'Showcases an angular jawline and strong cheekbones.',
      Oval:   'Works on almost any oval face — minimalist and confident.',
    },
    illustration: 'buzz',
  },
  {
    id: 'fade-low', name: 'Low Fade', gender: 'm', length: 'short',
    texture: ['straight', 'wavy', 'curly', 'coily'],
    suitsShapes: ['Oval', 'Round', 'Heart', 'Square'],
    avoidsShapes: [],
    difficulty: 2, maintenance: 3,
    description: 'Sides taper to skin near the ear, length kept on top.',
    whyItWorks: {
      Round: 'Tight sides slim the face; top volume adds vertical length.',
      Heart: 'Balanced fade lets you keep volume to offset a wider forehead.',
    },
    illustration: 'fade',
  },
  {
    id: 'fade-mid', name: 'Mid Fade', gender: 'm', length: 'short',
    texture: ['straight', 'wavy', 'curly'],
    suitsShapes: ['Oval', 'Square', 'Round', 'Diamond'],
    avoidsShapes: [],
    difficulty: 2, maintenance: 3,
    description: 'Fade starts mid-side — versatile, modern look.',
    whyItWorks: { Oval: 'Flattering on every face; the default modern barber cut.' },
    illustration: 'fade',
  },
  {
    id: 'fade-high', name: 'High Fade', gender: 'm', length: 'short',
    texture: ['straight', 'wavy', 'curly', 'coily'],
    suitsShapes: ['Square', 'Diamond'],
    avoidsShapes: ['Round', 'Oblong'],
    difficulty: 2, maintenance: 3,
    description: 'Aggressive fade up the sides — sharp, athletic look.',
    whyItWorks: { Square: 'Emphasises bone structure and angular cheekbones.' },
    illustration: 'fade',
  },
  {
    id: 'quiff', name: 'Quiff', gender: 'm', length: 'medium',
    texture: ['straight', 'wavy'],
    suitsShapes: ['Oval', 'Square', 'Round'],
    avoidsShapes: ['Oblong'],
    difficulty: 2, maintenance: 2,
    description: 'Voluminous top swept upward and back — classic with edge.',
    whyItWorks: {
      Round:  'Lifted top draws the eye up and elongates a round face.',
      Square: 'Softer top counterbalances a strong jaw.',
    },
    illustration: 'quiff',
  },
  {
    id: 'pompadour', name: 'Pompadour', gender: 'm', length: 'medium',
    texture: ['straight', 'wavy'],
    suitsShapes: ['Oval', 'Round', 'Square'],
    avoidsShapes: ['Oblong', 'Rectangle'],
    difficulty: 3, maintenance: 2,
    description: 'Big top volume swept back from the forehead — bold, classic.',
    whyItWorks: { Round: 'Maximum vertical lift slims the face dramatically.' },
    illustration: 'pomp',
  },
  {
    id: 'side-part', name: 'Side Part', gender: 'm', length: 'medium',
    texture: ['straight', 'wavy'],
    suitsShapes: ['Oval', 'Round', 'Diamond', 'Heart'],
    avoidsShapes: [],
    difficulty: 2, maintenance: 2,
    description: 'Crisp parting on one side — polished, timeless office look.',
    whyItWorks: {
      Round: 'Asymmetry breaks up the roundness of the face.',
      Heart: 'Parting balances out a wider top with directional flow.',
    },
    illustration: 'sidepart',
  },
  {
    id: 'french-crop', name: 'French Crop', gender: 'm', length: 'short',
    texture: ['straight', 'wavy', 'curly'],
    suitsShapes: ['Oval', 'Square', 'Oblong', 'Rectangle'],
    avoidsShapes: ['Round'],
    difficulty: 1, maintenance: 2,
    description: 'Short fringe brushed forward — youthful and easy.',
    whyItWorks: {
      Oblong:    'Front fringe shortens the face visually.',
      Rectangle: 'Forehead-covering fringe softens a long face.',
    },
    illustration: 'crop',
  },
  {
    id: 'textured-crop', name: 'Textured Crop', gender: 'm', length: 'short',
    texture: ['straight', 'wavy', 'curly'],
    suitsShapes: ['Oval', 'Square', 'Round', 'Diamond', 'Heart'],
    avoidsShapes: [],
    difficulty: 2, maintenance: 2,
    description: 'Choppy textured top with short sides — modern barber favourite.',
    whyItWorks: {
      Oval:    'Adds character without changing proportions.',
      Diamond: 'Wider top section adds balance to high cheekbones.',
    },
    illustration: 'crop',
  },
  {
    id: 'slick-back', name: 'Slick Back', gender: 'm', length: 'medium',
    texture: ['straight'],
    suitsShapes: ['Oval', 'Square', 'Diamond'],
    avoidsShapes: ['Round', 'Heart'],
    difficulty: 2, maintenance: 2,
    description: 'All hair swept straight back with product — sharp and formal.',
    whyItWorks: { Square: 'Exposes the full face — perfect for strong features.' },
    illustration: 'slick',
  },
  {
    id: 'modern-mullet', name: 'Modern Mullet', gender: 'm', length: 'medium',
    texture: ['straight', 'wavy'],
    suitsShapes: ['Oval', 'Square', 'Diamond'],
    avoidsShapes: ['Round'],
    difficulty: 2, maintenance: 2,
    description: 'Short on top, longer in the back — revived 90s look.',
    whyItWorks: { Square: 'Length at the back balances a wide jaw.' },
    illustration: 'mullet',
  },
  {
    id: 'curly-top', name: 'Curly Top', gender: 'm', length: 'medium',
    texture: ['curly', 'coily'],
    suitsShapes: ['Oval', 'Square', 'Diamond', 'Heart'],
    avoidsShapes: ['Round'],
    difficulty: 2, maintenance: 2,
    description: 'Defined curls left long on top with tapered sides.',
    whyItWorks: { Diamond: 'Curly volume tops a narrow forehead beautifully.' },
    illustration: 'curls',
  },
  {
    id: 'undercut', name: 'Undercut', gender: 'm', length: 'medium',
    texture: ['straight', 'wavy', 'curly'],
    suitsShapes: ['Oval', 'Square', 'Diamond'],
    avoidsShapes: ['Round', 'Oblong'],
    difficulty: 2, maintenance: 2,
    description: 'Sharp disconnected sides, long flowing top.',
    whyItWorks: { Square: 'Dramatic contrast suits strong angular features.' },
    illustration: 'undercut',
  },

  // ── Women's ──
  {
    id: 'bob', name: 'Bob Cut', gender: 'w', length: 'short',
    texture: ['straight', 'wavy'],
    suitsShapes: ['Oval', 'Square', 'Heart', 'Diamond'],
    avoidsShapes: ['Round'],
    difficulty: 1, maintenance: 2,
    description: 'Chin-length cut that frames the face — minimalist classic.',
    whyItWorks: {
      Square: 'Skims the jawline, softening sharp angles.',
      Heart:  'Adds width at the chin to balance a wider forehead.',
    },
    illustration: 'bob',
  },
  {
    id: 'lob', name: 'Lob', gender: 'w', length: 'medium',
    texture: ['straight', 'wavy'],
    suitsShapes: ['Oval', 'Round', 'Square', 'Heart', 'Oblong'],
    avoidsShapes: [],
    difficulty: 1, maintenance: 1,
    description: 'Long bob — shoulder-grazing, low-fuss everyday look.',
    whyItWorks: {
      Round: 'Vertical line of the cut slims a round face.',
      Oval:  'Forgiving on every shape — the default modern length.',
    },
    illustration: 'lob',
  },
  {
    id: 'pixie', name: 'Pixie Cut', gender: 'w', length: 'short',
    texture: ['straight', 'wavy'],
    suitsShapes: ['Oval', 'Heart', 'Diamond'],
    avoidsShapes: ['Round', 'Square'],
    difficulty: 1, maintenance: 3,
    description: 'Cropped close on sides and back, longer feathered top.',
    whyItWorks: {
      Heart:   'Volume on top balances a pointed chin elegantly.',
      Diamond: 'Spotlights cheekbones and a delicate jawline.',
    },
    illustration: 'pixie',
  },
  {
    id: 'layered', name: 'Layered Hair', gender: 'w', length: 'long',
    texture: ['straight', 'wavy', 'curly'],
    suitsShapes: ['Oval', 'Round', 'Square', 'Oblong'],
    avoidsShapes: [],
    difficulty: 1, maintenance: 1,
    description: 'Long layers cascading — movement and softness throughout.',
    whyItWorks: { Round: 'Layers create vertical movement that elongates the face.' },
    illustration: 'layers',
  },
  {
    id: 'curtain-bangs', name: 'Curtain Bangs', gender: 'w', length: 'medium',
    texture: ['straight', 'wavy'],
    suitsShapes: ['Oval', 'Round', 'Square', 'Heart', 'Diamond', 'Oblong'],
    avoidsShapes: [],
    difficulty: 1, maintenance: 2,
    description: 'Center-parted fringe sweeping outward — flattering on almost everyone.',
    whyItWorks: {
      Round:   'The angled sweep visually trims the cheek area.',
      Diamond: 'Adds soft width to the forehead.',
    },
    illustration: 'curtain',
  },
  {
    id: 'long-waves', name: 'Long Waves', gender: 'w', length: 'long',
    texture: ['wavy', 'curly'],
    suitsShapes: ['Oval', 'Square', 'Round', 'Heart'],
    avoidsShapes: ['Oblong'],
    difficulty: 2, maintenance: 1,
    description: 'Loose long waves with body — romantic and effortless.',
    whyItWorks: { Square: 'Soft waves visually soften an angular jawline.' },
    illustration: 'waves',
  },
  {
    id: 'wolf-cut', name: 'Wolf Cut', gender: 'w', length: 'medium',
    texture: ['straight', 'wavy', 'curly'],
    suitsShapes: ['Oval', 'Square', 'Diamond', 'Heart'],
    avoidsShapes: ['Round'],
    difficulty: 2, maintenance: 2,
    description: 'Shag-meets-mullet with heavy layering and curtain bangs.',
    whyItWorks: { Diamond: 'Heavy top layers complement a narrow forehead.' },
    illustration: 'wolf',
  },
  {
    id: 'butterfly', name: 'Butterfly Cut', gender: 'w', length: 'long',
    texture: ['straight', 'wavy'],
    suitsShapes: ['Oval', 'Round', 'Heart', 'Diamond'],
    avoidsShapes: [],
    difficulty: 2, maintenance: 2,
    description: 'Long with face-framing layers that flick outward.',
    whyItWorks: { Round: 'Outward layers slim the cheeks visually.' },
    illustration: 'butterfly',
  },
  {
    id: 'shag', name: 'Shag Cut', gender: 'w', length: 'medium',
    texture: ['wavy', 'curly'],
    suitsShapes: ['Oval', 'Square', 'Diamond', 'Heart'],
    avoidsShapes: ['Round'],
    difficulty: 2, maintenance: 2,
    description: 'Heavily layered with feathered ends — rockstar vibe.',
    whyItWorks: { Square: 'Disrupts the jawline with movement and texture.' },
    illustration: 'shag',
  },
  {
    id: 'ponytail', name: 'High Ponytail', gender: 'w', length: 'long',
    texture: ['straight', 'wavy', 'curly'],
    suitsShapes: ['Oval', 'Diamond', 'Heart'],
    avoidsShapes: ['Round', 'Square'],
    difficulty: 1, maintenance: 1,
    description: 'Hair pulled high and tight — sporty and elongating.',
    whyItWorks: { Diamond: 'Exposes and showcases sharp cheekbones.' },
    illustration: 'pony',
  },
  {
    id: 'beach-waves', name: 'Beach Waves', gender: 'w', length: 'medium',
    texture: ['wavy'],
    suitsShapes: ['Oval', 'Square', 'Round', 'Heart'],
    avoidsShapes: ['Oblong'],
    difficulty: 2, maintenance: 1,
    description: 'Tousled lived-in waves — that just-from-the-beach look.',
    whyItWorks: { Square: 'Loose texture softens a strong jaw.' },
    illustration: 'beach',
  },
];

// All available face shapes — kept here so the recommender, the
// classifier, and the UI all agree on labels.
export const FACE_SHAPES = [
  'Oval', 'Round', 'Square', 'Rectangle', 'Diamond', 'Heart', 'Triangle', 'Oblong',
];

export function getHairstyle(id) {
  return HAIRSTYLES.find((h) => h.id === id) || null;
}
