import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, firestore, firebaseReady } from './firebase.js';

// Mirrors UserRole.kt — the app-wide access tier, read from
// `users/{uid}.role`. Same field the shared Firestore rules' isAdmin()
// already checks (`role in ['admin', 'developer']`) and the same
// convention WalkieTalkie's admin-listen feature introduced; this
// formalizes it into a real 4-value tier used for menu visibility
// (see AppConfig.jsx's minRoleFor) instead of a one-off check.
//
// Ordinal order matters — ROLE_ORDER's index is what "role >= Role.ADMIN"
// style comparisons (roleAtLeast()) rely on.
export const ROLES = ['guest', 'user', 'admin', 'developer'];

/** Unknown, blank, or missing values default to the lowest tier. */
export function normalizeRole(value) {
  return ROLES.includes(value) ? value : 'guest';
}

export function roleAtLeast(role, minRole) {
  return ROLES.indexOf(normalizeRole(role)) >= ROLES.indexOf(normalizeRole(minRole));
}

const RoleContext = createContext('guest');

/**
 * Gated on onAuthStateChanged, same reasoning as AppConfig.jsx's fix:
 * `users/{uid}` reads require being signed in, and Auth's persisted-session
 * restoration is itself async, so subscribing unconditionally on mount can
 * race it.
 */
export function RoleProvider({ children }) {
  const [role, setRole] = useState('guest');

  useEffect(() => {
    if (!firebaseReady) return undefined;

    let unsubDoc = null;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubDoc?.();
      unsubDoc = null;

      if (!user) {
        setRole('guest');
        return;
      }

      unsubDoc = onSnapshot(
        doc(firestore, 'users', user.uid),
        (snap) => setRole(normalizeRole(snap.data()?.role)),
        (err) => console.warn('role listen failed:', err)
      );
    });

    return () => {
      unsubDoc?.();
      unsubAuth();
    };
  }, []);

  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export function useUserRole() {
  return useContext(RoleContext);
}
