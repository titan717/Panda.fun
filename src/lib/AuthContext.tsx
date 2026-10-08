import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  auth,
  db,
  googleProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  fbSignOut,
  onAuthStateChanged,
  updateProfile,
  User
} from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { historyUtil } from './history';
import { libraryManager } from './library';
import { getAuthErrorMessage, getProfileName, toUserProfile } from './authHelpers';
import { trackLogin, trackSignUp } from './analytics';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthModalOpen: boolean;
  authModalMode: 'signin' | 'signup';
  openAuthModal: (mode?: 'signin' | 'signup') => void;
  closeAuthModal: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name?: string) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function syncUserProfile(currentUser: User, preferredName?: string): Promise<void> {
  try {
    const userRef = doc(db, 'users', currentUser.uid);
    const existing = await getDoc(userRef);
    const createdAt = typeof existing.data()?.createdAt === 'string'
      ? String(existing.data()?.createdAt)
      : new Date().toISOString();

    const profileUser = preferredName?.trim()
      ? { ...currentUser, displayName: preferredName.trim() }
      : currentUser;

    await setDoc(userRef, toUserProfile(profileUser, createdAt), { merge: true });
  } catch (error) {
    // Authentication must not be reported as failed when optional profile persistence is unavailable.
    console.warn('[Panda.fun] Firebase profile sync unavailable:', error);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');

  useEffect(() => {
    let mounted = true;

    void getRedirectResult(auth).catch((error) => {
      console.warn('[Panda.fun] Firebase redirect sign-in failed:', getAuthErrorMessage(error?.code, 'signin'));
    });

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!mounted) return;
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        void syncUserProfile(currentUser);
        void historyUtil.syncFromFirestore(currentUser.uid);
        void libraryManager.syncFromFirestore(currentUser.uid);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const openAuthModal = (mode: 'signin' | 'signup' = 'signin') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const signInWithGoogle = async () => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await syncUserProfile(cred.user);
      trackLogin('Google');
      closeAuthModal();
    } catch (error: any) {
      if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      throw error;
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !pass) {
      const error = new Error('Email and password are required.');
      (error as Error & { code?: string }).code = 'auth/invalid-credential';
      throw error;
    }

    const cred = await signInWithEmailAndPassword(auth, normalizedEmail, pass);
    await syncUserProfile(cred.user);
    trackLogin('Email');
    closeAuthModal();
  };

  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  const signUpWithEmail = async (email: string, pass: string, name?: string) => {
    const normalizedEmail = email.trim();
    const preferredName = name?.trim();

    if (!normalizedEmail || !pass) {
      const error = new Error('Email and password are required.');
      (error as Error & { code?: string }).code = 'auth/invalid-credential';
      throw error;
    }

    const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, pass);

    if (preferredName) {
      await updateProfile(cred.user, { displayName: preferredName });
    }

    await syncUserProfile(cred.user, preferredName);
    trackSignUp('Email');
    closeAuthModal();
  };

  const updateDisplayName = async (name: string) => {
    if (!auth.currentUser) throw new Error('You must be signed in to update your profile.');
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Display name cannot be empty.');

    await updateProfile(auth.currentUser, { displayName: trimmed });
    await syncUserProfile(auth.currentUser, trimmed);
    setUser({ ...auth.currentUser });
  };

  const signOut = async () => {
    await fbSignOut(auth);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,
        signInWithGoogle,
        signInWithEmail,
        sendPasswordReset,
        signUpWithEmail,
        updateDisplayName,
        signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
