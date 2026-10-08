import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Lock, User as UserIcon, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';

export function AuthModal() {
  const { 
    isAuthModalOpen, 
    authModalMode, 
    closeAuthModal, 
    signInWithGoogle, 
    signInWithEmail, 
    signUpWithEmail,
    openAuthModal,
    sendPasswordReset
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  if (!isAuthModalOpen) return null;

  const isSignUp = authModalMode === 'signup';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetSent(false);
    setLoading(true);

    try {
      if (isSignUp) {
        if (!email || !password) {
          throw new Error('Please enter both email and password.');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }
        await signUpWithEmail(email.trim(), password, displayName.trim());
      } else {
        if (!email || !password) {
          throw new Error('Please enter both email and password.');
        }
        await signInWithEmail(email.trim(), password);
      }
    } catch (err: any) {
      let msg = err.message || 'Authentication failed. Please try again.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Invalid email or password.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password is too weak. Please use at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Invalid email address.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Too many attempts. Please wait a moment and try again.';
      } else if (err.code === 'auth/network-request-failed') {
        msg = 'Network error. Check your connection and try again.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') return;
      if (err.code === 'auth/popup-blocked') {
        setError('Your browser blocked the Google sign-in popup. Please allow popups for Panda.fun and try again.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error. Check your connection and try again.');
      } else {
        setError(err.message || 'Google Sign-In failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeAuthModal}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-md bg-[#0e0f14] border border-[#242432] rounded-2xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden"
        >
          {/* Ambient Glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#7b1fa2]/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-[#9c27b0]/15 rounded-full blur-3xl pointer-events-none" />

          {/* Close button */}
          <button 
            onClick={closeAuthModal}
            className="absolute top-5 right-5 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center mb-2">
              <span className="text-2xl font-black tracking-tight text-white">Kino</span>
              <span className="text-2xl font-black tracking-tight text-[#c084fc] drop-shadow-[0_0_12px_rgba(156,39,176,0.6)]">ma</span>
            </div>
            <h3 className="text-2xl font-bold text-white tracking-tight">
              {isSignUp ? 'Create your account' : 'Welcome back'}
            </h3>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              {isSignUp 
                ? 'Sync your watch history, favorites, and progress across devices.' 
                : 'Sign in to access your synchronized anime watch history.'}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Google Sign-In Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-[#171720] hover:bg-[#20202c] border border-[#2b2b3a] text-white text-sm font-semibold transition-all shadow-sm hover:border-[#7b1fa2]/50 disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Continue with Google</span>
          </button>

          {/* Divider */}
          <div className="flex items-center my-5">
            <div className="flex-1 h-px bg-[#242432]" />
            <span className="px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">or with email</span>
            <div className="flex-1 h-px bg-[#242432]" />
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            {isSignUp && (
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Display Name
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input 
                    type="text" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Otaku" 
                    className="w-full bg-[#13131a] border border-[#262634] focus:border-[#7b1fa2] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition-colors"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com" 
                  required
                  className="w-full bg-[#13131a] border border-[#262634] focus:border-[#7b1fa2] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  required
                  className="w-full bg-[#13131a] border border-[#262634] focus:border-[#7b1fa2] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition-colors"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="mt-2 w-full py-3 rounded-xl bg-gradient-to-r from-[#7b1fa2] via-[#9c27b0] to-[#ba68c8] hover:from-[#6a1b9a] hover:to-[#ab47bc] text-white text-sm font-bold shadow-[0_4px_20px_rgba(156,39,176,0.35)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
            </button>
          </form>

          {!isSignUp && (
            <div className="mt-4 text-center">
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  const normalizedEmail = email.trim();
                  if (!normalizedEmail) {
                    setError('Enter your email address first.');
                    return;
                  }
                  setError(null);
                  setResetSent(false);
                  setLoading(true);
                  try {
                    await sendPasswordReset(normalizedEmail);
                    setResetSent(true);
                  } catch (err: any) {
                    if (err.code === 'auth/invalid-email') {
                      setError('Invalid email address.');
                    } else if (err.code === 'auth/user-not-found') {
                      setError('No account was found for that email address.');
                    } else if (err.code === 'auth/too-many-requests') {
                      setError('Too many attempts. Please wait a moment and try again.');
                    } else {
                      setError(err.message || 'Unable to send the reset email.');
                    }
                  } finally {
                    setLoading(false);
                  }
                }}
                className="text-xs font-semibold text-white/55 hover:text-white transition-colors disabled:opacity-50"
              >
                Forgot password?
              </button>
              {resetSent && (
                <p className="mt-2 text-xs text-emerald-300" role="status">
                  Password reset email sent. Check your inbox.
                </p>
              )}
            </div>
          )}

          {/* Footer toggle */}
          <div className="mt-6 text-center text-xs text-gray-400">
            {isSignUp ? (
              <span>
                Already have an account?{' '}
                <button 
                  type="button"
                  onClick={() => openAuthModal('signin')}
                  className="text-[#c084fc] hover:underline font-semibold"
                >
                  Sign in
                </button>
              </span>
            ) : (
              <span>
                Don't have an account?{' '}
                <button 
                  type="button"
                  onClick={() => openAuthModal('signup')}
                  className="text-[#c084fc] hover:underline font-semibold"
                >
                  Sign up
                </button>
              </span>
            )}
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
