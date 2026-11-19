import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { clearSession, getSession, pickUser, saveSession, saveUser } from "../lib/authStorage";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  // Bumped on every signIn / signOut. The startup profile refresh below checks it,
  // so a slow background request can never overwrite or wipe a newer login.
  const authVersion = useRef(0);

  // On app start: restore the saved session instantly (works offline),
  // then quietly refresh the profile from the server in the background.


  useEffect(() => {
  console.log("AuthProvider MOUNT");
  return () => console.log("AuthProvider UNMOUNT");
}, []);

useEffect(() => {
  console.log("AuthProvider user ->", user?.firstName ?? null);
}, [user]);
  useEffect(() => {
    let alive = true;
    const startVersion = authVersion.current;
    const stale = () => !alive || authVersion.current !== startVersion;

    (async () => {
      const saved = await getSession();
      if (stale()) return;

      if (saved.refreshToken && saved.user) {
        setUser(saved.user);
        setBooting(false);
        try {
          const { user: fresh } = await api("/auth/me", { auth: true });
          if (stale()) return; // the user logged in or out meanwhile
          await saveUser(fresh);
          setUser(pickUser(fresh));
        } catch (e) {
          if (stale()) return;
          // Blocked or session truly expired: sign out. Network errors: stay signed in.
          if (e.status === 401 || e.status === 403) {
            await clearSession();
            setUser(null);
          }
        }
      } else {
        setBooting(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // Call with the response of /auth/login, /auth/signup/complete or /auth/biometric/login
  const signIn = useCallback(async (data) => {
    authVersion.current += 1;
    await saveSession(data);
    setUser(pickUser(data.user));
    setBooting(false);
  }, []);

  const signOut = useCallback(async () => {
    authVersion.current += 1;
    const { refreshToken } = await getSession();
    try {
      await api("/auth/logout", { method: "POST", auth: true, body: { refreshToken } });
    } catch {
      /* offline: still log out on this phone */
    }
    await clearSession();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, booting, signIn, signOut }), [user, booting, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}