import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Lock,
  Mail, Sparkles, User as UserIcon, X
} from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { getAuthErrorMessage } from '../../lib/authHelpers';
import '../../styles/auth.css';

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.35 12.2c0-.7-.06-1.38-.18-2.03H12v3.84h5.24a4.48 4.48 0 0 1-1.95 2.94v2.44h3.15c1.84-1.7 2.91-4.2 2.91-7.19Z" />
      <path fill="#34A853" d="M12 21.5c2.62 0 4.82-.87 6.43-2.35l-3.15-2.44c-.87.58-1.98.94-3.28.94-2.52 0-4.66-1.7-5.43-3.99H3.32v2.52A9.72 9.72 0 0 0 12 21.5Z" />
      <path fill="#FBBC05" d="M6.57 13.66A5.84 5.84 0 0 1 6.26 12c0-.58.1-1.14.31-1.66V7.82H3.32A9.5 9.5 0 0 0 2.5 12c0 1.5.36 2.9.82 4.18l3.25-2.52Z" />
      <path fill="#EA4335" d="M12 6.35c1.43 0 2.71.49 3.72 1.46l2.79-2.79C16.82 3.4 14.62 2.5 12 2.5a9.72 9.72 0 0 0-8.68 5.32l3.25 2.52C7.34 8.05 9.48 6.35 12 6.35Z" />
    </svg>
  );
}

function getPasswordScore(password: string): number {
  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 10) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

export function AuthModal() {
  const {
    isAuthModalOpen,
    authModalMode,
    closeAuthModal,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    openAuthModal,
    sendPasswordReset,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  const isSignUp = authModalMode === 'signup';
  const passwordScore = getPasswordScore(password);

  useEffect(() => {
    if (!isAuthModalOpen) return;
    setError('');
    setStatus('');
    setResetMode(false);
    setPassword('');
    setConfirmPassword('');
  }, [isAuthModalOpen, authModalMode]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setStatus('');

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError('Enter your email address.');
      return;
    }

    if (isSignUp && password !== confirmPassword) {
      setError('Your passwords do not match.');
      return;
    }

    if (isSignUp && passwordScore < 1) {
      setError('Choose a password with at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(normalizedEmail, password, displayName.trim());
      } else {
        await signInWithEmail(normalizedEmail, password);
      }
    } catch (authError: any) {
      setError(getAuthErrorMessage(authError?.code, isSignUp ? 'signup' : 'signin'));
    } finally {
      setLoading(false);
    }
  };

  const googleSignIn = async () => {
    setError('');
    setStatus('');
    setLoading(true);
    try {
      await signInWithGoogle();
      setStatus('Google sign-in complete. Welcome to Panda.');
    } catch (authError: any) {
      if (authError?.code === 'auth/popup-closed-by-user') {
        setError('Google sign-in was cancelled.');
      } else {
        setError(getAuthErrorMessage(authError?.code, 'signin'));
      }
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    const normalizedEmail = email.trim();
    setError('');
    setStatus('');
    if (!normalizedEmail) {
      setError('Enter your email address first.');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordReset(normalizedEmail);
      setStatus('Password reset email sent. Check your inbox.');
    } catch (authError: any) {
      setError(getAuthErrorMessage(authError?.code, 'signin'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isAuthModalOpen && (
        <div className="panda-auth" role="presentation">
          <motion.div
            className="panda-auth__backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeAuthModal}
          />
          <motion.div
            className="panda-auth__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="panda-auth-title"
            initial={{ opacity: 0, y: 20, scale: .985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: .985 }}
            transition={{ duration: .22, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="panda-auth__art" aria-hidden="true">
              <div className="panda-auth__glow panda-auth__glow--one" />
              <div className="panda-auth__glow panda-auth__glow--two" />
              <div className="panda-auth__art-mark">🐼</div>
              <div className="panda-auth__art-copy"><span>YOUR LITTLE CORNER</span><strong>Keep watching.<br />Keep your place.</strong></div>
              <div className="panda-auth__art-line" />
              <div className="panda-auth__art-meta"><span><Sparkles size={12} /> Panda account</span><small>Library · Progress · Favourites</small></div>
            </div>

            <div className="panda-auth__form-side">
              <button type="button" className="panda-auth__close" onClick={closeAuthModal} aria-label="Close sign in">
                <X size={18} />
              </button>

              <div className="panda-auth__heading">
                <span className="panda-auth__eyebrow">{resetMode ? 'ACCOUNT RECOVERY' : isSignUp ? 'JOIN PANDA' : 'WELCOME BACK'}</span>
                <h2 id="panda-auth-title">{resetMode ? 'Reset your password.' : isSignUp ? 'Create your Panda account.' : 'Sign in and pick up where you left off.'}</h2>
                <p>{resetMode ? 'Enter the email attached to your account and Firebase will send the reset link.' : 'One account for your library, watch progress and favourites across devices.'}</p>
              </div>

              {error && <motion.div className="panda-auth__notice panda-auth__notice--error" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}><AlertCircle size={15} /><span>{error}</span></motion.div>}
              {status && <motion.div className="panda-auth__notice panda-auth__notice--success" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}><CheckCircle2 size={15} /><span>{status}</span></motion.div>}

              {resetMode ? (
                <div className="panda-auth__reset">
                  <label className="panda-auth__field"><span>Email address</span><div><Mail size={15} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" /></div></label>
                  <button type="button" className="panda-auth__primary" disabled={loading} onClick={() => void resetPassword()}>{loading ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}Send reset email</button>
                  <button type="button" className="panda-auth__text-button" onClick={() => { setResetMode(false); setError(''); setStatus(''); }}>Back to sign in</button>
                </div>
              ) : (
                <>
                  <button type="button" className="panda-auth__google" disabled={loading} onClick={() => void googleSignIn()}><GoogleIcon /><span>Continue with Google</span><ArrowRight size={15} /></button>
                  <div className="panda-auth__divider"><span>or use email</span></div>

                  <form className="panda-auth__fields" onSubmit={(event) => void submit(event)}>
                    {isSignUp && (
                      <label className="panda-auth__field"><span>Display name <em>optional</em></span><div><UserIcon size={15} /><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" placeholder="Panda fan" /></div></label>
                    )}
                    <label className="panda-auth__field"><span>Email address</span><div><Mail size={15} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" required /></div></label>
                    <label className="panda-auth__field"><span>Password</span><div><Lock size={15} /><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={isSignUp ? 'new-password' : 'current-password'} placeholder="At least 6 characters" required /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></label>
                    {isSignUp && (
                      <>
                        <div className="panda-auth__strength"><div>{[0,1,2,3,4].map((item) => <span className={passwordScore > item ? 'is-on' : ''} key={item} />)}</div><small>{passwordScore <= 1 ? 'Basic' : passwordScore === 2 ? 'Decent' : passwordScore === 3 ? 'Good' : 'Strong'}</small></div>
                        <label className="panda-auth__field"><span>Confirm password</span><div><Lock size={15} /><input type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" placeholder="Repeat your password" required /><button type="button" aria-label={showConfirm ? 'Hide password' : 'Show password'} onClick={() => setShowConfirm(!showConfirm)}>{showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></label>
                      </>
                    )}
                    <button type="submit" className="panda-auth__primary" disabled={loading}>{loading ? <Loader2 size={16} className="animate-spin" /> : isSignUp ? <Sparkles size={16} /> : <ArrowRight size={16} />} {isSignUp ? 'Create account' : 'Sign in'}</button>
                  </form>

                  {!isSignUp && <button type="button" className="panda-auth__forgot" disabled={loading} onClick={() => setResetMode(true)}>Forgot password?</button>}

                  <div className="panda-auth__switch">{isSignUp ? 'Already have a Panda account?' : 'New to Panda?'} <button type="button" onClick={() => openAuthModal(isSignUp ? 'signin' : 'signup')}>{isSignUp ? 'Sign in' : 'Create account'}</button></div>
                </>
              )}

              <p className="panda-auth__privacy">By continuing, you agree to Panda.fun&apos;s <a href="/terms" onClick={closeAuthModal}>Terms</a> and <a href="/privacy-policy" onClick={closeAuthModal}>Privacy Policy</a>.</p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
