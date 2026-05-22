// Mirrors CallRoom.kt — deterministic Jitsi room name shared by the two
// participants in a chat, so the recipient joining via the chat invite
// always lands in the same call as the caller.

async function sha1Hex(text) {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-1', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function roomForUsers(uidA, uidB) {
  if (!uidA || !uidB) throw new Error('uids required');
  const canonical = [uidA, uidB].sort().join('-');
  const hash = await sha1Hex(canonical);
  return `yolo-${hash.slice(0, 16)}`;
}
