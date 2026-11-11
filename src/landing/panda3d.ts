// Hero 3D panda with headphones for the /welcome landing page (v1.2.9).
// Loaded lazily after first paint; the static SVG panda stays visible until the first frame renders, and stays
// in place for good when WebGL is unavailable. Rendering pauses off screen and in background tabs.
import {
  AmbientLight, BufferAttribute, BufferGeometry, CapsuleGeometry, Color, CylinderGeometry, DirectionalLight, Group,
  HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, PointLight, Points, PointsMaterial, Scene,
  SphereGeometry, SRGBColorSpace, TorusGeometry, WebGLRenderer, ACESFilmicToneMapping, AdditiveBlending, Vector2
} from "three";

export interface PandaOptions { reduced: boolean; onReady?: () => void }

export function mountPanda(canvas: HTMLCanvasElement, opts: PandaOptions): () => void {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const maxDpr = window.innerWidth < 700 ? 1.5 : 1.75;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));

  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0.55, 8.2);
  camera.lookAt(0, 0.35, 0);

  // materials
  const fur = new MeshStandardMaterial({ color: new Color("#f3f5f9"), roughness: 0.62, metalness: 0 });
  const ink = new MeshStandardMaterial({ color: new Color("#14161c"), roughness: 0.55, metalness: 0.05 });
  const shine = new MeshStandardMaterial({ color: new Color("#ffffff"), roughness: 0.15, emissive: new Color("#ffffff"), emissiveIntensity: 0.4 });
  const blush = new MeshStandardMaterial({ color: new Color("#d9ccff"), roughness: 0.7 });
  const shell = new MeshStandardMaterial({ color: new Color("#2a1f4d"), roughness: 0.32, metalness: 0.45 });
  const band = new MeshStandardMaterial({ color: new Color("#1d2230"), roughness: 0.3, metalness: 0.6 });
  const glow = new MeshStandardMaterial({ color: new Color("#39ff88"), emissive: new Color("#39ff88"), emissiveIntensity: 1.6, roughness: 0.4 });

  const sphere = new SphereGeometry(1, 48, 32);
  const mesh = (mat: MeshStandardMaterial, x: number, y: number, z: number, sx: number, sy = sx, sz = sx) => {
    const m = new Mesh(sphere, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    return m;
  };

  const panda = new Group();
  scene.add(panda);

  // body
  const body = new Group();
  body.add(mesh(fur, 0, -0.95, 0, 1.08, 1.02, 0.92));
  const armGeo = new CapsuleGeometry(0.28, 0.62, 8, 20);
  for (const s of [-1, 1]) {
    const arm = new Mesh(armGeo, ink);
    arm.position.set(0.86 * s, -0.78, 0.32);
    arm.rotation.z = 0.55 * s;
    arm.rotation.x = -0.35;
    body.add(arm);
    body.add(mesh(ink, 0.52 * s, -1.82, 0.42, 0.36, 0.3, 0.36));
  }
  body.add(mesh(ink, 0, -0.18, 0, 0.98, 0.32, 0.86)); // shoulder band
  panda.add(body);

  // head
  const head = new Group();
  head.position.set(0, 0.62, 0);
  panda.add(head);
  head.add(mesh(fur, 0, 0, 0, 1.12, 0.98, 0.98));
  for (const s of [-1, 1]) {
    head.add(mesh(ink, 0.74 * s, 0.78, -0.12, 0.34, 0.34, 0.24));
    const patch = mesh(ink, 0.38 * s, 0.1, 0.82, 0.24, 0.32, 0.14);
    patch.rotation.z = -0.5 * s;
    head.add(patch);
    head.add(mesh(shine, 0.36 * s, 0.16, 0.94, 0.075));
    head.add(mesh(blush, 0.66 * s, -0.24, 0.72, 0.12, 0.09, 0.05));
  }
  head.add(mesh(fur, 0, -0.27, 0.8, 0.36, 0.25, 0.26)); // muzzle
  head.add(mesh(ink, 0, -0.16, 1.04, 0.13, 0.085, 0.08)); // nose

  // headphones
  const phones = new Group();
  const arc = new Mesh(new TorusGeometry(1.2, 0.075, 16, 72, Math.PI), band);
  arc.position.set(0, 0.02, -0.05);
  phones.add(arc);
  const cupGeo = new CylinderGeometry(0.34, 0.34, 0.26, 40);
  const ringGeo = new TorusGeometry(0.27, 0.035, 12, 40);
  for (const s of [-1, 1]) {
    const cup = new Mesh(cupGeo, shell);
    cup.rotation.z = Math.PI / 2;
    cup.position.set(1.16 * s, -0.02, -0.02);
    phones.add(cup);
    const ring = new Mesh(ringGeo, glow);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(1.3 * s, -0.02, -0.02);
    phones.add(ring);
  }
  head.add(phones);

  // particles
  const count = window.innerWidth < 700 ? 140 : 260;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const palette = [new Color("#39ff88"), new Color("#22d3c5"), new Color("#8b5cf6"), new Color("#eef1f6")];
  for (let i = 0; i < count; i++) {
    const r = 2.6 + Math.random() * 2.4;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.cos(ph) * 0.7;
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th) - 1;
    const c = palette[i % palette.length]!;
    col.set([c.r, c.g, c.b], i * 3);
  }
  const pGeo = new BufferGeometry();
  pGeo.setAttribute("position", new BufferAttribute(pos, 3));
  pGeo.setAttribute("color", new BufferAttribute(col, 3));
  const dust = new Points(pGeo, new PointsMaterial({ size: 0.045, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, blending: AdditiveBlending }));
  scene.add(dust);

  // light
  scene.add(new HemisphereLight(0xcfdcff, 0x0b0b14, 1.1));
  scene.add(new AmbientLight(0xffffff, 0.15));
  const key = new DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 4, 6);
  scene.add(key);
  const rimTeal = new PointLight(0x22d3c5, 26, 12, 2);
  rimTeal.position.set(-3.2, 1.8, -1.6);
  scene.add(rimTeal);
  const rimPurple = new PointLight(0x8b5cf6, 30, 12, 2);
  rimPurple.position.set(3.2, -0.4, -2.2);
  scene.add(rimPurple);
  const rimGreen = new PointLight(0x39ff88, 10, 8, 2);
  rimGreen.position.set(0, 2.6, 1.8);
  scene.add(rimGreen);

  // sizing
  const resize = () => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(() => { resize(); if (!running) render(0); });
  ro.observe(canvas);
  resize();

  // pointer follow (head turns gently toward the cursor or touch)
  const target = new Vector2();
  const look = new Vector2();
  const onPointer = (e: PointerEvent) => {
    target.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  };
  window.addEventListener("pointermove", onPointer, { passive: true });

  let running = false;
  let raf = 0;
  let visible = true;
  const start = performance.now();
  let ready = false;

  function render(t: number) {
    const s = t / 1000;
    look.lerp(target, opts.reduced ? 1 : 0.06);
    panda.position.y = opts.reduced ? 0 : Math.sin(s * 1.6) * 0.06;
    panda.rotation.y = -0.32 + look.x * 0.2 + (opts.reduced ? 0 : Math.sin(s * 0.5) * 0.06);
    head.rotation.y = look.x * 0.32;
    head.rotation.x = look.y * 0.16;
    head.rotation.z = opts.reduced ? 0 : Math.sin(s * 1.6 + 0.6) * 0.04; // nodding to the beat
    glow.emissiveIntensity = opts.reduced ? 1.4 : 1.3 + Math.sin(s * 3.2) * 0.45;
    dust.rotation.y = s * 0.04;
    dust.rotation.x = Math.sin(s * 0.2) * 0.05;
    // slow cinematic camera drift
    camera.position.x = opts.reduced ? 0 : Math.sin(s * 0.25) * 0.35;
    camera.lookAt(0, 0.35, 0);
    renderer.render(scene, camera);
    if (!ready) { ready = true; opts.onReady?.(); }
  }
  const loop = () => {
    render(performance.now() - start);
    raf = requestAnimationFrame(loop);
  };
  const sync = () => {
    const want = visible && !document.hidden && !opts.reduced;
    if (want && !running) { running = true; raf = requestAnimationFrame(loop); }
    if (!want && running) { running = false; cancelAnimationFrame(raf); }
  };
  const io = new IntersectionObserver((entries) => { visible = entries.some((e) => e.isIntersecting); sync(); });
  io.observe(canvas);
  document.addEventListener("visibilitychange", sync);
  render(0);
  sync();

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    io.disconnect();
    ro.disconnect();
    window.removeEventListener("pointermove", onPointer);
    document.removeEventListener("visibilitychange", sync);
    renderer.dispose();
  };
}
