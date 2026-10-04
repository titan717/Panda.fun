import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createPandaSceneController } from './PandaSceneController';
import { createPandaModel, type PandaRig } from './PandaModel';
import { createPandaEnvironment } from './PandaEnvironment';
import type { PandaAnimationState, PandaSceneEvent } from './pandaSceneTypes';

export interface PandaSceneRuntimeOptions {
  mount: HTMLDivElement;
  event?: PandaSceneEvent;
  reducedMotion: boolean;
  onReady?: () => void;
  onError?: (error: unknown) => void;
}

export interface PandaSceneRuntimeHandle {
  play(event: PandaSceneEvent): void;
  dispose(): void;
}

export function createPandaSceneRuntime(options: PandaSceneRuntimeOptions): PandaSceneRuntimeHandle {
  const { mount, reducedMotion, onReady, onError } = options;
  let renderer: THREE.WebGLRenderer | null = null;
  let frame = 0;
  let disposed = false;
  let running = false;
  let rig: PandaRig | null = null;
  let realPanda: { root: THREE.Group; mixer: THREE.AnimationMixer; actions: Map<string, THREE.AnimationAction>; clips: THREE.AnimationClip[]; } | null = null;
  let realPandaLoadFailed = false;
  let realPandaAction: THREE.AnimationAction | null = null;
  let realPandaHead: THREE.Bone | null = null;
  let realPandaNeck: THREE.Bone | null = null;
  let lastFrameTime = performance.now();
  let pageHidden = document.hidden;
  let sceneVisible = true;
  let visibilityObserver: IntersectionObserver | null = null;
  let resizeObserver: ResizeObserver | null = null;
  const pointer = { x: 0, y: 0 };
  let stateStartedAt = performance.now();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 100);
  camera.position.set(0, 1.7, 9.4);
  camera.lookAt(0, 1.35, 0);

  const cap = Math.min(window.devicePixelRatio || 1, reducedMotion ? 1.25 : 1.75);
  renderer = new THREE.WebGLRenderer({
    antialias: !reducedMotion,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(cap);
  renderer.setClearColor(0x000000, 0);
  mount.appendChild(renderer.domElement);

  const environment = createPandaEnvironment(scene, reducedMotion);
  rig = createPandaModel();
  rig.root.position.set(-5.8, -0.45, 0);
  rig.root.rotation.y = -0.22;
  rig.root.scale.setScalar(0.94);
  scene.add(rig.root);

  // Use a genuine rigged GLB character as the primary Panda. The procedural mascot
  // remains only as a resilient fallback if the remote asset cannot be reached.
  const loadRealPanda = async () => {
    try {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(
        'https://cdn.jsdelivr.net/gh/Mesh2Motion/mesh2motion-app@main/static/models-variation/fox/panda.glb',
      );
      if (disposed) return;

      const root = gltf.scene;
      root.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.frustumCulled = true;
        }
      });

      const bounds = new THREE.Box3().setFromObject(root);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      root.position.sub(center);
      root.position.y -= bounds.min.y - center.y;
      // Keep the character intentionally small in the onboarding composition.
      // The environment and empty space should frame Panda, not be swallowed by it.
      const targetHeight = 2.9;
      const modelScale = targetHeight / Math.max(size.y, 0.001);
      root.scale.setScalar(modelScale);

      const mixer = new THREE.AnimationMixer(root);
      const actions = new Map<string, THREE.AnimationAction>();
      for (const clip of gltf.animations) {
        actions.set(clip.name.toLowerCase(), mixer.clipAction(clip));
      }

      root.position.set(-5.8, -0.45, 0);
      root.scale.multiplyScalar(0.92);
      root.rotation.y = -0.22;
      root.visible = true;
      scene.add(root);
      rig.root.visible = false;
      realPanda = { root, mixer, actions, clips: gltf.animations };
      realPandaHead = root.getObjectsByProperty('type', 'Bone').find((object) => /head/i.test(object.name)) as THREE.Bone | undefined ?? null;
      realPandaNeck = root.getObjectsByProperty('type', 'Bone').find((object) => /neck/i.test(object.name)) as THREE.Bone | undefined ?? null;

      // Start with the asset's first available motion while we transition into the scene.
      const initial = gltf.animations.find((clip) => /idle|stand|breath/i.test(clip.name)) ?? gltf.animations[0];
      if (initial) {
        const action = mixer.clipAction(initial);
        realPandaAction = action;
        action.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.25).play();
      }
    } catch (error) {
      realPandaLoadFailed = true;
      onError?.(error);
    }
  };
  void loadRealPanda();

  const stateRef = { current: 'idle' as PandaAnimationState };
  const controller = createPandaSceneController(
    { reducedMotion, pixelRatioCap: cap, onReady, onError },
    (next) => {
      stateRef.current = next;
      stateStartedAt = performance.now();
      if (rig) {
        rig.root.rotation.z = 0;
        rig.root.scale.setScalar(0.94);
      }
    },
  );

  const handlePointer = (event: PointerEvent) => {
    pointer.x = (event.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
    pointer.y = (event.clientY / Math.max(window.innerHeight, 1)) * 2 - 1;
  };

  const handleVisibility = () => { pageHidden = document.hidden; syncLoop(); };
  const handleIntersection = ([entry]: IntersectionObserverEntry[]) => {
    sceneVisible = entry?.isIntersecting ?? true;
    syncLoop();
  };

  const resize = () => {
    if (!renderer || disposed) return;
    const width = Math.max(1, mount.clientWidth);
    const height = Math.max(1, mount.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };

  const animate = () => {
    if (disposed || !renderer || !rig || !running) return;

    const now = performance.now();
    const elapsed = now / 1000;
    const state = stateRef.current;
    const t = (now - stateStartedAt) / 1000;
    const smooth = (value: number) => THREE.MathUtils.smoothstep(THREE.MathUtils.clamp(value, 0, 1), 0, 1);

    if (!reducedMotion && realPanda) {
      const findAction = (patterns: RegExp[]) => {
        for (const [name, action] of realPanda!.actions) {
          if (patterns.some((pattern) => pattern.test(name))) return action;
        }
        return undefined;
      };

      // Resolve an animation only when the state changes. Re-starting actions every
      // frame causes subtle foot pops and destroys the animator's natural timing.
      const targetAction =
        state === 'walk-in' || state === 'walk-out'
          ? findAction([/walk/, /run/])
          : state === 'wave'
            ? findAction([/wave/, /greet/, /hello/])
            : state === 'sleep'
              ? findAction([/sleep/, /rest/, /sit/])
              : state === 'eat-bamboo'
                ? findAction([/eat/, /bamboo/, /feed/])
                : state === 'celebrate'
                  ? findAction([/celebr/, /happy/, /victory/, /jump/])
                  : state === 'react'
                    ? findAction([/react/, /surprise/, /startle/])
                    : findAction([/idle/, /stand/, /breath/]) ?? realPanda.mixer.clipAction(realPanda.clips[0]);

      if (targetAction && targetAction !== realPandaAction) {
        const previousAction = realPandaAction;
        targetAction.reset();
        targetAction.setLoop(THREE.LoopRepeat, Infinity);
        targetAction.enabled = true;
        // The entrance should read as a calm, heavy walk rather than a run cycle.
        // Slow the source animation while keeping its foot contacts intact.
        const isWalking = state === 'walk-in' || state === 'walk-out';
        targetAction.setEffectiveTimeScale(isWalking ? 0.58 : 1);
        targetAction.setEffectiveWeight(1);
        targetAction.fadeIn(0.28).play();
        previousAction?.fadeOut(0.28);
        realPandaAction = targetAction;
      }

      const entering = state === 'walk-in';
      const walking = state === 'walk-in' || state === 'walk-out';
      // Tie travel duration to the actual source clip so the Panda reaches the
      // destination on a predictable footfall instead of sliding between steps.
      const walkClipDuration = walking && targetAction
        ? targetAction.getClip().duration / 0.58
        : 2.8;
      const walkCycles = entering ? 2.25 : 2;
      const duration = walking
        ? THREE.MathUtils.clamp(walkClipDuration * walkCycles, 3.8, 5.6)
        : 2.8;
      const progress = smooth(t / duration);
      const fromX = entering ? -5.8 : 0;
      const toX = entering ? 0 : 5.9;
      // Keep forward speed almost constant during the gait. Large easing curves
      // make the feet appear to skate because the animation itself has constant cadence.
      const locomotionProgress = walking
        ? THREE.MathUtils.clamp(t / duration, 0, 1)
        : progress;
      realPanda.root.position.x = THREE.MathUtils.lerp(fromX, toX, locomotionProgress);
      // Keep locomotion on one grounded plane; the GLB's feet provide the actual step cycle.
      realPanda.root.position.z = THREE.MathUtils.lerp(realPanda.root.position.z, 0, 0.08);
      realPanda.root.rotation.y = THREE.MathUtils.lerp(entering ? -0.24 : 0, entering ? 0 : 0.3, progress);
      realPanda.root.rotation.z = THREE.MathUtils.lerp(
        realPanda.root.rotation.z,
        walking
          ? Math.sin(t * 3.1) * 0.006 + pointer.x * -0.012
          : pointer.x * -0.018,
        0.045,
      );

      // Apply look-at after the mixer so the animation stays in control of the body,
      // while the head/neck gently acknowledge the viewer.
      if (realPandaHead) {
        realPandaHead.rotation.y = THREE.MathUtils.lerp(realPandaHead.rotation.y, pointer.x * 0.22, 0.075);
        realPandaHead.rotation.x = THREE.MathUtils.lerp(realPandaHead.rotation.x, pointer.y * -0.075, 0.075);
      }
      if (realPandaNeck) {
        realPandaNeck.rotation.y = THREE.MathUtils.lerp(realPandaNeck.rotation.y, pointer.x * 0.08, 0.05);
        realPandaNeck.rotation.x = THREE.MathUtils.lerp(realPandaNeck.rotation.x, pointer.y * -0.025, 0.05);
      }

      const delta = Math.min((now - lastFrameTime) / 1000, 0.05);
      lastFrameTime = now;
      realPanda.mixer.update(delta);
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
      return;
    }

    if (!reducedMotion) {
      const walkCycle = Math.sin(t * 5.8);
      const walkCycleOpposite = Math.sin(t * 5.8 + Math.PI);
      const breath = Math.sin(elapsed * 1.55) * 0.022;

      // Body mechanics stay subtle: breathing and a controlled center-of-mass shift.
      rig.body.scale.y = 1 + breath;
      rig.body.rotation.z = THREE.MathUtils.lerp(rig.body.rotation.z, Math.sin(elapsed * 1.05) * 0.018, 0.045);
      rig.body.position.y = 1.28 + Math.sin(elapsed * 1.55) * 0.012;

      if (state === 'walk-in' || state === 'walk-out') {
        const entering = state === 'walk-in';
        const duration = entering ? 1.85 : 1.65;
        const progress = smooth(t / duration);
        const fromX = entering ? -5.8 : 0;
        const toX = entering ? 0 : 6.1;
        const eased = entering ? progress * progress * (3 - 2 * progress) : progress;

        rig.root.position.x = THREE.MathUtils.lerp(fromX, toX, eased);
        // Keep the feet on the floor: the body rises and falls from a planted contact point,
        // rather than translating the whole character up and down like a floating sprite.
        const strideBounce = Math.abs(Math.sin(t * 3.5)) * 0.012;
        rig.root.position.y = -0.45 + strideBounce;
        rig.root.position.z = Math.sin(progress * Math.PI) * 0.22;
        rig.root.rotation.y = THREE.MathUtils.lerp(entering ? -0.24 : 0, entering ? 0 : 0.3, eased);
        rig.root.rotation.z = Math.sin(t * 4.4) * 0.012;

        // Alternating feet, hips and arms create a readable four-beat walking rhythm.
        const stride = Math.sin(t * 5.8);
        const stance = Math.max(0, Math.cos(t * 5.8));
        // Keep the stance foot quiet while the opposite leg swings through.
        rig.leftLeg.rotation.z = stride * 0.105;
        rig.rightLeg.rotation.z = -stride * 0.105;
        rig.leftFootPivot.rotation.z = -Math.max(0, stride) * 0.07;
        rig.rightFootPivot.rotation.z = -Math.max(0, -stride) * 0.07;
        rig.leftFoot.position.z = 0.19 + Math.max(0, -stride) * 0.045;
        rig.rightFoot.position.z = 0.19 + Math.max(0, stride) * 0.045;
        rig.leftFoot.rotation.z = 0;
        rig.rightFoot.rotation.z = 0;
        rig.leftArm.rotation.z = 0.20 - stride * 0.10;
        rig.rightArm.rotation.z = -0.20 - stride * 0.10;
        rig.body.rotation.y = THREE.MathUtils.lerp(rig.body.rotation.y, -stride * 0.025, 0.12);
        rig.body.rotation.x = THREE.MathUtils.lerp(rig.body.rotation.x, 0.045 + Math.abs(stride) * 0.012, 0.1);
        // The head leads the body with a natural look-around and follows the pointer.
        rig.head.rotation.y = THREE.MathUtils.lerp(rig.head.rotation.y, pointer.x * 0.30 + Math.sin(t * 1.15) * 0.055, 0.075);
        rig.head.rotation.x = THREE.MathUtils.lerp(rig.head.rotation.x, pointer.y * -0.085 + Math.sin(t * 1.05) * 0.02, 0.075);

        if (!entering && progress > 0.76) {
          const fadeScale = THREE.MathUtils.lerp(0.94, 0.72, smooth((progress - 0.76) / 0.24));
          rig.root.scale.setScalar(fadeScale);
        }
      } else {
        rig.root.position.x = THREE.MathUtils.lerp(rig.root.position.x, 0, 0.07);
        rig.root.position.y = THREE.MathUtils.lerp(rig.root.position.y, -0.45, 0.1);
        rig.root.position.z = THREE.MathUtils.lerp(rig.root.position.z, 0, 0.08);
        rig.root.rotation.y = THREE.MathUtils.lerp(rig.root.rotation.y, 0, 0.07);
        rig.root.rotation.z = THREE.MathUtils.lerp(rig.root.rotation.z, 0, 0.08);

        // The head leads attention while the ears follow a fraction later.
        rig.head.rotation.y = THREE.MathUtils.lerp(
          rig.head.rotation.y,
          pointer.x * 0.30 + Math.sin(elapsed * 0.72) * 0.035,
          0.07,
        );
        rig.head.rotation.x = THREE.MathUtils.lerp(
          rig.head.rotation.x,
          pointer.y * -0.085,
          0.07,
        );
        rig.leftEar.rotation.z = THREE.MathUtils.lerp(
          rig.leftEar.rotation.z,
          -pointer.x * 0.055 + Math.sin(elapsed * 1.2) * 0.018,
          0.045,
        );
        rig.rightEar.rotation.z = THREE.MathUtils.lerp(
          rig.rightEar.rotation.z,
          -pointer.x * 0.055 - Math.sin(elapsed * 1.2) * 0.018,
          0.045,
        );
      }

      if (state === 'wave') {
        const settle = smooth(t / 0.22);
        rig.rightArm.rotation.z = THREE.MathUtils.lerp(-0.25, -1.02, settle) + Math.sin(t * 7.5) * 0.12;
        rig.rightArm.rotation.x = Math.sin(t * 3.7) * 0.06;
        rig.head.rotation.z = Math.sin(t * 2.4) * 0.035;
      } else if (state === 'react') {
        const anticipation = smooth(t / 0.18);
        const settle = 1 - smooth(Math.max(t - 0.35, 0) / 0.75);
        rig.head.rotation.x = Math.sin(t * 5.2) * 0.10 * settle * anticipation;
        rig.head.rotation.z = Math.sin(t * 3.1) * 0.025 * settle;
        rig.leftEar.rotation.z = Math.sin(t * 6.2) * 0.075 * settle;
        rig.rightEar.rotation.z = -Math.sin(t * 6.2) * 0.075 * settle;
        rig.body.rotation.z = Math.sin(t * 3.1) * 0.025 * settle;
      } else if (state === 'remote-interaction') {
        const reach = smooth(t / 0.3);
        rig.rightArm.rotation.z = THREE.MathUtils.lerp(-0.25, -0.68, reach);
        rig.rightArm.rotation.x = -0.18 * reach;
        rig.remote.rotation.z = -0.25 + Math.sin(t * 8.5) * 0.12;
        rig.remote.rotation.y = Math.sin(t * 5.5) * 0.08;
        rig.head.rotation.x = Math.sin(t * 3.8) * 0.045;
      } else if (state === 'sleep') {
        const breathe = Math.sin(t * 1.2) * 0.025;
        rig.head.rotation.z = THREE.MathUtils.lerp(rig.head.rotation.z, -0.12, 0.08);
        rig.head.rotation.x = THREE.MathUtils.lerp(rig.head.rotation.x, 0.12, 0.08);
        rig.body.rotation.z = THREE.MathUtils.lerp(rig.body.rotation.z, -0.025, 0.06);
        rig.root.position.y = THREE.MathUtils.lerp(rig.root.position.y, -0.45 + breathe, 0.08);
        rig.leftArm.rotation.z = THREE.MathUtils.lerp(rig.leftArm.rotation.z, 0.55, 0.08);
        rig.rightArm.rotation.z = THREE.MathUtils.lerp(rig.rightArm.rotation.z, -0.55, 0.08);
        rig.bamboo.visible = false;
      } else if (state === 'eat-bamboo') {
        rig.bamboo.visible = true;
        rig.rightArm.rotation.z = THREE.MathUtils.lerp(rig.rightArm.rotation.z, -0.92, 0.08);
        rig.rightArm.rotation.x = THREE.MathUtils.lerp(rig.rightArm.rotation.x, -0.12, 0.08);
        rig.bamboo.rotation.z = Math.sin(t * 2.2) * 0.045;
        rig.bamboo.children.forEach((part, index) => {
          part.rotation.y = Math.sin(t * 2.4 + index * 0.7) * 0.045;
        });
        rig.bamboo.position.set(0.02, 2.0 + Math.sin(t * 2.1) * 0.025, 0.82);
        rig.head.rotation.x = THREE.MathUtils.lerp(rig.head.rotation.x, -0.07 + Math.sin(t * 2.1) * 0.035, 0.08);
      } else if (state === 'face-cover') {
        rig.leftArm.rotation.z = THREE.MathUtils.lerp(rig.leftArm.rotation.z, 1.12, 0.12);
        rig.rightArm.rotation.z = THREE.MathUtils.lerp(rig.rightArm.rotation.z, -1.12, 0.12);
        rig.leftArm.rotation.x = THREE.MathUtils.lerp(rig.leftArm.rotation.x, -0.16, 0.12);
        rig.rightArm.rotation.x = THREE.MathUtils.lerp(rig.rightArm.rotation.x, -0.16, 0.12);
        rig.head.rotation.z = THREE.MathUtils.lerp(rig.head.rotation.z, 0.08, 0.08);
      } else if (state === 'celebrate') {
        const hop = Math.pow(Math.abs(Math.sin(t * 3.7)), 1.8) * 0.14;
        rig.root.position.y = THREE.MathUtils.lerp(rig.root.position.y, -0.45 + hop, 0.18);
        rig.leftArm.rotation.z = 0.46 + Math.sin(t * 6.8) * 0.18;
        rig.rightArm.rotation.z = -0.46 - Math.sin(t * 6.8) * 0.18;
        rig.leftEar.rotation.z = Math.sin(t * 7) * 0.055;
        rig.rightEar.rotation.z = -Math.sin(t * 7) * 0.055;
        rig.head.rotation.z = Math.sin(t * 4.8) * 0.04;
      }

      // Organic blink timing, with slight pupil movement so the face never feels frozen.
      const blinkPhase = elapsed % 4.3;
      const blinking = state === 'sleep' || (blinkPhase > 3.84 && blinkPhase < 3.98) || (blinkPhase > 0.18 && blinkPhase < 0.24);
      const eyeScale = blinking ? 0.08 : 1;
      rig.leftEye.scale.y = THREE.MathUtils.lerp(rig.leftEye.scale.y, eyeScale, 0.55);
      rig.rightEye.scale.y = THREE.MathUtils.lerp(rig.rightEye.scale.y, eyeScale, 0.55);
      const blinkPhase = elapsed % 4.7;
      const blinkOne = blinkPhase > 3.95 && blinkPhase < 4.08;
      const blinkTwo = blinkPhase > 1.05 && blinkPhase < 1.16;
      const blinking = state === 'sleep' || blinkOne || blinkTwo;
      const eyeScale = blinking ? 0.08 : 1;
      rig.leftEye.scale.y = THREE.MathUtils.lerp(rig.leftEye.scale.y, eyeScale, 0.55);
      rig.rightEye.scale.y = THREE.MathUtils.lerp(rig.rightEye.scale.y, eyeScale, 0.55);
      const pupilX = THREE.MathUtils.clamp(pointer.x * 0.035 + Math.sin(elapsed * 0.55) * 0.008, -0.045, 0.045);
      const pupilY = THREE.MathUtils.clamp(pointer.y * -0.018 + Math.sin(elapsed * 0.72) * 0.006, -0.025, 0.025);
      rig.leftEye.position.set(-0.34 + pupilX, 0.16 + pupilY, 1.075);
      rig.rightEye.position.set(0.34 + pupilX, 0.16 + pupilY, 1.075);

      if (state !== 'eat-bamboo') rig.bamboo.visible = false;

      // Small idle cues make the character feel alive without turning the scene into a looped dance.
      if (state === 'idle' || state === 'recognize') {
        rig.head.rotation.z = THREE.MathUtils.lerp(rig.head.rotation.z, Math.sin(elapsed * 0.9) * 0.018, 0.04);
        rig.leftEar.rotation.x = THREE.MathUtils.lerp(rig.leftEar.rotation.x, Math.sin(elapsed * 1.4) * 0.025, 0.04);
        rig.rightEar.rotation.x = THREE.MathUtils.lerp(rig.rightEar.rotation.x, -Math.sin(elapsed * 1.4) * 0.025, 0.04);
      }

      camera.position.x = THREE.MathUtils.lerp(camera.position.x, pointer.x * -0.18, 0.025);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, 1.7 + pointer.y * -0.045, 0.025);

      environment.leaves.children.forEach((leaf) => {
        const data = leaf.userData as { baseRotation?: number; sway?: number; phase?: number };
        const phase = data.phase ?? 0;
        const sway = data.sway ?? 0.014;
        leaf.rotation.z = (data.baseRotation ?? leaf.rotation.z) + Math.sin(elapsed * 1.15 + phase) * sway;
        leaf.position.x += Math.sin(elapsed * 0.22 + phase) * 0.0007;
      });

      environment.mist.children.forEach((cloud) => {
        const data = cloud.userData as { speed?: number; phase?: number };
        cloud.position.x += (data.speed ?? 0.001) * 0.45;
        cloud.position.y += Math.sin(elapsed * 0.35 + (data.phase ?? 0)) * 0.00035;
        if (cloud.position.x > 6.5) cloud.position.x = -6.5;
      });

      environment.particles.children.forEach((particle) => {
        const data = particle.userData as { speed?: number; phase?: number };
        particle.position.y += data.speed ?? 0.0015;
        particle.position.x += Math.sin(elapsed * 0.7 + (data.phase ?? 0)) * 0.0008;
        if (particle.position.y > 4.2) particle.position.y = -0.2;
      });
    }

    renderer.render(scene, camera);
    frame = requestAnimationFrame(animate);
  };

  function syncLoop() {
    if (disposed) return;
    const shouldRun = !pageHidden && sceneVisible;
    if (shouldRun && !running) {
      running = true;
      frame = requestAnimationFrame(animate);
    } else if (!shouldRun && running) {
      running = false;
      cancelAnimationFrame(frame);
      frame = 0;
    }
  }

  try {
    resize();
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    visibilityObserver = new IntersectionObserver(handleIntersection, { threshold: 0.01 });
    visibilityObserver.observe(mount);
    window.addEventListener('pointermove', handlePointer, { passive: true });
    document.addEventListener('visibilitychange', handleVisibility);
    onReady?.();
    controller.play('arrive');
    if (options.event && options.event !== 'arrive') controller.play(options.event);
    syncLoop();
  } catch (error) {
    onError?.(error);
  }

  return {
    play(event: PandaSceneEvent) {
      if (!disposed) controller.play(event);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      running = false;
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      visibilityObserver?.disconnect();
      window.removeEventListener('pointermove', handlePointer);
      document.removeEventListener('visibilitychange', handleVisibility);
      controller.dispose();
      realPanda?.mixer.stopAllAction();
      realPandaAction = null;
      realPandaHead = null;
      realPandaNeck = null;
      if (realPanda) {
        scene.remove(realPanda.root);
        realPanda.root.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (mesh.isMesh) mesh.geometry.dispose();
        });
      }
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material?.dispose();
      });
      renderer?.dispose();
      renderer?.domElement.remove();
      renderer = null;
      rig = null;
    },
  };
}
