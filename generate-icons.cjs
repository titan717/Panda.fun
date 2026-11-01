#!/usr/bin/env node
/**
 * Single-source Panda.fun icon export.
 * assets/panda-icon.svg is the single icon artwork source; the exporter derives
 * maskable, density-specific, web/PWA and Android raster variants from it.
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = __dirname;
const python = process.env.PYTHON || 'python3';
const check = spawnSync(python, ['-c', 'import cairosvg; from PIL import Image'], { cwd: root, stdio: 'ignore' });

if (check.status !== 0) {
  console.log('Installing the one-time SVG export tools (CairoSVG and Pillow)…');
  const install = spawnSync(python, ['-m', 'pip', 'install', '--user', 'CairoSVG', 'Pillow'], {
    cwd: root,
    stdio: 'inherit',
  });
  if (install.error || install.status !== 0) {
    console.error('Could not install CairoSVG and Pillow. Install them with: python3 -m pip install --user CairoSVG Pillow');
    process.exit(1);
  }
}

const result = spawnSync(python, [path.join(root, 'scripts/generate-icons.py')], {
  cwd: root,
  stdio: 'inherit',
});

if (result.error) {
  console.error('Could not run the Panda.fun icon exporter.');
  console.error(result.error.message);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status || 1);
