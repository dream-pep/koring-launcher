export interface DownloadProgress {
  downloaded: number;
  contentLength: number;
  percent: number;
}

export async function checkForUpdates(): Promise<{ version: string; releaseNotes?: string } | null> {
  try {
    return await window.electronAPI?.invoke('update:check') as { version: string; releaseNotes?: string } | null;
  } catch {
    return null;
  }
}

export async function downloadAndInstall(
  onProgress?: (progress: DownloadProgress) => void
): Promise<void> {
  await window.electronAPI?.invoke('update:install');
}

export async function relaunchApp(): Promise<void> {
  await window.electronAPI?.invoke('app:relaunch');
}
