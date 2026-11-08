# Skill: TV sidebar test

Checks the TV sidebar against BLUEPRINT_SPEC §4.6–4.16. Run before every release that touches `src/tv/TvShell.tsx` or the `.rail*` styles.

1. Build and preview: `npm run build && npx vite preview --host 127.0.0.1 --port 4173`.
2. Automated: `npx playwright test e2e/tv-sidebar.spec.ts --project=tv-1280 --project=tv-1920 --project=tv-3840`. It covers:
   - Left from the leftmost content opens the sidebar on the current section (Home, Movies, Search, Categories).
   - Panel width is 400 tu, content does not move (overlay).
   - Up/Down order UPDATE → Search → Home → TV → Movies → New & Hot → Categories → My Space, stopping at both ends; Left is swallowed.
   - Right and Back return focus to the exact item you left; Back never changes the route.
   - Enter navigates, `aria-current` moves, and the Home icon stays lit on its sub-pages.
   - Only transform, opacity (plus colour and shadow on focus) are transitioned.
3. Visual: the spec saves `test-results/sidebar-<project>-collapsed.png` and `-expanded.png`. Put them next to tv1#15 (collapsed) and tv2#12 (expanded) from `blueprint/` PDFs, as in `blueprint-compare.md`, and check: pill under the logo when collapsed and beside it when open, sub-items only when open, opaque navy panel with a light right edge, glow band on focus, no dividers, overscan margins intact at 1280 × 720 and 3840 × 2160.
4. On a real TV or the emulator: hold Left/Down quickly — no flicker, no focus lost, no frame drops.
