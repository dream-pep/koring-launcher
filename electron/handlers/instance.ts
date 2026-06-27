import electron from 'electron';
import { createInstance, listInstances, deleteInstance, getInstanceInfo } from '../core/instance';

const { ipcMain } = electron;

export function registerInstanceHandlers() {
  ipcMain.handle('instance:create', async (_event, payload: {
    name: string;
    gamePath: string;
    mcVersion: string;
    loaderType?: string;
    loaderVersion?: string;
    javaPath?: string;
    memory?: { min?: string; max?: string };
  }) => {
    try {
      const data = await createInstance(
        payload.name,
        payload.gamePath,
        payload.mcVersion,
        payload.loaderType,
        payload.loaderVersion,
        payload.javaPath,
        payload.memory
      );
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('instance:list', async (_event, payload: { instancesPath: string }) => {
    try {
      const data = await listInstances(payload.instancesPath);
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('instance:delete', async (_event, payload: { name: string; instancesPath: string }) => {
    try {
      const data = await deleteInstance(payload.name, payload.instancesPath);
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('instance:info', async (_event, payload: { name: string; instancesPath: string }) => {
    try {
      const data = await getInstanceInfo(payload.name, payload.instancesPath);
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });
}
