import { cert, getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function initializeAdmin() {
  if (getApps().length) return;

  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawServiceAccount) {
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(rawServiceAccount);
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
    }
    initializeApp({ credential: cert(serviceAccount) });
    return;
  }

  initializeApp({ credential: applicationDefault() });
}

function usage() {
  console.error(
    [
      'Usage:',
      '  npm run auth:set-admin -- <uid-or-email>',
      '  npm run auth:set-admin -- --revoke <uid-or-email>',
      '',
      'Credentials:',
      '  FIREBASE_SERVICE_ACCOUNT_JSON=<service-account-json>',
      '  or GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json'
    ].join('\\n')
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const revoke = args[0] === '--revoke';
const identifier = revoke ? args[1] : args[0];

if (!identifier || args.length > (revoke ? 2 : 1)) usage();

initializeAdmin();

const auth = getAuth();
const user = identifier.includes('@')
  ? await auth.getUserByEmail(identifier.trim().toLowerCase())
  : await auth.getUser(identifier.trim());

const claims = { ...(user.customClaims ?? {}) };

if (revoke) {
  delete claims.admin;
} else {
  claims.admin = true;
}

await auth.setCustomUserClaims(user.uid, Object.keys(claims).length ? claims : null);

console.log(
  revoke
    ? `Removed admin claim from ${user.email ?? user.uid}. The user must refresh their ID token before access changes.`
    : `Granted admin claim to ${user.email ?? user.uid}. The user must refresh their ID token before access changes.`
);
