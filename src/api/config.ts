import { ipcInvoke, onIpcEvent } from './ipc';

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
  /** 共享资源目录（可选）：versions / libraries / assets 从该目录读取；留空表示各实例自包含 */
  resourceDir: string;
  /** 已添加的游戏目录列表 */
  gameDirs: string[];
  /** 当前选中的实例 ID（空 = 未选择）；首页启动与实例页「选择该版本」共用同一个值 */
  selectedInstance: string;
  /** 目录显示名（重命名）：key = 规范化路径，value = 自定义名称；只影响展示 */
  dirAliases: Record<string, string>;
}

export interface JavaConfig {
  javaPath: string;
  /** 自动选择 Java：开启后忽略 javaPath，按实例的 Minecraft 版本挑选最合适的运行时 */
  autoJavaPath: boolean;
  memMode: string;
  memGB: number;
  /** 初始内存 -Xms（GB）；0 = 不主动设置 */
  initialMemGB: number;
  /** 锁定内存：-Xms = -Xmx */
  lockMemory: boolean;
  /** IP 协议偏好：ipv4 / default / ipv6 */
  preferredIpStack: string;
  /** 用 java.exe 替代 javaw.exe */
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

/** 激活状态（OOBE / 启动校验结果，见 electron/config.ts 同名段） */
export interface ActivationConfig {
  versionOk: boolean;
  deviceOk: boolean;
  checkedAt: number;
  version: string;
  reason: string;
  upgradeTarget: string;
}

export interface DownloadConfig {
  /** 下载源：official（官方） | bmclapi（BMCLAPI 镜像，默认） | custom（自定义镜像地址） */
  source: string;
  /** 并发下载线程数（1–64） */
  threads: number;
  /** 自定义源的版本清单地址 */
  customVersionManifest: string;
  /** 自定义源的 Maven 仓库地址 */
  customMavenHost: string;
  /** 自定义源的 Assets 地址 */
  customAssetsHost: string;
}

export interface SecurityIdConfig {
  enabled: boolean;
  authUrl: string;
}

export interface NetworkConfig {
  securityId: SecurityIdConfig;
}

/** 更新进度持久化（主进程 updater 写入） */
export interface UpdateConfig {
  state: string;
  version: string;
  percent: number;
  transferred: number;
  total: number;
  source: string;
  channel: string;
  error: string;
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

export interface AppConfig {
  version: number;
  /** 当前应用版本号（写入配置时由主进程刷新） */
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

export async function getConfig(): Promise<AppConfig> {
  const result = await ipcInvoke<AppConfig>('config:get');
  return result;
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await ipcInvoke('config:save', config);
}

/**
 * 主进程权威更新配置：提交 { section, patch } 补丁，
 * 主进程深度合并、debounce 稀疏写盘并广播 config:changed。
 * 返回合并后的完整配置。
 */
export async function updateConfig(section: string, patch: unknown): Promise<AppConfig> {
  return ipcInvoke<AppConfig>('config:update', { section, patch });
}

/** 监听主进程广播的配置变更（完整配置） */
export function onConfigChanged(callback: (config: AppConfig) => void): () => void {
  return onIpcEvent<AppConfig>('config:changed', callback);
}
