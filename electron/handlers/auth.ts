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
import * as crypto from 'crypto';
const { ipcMain } = electron;
import {
  readAuth,
  writeAuth,
  deleteAuth,
  readAuthStore,
  writeAuthStore,
  upsertAccount,
  removeAccount,
  setActiveAccount,
  type AuthAccount,
} from '../auth';
import { offlineLogin, littleskinLogin } from '../core/auth';

export function registerAuthHandlers() {
  // ---------- 旧版单账号接口（Koring 启动器账号 / 兼容保留）----------

  ipcMain.handle('auth:get', () => {
    try {
      const auth = readAuth();
      return { success: true, data: auth, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('auth:save', (_event, auth) => {
    try {
      writeAuth(auth);
      return { success: true, data: null, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  ipcMain.handle('auth:delete', () => {
    try {
      deleteAuth();
      return { success: true, data: null, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  // 离线账号登录（仅生成档案，不落盘；兼容旧调用）
  ipcMain.handle('auth:offline-login', async (_event, payload: { username: string }) => {
    try {
      const username = (payload?.username || '').trim();
      if (!username) {
        return { success: false, data: null, error: '用户名不能为空' };
      }
      if (username.length > 16) {
        return { success: false, data: null, error: '用户名长度不能超过 16 个字符' };
      }
      const data = await offlineLogin(username);
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  // ---------- 多账号注册表接口 ----------

  // 读取账号列表（含旧文件迁移）
  ipcMain.handle('auth:accounts-list', () => {
    try {
      return { success: true, data: readAuthStore(), error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  // 添加离线账号
  ipcMain.handle('auth:account-add-offline', async (_event, payload: { username: string }) => {
    try {
      const username = (payload?.username || '').trim();
      if (!username) {
        return { success: false, data: null, error: '用户名不能为空' };
      }
      if (username.length > 16) {
        return { success: false, data: null, error: '用户名长度不能超过 16 个字符' };
      }

      const user = await offlineLogin(username);
      const now = Date.now();
      const account: AuthAccount = {
        id: crypto.randomUUID(),
        type: 'offline',
        username: user.username,
        uuid: user.uuid,
        addedAt: now,
        lastLoginAt: now,
      };

      const store = upsertAccount(readAuthStore(), account);
      writeAuthStore(store);
      return { success: true, data: store, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: e instanceof Error ? e.message : String(e) };
    }
  });

  // 添加 LittleSkin 账号（Yggdrasil 登录）
  ipcMain.handle('auth:account-add-littleskin', async (_event, payload: { username: string; password: string }) => {
    try {
      const username = (payload?.username || '').trim();
      const password = payload?.password || '';
      if (!username) {
        return { success: false, data: null, error: '请输入 LittleSkin 用户名' };
      }
      if (!password) {
        return { success: false, data: null, error: '请输入 LittleSkin 密码' };
      }

      const profile = await littleskinLogin(username, password);
      const now = Date.now();
      const account: AuthAccount = {
        id: crypto.randomUUID(),
        type: 'littleskin',
        username: profile.username,
        uuid: profile.uuid,
        accessToken: profile.accessToken,
        clientToken: profile.clientToken,
        // LittleSkin 官方头像接口
        avatarUrl: `https://littleskin.cn/avatar/player/${profile.uuid}?size=64`,
        addedAt: now,
        lastLoginAt: now,
      };

      const store = upsertAccount(readAuthStore(), account);
      writeAuthStore(store);
      return { success: true, data: store, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: e instanceof Error ? e.message : String(e) };
    }
  });

  // 删除账号
  ipcMain.handle('auth:account-remove', (_event, payload: { id: string }) => {
    try {
      const id = payload?.id;
      if (!id) {
        return { success: false, data: null, error: '缺少账号 ID' };
      }
      const store = removeAccount(readAuthStore(), id);
      writeAuthStore(store);
      return { success: true, data: store, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  // 切换当前账号
  ipcMain.handle('auth:account-set-active', (_event, payload: { id: string }) => {
    try {
      const id = payload?.id;
      if (!id) {
        return { success: false, data: null, error: '缺少账号 ID' };
      }
      const store = setActiveAccount(readAuthStore(), id);
      writeAuthStore(store);
      return { success: true, data: store, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });
}
