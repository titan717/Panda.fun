# 🐼 Panda.fun

Panda.fun is a responsive movie and TV streaming web application, previously known as **Kinoma**. It combines a Panda-themed streaming interface with a dedicated MovieAPI backend, local-first playback/library state, optional Firebase account sync, PWA support, and a native Android TV application.

> **Status:** Active development. The UI and playback system are still being refined, so implementation details may change.

## ✨ What Panda.fun Does

Panda.fun is designed around a simple flow:

```
Visitor
  ↓
Landing page
  ↓
Browse / Search
  ↓
Title details
  ↓
Watch
  ↓
Continue watching / My List
```

The application does not store the movie or TV video files itself. It retrieves catalog and playback information through the project's MovieAPI and loads the configured external playback embed.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────┐
│                 Panda.fun Web                │
│              React + TypeScript              │
├──────────────────────────────────────────────┤
│                                              │
│  Landing → Home → Search → Details → Watch  │
│                         │            │        │
│                         │            └───────┼── Vidy.st
│                         │                    │   └─ CineSrc default
│                         │                    │
│                         └── MovieAPI ────────┘
│                              │               │
│                              ├── TMDB        │
│                              ├── TVMaze      │
│                              └── cached data │
│                                              │
├──────────────────────────────────────────────┤
│ Firebase                                     │
│ Auth + Firestore account/progress sync       │
├──────────────────────────────────────────────┤
│ PWA / Service Worker                         │
├──────────────────────────────────────────────┤
│ Native Android TV                            │
│ Jetpack Compose + Media3 / ExoPlayer         │
└──────────────────────────────────────────────┘
```

### Frontend

The web application is a Vite-powered React 19 application written in TypeScript.

Important areas:

- `src/App.tsx` — application shell and routing
- `src/components/Layout.tsx` — Panda sidebar/navigation
- `src/pages/` — application screens
- `src/components/ui/` — reusable UI components
- `src/lib/api.ts` — MovieAPI client, caching and playback URL resolution
- `src/lib/history.ts` — watch history and episode progress
- `src/lib/library.ts` — My List/library state and sync
- `src/lib/preferences.ts` — search, personalization and player preferences
- `src/lib/AuthContext.tsx` — Firebase authentication/session state
- `src/lib/analytics.ts` — application analytics events
- `src/styles/panda-home.css` — Panda streaming UI styling

---

## 🧭 Application Routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page |
| `/home` | Main Panda.fun browsing experience |
| `/browse` | Browse/home alias |
| `/search` | Movie and TV search |
| `/details/:id` | Movie or TV title details |
| `/watch/:id` | Playback page |
| `/library` | My List / saved titles |
| `/history` | Library/history view |
| `/profile` | User profile |
| `/settings` | Application settings |
| `/whats-new` | What's new |
| `/about` | About Panda.fun |
| `/docs` | API documentation information |
| `/terms` | Terms of Service |
| `/privacy` | Privacy Policy |
| `/contact` | Contact/support |
| `/admin` | Admin dashboard |

Unknown routes are handled by the application's 404 state.

---

## 🎬 How Browsing Works

### Home

The home experience consumes the MovieAPI home endpoint and presents the catalog through Panda.fun's streaming interface.

The API currently exposes data for:

- Featured content
- Trending
- Popular movies
- Popular TV
- Latest movies
- Latest TV
- Airing/schedule information
- Genre-based discovery
- Recommendations

The UI is intentionally image-heavy and responsive, with a cinematic hero, content rows, cards, continue-watching state and title discovery.

### Search

Search queries are sent to MovieAPI for both movies and TV shows. The frontend combines the two result sets into a single searchable catalog.

Search results use normalized Panda.fun media IDs such as:

```
tmdb_movie_<tmdbId>
tmdb_tv_<tmdbId>
kinoma_tvmaze_<tvmazeId>
```

These IDs allow the frontend to work with both TMDB-backed and TVMaze-backed titles.

---

## 🎞️ Title Details

The details page resolves the selected media ID through MovieAPI.

For TV shows it can load:

1. Show metadata
2. Seasons
3. Episodes for a selected season
4. Trailer information
5. Recommendations

Movie titles use the corresponding movie metadata and recommendation flow.

TVMaze IDs can be resolved to TMDB IDs when a TMDB-only operation, such as trailer/playback resolution, requires one.

---

## ▶️ Playback

The current web player architecture uses **Vidy.st as the sole playback provider**.

For the current configuration:

```
Panda.fun
   ↓
Vidy.st
   ↓
TMDB-powered movie / TV playback
```

The frontend generates Vidy.st playback URLs with `autoplay=true`. TV playback also enables `nextEpisode=true`, `episodeSelector=true`, and `autoplayNextEpisode=true`.

### Movies

Movie playback is resolved using the TMDB movie ID.

### TV

TV playback uses:

```
TMDB ID
Season
Episode
```

The player page keeps the selected season and episode in the route so that episodes can be opened directly and navigation can move between episodes.

The player page also provides:

- Previous/next episode navigation
- Season selection
- Episode cards
- Current episode indication
- My List controls
- Native device sharing
- Similar/recommended titles
- Responsive player layout
- Vidy.st fallback/error states

### Important playback note

The video itself is provided by the configured external embed provider. Panda.fun controls the surrounding application experience but does not host the video files.

Browser autoplay policies and third-party embed behavior can still affect playback.

---

## 📺 Continue Watching

Panda.fun maintains playback/history information locally so the interface can restore the user's viewing state.

Progress can include:

- Title ID
- Season
- Episode
- Playback timestamp
- Duration
- Completion percentage
- Last watched time
- Completion state

For authenticated users, progress can also be synchronized with Firebase Firestore.

Because the web player is a cross-origin external iframe, the frontend cannot assume it can directly inspect the embedded player's exact playback position. Resume information therefore depends on the progress data available to the application.

---

## 📚 My List

My List is the user's saved-title collection.

The library system supports:

- Add/remove titles
- Local persistence
- Library UI updates
- Firebase synchronization for authenticated users

The same library state is used by title and player actions where appropriate.

---

## 👤 Accounts

Firebase Authentication is used for optional user accounts.

Supported authentication flows include:

- Google sign-in
- Email/password sign-in
- Email/password registration
- Sign-out

When a user signs in, Panda.fun can synchronize account information, watch progress and library data with Firestore.

Anonymous browsing remains possible for the core catalog experience.

---

## 🔐 Firebase Authentication

Panda.fun uses Firebase Authentication for optional user accounts. Google Sign-In and email/password authentication are configured in `firebase.json`, while account data, watch progress and library sync use the named Firestore database configured by the Firebase web app.

### Production Firebase setup

Deploy the version-controlled Authentication provider configuration and Firestore rules with the manual GitHub Actions workflow:

```
Actions → Deploy Firebase Authentication and Firestore → Run workflow
```

The workflow expects a GitHub Actions secret named `FIREBASE_SERVICE_ACCOUNT_JSON` containing a Firebase service-account JSON document. Firebase's Admin SDK is server-side only and is never bundled into the web client.

To grant the protected admin dashboard to an existing Firebase user:

```
npm run auth:set-admin -- <uid-or-email>
```

To revoke it:

```
npm run auth:set-admin -- --revoke <uid-or-email>
```

The admin command requires either `FIREBASE_SERVICE_ACCOUNT_JSON` or Application Default Credentials. Admin status is stored as the Firebase Authentication `admin` custom claim, not as a user-editable Firestore field.

## 📊 Analytics

Panda.fun has an application analytics layer backed by Firestore.

Tracked application events include:

- Page views
- Watch starts
- Watch progress
- Watch completion
- Searches
- Title opens
- Episode starts
- Library actions
- Errors

Analytics are designed to be non-blocking: an analytics failure should not prevent normal navigation or playback.

---

## 💾 Caching and Performance

The MovieAPI client includes:

- In-memory GET caching
- Request de-duplication
- Time-based cache TTLs
- API fallback handling
- Request timeouts
- Background recommendation loading
- Route-level code splitting
- Lazy loading for larger pages
- PWA/service-worker support

The player page prioritizes loading the selected playback iframe quickly while secondary information can load independently.

---

## 📱 PWA

Panda.fun can operate as a Progressive Web App.

The project includes:

- Web app manifest
- Service worker
- Install prompt handling
- Standalone/fullscreen detection
- Android/iOS device detection
- Cached application assets

The responsive web interface is intentionally shared across desktop, mobile and TV-sized screens rather than switching to the old separate TV web UI.

---

## 📺 Native Android TV

The repository also contains a native Android TV application under `/android`. Production Android TV releases are published manually through the `Build and Release Panda.fun Android TV APK` GitHub Actions workflow.

It uses:

- Kotlin
- Jetpack Compose
- Media3 / ExoPlayer
- Android TV / Leanback launcher support
- D-pad navigation
- Native TV playback
- Update checking

Build instructions are maintained separately in:

```
android/README.md
```

The native Android TV infrastructure is part of the project and should not be removed when changing the web interface.

---

## 🔧 Environment Variables

Create a local `.env` file based on `.env.example`.

The primary public MovieAPI endpoint is:

```
VITE_MOVIE_API_URL=https://movieapi-3d0v.onrender.com
```

A secondary endpoint can be supplied through:

```
VITE_MOVIE_API_FALLBACK_URL=
```

Firebase configuration is supplied through the Firebase configuration used by `src/lib/firebase.ts`.

**Never place private TMDB/provider credentials in the frontend.** Provider secrets belong in the MovieAPI backend.

---

## 🛠️ Local Development

### Requirements

- Node.js
- npm
- A configured Firebase project if account functionality is required
- Access to a working MovieAPI deployment for catalog/playback data

### Install

```bash
npm install
```

### Development server

```bash
npm run dev
```

### Type checking

```bash
npm run lint
```

### Tests

```bash
npm test
```

### Production build

```bash
npm run build
```

### Preview the Vite build

```bash
npm run preview
```

---

## 🚀 Deployment

The project is designed for Vercel deployment.

The frontend is a client-side React application with Vite build output and SPA rewrites configured in `vercel.json`.

Important deployment requirements:

1. Configure the required Vite environment variables.
2. Configure Firebase for the production domain.
3. Ensure the MovieAPI endpoint is reachable from the deployed site.
4. Keep the CSP/frame configuration aligned with the active playback embed provider.
5. Deploy the frontend after successful type checking/build verification.

---

## 🔌 MovieAPI

Panda.fun's web frontend is intentionally separated from the MovieAPI backend.

Backend repository:

**MovieAPI:** https://github.com/titan717/movieapi

Current deployment:

**MovieAPI Render:** https://movieapi-3d0v.onrender.com

The frontend should treat MovieAPI as its catalog, metadata, discovery, trailer and playback-resolution layer rather than directly embedding provider credentials or backend secrets.

---

## 🗂️ Project Structure

```
Panda.fun/
├── android/                 # Native Android TV application
├── docs/                    # Project plans and documentation
├── public/                  # Static web assets
├── src/
│   ├── components/          # Shared React components
│   ├── lib/                 # API, auth, cache, library, history, preferences
│   ├── pages/               # Application routes/screens
│   ├── services/            # Supporting services
│   ├── styles/              # Panda-specific styling
│   ├── App.tsx              # Router/application shell
│   ├── main.tsx             # Browser entry point
│   └── types.ts             # Shared TypeScript types
├── update/                  # Native app update metadata
├── .env.example             # Environment variable template
├── package.json             # Web dependencies/scripts
├── vercel.json              # Vercel/CSP/SPA configuration
├── vite.config.ts           # Vite configuration
└── README.md
```

---

## 🎨 Design Principles

Panda.fun is being built around a few core principles:

- **Panda first:** warm, relaxed, distinctive visual identity.
- **Streaming first:** content should remain the focus instead of looking like an admin dashboard.
- **Minimal UI:** controls should appear when useful and stay out of the way.
- **Responsive everywhere:** desktop, mobile and TV-sized screens use the same core web experience.
- **Fast navigation:** cache aggressively where safe and avoid blocking the main experience on secondary requests.
- **Graceful failure:** API/provider failures should produce useful UI states instead of breaking the entire application.
- **Accessible interaction:** keyboard, pointer, touch and TV/D-pad-friendly patterns should be considered.
- **Modular architecture:** catalog, playback, authentication, storage and UI concerns remain separable.

---

## 🧪 Current Development Notes

Panda.fun is still under active development.

Some parts of the repository retain historical **Kinoma** names for compatibility, including internal storage keys, component names and Android package paths. These do not change the public Panda.fun identity.

The onboarding/Panda Lounge experience is being kept isolated while the core streaming product is stabilized.

Anime integration is currently not part of the primary MovieAPI playback flow and can be reintroduced later without changing the core movie/TV architecture.

---

## 🤝 Contributing

Before making changes:

1. Understand whether the change belongs in Panda.fun or MovieAPI.
2. Keep playback-provider logic isolated from presentation code.
3. Preserve responsive behavior.
4. Avoid exposing provider/API secrets in the frontend.
5. Run type checking and tests before considering a change ready.
6. Keep commits focused so individual features can be reverted safely.

---

## 📄 License

No open-source license has currently been declared for this repository. Unless a license is added, the repository should not be assumed to grant permission to redistribute or reuse the source code.

---

**Panda.fun 🐼 — find something good, press play, and relax.**
