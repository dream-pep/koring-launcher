//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ \ \  /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

/**
 * gen-env.js - 打包前生成 build/.env（随包分发的主进程环境变量）
 *
 * 背景：Vite 的 `.env` / `.env.<mode>` 只会把 `VITE_*` 注入**渲染端** bundle，
 * 主进程（Node）读不到；而 Account API 的密钥与地址必须在主进程使用，
 * 所以打包时把当前模式的环境文件链合并成一份 `build/.env`，
 * 由 electron-builder 的 extraResources 复制到 `resources/.env`，
 * 运行时由 electron/core/env.ts 读取（`<resources>/.env` + `<userData>/.env`）。
 *
 * 用法：node scripts/gen-env.js <dev|beta|run>
 * 合并顺序（后者覆盖前者，与运行时 electron/core/env.ts 的 dev 顺序一致）：
 *   .env → .env.<文件后缀> → .env.local
 * 其中构建模式与 env 文件后缀的对应关系（与 Vite --mode 一致）：
 *   dev → .env.development | beta → .env.beta | run → .env.production
 *
 * ⚠️ 生成的 build/.env 会包含密钥，切勿提交（build/ 已在 .gitignore 中）。
 */
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('fs');
const { join } = require('path');

const mode = process.argv[2];
const validModes = ['dev', 'beta', 'run'];
/** 构建模式 → env 文件后缀（Vite 约定） */
const MODE_FILE_SUFFIX = { dev: 'development', beta: 'beta', run: 'production' };

if (!mode || !validModes.includes(mode)) {
  console.error(`Usage: node scripts/gen-env.js <${validModes.join('|')}>`);
  process.exit(1);
}

const root = join(__dirname, '..');
const buildDir = join(root, 'build');
const outFile = join(buildDir, '.env');

/** 解析一份 env 文件 → [key, value] 列表（与 electron/core/env.ts 的解析规则一致） */
function parseEnvFile(file) {
  const entries = [];
  const text = readFileSync(file, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    entries.push([key, value]);
  }
  return entries;
}

const candidates = ['.env', `.env.${MODE_FILE_SUFFIX[mode]}`, '.env.local'].map((name) =>
  join(root, name)
);
const merged = new Map();
const used = [];

for (const file of candidates) {
  if (!existsSync(file)) continue;
  used.push(file.split(/[\\/]/).pop());
  for (const [key, value] of parseEnvFile(file)) {
    merged.set(key, value);
  }
}

const header = [
  `# 由 scripts/gen-env.js 生成（mode=${mode}）——来源：${used.join(' → ') || '无'}`,
  '# 主进程运行时读取；现场可用 <userData>/.env 覆盖对应键',
  '',
].join('\n');

const body = [...merged.entries()].map(([k, v]) => `${k}=${v}`).join('\n');
mkdirSync(buildDir, { recursive: true });
writeFileSync(outFile, header + body + '\n', 'utf8');

const keys = [...merged.keys()];
console.log(
  `[gen-env] mode=${mode} → build/.env（来源：${used.join(' → ') || '未找到 env 文件'}；键：${keys.join(', ') || '无'}）`
);
