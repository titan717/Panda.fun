# Security

How Panda.fun protects its users, what has been reviewed, and what client code cannot protect. Updated every release; the security gate runs in every release and any new High finding blocks it (mission §6). The reporting policy is in [SECURITY.md](../SECURITY.md).

## Honest limits

- **Client code is public.** The web bundle and the APK can be read by anyone. Minifying (Vite, R8) slows reading down; it does not hide anything. Panda therefore ships **no secrets**: the app talks only to its own backend (`apikinoma.vercel.app`) and to public endpoints; TMDB and other keys live in the backend's environment.
- **Provider embeds are third-party code.** CineSrc, Vidy and VidLink run their own scripts inside their frames. Panda limits what those frames can reach (CSP `frame-src`, Permissions-Policy, origin checks on every message, the Android ad shield) but cannot change what they do inside their own frame. VidLink refuses a sandboxed frame, so in browsers its pop-ups cannot be stopped (D-137).
- **Local data is readable by anyone with the device.** Profiles, lists and progress are in `localStorage`. Root, a debugger or a backup tool can read them on any platform; encrypting them with a key that sits next to them would add nothing.
- **Root and tamper detection is not used.** Checks that are easy to bypass and that lock out legitimate users of custom ROMs and TV boxes would cost more than they protect. Revisited in the code-review gates.

## Web (Vercel)

| Control | State | Where |
|---|---|---|
| Minified build, no source maps shipped | yes | `vite.config.ts` (`sourcemap: false`) |
| Content-Security-Policy without `'unsafe-inline'` / `'unsafe-eval'` | yes since v1.2.6: the only inline code, the boot splash `<style>` in `index.html`, is allowed by its SHA-256 hash. The build fails if the hash in `vercel.json` does not match (`scripts/vite-integrity.mjs`). `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'self'`, `form-action 'self'`, `upgrade-insecure-requests`; `frame-src` lists only the providers and youtube-nocookie | `vercel.json` |
| Inline style attributes | Panda sets styles through the CSSOM (`element.style`), which CSP allows; no `innerHTML`, `insertAdjacentHTML` or `dangerouslySetInnerHTML` anywhere in `src/` | review v1.2.6 |
| Subresource Integrity | yes since v1.2.6: `sha384` on the entry script, module preloads and stylesheet, computed from the files as written to `dist/`. Lazy chunks are loaded by the entry, which is itself pinned, from the same origin | `scripts/vite-integrity.mjs` |
| HSTS | `max-age=63072000; includeSubDomains; preload` | `vercel.json` |
| Permissions-Policy | autoplay / fullscreen / picture-in-picture only for self and the providers; camera and geolocation off; microphone only for self (voice search) | `vercel.json` |
| Cross-Origin-Opener-Policy | `same-origin-allow-popups` (a provider frame cannot keep a handle on the Panda window) | `vercel.json` |
| Referrer-Policy, nosniff | `strict-origin-when-cross-origin`, `nosniff` | `vercel.json` |
| Iframes | trailers: `sandbox="allow-scripts allow-same-origin"`, no pointer events, tabindex −1 (D-141); providers: `allow` limited to autoplay, fullscreen, encrypted-media, picture-in-picture | `src/lib/youtube.ts`, `src/pages/Player.tsx` |
| postMessage | every handler checks `event.source` (the player's own frame) and `event.origin` against the source's registered origin before parsing | `src/lib/player*.ts` |
| Trusted Types | **not enforced yet** (D-156). The YouTube IFrame API script assigns script URLs itself and would break under `require-trusted-types-for 'script'`; Panda's own code has no DOM sinks, so a report-only rollout comes with the trailer engine review | |
| Sensitive local data | the sync code and key never leave the device; backups are encrypted with AES-256-GCM before upload (D-130) | `src/lib/sync*.ts` |

Verified in v1.2.6 with `scripts/qa-csp.mjs`: the production CSP injected on every document, phone and TV, Home with trailers, details, search, settings and the player: **0 violations**.

## Android app

| Control | State |
|---|---|
| R8 | `minifyEnabled true`, `shrinkResources true`, obfuscation on, **full mode** (`android.enableR8.fullMode=true`, explicit since v1.2.7; AGP 8 default). Gson models and `TypeToken` generics are kept by rule. Obfuscation slows reading the APK down; it hides nothing (no secrets ship) |
| Cleartext | `usesCleartextTraffic="false"`; every endpoint is HTTPS |
| WebView | file and content access off, universal and file-URL access off, mixed content never allowed, Safe Browsing on, geolocation denied, the top document can only ever be the bundled app (`shouldOverrideUrlLoading`), non-http(s) schemes (intent:, market:) refused in every frame |
| JavaScript bridge | **v1.2.6 fix (High, A126-5):** `addJavascriptInterface` puts the bridge into every frame, including provider and ad iframes, which could have read the phone-remote pairing code, posted notifications, started downloads or closed the app. Every method that acts or reveals state now requires a random per-launch key (128 bits, `SecureRandom`, compared with `MessageDigest.isEqual`). Only the app's own top document receives it, as a `<meta>` added to main-frame HTML responses; the web app reads it once, removes it from the DOM and passes it on each call (`src/lib/native.ts`). New bridge methods are gated by default. Capability getters (version, isTV, hasVoiceSearch, canPictureInPicture, notificationPermission) stay open |
| Bundled files | v1.2.6 removed `Access-Control-Allow-Origin: *` from the bundled-asset responses, so other origins cannot read the app's files |
| Exported components | `MainActivity` (launcher, `pandafun://` and `https://apikinoma.vercel.app/p/` links; DeepLinks.kt accepts only known paths), everything else `exported="false"`; the FileProvider is not exported |
| Updates | the APK comes from this repository's GitHub Release (or the backend's cached copy of the same release). **v1.2.7 (A127-4):** before the installer opens, `UpdateChecker.verifyApk` checks (1) SHA-256 equals the release's `.sha256`, (2) the package name is Panda's, (3) the versionCode is higher than the installed one (no downgrade), (4) the signing certificate set (SHA-256, `GET_SIGNING_CERTIFICATES` on Android 9+, `GET_SIGNATURES` below) equals the installed app's. Any failure deletes the file and shows the reason. A mirror that serves both a fake APK and a matching checksum can no longer get as far as the installer prompt |
| Signing key | lives only in GitHub Actions secrets; the same key signs every release; never in the repository |
| Phone remote (RemoteServer.kt) | **v1.2.7 (A127-8):** serves only loopback, RFC 1918, link-local, unique-local IPv6 and 100.64/10 hotspot addresses (403 otherwise); the Host header must be an IP literal (DNS-rebinding guard); 20 requests a second per address (burst 40). `/api/hello` trades the 8-character code for a 256-bit session token bound to the phone's address; every other call carries only the token. Sessions end after 2 h idle, 24 h total, an address change, or "Disconnect phones" (new code). 8 wrong codes lock an address for 5 minutes and 30 wrong codes in 10 minutes from anywhere pause pairing for 5 minutes (stops address-hopping guessing of the 32⁸ ≈ 1.1 × 10¹² space). JSON only, bodies ≤ 4 KB, keys/volume allowlisted, typed text stripped of control characters, "open" paths must be app paths (then DeepLinks.isRemotePath). The phone page stores only the token. Custom headers force a CORS preflight that the server never answers, so other web pages cannot call it |
| Certificate pinning | **v1.2.7 (A127-6):** `network_security_config.xml` pins the root/intermediate CA keys behind `apikinoma.vercel.app` (Let's Encrypt ISRG X1/X2, the backup roots Vercel can switch to) and `api.github.com` (USERTrust ECC/RSA, DigiCert Global Root CA/G2/G3, Google Trust Services R1/R4), with `expiration="2027-12-31"`. Rotation plan: (a) pins are CA keys, not leaf keys, so normal certificate renewals never break; (b) every set carries backups from a second CA; (c) CI runs `scripts/check-pins.mjs` against the live chains on every push, so a CA change fails the build months before users notice; (d) after the expiry date Android stops enforcing pins (fails open) rather than bricking old installs; a release before then moves the date. WebView traffic and DownloadManager (provider pages, TMDB images, GitHub's CDN for the APK) are not pinned: they talk to hosts Panda does not control and the APK is verified by checksum and signature instead. Cleartext is off for every domain |
| Backups | **v1.2.7 (A127-5):** `allowBackup="false"`, `fullBackupContent="false"` and `dataExtractionRules` that exclude every domain from cloud backup and device-to-device transfer, so adb/cloud backups cannot copy the WebView storage (sync code, PIN hash, history). Panda's encrypted Sync is the supported way to move a library |
| FileProvider | **v1.2.7 (A127-7):** shares only `Android/data/com.kinoma.tv/files/Download/` (where the verified update APK is saved) instead of the whole external storage root, not exported, URI grants are read-only and per intent |

## Sync and Kids PIN

- Sync (D-130–D-133): PBKDF2-SHA256, 150,000 rounds, AES-256-GCM with a fresh 12-byte IV per backup and the salt as additional data; the server stores only ciphertext under a hash of a hash of the code; 30 requests a minute per client, 5 unknown ids lock a client out for 15 minutes; revoke writes a tombstone.
- Kids PIN (**v1.2.7, A127-1–A127-3**): stored as `pbkdf2-sha256$120000$salt$hash` (WebCrypto PBKDF2-SHA-256, 120,000 rounds, 16-byte random salt per PIN; legacy plain PINs are verified once and re-hashed; comparisons are constant-time). Honest limit: a 4-digit PIN has 10,000 values, so hashing only stops someone reading the PIN out of storage, not a determined brute force of a copied hash. The live guard is the lockout: 5 wrong PINs lock entry for 30 s, doubling to 15 minutes, persisted across reloads. Every place that can weaken parental controls (Settings › Parental, Manage profiles, Edit profile: turning Kids off, removing the PIN, adding an adult profile) now asks for the PIN first (ParentLock, unlocked for 10 minutes); before 1.2.7 Manage profiles let a child bypass the PIN.

## Backend (movieapi)

Validation of route parameters, rate limits on sync and reports, safe error bodies without stack traces, no secrets in the repository. The CORS allowlist and per-route caching review is moved to the v1.2.8 gate (no High finding is known there; the API serves public catalogue data and ciphertext-only sync).

## CI and supply chain (v1.2.6)

- Every GitHub Action is pinned to a full commit SHA (with the version in a comment); every workflow declares least-privilege `permissions`.
- `npm audit --audit-level=high` runs in CI; `npm audit` is at 0 vulnerabilities (happy-dom 21.0.4, typescript-eslint 8.72.1 with `minimatch` 11.0.5 via `overrides`). All dependency versions are exact in `package.json` and locked in `package-lock.json`.
- CodeQL (`javascript-typescript` and `actions`, security-extended) on push, pull request and weekly.
- gitleaks secret scan over the full history on every push.
- Dependabot for npm, Gradle and GitHub Actions, weekly.
- A CycloneDX SBOM (`Panda.fun-sbom.cdx.json`, runtime dependencies) is attached to every GitHub Release next to the APK and its checksum.

## Findings

| # | Severity | Finding | Status |
|---|---|---|---|
| A126-1 | Medium | CSP allowed `'unsafe-inline'` styles | fixed v1.2.6 (hash + build check) |
| A126-2 | Low | No HSTS header of Panda's own, no SRI on entry assets | fixed v1.2.6 |
| A126-3 | Medium | GitHub Actions referenced by tag, not by SHA | fixed v1.2.6 |
| A126-4 | High (dev only) | happy-dom ≤ 21.0.3 advisory, minimatch ReDoS in typescript-eslint (test and lint tooling, not shipped) | fixed v1.2.6 |
| A126-5 | High | Android bridge reachable from third-party frames | fixed v1.2.6 (bridge key) |
| A126-6 | Medium | Bundled app files served with `Access-Control-Allow-Origin: *` | fixed v1.2.6 |
| A126-7 | Medium | Kids PIN stored unhashed on the device | fixed v1.2.7 (A127-1) |
| A126-8 | Low | `android:allowBackup="true"` lets adb backups include local app data | fixed v1.2.7 (A127-5) |
| A126-9 | Low | The update flow relies on the OS signature check; the checksum and APK can come from the same mirror | fixed v1.2.7 (A127-4) |
| A126-15 | Medium | CodeQL (first scan): sync keys from a decrypted backup could name `__proto__` when merged into plain objects | fixed v1.2.6 (null-prototype clock and merge maps, key guards in track, merge and rebuild) |
| A126-16 | Low | CodeQL: release-note heading regex escaped only `.` in the version | fixed v1.2.6 (full regex escape) |
| A126-17 | Low | CodeQL: caption tag stripping was single-pass (nested tags could rebuild one); captions render as text, never HTML | fixed v1.2.6 (strip until stable, drop stray `<`) |
| A126-18 | Low (build) | CodeQL: check-then-write race on `dist/index.html` in the integrity plugin | fixed v1.2.6 (one descriptor) |
| A126-19 | Low (dev harness) | CodeQL: the local ad-score harness echoed query parameters into HTML | fixed v1.2.6 (allowlisted URLs, escaped attributes) |
| A127-1 | Medium | Kids PIN kept in plain text | fixed v1.2.7 (PBKDF2 + salt, migration on first use) |
| A127-2 | Medium | Unlimited PIN guesses | fixed v1.2.7 (lockout 30 s doubling to 15 min, persisted) |
| A127-3 | High | Manage/Edit profiles let a kid turn Kids off, remove the PIN or add an adult profile without the PIN | fixed v1.2.7 (ParentLock on every parental surface) |
| A127-4 | Medium | Update APK origin not checked before the installer | fixed v1.2.7 (package, versionCode, signer set) |
| A127-5 | Low | Backups could copy local app data | fixed v1.2.7 (backup off, extraction rules) |
| A127-6 | Low | No certificate pinning | fixed v1.2.7 (CA-key pins, expiry, CI live check) |
| A127-7 | Low | FileProvider exposed the whole external storage root | fixed v1.2.7 (update folder only) |
| A127-8 | Medium | Phone remote: code on every call, no session expiry, no rate limit, served any source address, no Host check | fixed v1.2.7 (sessions, limits, LAN-only, IP-literal Host) |
