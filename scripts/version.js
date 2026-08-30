const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');

const root = join(__dirname, '..');
const pkgPath = join(root, 'package.json');

function getCurrentVersion() {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  return pkg.version;
}

/** 仅写文件，不打印（stdout 纯净，供脚本/CI 捕获） */
function setVersion(version) {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  pkg.version = version;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

// Parse args
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`Current version: ${getCurrentVersion()}`);
  process.exit(0);
}

// 输出裸版本号（供脚本/CI 使用）
if (args[0] === 'get') {
  console.log(getCurrentVersion());
  process.exit(0);
}

// 构建版本：统一「base + 构建号」规则，消除本地/CI 版本双轨
//   version.js build ci [buildId] [base]   CI：base 缺省读 package.json → 设置并输出 base-buildId
//   version.js build local                 本地：输出当前 base（不修改）
if (args[0] === 'build') {
  const kind = args[1];
  if (kind === 'ci') {
    const buildId = args[2] || process.env.GITHUB_RUN_NUMBER || '0';
    const base = args[3] || getCurrentVersion();
    const full = `${base}-${buildId}`;
    setVersion(full);
    console.log(full); // stdout 仅版本号
    process.exit(0);
  }
  if (kind === 'local') {
    console.log(getCurrentVersion());
    process.exit(0);
  }
  console.error('Usage: node scripts/version.js build ci [buildId] [base] | node scripts/version.js build local');
  process.exit(1);
}

if (args[0] === '--help' || args[0] === '-h') {
  console.log('Usage:');
  console.log('  node scripts/version.js <version>    Set version');
  console.log('  node scripts/version.js              Show current version');
  console.log('  node scripts/version.js get          Print raw version');
  console.log('  node scripts/version.js build ci [buildId] [base]   CI build version (base-buildId)');
  console.log('  node scripts/version.js build local                Print local base version');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/version.js 1.0.0');
  console.log('  node scripts/version.js 1.1.0-beta.1');
  console.log('  node scripts/version.js build ci 12');
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
console.log(`Version updated to ${newVersion}`);
console.log('  - package.json');
