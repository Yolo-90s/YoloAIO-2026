// Mirrors WalkieChannelId.kt — short, easy-to-read-aloud codes. Charset
// excludes 0/O and 1/I/L so a code traded over voice or text doesn't hit
// ambiguous characters.

const CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const LENGTH = 6;

export function generateChannelCode() {
  let out = '';
  for (let i = 0; i < LENGTH; i++) {
    out += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return out;
}

/** Loose validation for what the user types into the "peer's code" field. */
export function normalizeChannelCode(input) {
  return (input || '')
    .trim()
    .toUpperCase()
    .split('')
    .filter((c) => CHARSET.includes(c))
    .join('');
}

export function formatChannelCode(code) {
  if (!code) return '';
  return code.match(/.{1,3}/g).join(' ');
}
