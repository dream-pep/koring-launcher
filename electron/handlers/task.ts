import electron from 'electron';
import { createInstance, installInstanceGame, type InstanceRuntime } from '../core/instance';

const { ipcMain } = electron;

const runningTasks = new Map<string, AbortController>();

interface WinRef {
  mainWindow: electron.BrowserWindow | null;
}

// 在任务中发送进度事件到渲染进程
function emitProgress(win: WinRef, taskId: string, current: number, total: number, stage: string) {
  win.mainWindow?.webContents.send('task:progress', { taskId, current, total, stage, event: 'task:progress' });
}
function emitLog(win: WinRef, taskId: string, level: string, message: string) {
  win.mainWindow?.webContents.send('task:progress', { taskId, event: 'task:log', level, message });
}

export function registerTaskHandlers(win: WinRef) {
  ipcMain.handle('task:start', async (_event, payload: {
    taskId: string;
    type: string;
    title: string;
    description?: string;
    executorName: string;
    params?: Record<string, unknown>;
  }) => {
    try {
      const controller = new AbortController();
      runningTasks.set(payload.taskId, controller);

      win.mainWindow?.webContents.send('task:progress', {
        taskId: payload.taskId,
        event: 'task:started',
        xmclPath: payload.executorName,
      });

      // 根据 executorName 选择处理逻辑
      if (payload.executorName === 'install') {
        // 使用 @xmcl/core + @xmcl/installer 安装 Minecraft 实例
        const params = payload.params ?? {};
        const name = String(params.name ?? `mc-${Date.now()}`);
        const gamePath = String(params.gamePath ?? '.minecraft');
        const runtime = (params.runtime ?? { minecraft: '1.21.4' }) as InstanceRuntime;
        const description = String(params.description ?? '');

        emitProgress(win, payload.taskId, 0, 100, '创建实例目录');
        emitLog(win, payload.taskId, 'info', `正在创建实例: ${name}`);

        // Step 1: 创建实例（写入 instance.json）
        await createInstance(name, gamePath, runtime, { description });
        emitProgress(win, payload.taskId, 10, 100, '实例目录已创建');

        // Step 2: 安装游戏文件（@xmcl/installer）
        emitLog(win, payload.taskId, 'info', `正在下载 Minecraft ${runtime.minecraft}...`);
        await installInstanceGame(name, gamePath, {
          onProgress: (progress) => {
            if (controller.signal.aborted) return;
            const mapped = Math.round(10 + (progress.current / Math.max(progress.total, 1)) * 80);
            emitProgress(win, payload.taskId, mapped, 100, progress.stage || '安装中');
            if (progress.message) emitLog(win, payload.taskId, 'info', progress.message);
          },
        });

        emitProgress(win, payload.taskId, 100, 100, '安装完成');
        emitLog(win, payload.taskId, 'info', `实例「${name}」创建完成`);
      } else {
        // 默认模拟执行
        const steps = 20;
        for (let i = 0; i <= steps; i++) {
          if (controller.signal.aborted) throw new Error('已取消');
          emitProgress(win, payload.taskId, i, steps, `步骤 ${i}/${steps}`);
          await new Promise((r) => setTimeout(r, 150));
        }
        emitLog(win, payload.taskId, 'info', '任务完成');
      }

      runningTasks.delete(payload.taskId);
      win.mainWindow?.webContents.send('task:progress', {
        taskId: payload.taskId,
        event: 'task:completed',
      });

      return { success: true, data: null, error: null };
    } catch (e: unknown) {
      runningTasks.delete(payload.taskId);
      const errMsg = e instanceof Error ? e.message : String(e);
      win.mainWindow?.webContents.send('task:progress', {
        taskId: payload.taskId,
        event: 'task:failed',
        error: errMsg,
      });
      return { success: false, data: null, error: errMsg };
    }
  });

  ipcMain.handle('task:cancel', async (_event, payload: { taskId: string }) => {
    try {
      const controller = runningTasks.get(payload.taskId);
      if (controller) {
        controller.abort();
      }
      return { success: true, data: null, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });
}
