"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerInstanceHandlers = registerInstanceHandlers;
const electron_1 = __importDefault(require("electron"));
const instance_1 = require("../core/instance");
const { ipcMain } = electron_1.default;
function registerInstanceHandlers() {
    ipcMain.handle('instance:create', async (_event, payload) => {
        try {
            const data = await (0, instance_1.createInstance)(payload.name, payload.gamePath, payload.mcVersion, payload.loaderType, payload.loaderVersion, payload.javaPath, payload.memory);
            return { success: true, data, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('instance:list', async (_event, payload) => {
        try {
            const data = await (0, instance_1.listInstances)(payload.instancesPath);
            return { success: true, data, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('instance:delete', async (_event, payload) => {
        try {
            const data = await (0, instance_1.deleteInstance)(payload.name, payload.instancesPath);
            return { success: true, data, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('instance:info', async (_event, payload) => {
        try {
            const data = await (0, instance_1.getInstanceInfo)(payload.name, payload.instancesPath);
            return { success: true, data, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
}
