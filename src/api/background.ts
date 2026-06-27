import { ipcInvoke } from './ipc';

export type AnimationType = 'none' | 'gradient' | 'particles';
export type Theme = 'light' | 'dark' | 'system';

export interface BackgroundConfig {
  type: 'image' | 'color' | 'gradient' | 'particles';
  image?: string;
  color?: string;
  blur: number;
  opacity: number;
  animation: AnimationType;
  animationSpeed: number;
  theme: Theme;
}

export async function setImageBackground(url: string, blur?: number, opacity?: number): Promise<BackgroundConfig> {
  return ipcInvoke<BackgroundConfig>('background:set-image', { url, blur, opacity });
}

export async function setColorBackground(color: string): Promise<BackgroundConfig> {
  return ipcInvoke<BackgroundConfig>('background:set-color', { color });
}

export async function setBackgroundBlur(blur: number): Promise<BackgroundConfig> {
  return ipcInvoke<BackgroundConfig>('background:set-blur', { blur });
}

export async function setBackgroundOpacity(opacity: number): Promise<BackgroundConfig> {
  return ipcInvoke<BackgroundConfig>('background:set-opacity', { opacity });
}

export async function setBackgroundAnimation(type: AnimationType, speed?: number): Promise<BackgroundConfig> {
  return ipcInvoke<BackgroundConfig>('background:set-animation', { type, speed });
}

export async function getBackgroundConfig(): Promise<BackgroundConfig> {
  return ipcInvoke<BackgroundConfig>('background:get', {});
}

export async function setTheme(theme: Theme): Promise<BackgroundConfig> {
  return ipcInvoke<BackgroundConfig>('background:set-theme', { theme });
}

export async function resetBackground(): Promise<BackgroundConfig> {
  return ipcInvoke<BackgroundConfig>('background:reset', {});
}
