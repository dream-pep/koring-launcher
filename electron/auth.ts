//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import electron from 'electron';
const { app } = electron;

// ==================== 旧版单账号结构（Koring 启动器账号复用）====================

export interface AuthData {
  username: string;
  uuid: string;
  accessToken: string;
  refreshToken: string;
  xboxProfile: string;
}

/**
 * 认证文件路径（与配置一致）：
 * - 打包后 → 系统用户数据目录（userData）
 * - 开发模式 → 项目根目录
 */
export function authPath(): string {
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'koring-auth.json');
  }
  return path.join(__dirname, '..', 'koring-auth.json');
}

export function readAuth(): AuthData {
  const filePath = authPath();
  if (!fs.existsSync(filePath)) {
    return { username: '', uuid: '', accessToken: '', refreshToken: '', xboxProfile: '' };
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as AuthData;
  } catch {
    return { username: '', uuid: '', accessToken: '', refreshToken: '', xboxProfile: '' };
  }
}

export function writeAuth(auth: AuthData): void {
  const filePath = authPath();
  fs.writeFileSync(filePath, JSON.stringify(auth, null, 2), 'utf-8');
}

export function deleteAuth(): void {
  const filePath = authPath();
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

// ==================== 多账号注册表（游戏账号）====================

// 账号类型：offline 离线 / microsoft 微软 / littleskin 皮肤站
export type AccountType = 'offline' | 'microsoft' | 'littleskin';

// 单个游戏账号
export interface AuthAccount {
  /** 唯一标识（crypto.randomUUID） */
  id: string;
  type: AccountType;
  /** 游戏内昵称 */
  username: string;
  /** 带横线的 36 位 UUID */
  uuid: string;
  /** 访问令牌（LittleSkin / 微软） */
  accessToken?: string;
  /** 刷新令牌（微软 / Koring） */
  refreshToken?: string;
  /** LittleSkin Yggdrasil clientToken */
  clientToken?: string;
  /** 微软 Xbox 档案（JSON 字符串） */
  xboxProfile?: string;
  /** 头像地址（可空，前端有兜底） */
  avatarUrl?: string;
  addedAt: number;
  lastLoginAt: number;
}

// 多账号注册表（游戏账号独立文件，避免与 Koring 启动器账号文件争用）
export interface AuthStore {
  version: 2;
  activeAccountId: string | null;
  accounts: AuthAccount[];
}

/**
 * 游戏账号注册表文件路径：
 * - 打包后 → userData/koring-accounts.json
 * - 开发模式 → 项目根目录/koring-accounts.json
 */
export function accountsPath(): string {
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'koring-accounts.json');
  }
  return path.join(__dirname, '..', 'koring-accounts.json');
}

// 空注册表
function emptyStore(): AuthStore {
  return { version: 2, activeAccountId: null, accounts: [] };
}

/**
 * 读取多账号注册表。
 * 若注册表文件不存在，则尝试从旧版单账号文件 koring-auth.json 迁移一条账号（一次性落盘）。
 */
export function readAuthStore(): AuthStore {
  const filePath = accountsPath();

  // 已有注册表：直接读取并校正结构
  if (fs.existsSync(filePath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Partial<AuthStore>;
      if (raw && Array.isArray(raw.accounts)) {
        return {
          version: 2,
          activeAccountId: raw.activeAccountId ?? (raw.accounts[0]?.id ?? null),
          accounts: raw.accounts as AuthAccount[],
        };
      }
    } catch {
      // 文件损坏则回退为空
    }
    return emptyStore();
  }

  // 旧文件迁移：koring-auth.json 中存在游戏账号数据时迁移一条
  const legacy = readAuth();
  if (legacy.username && legacy.uuid) {
    const now = Date.now();
    const account: AuthAccount = {
      id: crypto.randomUUID(),
      type: legacy.accessToken ? 'microsoft' : 'offline',
      username: legacy.username,
      uuid: legacy.uuid,
      accessToken: legacy.accessToken || undefined,
      refreshToken: legacy.refreshToken || undefined,
      xboxProfile: legacy.xboxProfile || undefined,
      addedAt: now,
      lastLoginAt: now,
    };
    const store: AuthStore = { version: 2, activeAccountId: account.id, accounts: [account] };
    // 一次性落盘，避免后续 koring-auth.json 变更导致重复迁移
    writeAuthStore(store);
    return store;
  }

  return emptyStore();
}

// 写入多账号注册表
export function writeAuthStore(store: AuthStore): void {
  fs.writeFileSync(accountsPath(), JSON.stringify(store, null, 2), 'utf-8');
}

/**
 * 新增或更新账号（同 type + uuid 视为同一账号，复用原 id 与 addedAt）。
 * 若当前没有激活账号，则把新账号设为激活。
 */
export function upsertAccount(store: AuthStore, account: AuthAccount): AuthStore {
  const index = store.accounts.findIndex((a) => a.type === account.type && a.uuid === account.uuid);
  let accounts: AuthAccount[];
  let targetId = account.id;

  if (index >= 0) {
    const prev = store.accounts[index];
    targetId = prev.id;
    accounts = store.accounts.map((a, i) =>
      i === index ? { ...prev, ...account, id: prev.id, addedAt: prev.addedAt } : a,
    );
  } else {
    accounts = [...store.accounts, account];
  }

  return {
    ...store,
    accounts,
    activeAccountId: store.activeAccountId ?? targetId,
  };
}

// 移除账号：删除的是当前账号时，回退到剩余第一个（无剩余则为 null）
export function removeAccount(store: AuthStore, id: string): AuthStore {
  const accounts = store.accounts.filter((a) => a.id !== id);
  const activeAccountId =
    store.activeAccountId === id ? (accounts[0]?.id ?? null) : store.activeAccountId;
  return { ...store, accounts, activeAccountId };
}

// 设置当前账号（不存在则原样返回）
export function setActiveAccount(store: AuthStore, id: string): AuthStore {
  if (!store.accounts.some((a) => a.id === id)) return store;
  return { ...store, activeAccountId: id };
}
