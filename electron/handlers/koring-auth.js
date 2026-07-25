"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerKoringAuthHandlers = registerKoringAuthHandlers;
const electron_1 = __importDefault(require("electron"));
const { ipcMain } = electron_1.default;
const koring_auth_1 = require("../core/koring-auth");
const config_1 = require("../config");
function registerKoringAuthHandlers() {
    ipcMain.handle('koring-auth:request-device-code', async () => {
        try {
            const result = await (0, koring_auth_1.requestDeviceCode)();
            return { success: true, data: result, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('koring-auth:poll-token', async (_event, deviceCode) => {
        try {
            const result = await (0, koring_auth_1.pollForTokenOnce)(deviceCode);
            const user = (0, koring_auth_1.saveKoringAuth)(result);
            // 同时写入配置文件
            try {
                const config = (0, config_1.loadConfig)();
                config.koringUser = {
                    sub: user.sub,
                    name: user.name,
                    username: user.username,
                    email: user.email,
                    picture: user.picture,
                    accessToken: result.access_token,
                    refreshToken: result.refresh_token,
                };
                (0, config_1.saveConfig)(config);
            }
            catch (e) {
                console.error('[koring-auth] failed to save user to config:', e);
            }
            return { success: true, data: { user }, error: null };
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return { success: false, data: null, error: msg };
        }
    });
    ipcMain.handle('koring-auth:refresh', async () => {
        try {
            const stored = (0, koring_auth_1.readKoringAuth)();
            if (!stored?.refresh_token)
                throw new Error('No refresh token');
            const result = await (0, koring_auth_1.refreshAccessToken)(stored.refresh_token);
            const user = (0, koring_auth_1.saveKoringAuth)(result);
            // 同步到配置文件
            try {
                const config = (0, config_1.loadConfig)();
                config.koringUser = {
                    sub: user.sub,
                    name: user.name,
                    username: user.username,
                    email: user.email,
                    picture: user.picture,
                    accessToken: result.access_token,
                    refreshToken: result.refresh_token,
                };
                (0, config_1.saveConfig)(config);
            }
            catch { }
            return { success: true, data: { user }, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('koring-auth:get-user', () => {
        try {
            const stored = (0, koring_auth_1.readKoringAuth)();
            // 也从配置文件读取
            if (!stored?.user?.sub) {
                try {
                    const config = (0, config_1.loadConfig)();
                    const ku = config.koringUser;
                    if (ku?.sub) {
                        return { success: true, data: { user: ku, access_token: '', refresh_token: '', id_token: '', expires_at: 0 }, error: null };
                    }
                }
                catch { }
            }
            return { success: true, data: stored, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
    ipcMain.handle('koring-auth:logout', () => {
        try {
            (0, koring_auth_1.deleteKoringAuth)();
            // 清除配置文件中的用户数据
            try {
                const config = (0, config_1.loadConfig)();
                delete config.koringUser;
                (0, config_1.saveConfig)(config);
            }
            catch { }
            return { success: true, data: null, error: null };
        }
        catch (e) {
            return { success: false, data: null, error: String(e) };
        }
    });
}
