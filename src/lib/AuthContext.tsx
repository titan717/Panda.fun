import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  auth, 
  db,
  googleProvider, 
  signInWithPopup, 
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
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        // Save user profile to Firestore
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const snap = await getDoc(userRef);
          if (!snap.exists()) {
            await setDoc(userRef, {
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
              photoURL: currentUser.photoURL || '',
              createdAt: new Date().toISOString()
            }, { merge: true });
          }
        } catch (e) {
          console.error("Failed to sync user profile to Firestore:", e);
        }

        // Sync watch progress and library from Firestore
        historyUtil.syncFromFirestore(currentUser.uid);
        libraryManager.syncFromFirestore(currentUser.uid);
      }
    });

    return () => unsubscribe();
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
      if (cred.user) {
        const userRef = doc(db, 'users', cred.user.uid);
        await setDoc(userRef, {
          uid: cred.user.uid,
          email: cred.user.email || '',
          displayName: cred.user.displayName || '',
          photoURL: cred.user.photoURL || '',
          createdAt: new Date().toISOString()
        }, { merge: true });
      }
      closeAuthModal();
    } catch (err: any) {
      console.error("Google sign in error:", err);
      throw err;
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      closeAuthModal();
    } catch (err: any) {
      console.error("Email sign in error:", err);
      throw err;
    }
  };

  const sendPasswordReset = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err: any) {
      console.error("Password reset error:", err);
      throw err;
    }
  };

  const signUpWithEmail = async (email: string, pass: string, name?: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      if (name && cred.user) {
        await updateProfile(cred.user, { displayName: name });
      }
      if (cred.user) {
        const userRef = doc(db, 'users', cred.user.uid);
        await setDoc(userRef, {
          uid: cred.user.uid,
          email: cred.user.email || '',
          displayName: name || cred.user.email?.split('@')[0] || 'User',
          photoURL: '',
          createdAt: new Date().toISOString()
        }, { merge: true });
      }
      closeAuthModal();
    } catch (err: any) {
      console.error("Sign up error:", err);
      throw err;
    }
  };

  const signOut = async () => {
    try {
      await fbSignOut(auth);
    } catch (err: any) {
      console.error("Sign out error:", err);
      throw err;
    }
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
        signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
