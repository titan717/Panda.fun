#!/usr/bin/env node
/**
 * Single-source Panda.fun icon export.
 * assets/panda-icon.svg and assets/panda-icon-maskable.svg are the artwork
 * sources; scripts/generate-icons.py rasterises them for web/PWA and Android.
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = __dirname;
const result = spawnSync('python3', [path.join(root, 'scripts/generate-icons.py')], {
  cwd: root,
  stdio: 'inherit',
});

if (result.error) {
  console.error('Could not run the Panda.fun icon exporter. Install Python 3, CairoSVG and Pillow first.');
  console.error(result.error.message);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status || 1);
