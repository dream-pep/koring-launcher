"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAuthHandlers = registerAuthHandlers;
const electron_1 = __importDefault(require("electron"));
const { ipcMain } = electron_1.default;
const auth_1 = require("../auth");
function registerAuthHandlers() {
    ipcMain.handle('auth:get', () => {
        try {
            const auth = (0, auth_1.readAuth)();
            return { success: true, data: auth, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('auth:save', (_event, auth) => {
        try {
            (0, auth_1.writeAuth)(auth);
            return { success: true, data: null, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('auth:delete', () => {
        try {
            (0, auth_1.deleteAuth)();
            return { success: true, data: null, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
}
