//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

import { ipcInvoke } from './ipc';

// ==================== 旧版单账号（Koring 启动器账号 / 兼容保留）====================

export interface AuthData {
  username: string;
  uuid: string;
  accessToken: string;
  refreshToken: string;
  xboxProfile: string;
}

export async function getAuth(): Promise<AuthData> {
  return ipcInvoke<AuthData>('auth:get');
}

export async function saveAuth(auth: AuthData): Promise<void> {
  await ipcInvoke('auth:save', auth);
}

export async function deleteAuth(): Promise<void> {
  await ipcInvoke('auth:delete');
}

// ==================== 多账号注册表（游戏账号）====================

// 账号类型：offline 离线 / microsoft 微软 / littleskin 皮肤站
export type AccountType = 'offline' | 'microsoft' | 'littleskin';

// 单个游戏账号（与主进程 AuthAccount 同构）
export interface AuthAccount {
  id: string;
  type: AccountType;
  username: string;
  uuid: string;
  accessToken?: string;
  refreshToken?: string;
  clientToken?: string;
  xboxProfile?: string;
  avatarUrl?: string;
  addedAt: number;
  lastLoginAt: number;
}

// 多账号注册表
export interface AuthStore {
  version: 2;
  activeAccountId: string | null;
  accounts: AuthAccount[];
}

// 读取账号列表（含旧文件迁移）
export async function listAccounts(): Promise<AuthStore> {
  return ipcInvoke<AuthStore>('auth:accounts-list');
}

// 添加离线账号
export async function addOfflineAccount(username: string): Promise<AuthStore> {
  return ipcInvoke<AuthStore>('auth:account-add-offline', { username });
}

// 添加 LittleSkin 账号
export async function addLittleskinAccount(username: string, password: string): Promise<AuthStore> {
  return ipcInvoke<AuthStore>('auth:account-add-littleskin', { username, password });
}

// 删除账号
export async function removeAccount(id: string): Promise<AuthStore> {
  return ipcInvoke<AuthStore>('auth:account-remove', { id });
}

// 切换当前账号
export async function setActiveAccount(id: string): Promise<AuthStore> {
  return ipcInvoke<AuthStore>('auth:account-set-active', { id });
}
