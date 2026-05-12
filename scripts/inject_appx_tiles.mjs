/**
 * inject_appx_tiles.mjs
 * After electron-builder creates the APPX, this script replaces the
 * auto-generated (potentially default-looking) tile images with our
 * branded ones from build/appx-tiles/.
 *
 * APPX files are ZIP archives — we unzip, replace images, rezip.
 *
 * Usage (on Windows): node scripts/inject_appx_tiles.mjs
 */

import fs   from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// ── locate APPX ──────────────────────────────────────────────────────────────
const APPX_DIR   = 'dist/windows-store';
const TILES_DIR  = 'build/appx-tiles';
const WORK_DIR   = 'dist/windows-store/_appx_work';

const appxFile = fs.readdirSync(APPX_DIR).find(f => f.endsWith('.appx'));
if (!appxFile) { console.error('No .appx found in dist/windows-store/'); process.exit(1); }

const appxPath = path.join(APPX_DIR, appxFile);
console.log(`\nPatching: ${appxPath}`);

// ── unpack ───────────────────────────────────────────────────────────────────
if (fs.existsSync(WORK_DIR)) fs.rmSync(WORK_DIR, { recursive: true });
fs.mkdirSync(WORK_DIR, { recursive: true });

// Expand-Archive only accepts .zip — rename to .zip, expand, rename back
const zipPath = appxPath.replace('.appx', '.zip');
fs.copyFileSync(appxPath, zipPath);
execSync(`powershell -Command "Expand-Archive -Force '${zipPath}' '${WORK_DIR}'"`, { stdio: 'inherit' });
fs.unlinkSync(zipPath);
console.log('  ✓ Unpacked');

// ── find and replace tile images ─────────────────────────────────────────────
// Tile images live in various subfolders inside APPX, named like:
// Square150x150Logo.scale-100.png, Square44x44Logo.targetsize-44.png etc.
// We replace ALL files whose base name starts with a known tile prefix.

const TILE_MAP = {
  'StoreLogo':          'StoreLogo.png',
  'Square44x44Logo':    'Square44x44Logo.png',
  'Square71x71Logo':    'Square71x71Logo.png',
  'Square150x150Logo':  'Square150x150Logo.png',
  'Square310x310Logo':  'Square310x310Logo.png',
  'Wide310x150Logo':    'Wide310x150Logo.png',
};

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { walk(full); continue; }
    if (!e.name.endsWith('.png')) continue;

    for (const [prefix, src] of Object.entries(TILE_MAP)) {
      if (e.name.startsWith(prefix)) {
        const srcPath = path.join(TILES_DIR, src);
        if (!fs.existsSync(srcPath)) break;

        // Resize our source tile to match required dimensions encoded in filename
        // e.g. Square150x150Logo.scale-200.png → 300×300 (scale-200 = 2×)
        // We just copy our best-match size — MS generates scale variants from base
        fs.copyFileSync(srcPath, full);
        console.log(`  ✓ Replaced ${e.name}`);
        break;
      }
    }
  }
}

walk(WORK_DIR);

// ── repack ───────────────────────────────────────────────────────────────────
// Compress-Archive only produces .zip — compress to .zip then rename to .appx
const repackedZip = appxPath.replace('.appx', '-repacked.zip');
if (fs.existsSync(repackedZip)) fs.unlinkSync(repackedZip);

execSync(
  `powershell -Command "Compress-Archive -Force -Path '${WORK_DIR}\\*' -DestinationPath '${repackedZip}'"`,
  { stdio: 'inherit' }
);

// Replace original .appx with repacked zip renamed to .appx
fs.unlinkSync(appxPath);
fs.renameSync(repackedZip, appxPath);
fs.rmSync(WORK_DIR, { recursive: true });

console.log(`\n✅ Done — patched APPX: ${appxPath}`);
