# Skill: performance check

1. `npm run build` — record the JS/CSS gzip sizes of the entry chunk and the largest route chunk.
2. Lighthouse mobile on the production URL: `npx lighthouse <url> --preset=perf --form-factor=mobile --quiet --output=json`.
3. TV profile: Chrome with 4× CPU throttling at 1920×1080; record time to first row and focus move latency.
4. Warm start: reload with the cache filled; Home must paint from IndexedDB without waiting for the network.
5. Any number worse than the last release in docs/PERF.md blocks the release until fixed.
