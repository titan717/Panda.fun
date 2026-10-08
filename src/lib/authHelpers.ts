import type { User } from 'firebase/auth';

const FALLBACK_NAME = 'Panda';

export function getProfileName(user: Pick<User, 'displayName' | 'email'>, preferredName?: string): string {
  const chosen = preferredName?.trim();
  if (chosen) return chosen;
  const existing = user.displayName?.trim();
  if (existing) return existing;
  const localPart = user.email?.split('@')[0]?.trim();
  return localPart || FALLBACK_NAME;
}

export function toUserProfile(
  user: Pick<User, 'uid' | 'email' | 'displayName' | 'photoURL'>,
  createdAt: string
) {
  return {
    uid: user.uid,
    email: user.email || '',
    displayName: getProfileName(user),
    photoURL: user.photoURL || '',
    createdAt,
  };
}

export function getAuthErrorMessage(code: unknown, mode: 'signin' | 'signup'): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'That email or password is incorrect.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Choose a stronger password. Firebase requires at least 6 characters.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts were made. Please try again later.';
    case 'auth/network-request-failed':
      return 'We could not reach Firebase. Check your connection and try again.';
    case 'auth/popup-blocked':
      return 'Google sign-in was blocked by the browser.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was cancelled.';
    case 'auth/unauthorized-domain':
      return 'This Panda.fun address is not authorized in Firebase Authentication. Add the current site domain under Firebase Authentication → Settings → Authorized domains.';
    case 'auth/configuration-not-found':
      return 'Firebase Authentication is not configured for this project yet. Enable the sign-in provider in Firebase and deploy the authentication configuration.';
    case 'auth/invalid-api-key':
      return 'Firebase rejected the web API key. Check the Firebase web app configuration for Panda.fun.';
    case 'auth/operation-not-allowed':
      return mode === 'signup'
        ? 'Email/password sign-up is not enabled in Firebase yet.'
        : 'This sign-in method is not enabled in Firebase yet.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using another sign-in method.';
    default:
      return 'Authentication did not complete. Please try again.';
  }
}
