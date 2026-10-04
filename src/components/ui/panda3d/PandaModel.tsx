import * as THREE from 'three';

export interface PandaRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftFoot: THREE.Mesh;
  rightFoot: THREE.Mesh;
  leftFootPivot: THREE.Group;
  rightFootPivot: THREE.Group;
  leftEar: THREE.Mesh;
  rightEar: THREE.Mesh;
  leftEye: THREE.Mesh;
  rightEye: THREE.Mesh;
  leftEyePatch: THREE.Mesh;
  rightEyePatch: THREE.Mesh;
  remote: THREE.Group;
  bamboo: THREE.Group;
  leftPupil: THREE.Mesh;
  rightPupil: THREE.Mesh;
}

const sphere = (geometry: THREE.BufferGeometry, material: THREE.Material) => new THREE.Mesh(geometry, material);

export function createPandaModel(): PandaRig {
  const root = new THREE.Group();

  const black = new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.78 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf5f2e9, roughness: 0.62 });
  const eye = new THREE.MeshStandardMaterial({ color: 0x020304, roughness: 0.18 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x9fcf72, roughness: 0.5 });

  // A fresh, softer mascot silhouette: broad chest, short limbs, large expressive head.
  const body = new THREE.Group();
  body.position.set(0, 1.28, 0);
  root.add(body);

  const torso = sphere(new THREE.SphereGeometry(1.02, 40, 28), black);
  torso.scale.set(1.02, 1.13, 0.82);
  body.add(torso);

  const belly = sphere(new THREE.SphereGeometry(0.76, 32, 24), white);
  belly.scale.set(1.0, 1.12, 0.42);
  belly.position.set(0, -0.02, 0.68);
  body.add(belly);

  // Neck and head have their own pivot, so the head turns naturally instead of the whole body.
  const neck = sphere(new THREE.SphereGeometry(0.42, 24, 18), black);
  neck.position.set(0, 0.92, 0);
  body.add(neck);

  const head = new THREE.Group();
  head.position.set(0, 2.43, 0);
  root.add(head);

  const headMesh = sphere(new THREE.SphereGeometry(1.0, 44, 32), black);
  headMesh.scale.set(1.08, 0.98, 0.9);
  head.add(headMesh);

  const ears: THREE.Mesh[] = [];
  for (const x of [-0.62, 0.62]) {
    const ear = sphere(new THREE.SphereGeometry(0.31, 28, 20), black);
    ear.position.set(x, 0.66, -0.01);
    head.add(ear);
    ears.push(ear);
  }

  const muzzle = sphere(new THREE.SphereGeometry(0.54, 32, 24), white);
  muzzle.scale.set(1.04, 0.76, 0.7);
  muzzle.position.set(0, -0.14, 0.76);
  head.add(muzzle);

  const eyePatches: THREE.Mesh[] = [];
  const eyes: THREE.Mesh[] = [];
  for (const x of [-0.35, 0.35]) {
    const patch = sphere(new THREE.SphereGeometry(0.30, 28, 20), black);
    patch.scale.set(0.76, 1.12, 0.32);
    patch.rotation.z = x < 0 ? -0.2 : 0.2;
    patch.position.set(x, 0.16, 0.77);
    head.add(patch);
    eyePatches.push(patch);

    const eyeWhite = sphere(new THREE.SphereGeometry(0.18, 20, 16), white);
    eyeWhite.scale.set(0.86, 1.15, 0.48);
    eyeWhite.position.set(x, 0.16, 0.99);
    head.add(eyeWhite);

    const pupil = sphere(new THREE.SphereGeometry(0.095, 18, 14), eye);
    pupil.name = x < 0 ? 'leftPupil' : 'rightPupil';
    pupil.position.set(x, 0.16, 1.075);
    head.add(pupil);
    eyes.push(pupil);
  }

  const nose = sphere(new THREE.SphereGeometry(0.13, 20, 16), eye);
  nose.scale.set(1.15, 0.82, 0.86);
  nose.position.set(0, -0.03, 1.27);
  head.add(nose);

  const mouth = new THREE.Group();
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.018, 8, 24, Math.PI), eye);
  smile.rotation.x = Math.PI;
  smile.position.set(0, -0.18, 1.25);
  mouth.add(smile);
  head.add(mouth);

  // Arms pivot at the shoulder rather than rotating around their middle.
  const arms: THREE.Group[] = [];
  for (const x of [-0.88, 0.88]) {
    const arm = new THREE.Group();
    arm.position.set(x, 1.45, 0.02);
    arm.rotation.z = x < 0 ? 0.20 : -0.20;
    root.add(arm);

    const upper = sphere(new THREE.CapsuleGeometry(0.22, 0.68, 10, 18), black);
    upper.position.y = -0.35;
    arm.add(upper);

    const paw = sphere(new THREE.SphereGeometry(0.25, 24, 18), black);
    paw.scale.set(1, 0.82, 1.08);
    paw.position.set(0, -0.78, 0.05);
    arm.add(paw);
    arms.push(arm);
  }

  // Leg chains are vertical and anchored at the hips. Feet have a separate planted pivot.
  const legs: THREE.Group[] = [];
  const feet: THREE.Mesh[] = [];
  const footPivots: THREE.Group[] = [];
  for (const x of [-0.47, 0.47]) {
    const hip = new THREE.Group();
    hip.position.set(x, 0.70, 0.02);
    root.add(hip);

    const shin = sphere(new THREE.CapsuleGeometry(0.27, 0.58, 10, 18), black);
    shin.position.y = -0.34;
    hip.add(shin);

    const ankle = new THREE.Group();
    ankle.position.set(0, -0.68, 0.04);
    hip.add(ankle);

    const foot = sphere(new THREE.SphereGeometry(0.34, 28, 20), black);
    foot.scale.set(1.12, 0.56, 1.45);
    foot.position.set(0, -0.08, 0.19);
    ankle.add(foot);

    legs.push(hip);
    feet.push(foot);
    footPivots.push(ankle);
  }

  const tail = sphere(new THREE.SphereGeometry(0.22, 22, 16), white);
  tail.position.set(0, 1.02, -0.76);
  root.add(tail);

  const bamboo = new THREE.Group();
  const bambooStem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.95, 10), accent);
  bambooStem.rotation.z = -0.48;
  bambooStem.position.set(0.24, 0.1, 0.5);
  bamboo.add(bambooStem);
  for (let i = 0; i < 3; i += 1) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.10, 12, 8), accent);
    leaf.scale.set(1.8, 0.42, 0.7);
    leaf.rotation.z = i % 2 ? 0.45 : -0.45;
    leaf.position.set(0.24 + (i - 1) * 0.16, 0.28 + i * 0.15, 0.5);
    bamboo.add(leaf);
  }
  bamboo.visible = false;
  root.add(bamboo);

  const remote = new THREE.Group();
  const remoteBody = sphere(new THREE.BoxGeometry(0.27, 0.48, 0.12), accent);
  remote.add(remoteBody);
  remote.position.set(0.9, 1.02, 0.55);
  remote.rotation.z = -0.2;
  root.add(remote);

  return {
    root, body, head,
    leftArm: arms[0], rightArm: arms[1],
    leftLeg: legs[0], rightLeg: legs[1],
    leftFoot: feet[0], rightFoot: feet[1],
    leftFootPivot: footPivots[0], rightFootPivot: footPivots[1],
    leftEar: ears[0], rightEar: ears[1],
    leftEye: eyes[0], rightEye: eyes[1],
    leftEyePatch: eyePatches[0], rightEyePatch: eyePatches[1],
    remote,
    bamboo,
    leftPupil: eyes[0],
    rightPupil: eyes[1],
  };
}
