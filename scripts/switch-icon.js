const { cpSync, existsSync, mkdirSync } = require('fs');
const { join } = require('path');

const mode = process.argv[2];
const validModes = ['dev', 'beta', 'run'];

if (!mode || !validModes.includes(mode)) {
  console.error(`Usage: node scripts/switch-icon.js <${validModes.join('|')}>`);
  process.exit(1);
}

const root = join(__dirname, '..');
const srcDir = join(root, 'public', 'icons', mode);
const buildDir = join(root, 'build');

const png = join(srcDir, 'icon.png');
const ico = join(srcDir, 'icon.ico');

if (!existsSync(png)) {
  console.error(`Icon not found: ${png}`);
  process.exit(1);
}
if (!existsSync(ico)) {
  console.error(`Icon not found: ${ico}`);
  process.exit(1);
}

mkdirSync(buildDir, { recursive: true });

cpSync(png, join(buildDir, 'icon.png'), { overwrite: true });
cpSync(ico, join(buildDir, 'icon.ico'), { overwrite: true });

console.log(`[switch-icon] Mode: ${mode} → build/icon.png + build/icon.ico updated`);
