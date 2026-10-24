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
  /**
   * 共享资源目录（可选）：versions / libraries / assets 从该目录读取。
   * 留空表示各实例自包含（实例目录内的 versions/libraries/assets）。
   * 启动解析顺序：实例 resourcePath → 实例目录 → 此处配置的共享目录。
   */
  resourceDir: string;
  /** 已添加的游戏目录列表 */
  gameDirs: string[];
  /**
   * 目录显示名（重命名）：key = 规范化后的绝对路径，value = 用户自定义名称。
   * 仅影响设置页/启动器展示，不改变磁盘路径。
   */
  dirAliases: Record<string, string>;
}

export interface JavaConfig {
  javaPath: string;
  /** 自动选择 Java：开启后忽略 javaPath，按实例的 Minecraft 版本挑选最合适的运行时 */
  autoJavaPath: boolean;
  memMode: string;
  memGB: number;
  /** 初始内存 -Xms（GB）；0 = 不主动设置（沿用实例的最小内存） */
  initialMemGB: number;
  /** 锁定内存：令 -Xms = -Xmx，固定堆大小（减少延迟抖动，代价是全程占用接近最大分配） */
  lockMemory: boolean;
  /** IP 协议偏好：ipv4 / default / ipv6 → 追加 -Djava.net.preferIPv4Stack / preferIPv6Stack */
  preferredIpStack: string;
  /** 用 java.exe 替代 javaw.exe（能看到控制台输出，便于排查启动问题） */
  useJavaExe: boolean;
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
  /** 首页实例标题下的副信息：version（版本）/ loader（加载器）/ playtime（游玩时长）/ none */
  homeTitleDetail: string;
  /** 首页启动按钮下方的快捷入口（选择实例 / 打开目录） */
  showQuickActions: boolean;
}

/**
 * 激活状态（OOBE / 启动校验结果落盘）：
 * - versionOk：版本策略校验通过（未被禁激活、无强制升级）
 * - deviceOk：设备已登记且未被拉黑
 * 两者同时为真才算「完成激活」（step-finish 与启动门禁据此放行）。
 */
export interface ActivationConfig {
  versionOk: boolean;
  deviceOk: boolean;
  /** 最近一次校验时间戳（ms） */
  checkedAt: number;
  /** 最近一次校验时的程序版本 */
  version: string;
  /** 最近一次禁激活 / 黑名单原因（展示用） */
  reason: string;
  /** 最近一次版本策略要求的升级目标版本（供更新页优先选用） */
  upgradeTarget: string;
}

/**
 * 下载配置：主进程所有安装 / 依赖补齐的唯一来源。
 * 旧的 fileSource / versionSource / speedLimit 已废弃：
 * - fileSource + versionSource 合并为统一的 source
 * - speedLimit 删除（@xmcl/file-transfer 无带宽限制能力，保留会变成假设置）
 */
export interface DownloadConfig {
  /** 下载源：official | bmclapi | custom */
  source: string;
  /** 并发线程数（1-64），同时作用于 libraries 与 assets */
  threads: number;
  /** 自定义源：版本清单地址 */
  customVersionManifest: string;
  /** 自定义源：Maven 仓库根地址 */
  customMavenHost: string;
  /** 自定义源：资源文件根地址 */
  customAssetsHost: string;
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
  activation: ActivationConfig;
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
  game: { gameDir: '.minecraft', resourceDir: '', gameDirs: [], dirAliases: {} },
  java: {
    javaPath: '',
    autoJavaPath: true,
    memMode: 'auto',
    memGB: 4,
    initialMemGB: 0,
    lockMemory: false,
    preferredIpStack: 'default',
    useJavaExe: false,
    gc: 'auto',
    jvmArgs: '',
  },
  advanced: { afterLaunch: 'close', winMode: 'default', customWidth: 854, customHeight: 480, gameArgs: '', preLaunchCmd: '', debugMode: false, server: { ip: '', port: 25565 } },
  download: { source: 'bmclapi', threads: 16, customVersionManifest: '', customMavenHost: '', customAssetsHost: '' },
  network: { securityId: { enabled: false, authUrl: '' } },
  ui: { showInstanceTitle: true, showTaskButton: true, homeTitleDetail: 'version', showQuickActions: true },
  activation: { versionOk: false, deviceOk: false, checkedAt: 0, version: '', reason: '', upgradeTarget: '' },
  update: { state: 'idle', version: '', percent: 0, transferred: 0, total: 0, source: 'github', channel: 'woker', error: '' },
  instances: [],
};

function migrate(config: AppConfig): AppConfig {
  if (config.version < 1) {
    config.version = 1;
  }

  // 下载配置迁移：fileSource / versionSource / speedLimit → source + threads
  const legacy = config.download as unknown as {
    fileSource?: string;
    versionSource?: string;
    speedLimit?: number;
    source?: string;
    threads?: number;
    customVersionManifest?: string;
    customMavenHost?: string;
    customAssetsHost?: string;
  };
  if (!legacy.source) {
    const raw = legacy.fileSource || legacy.versionSource;
    legacy.source = raw === 'official' ? 'official' : 'bmclapi';
  }
  config.download = {
    source: legacy.source === 'official' || legacy.source === 'custom' ? legacy.source : 'bmclapi',
    threads: Math.min(64, Math.max(1, Number(legacy.threads) || DEFAULTS.download.threads)),
    customVersionManifest: legacy.customVersionManifest || '',
    customMavenHost: legacy.customMavenHost || '',
    customAssetsHost: legacy.customAssetsHost || '',
  };

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
    // 用 mergeDeep 补齐嵌套默认值：旧配置文件缺少新键时不会变成 undefined
    const config = migrate(mergeDeep(DEFAULTS, parsed) as AppConfig);
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
