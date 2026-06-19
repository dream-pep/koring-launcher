import { cpSync, existsSync } from "fs";
import { join } from "path";

const mode = process.argv[2];
const validModes = ["dev", "beta", "run"];

if (!mode || !validModes.includes(mode)) {
  console.error(`Usage: node scripts/switch-icon.js <${validModes.join("|")}>`);
  process.exit(1);
}

const root = join(import.meta.dirname, "..");
const publicDir = join(root, "public");
const iconsDir = join(root, "src-tauri", "icons");

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

cpSync(png, join(iconsDir, "icon.png"), { overwrite: true });
cpSync(ico, join(iconsDir, "icon.ico"), { overwrite: true });
cpSync(png, join(iconsDir, "32x32.png"), { overwrite: true });
cpSync(png, join(iconsDir, "128x128.png"), { overwrite: true });
cpSync(png, join(iconsDir, "128x128@2x.png"), { overwrite: true });

console.log(`[switch-icon] Mode: ${mode} → icons updated`);
