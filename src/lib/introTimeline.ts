/**
 * v1.3.1 TV intro timeline (D-181): the beats and the paper pieces of the retro film, kept out of the lazy film chunk
 * (components/IntroTv.tsx) because Intro.tsx builds its beat sheet and the score's paper clicks from them.
 */
export const FPS = 12;
/** The frame a time in ms falls on (12 fps, stepped). */
export const frameOf = (ms: number) => Math.floor((ms * FPS) / 1000);
/** The first ms of a frame. */
export const frameMs = (f: number) => (f * 1000) / FPS;

/** TV beats in ms. The whole film is 5 s; the hard timeout in Intro.tsx is 6 s. */
export const RETRO = {
  eyeL: 400, eyeR: 650, blink: 1000, blinkEnd: 1200,
  assemble: 1250, iris: 1000, // iris-in and pieces pop together over 1.0 s
  glint: 2300, glintEnd: 2500,
  zoom: 2500, inside: 3750, // stepped zoom into the left eye; the drum hit lands when the eye fills the screen
  fade: 3440, fadeLen: 600,
  horizon: 3900, leave: 4600, done: 5000, hard: 6000,
} as const;

/** Paper pieces, back to front, with the ms they pop in and the centre they settle around. */
export const PIECES = [
  { id: "disc", at: 1250, c: [800, 450] },
  { id: "stalk0", at: 1317, c: [233, 450], jit: 0.6 },
  { id: "stalk1", at: 1417, c: [1356, 440], jit: 0.6 },
  { id: "stalk2", at: 1517, c: [1450, 480], jit: 0.6 },
  { id: "earL", at: 1650, c: [590, 240] },
  { id: "earR", at: 1783, c: [1010, 240] },
  { id: "head", at: 1317, c: [800, 460] },
  { id: "shine", at: 1450, c: [645, 296] },
  { id: "phones", at: 1883, c: [800, 320] },
  { id: "patchL", at: 1517, c: [690, 425] },
  { id: "patchR", at: 1617, c: [910, 425] },
  { id: "brows", at: 1783, c: [801, 290] },
  { id: "nose", at: 1917, c: [800, 540] },
  { id: "mouth", at: 2050, c: [806, 595] },
  { id: "bamboo", at: 2183, c: [936, 565] },
  { id: "shades", at: 2250, c: [800, 427] },
] as const;
export type PieceId = (typeof PIECES)[number]["id"];

/** One paper-click per frame on which something pops in (pieces on the same frame share a click), in ms. */
export const POPS: number[] = [...new Set(PIECES.map((p) => frameOf(p.at)))].sort((a, b) => a - b).map(frameMs);

/** The left eye, where the camera zooms in. */
export const EYE_L = [690, 420] as const;
export const ZOOM_MAX = 24;
