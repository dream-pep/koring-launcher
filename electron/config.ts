import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import electron from 'electron';
import { createLogger } from './core/logger';
const { app } = electron;

const log = createLogger('config');

const CONFIG_FILE = 'Koring.yml';
const CURRENT_VERSION = 1;

/**
 * 配置文件路径：
 * - 打包后 → 系统用户数据目录（userData）。
 *   ⚠️ 不能放安装目录：NSIS 每次重装/升级都会经旧卸载器 RMDir /r 删除整个安装目录，
 *   /KEEP_APP_DATA 只保护 %APPDATA%（userData），安装目录内的配置文件会被清空
 * - 开发模式 → 项目根目录（与旧行为一致，方便调试）
 */
export function configPath(): string {
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), CONFIG_FILE);
  }
  return path.join(__dirname, '..', CONFIG_FILE);
}

export interface ThemeConfig {
  darkMode: string;
  parallax: boolean;
}

export interface A11yConfig {
  reduceMotion: boolean;
  reduceTransparency: boolean;
  highContrast: boolean;
  contentBlurOpacity: number;
}

export interface BackgroundConfig {
  bgType: string;
  image: string;
  blur: number;
  opacity: number;
}

export interface GameConfig {
  gameDir: string;
  resourceDir: string;
  savesDir: string;
  instancesDir: string;
  /** 已添加的游戏目录列表 */
  gameDirs: string[];
}

export interface JavaConfig {
  javaPath: string;
  memMode: string;
  memGB: number;
  gc: string;
  jvmArgs: string;
}

export interface ServerConfig {
  ip: string;
  port: number;
}

export interface AdvancedConfig {
  afterLaunch: string;
  winMode: string;
  customWidth: number;
  customHeight: number;
  gameArgs: string;
  preLaunchCmd: string;
  debugMode: boolean;
  /** 快速进入服务器（启动后自动加入；ip 为空则不自动加入） */
  server: ServerConfig;
}

export interface AppInfoConfig {
  /** 界面语言偏好（zh-CN | en-US）；语言包开发中，暂仅保存并设置 <html lang> */
  language: string;
}

export interface UiConfig {
  /** 首页实例标题显示 */
  showInstanceTitle: boolean;
  /** 标题栏任务队列按钮显示 */
  showTaskButton: boolean;
}

export interface DownloadConfig {
  fileSource: string;
  versionSource: string;
  threads: number;
  speedLimit: number;
}

export interface SecurityIdConfig {
  enabled: boolean;
  authUrl: string;
}

export interface InstanceMeta {
  name: string;
  displayName: string;
  icon: string;
  gameVersion: string;
  loader: string;
  loaderVersion: string;
  createdAt: number;
  lastPlayed: number;
  playtime: number;
}

export interface NetworkConfig {
  securityId: SecurityIdConfig;
}

/** 更新进度持久化（主进程 updater 写入；重启后可恢复/展示） */
export interface UpdateConfig {
  /** 状态：idle/checking/available/not-available/downloading/paused/downloaded/installing/error */
  state: string;
  /** 目标版本号 */
  version: string;
  /** 下载进度百分比 0-100 */
  percent: number;
  transferred: number;
  total: number;
  /** 更新源：github / 加速源域名 */
  source: string;
  /** 更新通道：woker（慢走，仅正式版）/ runner（跑步，含预览版） */
  channel: string;
  error: string;
}

export interface AppConfig {
  /** 配置结构版本（迁移用） */
  version: number;
  /** 当前应用版本号（app.getVersion()，每次启动刷新；配置文件自述用） */
  appVersion: string;
  oobe: boolean;
  app: AppInfoConfig;
  theme: ThemeConfig;
  a11y: A11yConfig;
  background: BackgroundConfig;
  game: GameConfig;
  java: JavaConfig;
  advanced: AdvancedConfig;
  download: DownloadConfig;
  network: NetworkConfig;
  ui: UiConfig;
  update: UpdateConfig;
  instances: InstanceMeta[];
}

const DEFAULTS: AppConfig = {
  version: CURRENT_VERSION,
  appVersion: '',
  oobe: true,
  app: { language: 'zh-CN' },
  theme: { darkMode: 'auto', parallax: true },
  a11y: { reduceMotion: false, reduceTransparency: false, highContrast: false, contentBlurOpacity: 50 },
  background: { bgType: 'image', image: '/background.png', blur: 0, opacity: 100 },
  game: { gameDir: '.minecraft', resourceDir: '', savesDir: '', instancesDir: '.minecraft/instances', gameDirs: [] },
  java: { javaPath: '', memMode: 'auto', memGB: 4, gc: 'auto', jvmArgs: '' },
  advanced: { afterLaunch: 'close', winMode: 'default', customWidth: 854, customHeight: 480, gameArgs: '', preLaunchCmd: '', debugMode: false, server: { ip: '', port: 25565 } },
  download: { fileSource: 'mirror', versionSource: 'mirror', threads: 16, speedLimit: 0 },
  network: { securityId: { enabled: false, authUrl: '' } },
  ui: { showInstanceTitle: true, showTaskButton: true },
  update: { state: 'idle', version: '', percent: 0, transferred: 0, total: 0, source: 'github', channel: 'woker', error: '' },
  instances: [],
};

function migrate(config: AppConfig): AppConfig {
  if (config.version < 1) {
    config.version = 1;
  }
  return config;
}

function diffValue(full: unknown, defaultVal: unknown): unknown {
  if (full === null || full === undefined) return undefined;
  if (typeof full !== 'object' || typeof defaultVal !== 'object') {
    return full === defaultVal ? undefined : full;
  }
  if (Array.isArray(full) && Array.isArray(defaultVal)) {
    return JSON.stringify(full) === JSON.stringify(defaultVal) ? undefined : full;
  }
  if (Array.isArray(full) !== Array.isArray(defaultVal)) return full;

  const fullObj = full as Record<string, unknown>;
  const defaultObj = defaultVal as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(fullObj)) {
    const d = diffValue(fullObj[key], defaultObj[key]);
    if (d !== undefined) {
      result[key] = d;
    }
  }

  return Object.keys(result).length === 0 ? undefined : result;
}

export function configExists(): boolean {
  try {
    return fs.existsSync(configPath());
  } catch {
    return false;
  }
}

export function loadConfig(): AppConfig {
  const filePath = configPath();
  if (!fs.existsSync(filePath)) {
    return { ...DEFAULTS };
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    if (!raw.trim()) return { ...DEFAULTS };
    const parsed = yaml.load(raw) as Partial<AppConfig>;
    const config = migrate({ ...DEFAULTS, ...parsed } as AppConfig);
    config.version = CURRENT_VERSION;
    return config;
  } catch {
    return { ...DEFAULTS };
  }
}

/**
 * 保存配置（稀疏：仅写与默认值不同的部分）。
 * - force=true：全量写入（首次启动使用，保证配置文件在安装目录可见）
 * - 稀疏结果为空时：保留现有文件不删（重置由 config:reset / factoryReset 显式删除）
 */
export function saveConfig(config: AppConfig, force = false): void {
  const filePath = configPath();
  const sparse = diffValue(config, DEFAULTS) as Record<string, unknown> | undefined;
  log.debug(`saveConfig → ${filePath} (force=${force}, 稀疏键=${sparse ? Object.keys(sparse).length : 0})`);

  if (!sparse || Object.keys(sparse).length === 0) {
    if (force) {
      fs.writeFileSync(filePath, yaml.dump(config, { lineWidth: -1 }), 'utf-8');
    }
    return;
  }

  const yamlStr = yaml.dump(sparse, { lineWidth: -1 });
  fs.writeFileSync(filePath, yamlStr, 'utf-8');
}

// ==================== 主进程权威配置模型 ====================
// 主进程内存缓存是唯一权威（single source of truth）：
// 渲染进程通过 config:update 提交补丁 → updateConfig 合并 → debounce 稀疏写盘
// 启动游戏时直接读内存缓存，保证永远是最新配置（无磁盘竞争）。

let current: AppConfig | null = null;

function mergeDeep<T>(base: T, patch: unknown): T {
  if (patch === null || patch === undefined) return base;
  if (typeof base !== 'object' || typeof patch !== 'object' || Array.isArray(base) || Array.isArray(patch)) {
    return patch as T;
  }
  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const key of Object.keys(patch as Record<string, unknown>)) {
    result[key] = mergeDeep(result[key], (patch as Record<string, unknown>)[key]);
  }
  return result as T;
}

/** 读取当前配置（内存优先，未加载则从磁盘读取） */
export function getConfig(): AppConfig {
  if (!current) {
    current = loadConfig();
    // 注意：不在此处刷新 appVersion —— 升级后保持旧版本号，
    // 由渲染端 upvp（版本更新引导）流程完成后写入新版本号
  }
  return current;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    flushConfig();
  }, 300);
}

/** 立即将内存配置写盘（应用退出前调用） */
export function flushConfig(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (current) {
    log.debug('flushConfig：内存配置落盘');
    saveConfig(current);
  }
}

/** 深度合并补丁到内存配置并返回合并结果（300ms debounce 写盘） */
export function updateConfig(patch: Record<string, unknown>): AppConfig {
  const base = getConfig();
  current = mergeDeep(base, patch) as AppConfig;
  log.debug('config:update 补丁顶层键', Object.keys(patch ?? {}));
  scheduleSave();
  return current;
}

/** 删除内存配置中的指定顶层键（如 koringUser），300ms debounce 写盘 */
export function deleteConfigKey(key: string): AppConfig {
  const base = getConfig();
  const next = { ...(base as unknown as Record<string, unknown>) };
  delete next[key];
  current = next as unknown as AppConfig;
  log.debug(`config:delete 顶层键 ${key}`);
  scheduleSave();
  return current;
}
