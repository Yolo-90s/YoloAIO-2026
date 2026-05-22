import {
  ALIGN_CENTER,
  BG_GRADIENT,
} from './quoteModel.js';

// Mirrors PresetQuotes.kt — 12 hand-picked starters. Same ids so any future
// "favorite a preset" linkage stays cross-platform.

function preset(id, text, author, colors) {
  return {
    id,
    text,
    author,
    isCustom: false,
    createdAt: 0,
    visibility: 'private',
    ownerUid: '',
    ownerName: '',
    style: {
      textColor: 0xffffffff,
      fontSize: 28,
      bold: false,
      italic: true,
      alignment: ALIGN_CENTER,
      backgroundType: BG_GRADIENT,
      backgroundColors: colors,
      backgroundImageUrl: null,
    },
  };
}

export const presetQuotes = [
  preset('p1', 'The best way to predict the future is to invent it.', 'Alan Kay', [0xff1a237e, 0xff4a148c]),
  preset('p2', 'Stay hungry. Stay foolish.', 'Steve Jobs', [0xffb71c1c, 0xffe65100]),
  preset('p3', 'Simplicity is the ultimate sophistication.', 'Leonardo da Vinci', [0xff004d40, 0xff263238]),
  preset('p4', "Whether you think you can, or you think you can't — you're right.", 'Henry Ford', [0xff6a1b9a, 0xffad1457]),
  preset('p5', 'Talk is cheap. Show me the code.', 'Linus Torvalds', [0xff0d47a1, 0xff01579b]),
  preset('p6', "It always seems impossible until it's done.", 'Nelson Mandela', [0xff1b5e20, 0xff004d40]),
  preset('p7', 'Make it work, make it right, make it fast.', 'Kent Beck', [0xff263238, 0xff000000]),
  preset('p8', "If you can't explain it simply, you don't understand it well enough.", 'Albert Einstein', [0xff311b92, 0xff1a237e]),
  preset('p9', 'Do, or do not. There is no try.', 'Yoda', [0xff2e7d32, 0xff1b5e20]),
  preset('p10', 'The only way to do great work is to love what you do.', 'Steve Jobs', [0xffad1457, 0xff880e4f]),
  preset('p11', 'Not everything that is faced can be changed. But nothing can be changed until it is faced.', 'James Baldwin', [0xffbf360c, 0xff3e2723]),
  preset('p12', 'Premature optimization is the root of all evil.', 'Donald Knuth', [0xff1a237e, 0xff000000]),
];

// Background gradient palettes — same hex pairs the Android editor uses.
export const gradientPresets = [
  [0xff1a237e, 0xff4a148c],
  [0xffb71c1c, 0xffe65100],
  [0xff004d40, 0xff263238],
  [0xff6a1b9a, 0xffad1457],
  [0xff0d47a1, 0xff01579b],
  [0xff1b5e20, 0xff004d40],
  [0xff263238, 0xff000000],
  [0xff311b92, 0xff1a237e],
  [0xff2e7d32, 0xff1b5e20],
  [0xffad1457, 0xff880e4f],
  [0xffbf360c, 0xff3e2723],
  [0xffff7ab6, 0xffb85ac1],
  [0xff7c9cff, 0xff1a237e],
  [0xffffc36b, 0xffe65100],
];

export const solidPresets = [
  0xff1a237e, 0xff4a148c, 0xffb71c1c, 0xffe65100,
  0xff263238, 0xff000000, 0xffad1457, 0xff6a1b9a,
  0xff004d40, 0xff1b5e20, 0xff0d47a1, 0xff3e2723,
];

export const textColorPresets = [
  0xffffffff, 0xff000000, 0xffffc36b, 0xffff7ab6,
  0xffe0aaff, 0xffa8c7ff, 0xffb85ac1, 0xff7c9cff,
  0xff00bfa5, 0xffffd740, 0xffff6e40, 0xff8c9eff,
];
