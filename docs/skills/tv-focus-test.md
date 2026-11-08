# Skill: TV focus test

1. Open the app in TV mode (`?tv=1` or 1920×1080 with the TV user agent).
2. With arrow keys only: rail → hero → every row → back up. Focus must never be lost or land on a hidden element.
3. Enter on every focusable item opens something real. No dead buttons.
4. Back (Escape / Backspace / Android Back / 461 / 10009) closes panels first, then goes back one screen, then asks to exit on Home.
5. Focus ring is visible on true black, and focus moves feel instant (no frame drops in the Performance panel).
6. Playwright: `npx playwright test --project=tv`.
