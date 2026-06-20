import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export interface DownloadProgress {
  downloaded: number;
  contentLength: number;
  percent: number;
}

export async function checkForUpdates(): Promise<Update | null> {
  const update = await check();
  return update;
}

export async function downloadAndInstall(
  update: Update,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<void> {
  let downloaded = 0;
  let contentLength = 0;

  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case "Started":
        contentLength = event.data.contentLength ?? 0;
        break;
      case "Progress":
        downloaded += event.data.chunkLength;
        onProgress?.({
          downloaded,
          contentLength,
          percent: contentLength > 0 ? Math.round((downloaded / contentLength) * 100) : 0,
        });
        break;
      case "Finished":
        break;
    }
  });
}

export async function relaunchApp(): Promise<void> {
  await relaunch();
}
