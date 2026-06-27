"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerModsHandlers = registerModsHandlers;
const electron_1 = __importDefault(require("electron"));
const modrinth_1 = require("../core/modrinth");
const { ipcMain } = electron_1.default;
function registerModsHandlers() {
    ipcMain.handle('mods:search', async (_event, payload) => {
        try {
            const data = await (0, modrinth_1.searchMods)(payload.query, payload.gameVersion, payload.loader, payload.limit, payload.offset, payload.source);
            return { success: true, data, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('mods:detail', async (_event, payload) => {
        try {
            const data = await (0, modrinth_1.getModDetail)(payload.projectId, payload.source);
            return { success: true, data, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('mods:versions', async (_event, payload) => {
        try {
            const data = await (0, modrinth_1.getModVersions)(payload.projectId, payload.gameVersion, payload.loader, payload.source);
            return { success: true, data, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('mods:install', async (_event, payload) => {
        try {
            const data = await (0, modrinth_1.installMod)(payload.projectId, payload.versionId, payload.gamePath, payload.source);
            return { success: true, data, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
}
