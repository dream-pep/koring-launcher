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

export interface NetworkConfig {
  securityId: SecurityIdConfig;
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
