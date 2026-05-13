import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, firestore, firebaseReady } from '../../data/firebase.js';
import { computeInitials, pickAvatarColor } from '../../data/userProfile.js';

function ensureReady() {
  if (!firebaseReady) {
    throw new Error('Firebase isn\'t configured. Copy `.env.example` to `.env.local` and fill in the Web app config.');
  }
}

export async function signIn(email, password) {
  ensureReady();
  try {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  } catch (e) {
    throw new Error(mapSignInError(e));
  }
}

export async function signUp(name, email, password) {
  ensureReady();
  const cleanName = name.trim();
  const cleanEmail = email.trim();
  if (!cleanName) throw new Error('Please enter your name');
  if (!cleanEmail) throw new Error('Please enter your email');
  if (password.length < 6) throw new Error('Password must be at least 6 characters');

  let cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
  } catch (e) {
    throw new Error(mapSignUpError(e));
  }
  await updateProfile(cred.user, { displayName: cleanName });
  await setDoc(doc(firestore, 'users', cred.user.uid), {
    uid: cred.user.uid,
    email: cleanEmail,
    displayName: cleanName,
    initials: computeInitials(cleanName),
    avatarColor: pickAvatarColor(),
    createdAt: Date.now(),
  });
}

// On the web we use Firebase's signInWithPopup. The Android-only Credential
// Manager flow doesn't apply here; the popup uses the same Google OAuth web
// client ID configured for the Firebase project.
export async function signInWithGoogle() {
  ensureReady();
  const provider = new GoogleAuthProvider();
  let result;
  try {
    result = await signInWithPopup(auth, provider);
  } catch (e) {
    if (e?.code === 'auth/popup-closed-by-user') throw new Error('Sign-in cancelled.');
    if (e?.code === 'auth/popup-blocked')
      throw new Error('Your browser blocked the Google popup. Allow popups for this site and try again.');
    throw new Error(e?.message || 'Google sign-in failed');
  }
  await ensureUserProfileExists(result.user);
}

async function ensureUserProfileExists(user) {
  const ref = doc(firestore, 'users', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  const name =
    user.displayName?.trim() ||
    user.email?.split('@')[0] ||
    'Yolo User';
  await setDoc(ref, {
    uid: user.uid,
    email: user.email ?? '',
    displayName: name,
    initials: computeInitials(name),
    avatarColor: pickAvatarColor(),
    createdAt: Date.now(),
  });
}

export async function signOutUser() {
  if (!firebaseReady) return;
  await signOut(auth);
}

export async function updateDisplayName(newName) {
  ensureReady();
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  const clean = newName.trim();
  if (!clean) throw new Error('Name cannot be empty');
  await updateProfile(user, { displayName: clean });
  await updateDoc(doc(firestore, 'users', user.uid), {
    displayName: clean,
    initials: computeInitials(clean),
  });
}

export async function changePassword(currentPassword, newPassword) {
  ensureReady();
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  if (!user.email) throw new Error('Account has no email');
  if (newPassword.length < 6) throw new Error('New password must be at least 6 characters');
  if (!currentPassword) throw new Error('Enter your current password');

  try {
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
  } catch (e) {
    throw new Error(mapPasswordChangeError(e));
  }
}

function mapSignInError(e) {
  const code = e?.code ?? '';
  if (code === 'auth/user-not-found') return 'No account exists with that email. Tap Sign Up to create one.';
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential')
    return 'Email or password is incorrect. If you don\'t have an account yet, tap Sign Up.';
  if (code === 'auth/network-request-failed') return 'Network error. Check your connection and try again.';
  return e?.message || 'Sign in failed';
}

function mapSignUpError(e) {
  const code = e?.code ?? '';
  if (code === 'auth/email-already-in-use') return 'An account already exists with this email. Tap Sign In.';
  if (code === 'auth/weak-password')
    return 'Password is too weak. Use at least 6 characters with a mix of letters and numbers.';
  if (code === 'auth/invalid-email') return 'That email address looks invalid.';
  if (code === 'auth/network-request-failed') return 'Network error. Check your connection and try again.';
  return e?.message || 'Sign up failed';
}

function mapPasswordChangeError(e) {
  const code = e?.code ?? '';
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') return 'Current password is incorrect.';
  if (code === 'auth/weak-password') return 'New password is too weak. Use at least 6 characters.';
  if (code === 'auth/requires-recent-login') return 'Please sign out and sign in again, then retry.';
  if (code === 'auth/network-request-failed') return 'Network error. Check your connection and try again.';
  return e?.message || "Couldn't change password";
}
