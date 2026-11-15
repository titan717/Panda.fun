# v1.4.0 research notes

Each note says what kind of evidence it is: **Official docs** (platform vendor documentation), **Independent research** (papers), **Competitor observation** (how other apps behave; qualitative, never measured here) or **Our decision** (a choice made for Panda, with the reason). No benchmarks are invented. Every number in Panda's docs comes from a test or measurement in this repository.

## TV navigation and text entry

- **Official docs.** Android TV apps must be fully usable with the D-pad. Focus must always be visible, and every element must be reachable by directional navigation ([Android Developers, TV navigation](https://developer.android.com/training/tv/get-started/navigation)).
- **Official docs.** Android TV ships Gboard as its on-screen keyboard. Apps choose it through the normal input type and IME options, and voice input works through Gboard with no extra permission ([Android Developers, On-screen keyboard](https://developer.android.com/training/tv/get-started/onscreen-keyboard)). The action key is set with `imeOptions`, e.g. `actionSearch` ([Android Developers, Specify the input method type](https://developer.android.com/develop/ui/views/touch-and-input/keyboard-input/style)).
- **Our decision.** Search and every text field on TV use the real system keyboard (Gboard in the Android app, the browser's IME elsewhere). Panda does not draw a fake keyboard. See the TV input section of `docs/PLAN-v1.4.0.md` for the native bridge.

## Recommendations

- **Independent research.** Maximal Marginal Relevance re-ranks a relevance-ordered list by trading relevance against similarity to the items already picked, with a parameter λ ([Carbonell & Goldstein, SIGIR 1998](http://www.cs.cmu.edu/~jgc/publication/The_Use_MMR_Diversity_Based_LTMIR_1998.pdf)). Panda uses MMR with genre/type/seed similarity (λ 0.72 for Top Picks).
- **Our decision.** A transparent weighted content model plus MMR, entirely on the device, because the directive rules out a complex backend or AI API. Panda has no interaction data across users, so collaborative filtering is not possible honestly. The UI and docs do not call it AI. Weights and the offline evaluation are in `RECOMMENDATIONS.md`.
- **Our decision.** Explanations come only from a score component that really drove the pick. When none did, no reason is shown.

## Onboarding

- **Competitor observation (qualitative).** Language-learning and streaming apps often let people try the product before any account wall and ask a few quick taste questions with large tappable choices. This is a design reference only. No numbers were collected.
- **Our decision.** Seven short, skippable screens. No account, no login, no registration. Answers are stored per profile on the device and can be redone or reset in Settings.

## Playback

- **Our decision (from measurement in this repo).** Provider tiers come from `docs/sources/adscore.json` (`SOURCES.md`). Playback counts as successful only when the provider's player clock advances, never on the iframe `load` event alone, because a loaded frame can still show an error, a sandbox wall or an ad overlay. See `PLAYBACK_HEALTH.md`.
