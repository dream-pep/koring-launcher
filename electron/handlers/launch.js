"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerLaunchHandlers = registerLaunchHandlers;
const electron_1 = __importDefault(require("electron"));
const launcher_1 = require("../core/launcher");
const { ipcMain } = electron_1.default;
function registerLaunchHandlers(win) {
    ipcMain.handle('launch:launch', async (_event, payload) => {
        try {
            const requestId = `launch-${Date.now()}`;
            const result = await (0, launcher_1.launchMinecraft)({
                gamePath: payload.gamePath,
                javaPath: payload.javaPath,
                version: payload.version,
                username: payload.username,
                uuid: payload.uuid,
                accessToken: payload.accessToken,
                memory: payload.memory,
                jvmArgs: payload.jvmArgs,
                gameArgs: payload.gameArgs,
                server: payload.server,
                detached: payload.detached,
                onEvent: (event) => {
                    win.mainWindow?.webContents.send('launch:event', { requestId, ...event });
                },
            });
            return { success: true, data: { ...result, requestId }, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('launch:diagnose', async (_event, payload) => {
        try {
            const data = await (0, launcher_1.diagnoseVersion)(payload.gamePath, payload.version);
            return { success: true, data, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
}
