# 迁移计划：Tauri 2 → Electron

## 概述

将 koring-launcher 从 Tauri 2（Rust 后端 + Node.js sidecar）迁移到 Electron（Node.js 主进程）。sidecar 的 @xmcl/* 包直接集成到 Electron 主进程中，不再需要独立的 sidecar 二进制文件和 stdin/stdout IPC。

---

## 架构变更

### 迁移前（Tauri）
```
前端 (React) ←→ Rust (Tauri) ←→ Sidecar (Node.js/@xmcl)
       ↕ invoke()         ↕ spawn stdin/stdout
       ↕ listen events    ↕ emit events
```

### 迁移后（Electron）
```
前端 (React) ←→ Electron 主进程 (Node.js/@xmcl)
       ↕ ipcRenderer.invoke()      ↕ ipcMain.handle()
       ↕ ipcRenderer.on()          ↕ webContents.send()
```

Rust 后端和 sidecar **完全移除**。所有功能都在 Electron 主进程中以 `ipcMain.handle()` 处理器的形式存在。

---

## 阶段一：项目初始化

### 1.1 初始化 Electron

- [ ] 在项目根目录创建 `electron/` 目录
- [ ] 创建 `electron/main.ts`（Electron 主进程入口）
- [ ] 创建 `electron/preload.ts`（context bridge 用于 IPC）
- [ ] 更新根目录 `package.json`：
  - 移除 `@tauri-apps/api`、`@tauri-apps/plugin-*`
  - 添加 `electron`、`electron-builder`、`electron-vite`
  - 添加 `electron-store`（用于配置/认证持久化）
  - 添加 `electron-updater`（用于自动更新）
  - 更新脚本：`dev`、`build`、`build:win`、`build:mac`、`build:linux`
- [ ] 创建 `electron-builder.yml` 用于打包配置
- [ ] 更新 `vite.config.ts` 兼容 Electron（移除 Tauri 相关配置）

### 1.2 清理 Tauri 相关文件

- [ ] 完全删除 `src-tauri/` 目录
- [ ] 完全删除 `sidecar/` 目录
- [ ] 删除 `.tauri/` 签名密钥
- [ ] 删除 `build-all.cmd`、`build-arch.cmd`、`build-vs.cmd`、`dev-vs.cmd`
- [ ] 删除 `scripts/switch-icon.js`
- [ ] 清理 `package.json` 脚本（移除所有 tauri 相关脚本）
- [ ] 更新 `.gitignore` 移除 Tauri 相关条目

---

## 阶段二：Electron 主进程

### 2.1 主进程入口（`electron/main.ts`）

```typescript
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';

// 窗口管理
// Splash → Main 过渡（4秒计时器）
// 单实例锁定
// 应用生命周期事件
```

核心职责：
- 创建 splash 窗口（480x320，透明，无边框）
- 创建主窗口（1000x700，透明，无边框，初始隐藏）
- 4秒后关闭 splash，显示主窗口
- 处理应用退出（终止所有运行中的 MC 进程）

### 2.2 IPC 处理器

将所有 16 个 Tauri 命令替换为 `ipcMain.handle()`：

| Tauri 命令 | Electron IPC 频道 | 说明 |
|---|---|---|
| `sidecar_request` | ❌ **已移除** | 不再需要，直接调用具体处理器 |
| `install_minecraft` | `install:minecraft` | 直接使用 @xmcl/installer |
| `install_mod_loader` | `install:mod-loader` | 直接使用 @xmcl/installer |
| `get_version_list` | `install:version-list` | 直接使用 @xmcl/installer |
| `launch_game` | `launch:launch` | 直接使用 @xmcl/core |
| `offline_login` | `auth:offline-login` | 直接使用 @xmcl/user |
| `search_mods` | `mods:search` | 直接使用 @xmcl/modrinth |
| `install_mod` | `mods:install` | 直接使用 @xmcl/modrinth |
| `create_instance` | `instance:create` | 直接文件 I/O |
| `list_instances` | `instance:list` | 直接文件 I/O |
| `get_config` | `config:get` | electron-store 或 YAML 文件 |
| `save_config` | `config:save` | electron-store 或 YAML 文件 |
| `get_auth` | `auth:get` | electron-store（替代注册表） |
| `save_auth` | `auth:save` | electron-store（替代注册表） |
| `delete_auth_cmd` | `auth:delete` | electron-store |
| `get_system_info` | `system:info` | `process.versions`、`os` 模块 |

**新增频道**（替代 sidecar 事件转发）：
- `install:progress` → `webContents.send('install:progress', data)`
- `install:complete` → `webContents.send('install:complete', data)`
- `launch:events` → `webContents.send('launch:events', data)`
- `task:progress` → `webContents.send('task:progress', data)`
- `task:completed` → `webContents.send('task:completed', data)`

### 2.3 配置系统（`electron/config.ts`）

从 Rust `config.rs` 迁移到 Node.js：
- 保持 YAML 格式（使用 `js-yaml` 库）
- 保持稀疏保存逻辑（与默认值做 diff，只保存非默认值）
- 存储路径：打包后使用 `app.getPath('exe')` 父目录

### 2.4 认证系统（`electron/auth.ts`）

从 Windows 注册表迁移到 `electron-store`：
- 使用 `electron-store` 存储认证数据（跨平台 JSON）
- 可选使用 `safeStorage` 加密

### 2.5 Sidecar → 主进程集成

将所有 sidecar 模块直接移入主进程：
- `electron/core/auth.ts` ← `sidecar/src/core/auth.ts`（Microsoft OAuth、离线登录）
- `electron/core/installer.ts` ← `sidecar/src/core/installer.ts`（@xmcl/installer）
- `electron/core/launcher.ts` ← `sidecar/src/core/launcher.ts`（@xmcl/core）
- `electron/core/modrinth.ts` ← `sidecar/src/core/modrinth.ts`（Mod API）
- `electron/handlers/` ← `sidecar/src/handlers/`（将 stdin/stdout 改为 IPC）
- `electron/utils/paths.ts` ← `sidecar/src/utils/paths.ts`

**关键变更**：sidecar 使用 `sendResult(id, data)` / `sendProgress(id, data)` 通过 stdout 发送。现在改用 `webContents.send(channel, data)` 直接发送。

### 2.6 窗口管理

替换 Tauri 窗口 API：
- `@tauri-apps/api/window` → Electron `BrowserWindow` 方法
- 自定义标题栏：移除 `data-tauri-drag-region`，改用 CSS `-webkit-app-region: drag` 实现无边框窗口拖拽
- 窗口控制按钮：`ipcRenderer.invoke('window:minimize')`、`ipcRenderer.invoke('window:maximize')`、`ipcRenderer.invoke('window:close')`

---

## 阶段三：前端迁移

### 3.1 API 层重写

**`src/api/sidecar.ts`** → `src/api/ipc.ts`：
- 替换 `invoke("sidecar_request", ...)` 为 `window.electronAPI.invoke('channel', payload)`
- 替换 `listen("sidecar-response", ...)` 为 `window.electronAPI.on('channel', callback)`
- 移除基于 requestId 的事件过滤（每个 IPC 频道是独立的）

**`src/api/config.ts`**：
- `invoke("get_config")` → `window.electronAPI.invoke('config:get')`
- `invoke("save_config", { cfg })` → `window.electronAPI.invoke('config:save', config)`

**`src/api/auth-registry.ts`**：
- `invoke("get_auth")` → `window.electronAPI.invoke('auth:get')`
- `invoke("save_auth", { auth })` → `window.electronAPI.invoke('auth:save', auth)`
- `invoke("delete_auth_cmd")` → `window.electronAPI.invoke('auth:delete')`

**`src/api/update.ts`**：
- 替换 `@tauri-apps/plugin-updater` → `electron-updater`
- `checkForUpdates()` → `window.electronAPI.invoke('update:check')`
- `downloadAndInstall()` → `window.electronAPI.invoke('update:install')`
- `relaunchApp()` → `window.electronAPI.invoke('app:relaunch')`

**`src/api/system.ts`**：
- `invoke("get_system_info")` → `window.electronAPI.invoke('system:info')`

### 3.2 移除 Tauri 导入

需要更新的文件（移除所有 `@tauri-apps/*` 导入）：

| 文件 | Tauri 导入 | 替换为 |
|---|---|---|
| `src/api/sidecar.ts` | `@tauri-apps/api/core`, `@tauri-apps/api/event` | `window.electronAPI` |
| `src/api/config.ts` | `@tauri-apps/api/core` | `window.electronAPI` |
| `src/api/auth-registry.ts` | `@tauri-apps/api/core` | `window.electronAPI` |
| `src/api/update.ts` | `@tauri-apps/plugin-updater`, `@tauri-apps/plugin-process` | `window.electronAPI` |
| `src/api/system.ts` | `@tauri-apps/api/core` | `window.electronAPI` |
| `src/hooks/useTheme.ts` | `@tauri-apps/api/window` | `window.electronAPI` |
| `src/components/system/WindowControls.tsx` | `@tauri-apps/api/window` | `window.electronAPI` |
| `src/components/system/TitleBar.tsx` | `@tauri-apps/api/window` | `window.electronAPI` |
| `src/components/system/SystemLayer.tsx` | `@tauri-apps/api/window` | `window.electronAPI` |

### 3.3 Preload 脚本 / Context Bridge

创建 `electron/preload.ts`：
```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, ...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args),
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    return () => ipcRenderer.removeListener(channel, callback);
  },
  send: (channel: string, ...args: unknown[]) =>
    ipcRenderer.send(channel, ...args),

  // 窗口控制
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onResized: (callback: () => void) => {
    ipcRenderer.on('window:resized', callback);
    return () => ipcRenderer.removeListener('window:resized', callback);
  },

  // 主题
  getTheme: () => ipcRenderer.invoke('window:getTheme'),
});
```

在 `src/types/electron.d.ts` 中添加 TypeScript 类型声明。

### 3.4 窗口控制更新

**`src/components/system/WindowControls.tsx`**：
- 移除 `getCurrentWindow()` from `@tauri-apps/api/window`
- 使用 `window.electronAPI.minimize()`、`.maximize()`、`.close()`
- 使用 `window.electronAPI.isMaximized()` 和 `window.electronAPI.onResized()`

**`src/components/system/TitleBar.tsx`**：
- 移除 `getCurrentWindow()` 拖拽区域
- 使用 CSS `-webkit-app-region: drag` 实现无边框窗口拖拽
- 移除 `appWindow.startDragging()` 调用

**`src/hooks/useTheme.ts`**：
- 移除 `getCurrentWindow().theme()` from `@tauri-apps/api/window`
- 使用 `window.electronAPI.getTheme()` 替代
- 保留 `matchMedia` 回退方案

### 3.5 Splash 屏幕

**`splash.html`**：无需更改（纯 HTML/CSS）
**`src/components/splash/Splash.tsx`**：无需更改（纯 React）

### 3.6 Vite 配置更新

更新 `vite.config.ts`：
- 移除 `ignore` 中的 `src-tauri/`
- 如果使用 `electron-vite`，添加 Electron 特定配置
- 确保 `base: './'` 以支持 Electron 的 file:// 协议

---

## 阶段四：构建与打包

### 4.1 Electron Builder 配置

创建 `electron-builder.yml`：
```yaml
appId: com.lingke.koring.launcher
productName: Koring Launcher
directories:
  output: dist-electron
files:
  - dist/**          # Vite 构建输出
  - electron/**      # 主进程代码
win:
  target: nsis
  icon: public/run.ico
mac:
  target: dmg
  icon: public/run.png
linux:
  target: AppImage
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
```

### 4.2 开发脚本

```bash
# 开发
pnpm dev:renderer    # Vite 开发服务器
pnpm dev:main        # electron-vite 启动 Electron
pnpm dev             # 同时运行两个（concurrently）

# 构建
pnpm build           # Vite 构建 + Electron 打包
pnpm build:win       # Windows 安装程序
```

### 4.3 构建模式（dev/beta/run）

- 保留 `VITE_BUILD_MODE` 环境变量
- 使用 `electron-builder` 不同配置：
  - `electron-builder.dev.yml` — 不签名，不更新
  - `electron-builder.beta.yml` — beta 更新通道
  - `electron-builder.yml` — 正式版

---

## 阶段五：自动更新

将 `@tauri-apps/plugin-updater` 替换为 `electron-updater`：

### 5.1 主进程

```typescript
import { autoUpdater } from 'electron-updater';

ipcMain.handle('update:check', async () => {
  return autoUpdater.checkForUpdates();
});

ipcMain.handle('update:install', async () => {
  autoUpdater.downloadUpdate();
});

autoUpdater.on('update-available', (info) => {
  mainWindow.webContents.send('update:available', info);
});

autoUpdater.on('download-progress', (progress) => {
  mainWindow.webContents.send('update:progress', progress);
});
```

### 5.2 前端

```typescript
// src/api/update.ts
export async function checkForUpdates() {
  return window.electronAPI.invoke('update:check');
}

export function onUpdateAvailable(callback: (info: any) => void) {
  return window.electronAPI.on('update:available', callback);
}

export function onUpdateProgress(callback: (progress: any) => void) {
  return window.electronAPI.on('update:progress', callback);
}
```

---

## 阶段六：测试与清理

### 6.1 测试清单

- [ ] Splash 屏幕显示 4 秒后主窗口出现
- [ ] 自定义标题栏正常工作（最小化/最大化/关闭）
- [ ] 无边框窗口拖拽正常
- [ ] 暗色模式跟随系统同步
- [ ] 配置正确加载/保存（Koring.yml）
- [ ] 认证正确存储/加载（electron-store）
- [ ] Microsoft OAuth 流程正常（打开浏览器 → 回调）
- [ ] 离线登录正常
- [ ] Minecraft 安装带进度条正常
- [ ] 游戏启动带事件流正常
- [ ] Mod 搜索/安装正常（Modrinth/CurseForge）
- [ ] 实例 创建/列表/删除 正常
- [ ] 自动更新 检查/下载 正常
- [ ] 任务队列正常（进度、取消、重试）
- [ ] 构建模式（dev/beta/run）显示正确的图标/徽章
- [ ] NSIS 安装程序正确构建
- [ ] 打包后应用正常运行

### 6.2 文件清理

- [ ] 删除 `src-tauri/` 目录
- [ ] 删除 `sidecar/` 目录
- [ ] 删除 `.tauri/` 目录
- [ ] 删除 `*.cmd` 构建脚本
- [ ] 删除 `scripts/` 目录
- [ ] 移除 `.vscode/extensions.json` 中的 `src-tauri` 引用
- [ ] 更新 `AGENTS.md` 为新的 Electron 架构
- [ ] 更新 `DEV.md` 为 Electron 开发说明
- [ ] 更新 `README.md`

### 6.3 新文件结构

```
koring-launcher/
├── electron/                    # Electron 主进程
│   ├── main.ts                  # 主入口
│   ├── preload.ts               # Context bridge
│   ├── config.ts                # 配置（YAML）管理
│   ├── auth.ts                  # 认证（electron-store）管理
│   ├── core/                    # 从 sidecar 迁移
│   │   ├── auth.ts              # @xmcl/user 认证
│   │   ├── installer.ts         # @xmcl/installer 安装
│   │   ├── launcher.ts          # @xmcl/core 启动
│   │   └── modrinth.ts          # @xmcl/modrinth Mod API
│   ├── handlers/                # IPC 处理器
│   │   ├── install.ts
│   │   ├── launch.ts
│   │   ├── auth.ts
│   │   ├── mods.ts
│   │   ├── instance.ts
│   │   ├── background.ts
│   │   └── task.ts
│   └── utils/
│       └── paths.ts
├── src/                         # 前端（基本不变）
├── dist/                        # Vite 构建输出
├── electron-builder.yml
├── vite.config.ts
├── package.json
└── index.html
```

---

## 迁移顺序

1. **阶段一** — 项目初始化（Electron 脚手架、移除 Tauri 依赖）
2. **阶段二** — 主进程（IPC 处理器、配置、认证、sidecar 集成）
3. **阶段三** — 前端迁移（API 层、导入、preload bridge）
4. **阶段四** — 构建与打包（electron-builder、开发脚本）
5. **阶段五** — 自动更新（electron-updater）
6. **阶段六** — 测试与清理

预计工作量：大规模重构。每个阶段应独立测试后再进入下一阶段。
