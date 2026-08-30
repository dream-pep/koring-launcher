/**
 * 生成构建元数据文件 src/lib/buildInfo.ts（CI 构建时调用）。
 *
 * 用法：
 *   node scripts/gen-build-info.js <mode>        # mode: dev | beta | run
 *
 * 环境变量：
 *   BUILD_ID   编译号（CI 传 GITHUB_RUN_NUMBER；缺省 "local"）
 * 本地 git HEAD 短哈希作为构建来源 commit。
 */
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const mode = process.argv[2] || 'run';

let commit = '';
try {
  commit = execSync('git rev-parse --short HEAD').toString().trim();
} catch {
  /* 非 git 环境，保持空 */
}

const buildId = process.env.BUILD_ID || process.env.GITHUB_RUN_NUMBER || 'local';

const content = `// 构建元数据：由 scripts/gen-build-info.js 自动生成（CI 覆盖；本地开发为默认值）
export const BUILD_COMMIT: string = ${JSON.stringify(commit)};
export const BUILD_ID: string = ${JSON.stringify(buildId)};
`;

fs.writeFileSync(path.join(__dirname, '..', 'src', 'lib', 'buildInfo.ts'), content);
console.log(`[build-info] mode=${mode} commit=${commit || '(none)'} buildId=${buildId}`);
