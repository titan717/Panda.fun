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
| R8 | `minifyEnabled true`, `shrinkResources true`, optimize rules (obfuscation on). Full mode is reviewed with the Android release in v1.2.7 |
| Cleartext | `usesCleartextTraffic="false"`; every endpoint is HTTPS |
| WebView | file and content access off, universal and file-URL access off, mixed content never allowed, Safe Browsing on, geolocation denied, the top document can only ever be the bundled app (`shouldOverrideUrlLoading`), non-http(s) schemes (intent:, market:) refused in every frame |
| JavaScript bridge | **v1.2.6 fix (High, A126-5):** `addJavascriptInterface` puts the bridge into every frame, including provider and ad iframes, which could have read the phone-remote pairing code, posted notifications, started downloads or closed the app. Every method that acts or reveals state now requires a random per-launch key (128 bits, `SecureRandom`, compared with `MessageDigest.isEqual`). Only the app's own top document receives it, as a `<meta>` added to main-frame HTML responses; the web app reads it once, removes it from the DOM and passes it on each call (`src/lib/native.ts`). New bridge methods are gated by default. Capability getters (version, isTV, hasVoiceSearch, canPictureInPicture, notificationPermission) stay open |
| Bundled files | v1.2.6 removed `Access-Control-Allow-Origin: *` from the bundled-asset responses, so other origins cannot read the app's files |
| Exported components | `MainActivity` (launcher, `pandafun://` and `https://apikinoma.vercel.app/p/` links; DeepLinks.kt accepts only known paths), everything else `exported="false"`; the FileProvider is not exported |
| Updates | the APK comes from this repository's GitHub Release (or the backend's cached copy of the same release when GitHub rate-limits); its SHA-256 must match the release's `.sha256` file before the installer opens (`UpdateChecker.kt`), and Android's package installer refuses an update that is not signed with the installed app's key. An explicit certificate check before the installer opens comes with the v1.2.7 Android review (A126-9) |
| Signing key | lives only in GitHub Actions secrets; the same key signs every release; never in the repository |
| Phone remote (RemoteServer.kt) | local network only (site-local address), an 8-character pairing code on every `/api` call, 8 wrong codes lock that address out for 5 minutes, request bodies capped at 4 KB, "Disconnect phones" rotates the code. Session expiry and per-address rate limits are reviewed in v1.2.7 |
| Certificate pinning | not yet (v1.2.7, with a rotation plan: pins for the backend's current and backup CA keys) |

## Sync and Kids PIN

- Sync (D-130–D-133): PBKDF2-SHA256, 150,000 rounds, AES-256-GCM with a fresh 12-byte IV per backup and the salt as additional data; the server stores only ciphertext under a hash of a hash of the code; 30 requests a minute per client, 5 unknown ids lock a client out for 15 minutes; revoke writes a tombstone.
- Kids PIN: stored on the device only (`DEVICE_PREFS`); hashing it with a per-device salt is part of the v1.2.7 review (A126-7, Medium: it protects a profile switch on a shared TV, not data).

## Backend (movieapi)

Validation of route parameters, rate limits on sync and reports, safe error bodies without stack traces, no secrets in the repository. The full backend review (CORS allowlist, caching rules per route) is part of the v1.2.7 gate.

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
| A126-7 | Medium | Kids PIN stored unhashed on the device | v1.2.7 |
| A126-8 | Low | `android:allowBackup="true"` lets adb backups include local app data | v1.2.7 (backup rules that exclude WebView storage) |
| A126-9 | Low | The update flow relies on the OS signature check; the checksum and APK can come from the same mirror | v1.2.7 (compare the APK's signing certificate before installing) |
