import electron from 'electron';
import { searchMods, getModDetail, getModVersions, installMod, getCategories, getGameVersions } from '../core/modrinth';

const { ipcMain } = electron;

export function registerModsHandlers() {
  ipcMain.handle('mods:search', async (_event, payload: {
    query?: string;
    gameVersion?: string;
    loader?: string;
    category?: string;
    projectType?: string;
    limit?: number;
    offset?: number;
    source: string;
  }) => {
    try {
      const data = await searchMods(
        payload.query,
        payload.gameVersion,
        payload.loader,
        payload.category,
        payload.projectType,
        payload.limit,
        payload.offset,
        payload.source as 'modrinth' | 'curseforge'
      );
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('mods:categories', async (_event, payload: { projectType?: string }) => {
    try {
      const data = await getCategories(payload.projectType);
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('mods:game-versions', async () => {
    try {
      const data = await getGameVersions();
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('mods:detail', async (_event, payload: { projectId: string; source: string }) => {
    try {
      const data = await getModDetail(
        payload.projectId,
        payload.source as 'modrinth' | 'curseforge'
      );
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('mods:versions', async (_event, payload: {
    projectId: string;
    gameVersion?: string;
    loader?: string;
    source: string;
  }) => {
    try {
      const data = await getModVersions(
        payload.projectId,
        payload.gameVersion,
        payload.loader,
        payload.source as 'modrinth' | 'curseforge'
      );
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('mods:install', async (_event, payload: {
    projectId: string;
    versionId?: string;
    gamePath: string;
    source: string;
  }) => {
    try {
      const data = await installMod(
        payload.projectId,
        payload.versionId,
        payload.gamePath,
        payload.source as 'modrinth' | 'curseforge'
      );
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });
}
