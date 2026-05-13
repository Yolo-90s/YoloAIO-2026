import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, firebaseReady } from './firebase.js';

// Mirrors UserSession.kt — a single source of truth for the current Firebase
// user, exposed via context. `loading` lets the router hold the redirect
// decision until the first auth state fires (otherwise we briefly route a
// signed-in user to /auth on every reload).
const UserContext = createContext({ user: null, loading: true });

export function UserSessionProvider({ children }) {
  const [state, setState] = useState({ user: null, loading: firebaseReady });

  useEffect(() => {
    if (!firebaseReady) return;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setState({ user, loading: false });
    });
    return unsubscribe;
  }, []);

  return <UserContext.Provider value={state}>{children}</UserContext.Provider>;
}

export function useCurrentUser() {
  return useContext(UserContext);
}
