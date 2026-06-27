"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerConfigHandlers = registerConfigHandlers;
const electron_1 = __importDefault(require("electron"));
const { ipcMain } = electron_1.default;
const config_1 = require("../config");
function registerConfigHandlers() {
    ipcMain.handle('config:get', () => {
        try {
            const config = (0, config_1.loadConfig)();
            return { success: true, data: config, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('config:save', (_event, config) => {
        try {
            (0, config_1.saveConfig)(config);
            return { success: true, data: null, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
}
