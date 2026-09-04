<p align="center">
  <img src="public/icons/run/icon.png" width="96" alt="Koring Launcher" />
</p>

<h1 align="center">Koring Launcher</h1>

<p align="center">
  A modern Minecraft launcher for Windows · 基于 Electron + React 的现代化 Minecraft 启动器
</p>

<p align="center">
  <a href="https://github.com/dream-pep/koring-launcher/releases"><img src="https://img.shields.io/github/v/release/dream-pep/koring-launcher?display_name=release&label=Release&logo=github&color=4c6ef5" alt="Release"></a>
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-8a94a6" alt="Platform">
  <img src="https://img.shields.io/badge/Electron%2033%20%C2%B7%20React%2019%20%C2%B7%20TypeScript-20242e" alt="Electron · React · TypeScript">
  <img src="https://img.shields.io/badge/license-LL--1.0-7d5fb8" alt="License">
  <a href="https://github.com/dream-pep/koring-launcher/actions/workflows/release.yml"><img src="https://github.com/dream-pep/koring-launcher/actions/workflows/release.yml/badge.svg" alt="Build & Release"></a>
</p>

<p align="center">
  <a href="https://github.com/dream-pep/koring-launcher"><img src="https://img.shields.io/github/stars/dream-pep/koring-launcher?style=social" alt="Stars"></a>
</p>

---

# 中文文档

- [项目简介](#项目简介)
- [功能特性](#功能特性)
- [界面预览](#界面预览)
- [快速开始](#快速开始)
- [开发指南](#开发指南)
- [构建与发布](#构建与发布)
- [技术架构](#技术架构)
- [目录结构](#目录结构)
- [版本与自动更新](#版本与自动更新)
- [路线图](#路线图)
- [贡献指南](#贡献指南)
- [许可证](#许可证)

---

## 项目简介

**Koring Launcher** 是一款面向现代 Windows 桌面的 Minecraft 启动器，采用
**Electron + React 19 + TypeScript** 构建，游戏侧核心能力基于成熟的
[@xmcl](https://github.com/Voxelum/xmcl) 开源生态（安装、启动、任务）。

项目强调**流畅的桌面体验**与**工程化的进程架构**：自定义无边框窗口与启动画面、
三层层级 UI、主进程权威的配置体系、内置资源注册表与内存管理，以及 beta/run 双通道
自动更新。代码库以「渲染进程薄、主进程权威」为原则，所有游戏相关能力
（@xmcl、文件系统、进程管理）均运行于 Electron 主进程，渲染进程只通过类型安全的
IPC 与主进程通信。

> **状态**：项目处于积极开发与内测阶段（`beta` / `run` 双通道发布）。主框架与核心
> 流程稳定可用，部分 UI 模块（见 [路线图](#路线图)）仍在打磨。

## 功能特性

**桌面体验**

- 自定义**无边框窗口**：自绘标题栏（毛玻璃）与窗口控制，深浅色模式自动适配
- 独立的 **Splash 启动画面**（480×320 透明窗，无框架依赖，`ready-to-show` + 最短停留时间过渡）
- **三层层级 UI**：背景层 / 内容层 / 系统层，页面间使用 View Transitions 过渡
- 内置**隐藏调试页**（`debug-*` 路由）：显示、更新、任务、资源与内存等专项调试

**游戏能力（基于 @xmcl）**

- **统一配置驱动启动**：主进程读取权威配置，自动映射为 `LaunchOption`
  （Java 路径 / 内存 / GC / JVM 参数 / 游戏参数 / 窗口 / 启动前命令），
  支持启动事件推送与 `afterLaunch` 窗口处理
- **Java 自动检测与路径校验**（`java:scan` / `java:resolve`）
- **实例系统**：主库实例 + 游戏目录批量导入（幂等、目录变更自动重扫）
- **Mod 生态**：Modrinth / CurseForge 检索与安装模块
- **账号体系**：Koring 账号、离线账号（规范离线 UUID），微软 OAuth 核心已接入
- 任务系统：安装 / 下载进度统一通过主进程任务队列（`task:*`）推进，UI 可查看队列

**配置与个性化**

- **主进程权威配置**：YAML（`Koring.yml`），深度合并 + 稀疏写盘 + 变更广播
- **设置中心**（参考 PCL2 的分组结构）：游戏（账号 / Java / 目录 / 高级）、
  个性化（主题背景 / 主界面 / 语言 / 无障碍）、网络（下载 / 安全识别）等均已接入
- **背景系统**：颜色 / 渐变 / 模糊 / 自选壁纸；自选壁纸由主进程按屏幕尺寸降采样并
  落盘存储，经 `koring-res://` 特权协议流式读取（**全程无 base64**），并纳入
  **资源注册表**统一管理（引用计数、预算 + LRU 逐出）
- **引导流程**：首次启动 OOBE 向导（语言 / 协议 / 登录 / 版本）与更新后引导（UPvP），
  「关于此版本」将 GitHub Release Notes 按新增 / 修复 / 优化等**分类卡片化**展示
- **意见反馈**：设置 → 服务与反馈内置 HeroUI 反馈按钮，点击在系统浏览器打开 YouTrack 反馈表单
  （`components/feedback/FeedbackButton`，直链 `lingke.youtrack.cloud/form/<uuid>`）
- **设备识别码**：关于页展示设备唯一标识 —— 由硬件指纹（主板 UUID / 硬盘序列号 / BIOS 序列号，过滤 OEM 占位值）
  优先取源，缺失时回退注册表 `MachineGuid`，经 SHA-256 生成 UUID 样式标识（`electron/core/device-id.ts`，进程内缓存）

## 界面预览

> 截图整理中 —— 欢迎将截图放入 `docs/screenshots/` 后在此展示。

<!--
  示例：
  <img src="docs/screenshots/home.png" width="720" alt="主界面" />
-->

## 快速开始

**面向用户**：从 [GitHub Releases](https://github.com/dream-pep/koring-launcher/releases)
下载最新安装包（NSIS 安装器，可自选安装目录）。目前发布管线产出 Windows 安装程序，
macOS（DMG）与 Linux（AppImage）构建目标已配置，将在 CI 中逐步开放。

**开发环境要求**

| 依赖 | 版本 | 说明 |
| --- | --- | --- |
| OS | Windows 10/11（x64） | 主要开发与目标平台 |
| Node.js | ≥ 20.19（CI 使用 22） | Vite 7 要求 |
| pnpm | ≥ 9（CI 使用 11.7） | 包管理器，仓库基于 pnpm workspace |

> 国内网络环境：仓库 `.npmrc` 已配置 Electron 二进制走 npmmirror 镜像，
> 可避免 Electron 下载超时。

```bash
# 安装依赖
pnpm install

# 开发（完整应用：Vite dev server :1420 + Electron）
pnpm dev

# 仅渲染进程（HMR，端口 1420）/ 仅主进程
pnpm dev:renderer
pnpm dev:main
```

## 开发指南

常用脚本一览（完整说明见 `DEV.md` 与 `AGENTS.md`）：

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 完整开发环境（先编译主进程，再并行启动 Vite + Electron） |
| `pnpm dev:renderer` | 仅渲染进程（Vite HMR，端口 1420） |
| `pnpm dev:main` | 仅主进程（`tsc` 编译后启动 Electron） |
| `pnpm build:renderer:{dev,beta,run}` | 按模式构建渲染进程 |
| `pnpm build:main` | 编译主进程 TypeScript |
| `pnpm build:{dev,beta,run}` | 对应模式的完整构建（渲染进程 + 主进程） |
| `pnpm preview` | 预览 Vite 产物 |
| `pnpm version:set` | 设置版本号（单一事实源为 `package.json`） |
| `pnpm pack` | `electron-builder --dir`（未打包目录产物） |
| `pnpm dist` / `dist:win` / `dist:mac` / `dist:linux` | electron-builder 按目标平台打包 |

**开发要点速览**

- `@/` 路径别名映射到 `src/`（同时配置于 `vite.config.ts` 与 `tsconfig.json`）
- 渲染进程公共资源路径须使用 `import.meta.env.BASE_URL` 前缀（打包后绝对路径失效）
- 所有 `@xmcl/*`、文件系统与子进程能力运行于主进程；渲染进程经
  `ipcRenderer.invoke()` → `ipcMain.handle()` 调用，方向性事件经 `webContents.send()` 推送
- 主进程配置为唯一权威：渲染端只提交补丁，不直接写盘（详见「配置存储」）
- HeroUI 3（基于 react-aria）控件使用 `onChange`，`onValueChange` 已移除
- 窗口拖拽需使用内联样式 `WebkitAppRegion: "drag"`（Electron 仅识别 CSS 属性）

## 构建与发布

### 构建模式

项目支持三种构建模式，通过环境文件（`.env.development` / `.env.beta` /
`.env.production`）注入，并配套**切换图标**（exe / 安装器图标随模式不同）：

| 模式 | Vite mode | 图标目录 | 用途 |
| --- | --- | --- | --- |
| `dev` | `development` | `public/icons/dev/` | 日常开发 |
| `beta` | `beta` | `public/icons/beta/` | 内测发布 |
| `run` | `production` | `public/icons/run/` | 正式发布 |

```bash
pnpm dist:dev    # build:dev  →  icon:dev  →  electron-builder --win
pnpm dist:beta   # build:beta →  icon:beta →  electron-builder --win
pnpm dist:run    # build:run  →  icon:run  →  electron-builder --win
```

打包流程：模式构建 → `scripts/switch-icon.js` 将对应图标复制到 `build/`
（electron-builder 的 `buildResources`）→ electron-builder 产出 NSIS 安装程序，
产物位于 `dist-electron/koring-launcher-{version}-setup.exe`。

### 发布流水线（GitHub Actions）

`.github/workflows/release.yml` 手动触发（选择 `beta` / `run` 模式）：

1. 从 `package.json` 读取基础版本号，附加 **BUILD ID**（GitHub Run Number，
   严格递增）生成最终版本：`{base}-beta.{buildId}`（beta）或 `{base}-{buildId}`（run）
2. `pnpm build:{mode}` + `pnpm icon:{mode}`（renderer + main + 图标）
3. `electron-builder --win`，经 **SignPath 远程签名**（无 `SIGNPATH_API_TOKEN`
   时自动跳过，本地构建不受影响；仅对 sha256 签名以节省配额）
4. 生成中文发布说明并发布 GitHub Release：beta 为 prerelease 并额外上传
   `latest-beta.yml`，run 为正式版并上传 `latest.yml`（electron-updater 更新清单）

### 配置存储（主进程权威）

- **`Koring.yml`**：打包后存 `app.getPath('userData')`（`%APPDATA%/Koring Launcher/`），
  开发模式存项目根目录；旧版 exe 旁文件首次启动自动迁移
- 主进程内存缓存为唯一权威：渲染端经 `config:update` 提交补丁 → 主进程深度合并 →
  300ms debounce **稀疏写盘**（仅写非默认值）→ 广播 `config:changed` 同步渲染端镜像
- **`koring-auth.json`**（账号数据）与崩溃日志采用相同存储策略
- ⚠️ 数据文件不可放入安装目录：NSIS 重装 / 升级会经旧卸载器删除整个安装目录

## 技术架构

```
┌────────────────────────── Renderer (React 19) ─────────────────────────┐
│  pages / components / stores (Zustand)        resources (注册表+LRU)   │
│        │ ipcRenderer.invoke()  ▲ ipcMain.handle()                      │
│        ▼                      │ webContents.send() (方向性事件)         │
├────────────────────────── Main Process (Electron / Node) ──────────────┤
│  handlers/*  ──  config.ts (YAML 权威) · auth.ts · updater.ts           │
│  core/*      ──  @xmcl/core · @xmcl/installer · @xmcl/task             │
│                  launch-options (配置→LaunchOption)                    │
│  resource-protocol.ts  koring-res://（白名单流式读取，realpath 校验）    │
└────────────────────────────────────────────────────────────────────────┘
```

- **IPC 流**：渲染进程 `invoke` → 主进程 `handle` → 处理完成返回；主进程主动事件
  经 `webContents.send` 推送给渲染端（如 `config:changed`、`launch:event`）
- **可变的 `win` 引用**：`main.ts` 使用可变 `win` 对象，各 handler 在运行时读取
  `win.mainWindow`，而非注册时捕获
- **`koring-res://`**：特权自定义协议，仅服务 userData 内
  `background-custom*` 白名单文件（realpath 二次校验，防目录穿越），
  用于渲染进程「按引用」流式读取本地壁纸，避免 base64 膨胀内存
- **背景图处理**：自选壁纸由主进程复制到 userData，并按屏幕尺寸降采样 / 重编码
  **落盘**；配置文件只存文件路径
- **资源注册表**（`src/resources/`）：acquire / release 引用计数、预算 + LRU 逐出、
  onRelease 释放回调；图片按显示尺寸降采样，供列表缩略图复用

## 目录结构

```
koring-launcher/
├─ electron/                  # 主进程（Electron，@xmcl 全部运行于此）
│  ├─ main.ts                 # 入口：窗口管理、splash→主界面过渡
│  ├─ preload.ts              # contextBridge 暴露 window.electronAPI
│  ├─ config.ts               # YAML 配置（权威、稀疏写盘、迁移）
│  ├─ auth.ts · updater.ts · resource-protocol.ts
│  ├─ core/                   # @xmcl 集成与业务核心
│  │  ├─ auth.ts · koring-auth.ts · installer.ts · launcher.ts
│  │  ├─ launch-options.ts · modrinth.ts · instance.ts
│  │  ├─ task.ts · paths.ts · background-image.ts · crash-logger.ts
│  └─ handlers/               # IPC 处理器（config/auth/install/launch/java/
│                             #   mods/instance/background/task/system/update/
│                             #   koring-auth/crash-monitor/window）
├─ src/                       # 渲染进程（React 19）
│  ├─ api/                    # IPC 类型封装
│  ├─ components/             # background/ system/ setting/ task/
│  │                          #   about-version/ ui/ (shadcn) …
│  ├─ pages/                  # home · gallery · store · today · play-link ·
│  │                          #   setting(分组子页) · oobe · upvp · update ·
│  │                          #   task-queue · crash · debug
│  ├─ resources/              # 资源注册表（引用计数/预算/LRU）与图片解码管线
│  ├─ stores/                 # Zustand 状态（config/auth/theme/route/launch…）
│  ├─ layouts/ · hooks/ · lib/ (mode/buildInfo/version) · assets/ · types/
│  ├─ App.tsx · main.tsx · index.css
├─ public/                    # 静态资源：icons/{dev,beta,run}/、背景、字体
├─ scripts/                   # switch-icon · version · gen-build-info ·
│                             #   signpath-sign · release-notes …
├─ docs/ · DEV.md · AGENTS.md # 开发文档与仓库约定
├─ electron-builder.yml       # appId / 打包目标 / NSIS / 签名配置
├─ vite.config.ts · tsconfig*.json · .env.{development,beta,production}
└─ package.json               # 版本单一事实源
```

## 版本与自动更新

- **版本单一事实源**：`package.json` 的 `version` 字段（`scripts/version.js`
  `get` / `set`），本地与 CI 共用，消除双轨
- **版本号格式**：`{base}`（package.json）→ 发布时追加构建号
  `{base}-beta.{buildId}`（beta 通道）/ `{base}-{buildId}`（run 通道）
- **自动更新**：`electron-updater` + GitHub provider；run 通道读 `latest.yml`，
  beta 通道读 `latest-beta.yml`；客户端开启 `allowPrerelease` 以接收带构建号的
  beta 更新
- ⚠️ 若切换构建号方案（时间戳 → Run Number），旧版数值更大，老用户不会自动
  升级，需同步提升 base 版本（详见 `docs/auto-update-plan.md`）

## 路线图

- [ ] **实例中心 / 资源中心 UI**：完整实现已就绪，暂以占位页收尾打磨后放开
      （Minecraft 版本 / Mod / 整合包浏览与安装）
- [ ] **微软账号登录 UI**：OAuth / Xbox / Minecraft 认证核心已接入，入口 UI 完善中
- [ ] **以太 / 陶瓦联机页**：目前为占位
- [ ] macOS（DMG）与 Linux（AppImage）CI 发布产物
- [ ] 多语言（`app.language` 偏好已定义，UI 文案逐步外置）

## 贡献指南

欢迎提交 Issue 与 Pull Request：

1. Fork 本仓库并以 `master` 为基线创建功能分支
2. 遵循仓库现有风格（TypeScript 严格模式、组件/处理器分层），
   提交信息建议使用约定式（`feat:` / `fix:` / `docs:` / `refactor:` …）
3. 修改渲染进程前先阅读 [AGENTS.md](AGENTS.md)（架构约束与注意点）
   与 [DEV.md](DEV.md)（开发说明）
4. 涉及图标 / 安装器的改动请分别验证三种构建模式（`dist:dev/beta/run`）

## 许可证

本项目使用自定义 **LingkeLice 1.0（LL-1.0）** 许可证，版权归
**Shenzhen Lingke Network Technology Co., Ltd.（深圳灵科网络科技有限公司）** 所有。
要点：**非商业用途**可自由使用、复制、修改与分发（含并入其他项目）；任何
**商业用途**（含集成进商业产品、商业化提供服务、直接 / 间接获利）须事先获得
版权所有者的**书面授权**。详见 [LICENSE](LICENSE)。

商业授权请联系 Shenzhen Lingke Network Technology Co., Ltd.

---

# English Version

- [Introduction](#introduction)
- [Features](#features)
- [Screenshots](#screenshots)
- [Quick Start](#quick-start)
- [Development](#development)
- [Build & Release](#build--release)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Versioning & Auto-Update](#versioning--auto-update)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

## Introduction

**Koring Launcher** is a modern Minecraft launcher for Windows built with
**Electron + React 19 + TypeScript**, with game-side capabilities powered by the
mature [@xmcl](https://github.com/Voxelum/xmcl) ecosystem (install, launch, task).

The project favors a *thin renderer, authoritative main process* architecture:
game-related features (@xmcl, filesystem, subprocesses) all run in the Electron
main process, while the renderer talks to it only through type-safe IPC. Notable
engineering practices include a custom frameless window and splash screen,
a three-layer UI model, main-process-authoritative configuration, a built-in
resource registry with memory management, and dual-channel (beta/run) auto-update.

> **Status**: under active development with public beta/run releases. The core
> framework and main flows are stable; a few UI modules are being polished
> (see [Roadmap](#roadmap)).

## Features

**Desktop experience**

- Custom **frameless window**: glassmorphism title bar and window controls,
  automatic dark/light mode
- Standalone **splash screen** (480×320 transparent window, dependency-free,
  `ready-to-show` + minimum-duration transition)
- **Three-layer UI** (background / content / system) with View Transitions
- Hidden **debug pages** (`debug-*` routes) for display, update, task, and
  resource/memory inspection

**Game capabilities (via @xmcl)**

- **Config-driven unified launch**: the main process maps authoritative config
  to `LaunchOption` (Java path, memory, GC, JVM args, window, pre-launch
  commands), with launch event streaming and `afterLaunch` window handling
- **Java auto-detection & validation** (`java:scan` / `java:resolve`)
- **Instance system**: instances in the main library + bulk import from an
  existing game directory (idempotent, auto-rescan on directory change)
- **Mod ecosystem**: Modrinth / CurseForge search & install modules
- **Accounts**: Koring account, offline login (spec-compliant offline UUID),
  Microsoft OAuth core integrated
- **Task system**: install / download progress flows through a main-process
  task queue (`task:*`) with a visible UI queue

**Configuration & personalization**

- **Main-process-authoritative config**: YAML (`Koring.yml`), deep merge +
  sparse save + change broadcast
- **Settings center** (PCL2-inspired groups): game (account / Java / directory /
  advanced), personalization (theme & background / UI / language / a11y),
  network (download / security ID), etc.
- **Background system**: color / gradient / blur / custom wallpaper. Custom
  wallpapers are downsampled to screen size and stored **on disk** by the main
  process, streamed via the privileged `koring-res://` protocol (**no base64**),
  and managed by a **resource registry** (ref-counting, budget + LRU eviction)
- **Onboarding flows**: first-launch OOBE wizard (language / agreement / login /
  version) and post-update wizard (UPvP); “About this version” renders GitHub
  release notes as categorized cards (added / fixed / improved / …)

## Screenshots

> Coming soon — contributions welcome: drop screenshots into `docs/screenshots/`
> and reference them here.

<!--
  e.g. <img src="docs/screenshots/home.png" width="720" alt="Home" />
-->

## Quick Start

**End users**: download the latest installer from
[GitHub Releases](https://github.com/dream-pep/koring-launcher/releases) (NSIS,
custom install directory). The release pipeline currently publishes Windows
setups; macOS (DMG) and Linux (AppImage) targets are configured and will be
opened up in CI gradually.

**Development requirements**

| Dependency | Version | Notes |
| --- | --- | --- |
| OS | Windows 10/11 (x64) | Primary development & target platform |
| Node.js | ≥ 20.19 (CI uses 22) | Required by Vite 7 |
| pnpm | ≥ 9 (CI uses 11.7) | Package manager (pnpm workspace) |

> In China, `.npmrc` already redirects Electron binaries to the npmmirror
> mirror to avoid download timeouts.

```bash
pnpm install

# Full app dev (Vite :1420 + Electron)
pnpm dev
pnpm dev:renderer   # renderer only (HMR, port 1420)
pnpm dev:main       # main process only
```

## Development

Common scripts (full details in `DEV.md` and `AGENTS.md`):

| Command | Description |
| --- | --- |
| `pnpm dev` | Full dev environment (compile main, then Vite + Electron) |
| `pnpm dev:renderer` | Renderer only (Vite HMR, port 1420) |
| `pnpm dev:main` | Main process only (`tsc` then launch Electron) |
| `pnpm build:renderer:{dev,beta,run}` | Build renderer for a mode |
| `pnpm build:main` | Compile main-process TypeScript |
| `pnpm build:{dev,beta,run}` | Full build for a mode (renderer + main) |
| `pnpm preview` | Preview the Vite build |
| `pnpm version:set` | Set the version (`package.json` is the single source) |
| `pnpm pack` | `electron-builder --dir` (unpacked output) |
| `pnpm dist` / `dist:win` / `dist:mac` / `dist:linux` | Package for a target |

**Quick notes**

- `@/` maps to `src/` (in both `vite.config.ts` and `tsconfig.json`)
- Public assets in the renderer must use the `import.meta.env.BASE_URL` prefix
  (absolute paths break when packaged)
- All `@xmcl/*`, filesystem and subprocess code lives in the main process; the
  renderer calls via `ipcRenderer.invoke()` → `ipcMain.handle()`, and
  directional events are pushed with `webContents.send()`
- Main-process config is authoritative — the renderer submits patches, never
  writes files directly
- HeroUI 3 (built on react-aria) controls use `onChange` (`onValueChange`
  no longer exists)
- Window dragging requires the inline style `WebkitAppRegion: "drag"`
  (Electron only honors the CSS property)

## Build & Release

### Build modes

Three build modes are driven by env files (`.env.development` / `.env.beta` /
`.env.production`) and each ships its **own icon set** for the exe and
installer:

| Mode | Vite mode | Icon dir | Purpose |
| --- | --- | --- | --- |
| `dev` | `development` | `public/icons/dev/` | Daily development |
| `beta` | `beta` | `public/icons/beta/` | Beta release |
| `run` | `production` | `public/icons/run/` | Production release |

```bash
pnpm dist:dev    # build:dev  →  icon:dev  →  electron-builder --win
pnpm dist:beta   # build:beta →  icon:beta →  electron-builder --win
pnpm dist:run    # build:run  →  icon:run  →  electron-builder --win
```

Pipeline: mode build → `scripts/switch-icon.js` copies the mode icons into
`build/` (electron-builder’s `buildResources`) → electron-builder produces an
NSIS installer at `dist-electron/koring-launcher-{version}-setup.exe`.

### Release pipeline (GitHub Actions)

`.github/workflows/release.yml` is triggered manually with a `beta` / `run` mode:

1. Read the base version from `package.json`, append a **BUILD ID**
   (GitHub Run Number, strictly increasing): `{base}-beta.{buildId}` (beta) or
   `{base}-{buildId}` (run)
2. `pnpm build:{mode}` + `pnpm icon:{mode}`
3. `electron-builder --win` with **SignPath remote signing** (auto-skipped when
   `SIGNPATH_API_TOKEN` is absent; sha256-only to save quota)
4. Generate Chinese release notes and publish a GitHub Release: beta releases
   are prereleases that also upload `latest-beta.yml`; run releases are stable
   and upload `latest.yml` (the electron-updater manifest)

### Config storage (main-process authoritative)

- **`Koring.yml`**: stored under `app.getPath('userData')`
  (`%APPDATA%/Koring Launcher/`) when packaged, or in the project root in dev;
  legacy files next to the old exe are auto-migrated on first launch
- The in-memory cache in the main process is the single source of truth:
  renderer submits a patch via `config:update` → deep merge → 300 ms debounced
  **sparse write** (non-default values only) → broadcast `config:changed`
- **`koring-auth.json`** (account data) and crash logs follow the same policy
- ⚠️ Never store data files inside the install directory: NSIS reinstall /
  upgrade removes the whole directory via the old uninstaller

## Architecture

```
┌────────────────────────── Renderer (React 19) ─────────────────────────┐
│  pages / components / stores (Zustand)        resources (registry+LRU) │
│        │ ipcRenderer.invoke()  ▲ ipcMain.handle()                      │
│        ▼                      │ webContents.send() (directional)        │
├────────────────────────── Main Process (Electron / Node) ──────────────┤
│  handlers/*  ──  config.ts (YAML authority) · auth.ts · updater.ts      │
│  core/*      ──  @xmcl/core · @xmcl/installer · @xmcl/task             │
│                  launch-options (config → LaunchOption)                │
│  resource-protocol.ts  koring-res:// (whitelist streaming, realpath)    │
└────────────────────────────────────────────────────────────────────────┘
```

- **IPC flow**: renderer `invoke` → main `handle` → result returns; the main
  process pushes directional events (e.g. `config:changed`, `launch:event`)
  via `webContents.send`
- **Mutable `win` reference**: `main.ts` keeps a mutable `win` object, and
  handlers read `win.mainWindow` at runtime instead of capture time
- **`koring-res://`**: privileged custom protocol serving only whitelisted
  `background-custom*` files inside userData (realpath double-check against
  path traversal) so the renderer can stream local wallpapers by reference
- **Wallpaper pipeline**: custom wallpapers are copied into userData,
  downsampled/re-encoded to screen size and written **to disk**; the config
  stores only the file path
- **Resource registry** (`src/resources/`): acquire/release ref-counting,
  budget + LRU eviction, onRelease callbacks; images are decoded at display
  size and shared by list thumbnails

## Project Structure

```
koring-launcher/
├─ electron/                  # Main process (all @xmcl code runs here)
│  ├─ main.ts                 # Entry: windows, splash → main transition
│  ├─ preload.ts              # contextBridge → window.electronAPI
│  ├─ config.ts               # YAML config (authoritative, sparse save, migrate)
│  ├─ auth.ts · updater.ts · resource-protocol.ts
│  ├─ core/                   # @xmcl integrations & business core
│  │  ├─ auth.ts · koring-auth.ts · installer.ts · launcher.ts
│  │  ├─ launch-options.ts · modrinth.ts · instance.ts
│  │  ├─ task.ts · paths.ts · background-image.ts · crash-logger.ts
│  └─ handlers/               # IPC handlers (config/auth/install/launch/java/
│                             #   mods/instance/background/task/system/update/
│                             #   koring-auth/crash-monitor/window)
├─ src/                       # Renderer (React 19)
│  ├─ api/                    # Typed IPC wrappers
│  ├─ components/             # background/ system/ setting/ task/
│  │                          #   about-version/ ui/ (shadcn) …
│  ├─ pages/                  # home · gallery · store · today · play-link ·
│  │                          #   setting (grouped subpages) · oobe · upvp ·
│  │                          #   update · task-queue · crash · debug
│  ├─ resources/              # Resource registry (ref-count/budget/LRU) +
│  │                          #   image decode pipeline
│  ├─ stores/                 # Zustand (config/auth/theme/route/launch…)
│  ├─ layouts/ · hooks/ · lib/ (mode/buildInfo/version) · assets/ · types/
│  ├─ App.tsx · main.tsx · index.css
├─ public/                    # Static assets: icons/{dev,beta,run}/, bg, fonts
├─ scripts/                   # switch-icon · version · gen-build-info ·
│                             #   signpath-sign · release-notes …
├─ docs/ · DEV.md · AGENTS.md # Docs & repository conventions
├─ electron-builder.yml       # appId / targets / NSIS / signing
├─ vite.config.ts · tsconfig*.json · .env.{development,beta,production}
└─ package.json               # Single source of truth for the version
```

## Versioning & Auto-Update

- **Single source of truth**: the `version` field in `package.json`
  (`scripts/version.js` `get`/`set`) shared by local builds and CI
- **Version format**: `{base}` (package.json) gains a build suffix at release
  time: `{base}-beta.{buildId}` (beta) / `{base}-{buildId}` (run)
- **Auto-update**: `electron-updater` with the GitHub provider; run reads
  `latest.yml`, beta reads `latest-beta.yml`; the client enables
  `allowPrerelease` so suffixed beta builds are detected
- ⚠️ Switching the build-ID scheme (timestamp → Run Number) makes old versions
  numerically larger; raise the base version at the same time or old clients
  will not upgrade (details: `docs/auto-update-plan.md`)

## Roadmap

- [ ] **Instance center / Resource center UI**: full implementations are ready
      but temporarily behind placeholder pages (Minecraft versions / mods /
      modpacks browse & install)
- [ ] **Microsoft account login UI**: OAuth / Xbox / Minecraft auth core is
      integrated; UI entry is being polished
- [ ] **Ether / Tawa online play pages**: currently placeholders
- [ ] macOS (DMG) and Linux (AppImage) CI artifacts
- [ ] i18n rollout (`app.language` preference is defined; UI strings are being
      externalized)

## Contributing

Issues and pull requests are welcome:

1. Fork the repository and branch from `master`
2. Follow the existing style (strict TypeScript, layered components/handlers);
   prefer conventional commits (`feat:` / `fix:` / `docs:` / `refactor:` …)
3. Before touching the renderer, read [AGENTS.md](AGENTS.md) (architecture
   constraints) and [DEV.md](DEV.md) (development notes)
4. Icon / installer changes should be verified across all three build modes
   (`dist:dev/beta/run`)

## License

This project is licensed under the custom **LingkeLice 1.0 (LL-1.0)**, ©
**Shenzhen Lingke Network Technology Co., Ltd.** In short: **non-commercial
use** (use, copy, modify, distribute, including incorporation into other
projects) is free; any **commercial use** — integrating into commercial
products, providing paid services, or earning direct/indirect revenue — requires
**prior written authorization** from the copyright holder. See
[LICENSE](LICENSE).

For commercial licensing, contact Shenzhen Lingke Network Technology Co., Ltd.
