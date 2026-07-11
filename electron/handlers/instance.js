"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerInstanceHandlers = registerInstanceHandlers;
const electron_1 = __importDefault(require("electron"));
const instance_1 = require("../core/instance");
const { ipcMain } = electron_1.default;
function registerInstanceHandlers(win) {
    ipcMain.handle('instance:create', async (_event, payload) => {
        try {
            const data = await (0, instance_1.createInstance)(payload.name, payload.gamePath, payload.runtime, {
                author: payload.author,
                description: payload.description,
                java: payload.java,
                minMemory: payload.minMemory,
                maxMemory: payload.maxMemory,
                vmOptions: payload.vmOptions,
                mcOptions: payload.mcOptions,
            });
            return { success: true, data, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('instance:list', async (_event, payload) => {
        try {
            const data = await (0, instance_1.listInstances)(payload.gamePath);
            return { success: true, data, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('instance:info', async (_event, payload) => {
        try {
            const data = await (0, instance_1.getInstanceInfo)(payload.name, payload.gamePath);
            return { success: true, data, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('instance:delete', async (_event, payload) => {
        try {
            const data = await (0, instance_1.deleteInstance)(payload.name, payload.gamePath);
            return { success: true, data, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('instance:update', async (_event, payload) => {
        try {
            const data = await (0, instance_1.updateInstance)(payload.name, payload.gamePath, payload.patch);
            return { success: true, data, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('instance:install', async (_event, payload) => {
        try {
            const requestId = `install-${Date.now()}`;
            (0, instance_1.installInstanceGame)(payload.name, payload.gamePath, {
                onProgress: (progress) => {
                    win.mainWindow?.webContents.send('instance:progress', { requestId, ...progress });
                },
            }).then((data) => {
                win.mainWindow?.webContents.send('instance:install-complete', { requestId, data });
            }).catch((err) => {
                win.mainWindow?.webContents.send('instance:install-error', { requestId, error: String(err) });
            });
            return { success: true, data: { requestId }, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('instance:launch', async (_event, payload) => {
        try {
            const requestId = `launch-${Date.now()}`;
            (0, instance_1.launchInstance)(payload.name, payload.gamePath, {
                username: payload.username,
                uuid: payload.uuid,
                accessToken: payload.accessToken,
                javaPath: payload.javaPath,
                server: payload.server,
                onEvent: (event) => {
                    win.mainWindow?.webContents.send('instance:launch-event', { requestId, ...event });
                },
            }).then((data) => {
                win.mainWindow?.webContents.send('instance:launch-complete', { requestId, data });
            }).catch((err) => {
                win.mainWindow?.webContents.send('instance:launch-error', { requestId, error: String(err) });
            });
            return { success: true, data: { requestId }, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('instance:diagnose', async (_event, payload) => {
        try {
            const data = await (0, instance_1.diagnoseInstance)(payload.name, payload.gamePath);
            return { success: true, data, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    // Version list APIs
    ipcMain.handle('instance:version-list', async (_event, payload) => {
        try {
            const data = await (0, instance_1.getMinecraftVersionList)(payload.type);
            return { success: true, data, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('instance:forge-version-list', async (_event, payload) => {
        try {
            const data = await (0, instance_1.getForgeVersionList)(payload.mcVersion);
            return { success: true, data, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('instance:fabric-version-list', async (_event, payload) => {
        try {
            const data = await (0, instance_1.getFabricVersionList)(payload.mcVersion);
            return { success: true, data, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('instance:quilt-version-list', async (_event, payload) => {
        try {
            const data = await (0, instance_1.getQuiltVersionList)(payload.mcVersion);
            return { success: true, data, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
}
