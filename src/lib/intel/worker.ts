import { handleMessage, transferables, type ToWorker } from "./trainer";
import type { LearnerState } from "./learner";

/**
 * v1.5.0 Panda Intelligence training worker. Holds a mirror of the active profile's model and runs training jobs off
 * the main thread (src/lib/intel/trainer.ts). It makes no network requests and touches no storage: the main thread
 * owns persistence (IndexedDB) and merges each result. Loaded lazily, the first time there is something to train.
 */
const box: { state: LearnerState | null; epoch: number } = { state: null, epoch: -1 };
// typed loosely on purpose: the app's tsconfig uses the DOM lib, and the webworker lib would leak into every file
const scope = self as unknown as { onmessage: ((ev: MessageEvent<ToWorker>) => void) | null; postMessage: (m: unknown, t?: Transferable[]) => void };

scope.onmessage = (ev: MessageEvent<ToWorker>) => {
  const m = ev.data;
  try {
    const r = handleMessage(box, m, () => performance.now());
    if (r) scope.postMessage(r, transferables(r));
  } catch (e) {
    // the mirror may be half-updated: drop it, the main thread re-sends `init` and falls back if this repeats
    box.state = null;
    box.epoch = -1;
    scope.postMessage({ t: "fail", epoch: m.epoch, id: m.t === "job" ? m.id : -1, message: e instanceof Error ? e.message : String(e) });
  }
};
