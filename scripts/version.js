const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');

const root = join(__dirname, '..');
const pkgPath = join(root, 'package.json');

function getCurrentVersion() {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  return pkg.version;
}

function setVersion(version) {
  // Update package.json
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  pkg.version = version;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  console.log(`Version updated to ${version}`);
  console.log(`  - package.json`);
}

// Parse args
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`Current version: ${getCurrentVersion()}`);
  process.exit(0);
}

if (args[0] === '--help' || args[0] === '-h') {
  console.log('Usage:');
  console.log('  node scripts/version.js <version>    Set version');
  console.log('  node scripts/version.js              Show current version');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/version.js 1.0.0');
  console.log('  node scripts/version.js 1.1.0-beta.1');
  console.log('  node scripts/version.js 2.0.0-rc.1');
  process.exit(0);
}

const newVersion = args[0];

// Validate semver-ish format
if (!/^\d+\.\d+\.\d+/.test(newVersion)) {
  console.error(`Invalid version: ${newVersion}`);
  console.error('Expected format: x.y.z or x.y.z-tag');
  process.exit(1);
}

const current = getCurrentVersion();
console.log(`Current version: ${current}`);
setVersion(newVersion);
