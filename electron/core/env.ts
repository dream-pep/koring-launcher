/**
 * 主进程环境变量（.env）加载。
 *
 * 为什么主进程需要自己读：Vite 只把 `.env*` 里的 `VITE_*` 注入**渲染端** bundle，
 * 主进程是 tsc 编译 + Node 运行，`process.env` 里只有操作系统真实环境变量。
 * 而 Account API 的密钥/地址必须在主进程使用（打包后渲染进程 origin 是 file://，
 * 直连会被 CORS 拦截；密钥也不应进入渲染层）。
 *
 * 分层与优先级（先命中者生效，真实环境变量始终最高）：
 *   1. 操作系统环境变量（CI / 运维注入）
 *   2. 未打包（开发）：<项目根>/.env → .env.development → .env.local
 *      打包：<resources>/.env → <userData>/.env（现场覆盖，重装不丢）
 *   3. 未配置时会话：取值为空，由使用方给出明确报错
 *
 * 解析规则：极简 dotenv（KEY=VALUE、# 注释、可带引号），不引入额外依赖。
 */
import * as fs from 'fs';
import * as path from 'path';
import electron from 'electron';
import { createLogger } from './logger';

const { app } = electron;

const log = createLogger('core/env');

/** 进程启动前就已存在的真实环境变量（这些键不允许被 .env 覆盖） */
let presetKeys: Set<string> | null = null;
let loadedFiles: string[] = [];

function candidateFiles(): string[] {
  if (!app.isPackaged) {
    const root = path.join(__dirname, '..', '..');
    return [path.join(root, '.env'), path.join(root, '.env.development'), path.join(root, '.env.local')];
  }
  const files = [path.join(process.resourcesPath, '.env')];
  try {
    files.push(path.join(app.getPath('userData'), '.env'));
  } catch {
    /* userData 不可用时忽略 */
  }
  return files;
}

function loadFile(file: string, preset: Set<string>): boolean {
  let text: string;
  try {
    if (!fs.existsSync(file)) return false;
    text = fs.readFileSync(file, 'utf-8');
  } catch (e) {
    log.warn(`[env] 读取 ${file} 失败：${String(e)}`);
    return false;
  }

  let count = 0;
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
    if (preset.has(key)) continue; // 真实环境变量优先
    process.env[key] = value;
    count += 1;
  }
  log.debug(`[env] 已加载 ${file}（${count} 个键）`);
  return true;
}

/** 加载 .env（幂等；在 main.ts 启动最早期调用一次即可，其他模块按需读取） */
export function loadEnv(): string[] {
  if (presetKeys) return loadedFiles;
  presetKeys = new Set(Object.keys(process.env));
  loadedFiles = [];
  for (const file of candidateFiles()) {
    if (loadFile(file, presetKeys)) loadedFiles.push(file);
  }
  log.info(`[env] 加载完成：${loadedFiles.length ? loadedFiles.join(' / ') : '未找到 .env 文件'}`);
  return loadedFiles;
}

/** 读取环境变量（未加载时自动加载一次）；缺失返回空串 */
export function getEnv(key: string): string {
  if (!presetKeys) loadEnv();
  return (process.env[key] ?? '').trim();
}

/** 读取并规范化基址（去掉末尾斜杠）；缺失返回空串 */
export function getEnvBase(key: string): string {
  return getEnv(key).replace(/\/+$/, '');
}
