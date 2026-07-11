"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBackgroundHandlers = registerBackgroundHandlers;
const electron_1 = __importDefault(require("electron"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
const { ipcMain } = electron_1.default;
function registerBackgroundHandlers() {
    ipcMain.handle('background:set-image', async (_event, payload) => {
        try {
            const config = (0, config_1.loadConfig)();
            config.background.bgType = 'image';
            config.background.image = payload.url;
            if (payload.blur !== undefined)
                config.background.blur = payload.blur;
            if (payload.opacity !== undefined)
                config.background.opacity = payload.opacity;
            (0, config_1.saveConfig)(config);
            return { success: true, data: config.background, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('background:set-color', async (_event, payload) => {
        try {
            const config = (0, config_1.loadConfig)();
            config.background.bgType = 'color';
            config.background.image = payload.color;
            (0, config_1.saveConfig)(config);
            return { success: true, data: config.background, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('background:set-blur', async (_event, payload) => {
        try {
            const config = (0, config_1.loadConfig)();
            config.background.blur = payload.blur;
            (0, config_1.saveConfig)(config);
            return { success: true, data: config.background, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('background:set-opacity', async (_event, payload) => {
        try {
            const config = (0, config_1.loadConfig)();
            config.background.opacity = payload.opacity;
            (0, config_1.saveConfig)(config);
            return { success: true, data: config.background, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('background:set-animation', async (_event, payload) => {
        try {
            // Animation config is not persisted in current design, return defaults
            return { success: true, data: { bgType: 'image', image: '/background.png', blur: 0, opacity: 100 }, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('background:get', async () => {
        try {
            const config = (0, config_1.loadConfig)();
            return { success: true, data: config.background, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('background:set-theme', async (_event, payload) => {
        try {
            const config = (0, config_1.loadConfig)();
            config.theme.darkMode = payload.theme;
            (0, config_1.saveConfig)(config);
            return { success: true, data: config.background, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('background:reset', async () => {
        try {
            const config = (0, config_1.loadConfig)();
            config.background = { bgType: 'image', image: '/background.png', blur: 0, opacity: 100 };
            (0, config_1.saveConfig)(config);
            return { success: true, data: config.background, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    // Copy file to userData and return the destination path
    ipcMain.handle('background:copyToUserData', async (_event, srcPath, ext) => {
        try {
            const userDataPath = electron_1.default.app.getPath('userData');
            const destPath = path_1.default.join(userDataPath, `background-custom${ext}`);
            fs_1.default.copyFileSync(srcPath, destPath);
            return destPath;
        }
        catch {
            return null;
        }
    });
    // Get cached background file path from userData
    ipcMain.handle('background:getCachedPath', async () => {
        try {
            const userDataPath = electron_1.default.app.getPath('userData');
            const files = fs_1.default.readdirSync(userDataPath).filter(f => f.startsWith('background-custom'));
            if (files.length === 0)
                return null;
            return path_1.default.join(userDataPath, files[0]);
        }
        catch {
            return null;
        }
    });
}
