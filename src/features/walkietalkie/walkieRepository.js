import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, firestore } from '../../data/firebase.js';
import { generateChannelCode } from './walkieChannelId.js';

// Mirrors WalkieTalkieRepository.kt — same collection layout so Android
// and Web read/write the same channel + signaling docs interchangeably:
//
//   walkieChannels/{code}                          ownerUid, createdAt, live, updatedAt
//   walkieChannels/{code}/sessions/{receiverUid}    offer, answer, createdAt
//     .../receiverCandidates/{autoId}
//     .../transmitterCandidates/{autoId}

function currentUid() {
  return auth?.currentUser?.uid ?? null;
}

function channelRef(code) {
  return doc(firestore, 'walkieChannels', code);
}

function sessionsCol(code) {
  return collection(firestore, 'walkieChannels', code, 'sessions');
}

function sessionRef(code, receiverUid) {
  return doc(firestore, 'walkieChannels', code, 'sessions', receiverUid);
}

function candidateCol(code, receiverUid, from) {
  const sub = from === 'receiver' ? 'receiverCandidates' : 'transmitterCandidates';
  return collection(firestore, 'walkieChannels', code, 'sessions', receiverUid, sub);
}

/** Returns the caller's existing code, claiming a fresh one on first use. */
export async function ensureChannelCode() {
  const me = currentUid();
  if (!me) throw new Error('Not signed in');
  const userSnap = await getDoc(doc(firestore, 'users', me));
  const existing = userSnap.exists() ? userSnap.data()?.walkieId : null;
  if (existing) return existing;
  return claimNewCode(me);
}

/** Retires the old code (best-effort) and claims a brand new one. */
export async function refreshChannelCode() {
  const me = currentUid();
  if (!me) throw new Error('Not signed in');
  const userSnap = await getDoc(doc(firestore, 'users', me));
  const old = userSnap.exists() ? userSnap.data()?.walkieId : null;
  if (old) {
    try {
      await deleteDoc(channelRef(old));
    } catch {
      // best-effort — a stale orphaned channel doc is harmless
    }
  }
  return claimNewCode(me);
}

async function claimNewCode(uid) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateChannelCode();
    const ref = channelRef(code);
    try {
      // eslint-disable-next-line no-await-in-loop
      await runTransaction(firestore, async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists()) throw new Error('taken');
        tx.set(ref, { ownerUid: uid, createdAt: serverTimestamp(), live: false });
      });
      // eslint-disable-next-line no-await-in-loop
      await setDoc(doc(firestore, 'users', uid), { walkieId: code }, { merge: true });
      return code;
    } catch {
      // collision or transient error — retry with a new code
    }
  }
  throw new Error("Couldn't claim a WalkieTalkie code — try again");
}

export async function setLive(code, live) {
  await setDoc(channelRef(code), { live, updatedAt: serverTimestamp() }, { merge: true });
}

export async function heartbeat(code) {
  await setDoc(channelRef(code), { updatedAt: serverTimestamp() }, { merge: true });
}

export async function fetchChannel(code) {
  const snap = await getDoc(channelRef(code));
  return snap.exists() ? snap.data() : null;
}

/** Transmitter side: fires raw doc changes whenever a receiver's session doc is added/changed/removed. */
export function observeSessions(code, onChange) {
  return onSnapshot(sessionsCol(code), (snap) => {
    onChange(snap.docChanges());
  });
}

/** Receiver side: watches its own session doc for the transmitter's answer. */
export function observeSession(code, receiverUid, onChange) {
  return onSnapshot(sessionRef(code, receiverUid), (snap) => {
    onChange(snap.exists() ? snap.data() : null);
  });
}

export async function writeOffer(code, receiverUid, offer) {
  await setDoc(sessionRef(code, receiverUid), {
    offer: { sdp: offer.sdp, type: offer.type },
    createdAt: serverTimestamp(),
  });
}

export async function writeAnswer(code, receiverUid, answer) {
  await setDoc(
    sessionRef(code, receiverUid),
    { answer: { sdp: answer.sdp, type: answer.type } },
    { merge: true }
  );
}

export async function addIceCandidate(code, receiverUid, from, candidate) {
  await addDoc(candidateCol(code, receiverUid, from), {
    sdpMid: candidate.sdpMid ?? null,
    sdpMLineIndex: candidate.sdpMLineIndex ?? 0,
    candidate: candidate.candidate,
  });
}

/** [from] is the role whose candidates we want to *receive* (the peer's role). */
export function observeIceCandidates(code, receiverUid, from, onAdded) {
  return onSnapshot(candidateCol(code, receiverUid, from), (snap) => {
    const added = snap
      .docChanges()
      .filter((c) => c.type === 'added')
      .map((c) => c.doc.data());
    if (added.length) onAdded(added);
  });
}

/** Deletes a session doc and both candidate subcollections underneath it. */
export async function endSession(code, receiverUid) {
  const ref = sessionRef(code, receiverUid);
  for (const sub of ['receiverCandidates', 'transmitterCandidates']) {
    const col = collection(firestore, 'walkieChannels', code, 'sessions', receiverUid, sub);
    // eslint-disable-next-line no-await-in-loop
    const docs = await getDocs(col);
    if (!docs.empty) {
      const batch = writeBatch(firestore);
      docs.forEach((d) => batch.delete(d.ref));
      // eslint-disable-next-line no-await-in-loop
      await batch.commit();
    }
  }
  await deleteDoc(ref);
}
