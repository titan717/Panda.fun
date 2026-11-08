# Skill: blueprint compare

Run for every screen changed in a release.

1. Find the screen in docs/BLUEPRINTS.md and its section in docs/BLUEPRINT_SPEC.md.
2. Run `npx vite preview --port 4173 --host 127.0.0.1` and `node scripts/qa-shots.mjs` (1920×1080 TV, 390×844 mobile).
3. Put each shot next to the blueprint image in `bp/` at the same size.
4. Check in order: background colour, layout grid (x/y of hero, rail, rows), sizes and radii, type sizes and weights, focus style, text content, icons.
5. Every difference is either fixed or written in BLUEPRINT_GAPS.md / DECISIONS.md with a reason.
