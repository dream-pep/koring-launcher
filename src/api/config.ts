import { ipcInvoke } from './ipc';

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
}

export interface JavaConfig {
  javaPath: string;
  memMode: string;
  memGB: number;
  gc: string;
  jvmArgs: string;
}

export interface AdvancedConfig {
  afterLaunch: string;
  winMode: string;
  customWidth: number;
  customHeight: number;
  gameArgs: string;
  preLaunchCmd: string;
  debugMode: boolean;
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

export interface AppConfig {
  version: number;
  theme: ThemeConfig;
  a11y: A11yConfig;
  background: BackgroundConfig;
  game: GameConfig;
  java: JavaConfig;
  advanced: AdvancedConfig;
  download: DownloadConfig;
  network: NetworkConfig;
}

interface CommandResult {
  success: boolean;
  data: unknown;
  error: string | null;
}

export async function getConfig(): Promise<AppConfig> {
  const result = await ipcInvoke<AppConfig>('config:get');
  return result;
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await ipcInvoke('config:save', config);
}
