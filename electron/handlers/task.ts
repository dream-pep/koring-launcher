//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

import electron from 'electron';
import { CancelledError, type Task } from '@xmcl/task';
import { createXmclTask, stageFromPath, type TaskHooks } from '../core/task';

const { ipcMain } = electron;

// 运行中的任务映射：taskId → @xmcl/task 实例
const runningTasks = new Map<string, Task<unknown>>();

interface WinRef {
  mainWindow: electron.BrowserWindow | null;
}

// 向渲染进程广播任务事件（统一走 task:progress 通道）
function emit(win: WinRef, taskId: string, payload: Record<string, unknown>) {
  win.mainWindow?.webContents.send('task:progress', { taskId, ...payload });
}

export function registerTaskHandlers(win: WinRef) {
  // 启动任务：创建 @xmcl/task 任务并通过 startAndWait 回调广播事件
  ipcMain.handle('task:start', async (_event, payload: {
    taskId: string;
    type: string;
    title: string;
    description?: string;
    executorName: string;
    params?: Record<string, unknown>;
  }) => {
    // 任务钩子：日志广播到渲染进程
    const hooks: TaskHooks = {
      log: (level, message) => emit(win, payload.taskId, { event: 'task:log', level, message }),
    };

    // 从执行器注册表创建 @xmcl/task 任务
    const xmclTask = createXmclTask(payload.executorName, payload.params ?? {}, hooks);
    if (!xmclTask) {
      return { success: false, data: null, error: `未知执行器: ${payload.executorName}` };
    }

    runningTasks.set(payload.taskId, xmclTask);

    try {
      // 使用 @xmcl/task 的任务上下文回调驱动事件广播
      await xmclTask.startAndWait({
        onStart: (t) => emit(win, payload.taskId, { event: 'task:started', xmclPath: t.path }),
        onUpdate: (t) => emit(win, payload.taskId, {
          event: 'task:progress',
          current: t.progress,
          total: t.total,
          stage: stageFromPath(t.path),
          xmclPath: t.path,
        }),
        onPaused: () => emit(win, payload.taskId, { event: 'task:paused' }),
        onResumed: () => emit(win, payload.taskId, { event: 'task:resumed' }),
        onCancelled: () => emit(win, payload.taskId, { event: 'task:cancelled' }),
        onSucceed: () => emit(win, payload.taskId, { event: 'task:completed' }),
        onFailed: (t, error) => emit(win, payload.taskId, { event: 'task:failed', error: String(error) }),
      });
      runningTasks.delete(payload.taskId);
      return { success: true, data: null, error: null };
    } catch (e: unknown) {
      runningTasks.delete(payload.taskId);
      // 取消不是错误：状态已通过 task:cancelled 事件广播
      if (e instanceof CancelledError) {
        return { success: true, data: null, error: null };
      }
      return { success: false, data: null, error: e instanceof Error ? e.message : String(e) };
    }
  });

  // 取消任务：调用 @xmcl/task 的 cancel()，取消信号沿任务树向下传播
  ipcMain.handle('task:cancel', async (_event, payload: { taskId: string }) => {
    try {
      const xmclTask = runningTasks.get(payload.taskId);
      if (xmclTask) {
        await xmclTask.cancel();
      }
      return { success: true, data: null, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  // 暂停任务：@xmcl/task 原生 Paused 状态
  ipcMain.handle('task:pause', async (_event, payload: { taskId: string }) => {
    try {
      const xmclTask = runningTasks.get(payload.taskId);
      if (xmclTask) {
        await xmclTask.pause();
      }
      return { success: true, data: null, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  // 恢复任务：从 Paused 状态恢复
  ipcMain.handle('task:resume', async (_event, payload: { taskId: string }) => {
    try {
      const xmclTask = runningTasks.get(payload.taskId);
      if (xmclTask) {
        await xmclTask.resume();
      }
      return { success: true, data: null, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });
}
