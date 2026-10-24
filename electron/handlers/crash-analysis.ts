import electron from 'electron';
import { analyzeInstanceCrash } from '../core/crash-analysis';

const { ipcMain } = electron;

export function registerCrashAnalysisHandlers() {
  ipcMain.handle('instance:crash-analysis', async (_event, payload?: {
    /** 实例目录 */
    instancePath?: string;
    /** 指定分析哪个日志文件；不传则自动挑最新崩溃报告 / latest.log */
    fileName?: string;
  }) => {
    try {
      if (!payload?.instancePath) {
        return { success: false, data: null, error: '缺少实例路径' };
      }
      const data = analyzeInstanceCrash(payload.instancePath, payload.fileName);
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: e instanceof Error ? e.message : String(e) };
    }
  });
}
