import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import electron from 'electron';
const { app } = electron;

const CONFIG_FILE = 'Koring.yml';
const CURRENT_VERSION = 1;

export function configPath(): string {
  if (app.isPackaged) {
    return path.join(path.dirname(app.getPath('exe')), CONFIG_FILE);
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
  oobe: boolean;
  theme: ThemeConfig;
  a11y: A11yConfig;
  background: BackgroundConfig;
  game: GameConfig;
  java: JavaConfig;
  advanced: AdvancedConfig;
  download: DownloadConfig;
  network: NetworkConfig;
}

const DEFAULTS: AppConfig = {
  version: CURRENT_VERSION,
  oobe: true,
  theme: { darkMode: 'auto', parallax: true },
  a11y: { reduceMotion: false, reduceTransparency: false, highContrast: false, contentBlurOpacity: 50 },
  background: { bgType: 'image', image: '/background.png', blur: 0, opacity: 100 },
  game: { gameDir: '.minecraft', resourceDir: '', savesDir: '', instancesDir: '.minecraft/instances' },
  java: { javaPath: '', memMode: 'auto', memGB: 4, gc: 'auto', jvmArgs: '' },
  advanced: { afterLaunch: 'close', winMode: 'default', customWidth: 854, customHeight: 480, gameArgs: '', preLaunchCmd: '', debugMode: false },
  download: { fileSource: 'mirror', versionSource: 'mirror', threads: 16, speedLimit: 0 },
  network: { securityId: { enabled: false, authUrl: '' } },
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

export function saveConfig(config: AppConfig): void {
  const filePath = configPath();
  const sparse = diffValue(config, DEFAULTS) as Record<string, unknown> | undefined;

  if (!sparse || Object.keys(sparse).length === 0) {
    try { fs.unlinkSync(filePath); } catch {}
    return;
  }

  const yamlStr = yaml.dump(sparse, { lineWidth: -1 });
  fs.writeFileSync(filePath, yamlStr, 'utf-8');
}
