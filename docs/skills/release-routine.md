# Skill: release routine

1. `npm run typecheck && npm run lint && npm test && npm run build && npx playwright test`.
2. Blueprint compare (blueprint-compare.md) and TV focus test (tv-focus-test.md) for changed screens.
3. Perf check (perf-check.md); add the numbers to docs/PERF.md.
4. Bump `package.json` version; write the release notes (release body and the in-app What's New list).
5. Commit and push `main` (Vercel deploys production from `main`).
6. `gh workflow run build-apk.yml -R titan717/Panda.fun -f version_name=X.Y.Z`; wait; check the Release has the APK and `.sha256`.
7. Install the previous APK, open Settings › Check for Updates, and confirm it updates to the new one and shows What's New.
8. Re-check the Drive blueprint folder for new or changed files.
