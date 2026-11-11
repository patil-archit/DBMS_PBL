import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getMe } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [me, setMe] = useState(null); // BookLog profile: username, role, favourite_genres...
  const [loading, setLoading] = useState(true);

  const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
  const logout = () => signOut(auth);

  const refreshMe = useCallback(async () => {
    if (!auth.currentUser) {
      setMe(null);
      return null;
    }
    try {
      const profile = await getMe();
      setMe(profile);
      return profile;
    } catch (err) {
      console.error('Failed to load profile', err);
      return null;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) await refreshMe();
      else setMe(null);
      setLoading(false);
    });
    return unsubscribe;
  }, [refreshMe]);

  const value = {
    currentUser,
    me,
    isStaff: me?.role === 'admin' || me?.role === 'moderator',
    isAdmin: me?.role === 'admin',
    refreshMe,
    loginWithGoogle,
    logout,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
