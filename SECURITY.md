# Security policy

## Supported versions

Only the latest release of Panda.fun (web at the Vercel production deployment, Android APK on [GitHub Releases](https://github.com/titan717/Panda.fun/releases/latest)) receives security fixes. The app updates itself, so please reproduce on the latest version first.

## Reporting a vulnerability

Please report privately through GitHub: **Security › Report a vulnerability** on this repository (private vulnerability reporting). Do not open a public issue for a security problem.

Include the affected version, platform (browser, Android phone, Android TV / Fire TV), steps to reproduce and what an attacker gains. You will get an answer within 7 days. Fixes ship in the next release, and High or Critical issues block every release until they are fixed.

## Scope

In scope: this repository (web app, Android wrapper, CI) and the backend in [titan717/movieapi](https://github.com/titan717/movieapi).

Out of scope: the third-party video providers' own players and servers (CineSrc, Vidy, VidLink), YouTube, and TMDB. Panda limits what their frames can do but does not control their code.

How Panda is protected, and the limits of protecting client code, are described in [docs/SECURITY.md](docs/SECURITY.md).
