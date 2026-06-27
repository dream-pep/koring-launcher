const { cpSync, existsSync } = require('fs');
const { join } = require('path');

const mode = process.argv[2];
const validModes = ['dev', 'beta', 'run'];

if (!mode || !validModes.includes(mode)) {
  console.error(`Usage: node scripts/switch-icon.js <${validModes.join('|')}>`);
  process.exit(1);
}

const root = join(__dirname, '..');
const publicDir = join(root, 'public');

const png = join(publicDir, `${mode}.png`);
const ico = join(publicDir, `${mode}.ico`);

if (!existsSync(png)) {
  console.error(`Icon not found: ${png}`);
  process.exit(1);
}
if (!existsSync(ico)) {
  console.error(`Icon not found: ${ico}`);
  process.exit(1);
}

cpSync(png, join(publicDir, 'icon.png'), { overwrite: true });
cpSync(ico, join(publicDir, 'icon.ico'), { overwrite: true });

console.log(`[switch-icon] Mode: ${mode} → icon.png + icon.ico updated`);
