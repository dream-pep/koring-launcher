"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTaskHandlers = registerTaskHandlers;
const electron_1 = __importDefault(require("electron"));
const { ipcMain } = electron_1.default;
const runningTasks = new Map();
function registerTaskHandlers(win) {
    ipcMain.handle('task:start', async (_event, payload) => {
        try {
            const controller = new AbortController();
            runningTasks.set(payload.taskId, controller);
            win.mainWindow?.webContents.send('task:started', {
                taskId: payload.taskId,
                xmclPath: payload.executorName,
            });
            // Simulate task execution
            const steps = 20;
            for (let i = 0; i <= steps; i++) {
                if (controller.signal.aborted) {
                    win.mainWindow?.webContents.send('task:failed', {
                        taskId: payload.taskId,
                        error: 'Task cancelled',
                    });
                    runningTasks.delete(payload.taskId);
                    return { success: true, data: null, error: null };
                }
                win.mainWindow?.webContents.send('task:progress', {
                    taskId: payload.taskId,
                    current: i,
                    total: steps,
                    stage: `步骤 ${i}/${steps}`,
                });
                await new Promise((r) => setTimeout(r, 150));
            }
            runningTasks.delete(payload.taskId);
            win.mainWindow?.webContents.send('task:completed', {
                taskId: payload.taskId,
            });
            return { success: true, data: null, error: null };
        }
        catch (e) {
            runningTasks.delete(payload.taskId);
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('task:cancel', async (_event, payload) => {
        try {
            const controller = runningTasks.get(payload.taskId);
            if (controller) {
                controller.abort();
            }
            return { success: true, data: null, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
}
