# Koring Launcher

Minecraft launcher built with Electron + React 19 + TypeScript + Node.js (@xmcl).

## Quick Start

```bash
pnpm install
pnpm dev                # full app (frontend + electron)
pnpm dev:renderer       # frontend only (vite, port 1420)
pnpm dev:main           # electron main process only
```

## Build

```bash
pnpm build              # production build (vite + tsc)
pnpm dist:dev           # dev icon + Windows installer
pnpm dist:beta          # beta icon + Windows installer
pnpm dist:run           # production icon + Windows installer
pnpm dist:mac           # build macOS DMG
pnpm dist:linux         # build Linux AppImage
```

## Architecture

```
src/                     Frontend (React 19 + Vite 7 + Tailwind v4 + shadcn/ui + Zustand)
electron/                Main process (Node.js/TypeScript, @xmcl/* packages)
public/                  Static assets (icons, fonts, images)
build/                   Build resources (generated, gitignored)
```

**IPC Flow:**
Frontend → `ipcRenderer.invoke()` → `ipcMain.handle()` → main process → `webContents.send()` → Frontend

**Config storage (main-process authoritative):**
- `Koring.yml` — 打包后存 `app.getPath('userData')`（`%APPDATA%/Koring Launcher/`），开发模式在项目根目录；旧版 exe 旁文件首次启动自动迁移
- 主进程内存缓存为唯一权威：渲染进程通过 `config:update` 提交补丁，主进程深度合并 → 300ms debounce 稀疏写盘 → 广播 `config:changed` 同步渲染端镜像
- `koring-auth.json` / `koring-crash.log` 与配置同策略（打包后 userData）

## Project Structure

```
src/
├── api/                  # Frontend API layer (IPC wrappers)
│   ├── ipc.ts            # Core IPC utilities
│   ├── background.ts     # Background control
│   ├── install.ts        # Minecraft install
│   ├── launch.ts         # Game launch
│   ├── auth.ts           # Microsoft/offline auth
│   ├── mods.ts           # Modrinth/CurseForge
│   └── instance.ts       # Instance management
├── stores/               # Zustand state stores
├── components/
│   ├── background/       # Background layer (z-0)
│   ├── system/           # Title bar + window controls (z-100)
│   └── ui/               # shadcn/ui components
├── layouts/
│   └── RootLayout.tsx    # Three-layer page structure
├── pages/
│   ├── Home.tsx          # Main page
│   └── Debug.tsx         # Debug tools
├── lib/
│   ├── mode.ts           # Build mode constants (DEFAULT_BG, LOGO_SVG, APP_ICON)
│   └── utils.ts          # cn() helper
└── App.tsx               # Root component with state router

electron/
├── main.ts               # Electron entry, window management, splash→main transition
├── preload.ts            # Context bridge (window.electronAPI)
├── config.ts             # YAML config management (main-process authoritative, debounce sparse save)
├── auth.ts               # Auth data persistence
├── core/                 # @xmcl/* integrations
│   ├── auth.ts           # Microsoft OAuth, Xbox Live, MC auth
│   ├── installer.ts      # @xmcl/installer
│   ├── launcher.ts       # Unified game launcher (@xmcl/core launch + config-driven)
│   ├── launch-options.ts # Config → LaunchOption mapping (parseArgs/buildLaunchOptions/resolveJavaPath)
│   ├── modrinth.ts       # Modrinth/CurseForge API
│   └── instance.ts       # Instance management
├── handlers/             # IPC handlers
│   ├── config.ts         # Config load/save/update (config:get/update/save + config:changed broadcast)
│   ├── auth.ts           # Auth operations
│   ├── install.ts        # Install operations
│   ├── launch.ts         # Unified game launch (launch:launch / launch:diagnose + afterLaunch)
│   ├── java.ts           # Java detection (java:scan / java:resolve)
│   ├── mods.ts           # Mod operations
│   ├── instance.ts       # Instance operations
│   ├── background.ts     # Background operations
│   ├── task.ts           # Task system
│   ├── system.ts         # System info
│   └── window.ts         # Window controls + splash management
└── types/
    └── electron.d.ts     # TypeScript declarations
```

## Three-Layer Page Structure

```
┌──────────────────────────────────────┐
│  z-index: 100  System Layer          │  pointer-events: none
│  ┌──────────────────────────────┐    │
│  │ TitleBar (frosted glass)     │    │  pointer-events: auto
│  │ WindowControls (25px btns)   │    │
│  └──────────────────────────────┘    │
├──────────────────────────────────────┤
│  z-index: 1   Content Layer          │  pointer-events: auto
│  All page content                    │
├──────────────────────────────────────┤
│  z-index: 0   Background Layer       │  pointer-events: none
│  Image / color / gradient / blur     │
└──────────────────────────────────────┘
```

## Splash Screen

- Standalone HTML/CSS (`splash.html`), no React/Vite dependency
- Loads instantly while Vite dev server starts
- Window: 480×320, no decorations, transparent, locked size
- Auto-adapts to system dark mode (`prefers-color-scheme`)
- Logo: `filter: invert(1)` in dark mode
- Startup: splash shows first → main loads behind → transition after `ready-to-show` + 1.5s minimum

## Icon System

Three icon variants in `public/icons/`:

```
public/icons/
  dev/icon.ico, icon.png    # Development
  beta/icon.ico, icon.png   # Testing
  run/icon.ico, icon.png    # Production release
```

**Build-time switching:**
```bash
pnpm icon:dev    # copies public/icons/dev/ → build/
pnpm icon:beta   # copies public/icons/beta/ → build/
pnpm icon:run    # copies public/icons/run/ → build/
```

`electron-builder.yml` reads icons from `build/` (`buildResources: build`).

**Frontend usage:**
```tsx
import { APP_ICON, DEFAULT_BG, LOGO_SVG, BUILD_MODE, isDev } from "@/lib/mode";

<img src={APP_ICON} />
<img src={LOGO_SVG} />
<img src={DEFAULT_BG} />
{isDev && <span>Dev Mode</span>}
```

## IPC Handlers

- `config:get` / `config:update` / `config:save` / `config:changed` — 配置读写（主进程权威：update 深度合并 + debounce 稀疏写盘 + 广播）
- `auth:*` — Microsoft OAuth, offline login
- `install:*` — Minecraft install, mod loader, version lists
- `launch:launch` / `launch:diagnose` — 统一游戏启动：主进程读取权威配置自动应用 Java/内存/GC/JVM/游戏参数/窗口/启动前命令，事件经 `launch:event` 推送，window-ready 时按 `afterLaunch` 处理启动器窗口
- `java:scan` / `java:resolve` — Java 环境检测 / 路径校验
- `mods:*` — Modrinth/CurseForge search, install
- `instance:*` — Instance CRUD（安装/导入/诊断；启动统一走 `launch:launch`）
- `background:*` — Background image/color/blur/animation/theme
- `task:*` — Task system progress
- `system:*` — System info
- `window:*` — Minimize/maximize/close + splash management
- `dialog:*` — File picker

## Key Gotchas

- **@xmcl packages run in main process**: `@xmcl/core`, `@xmcl/installer` require `fs`/`child_process`. All run in Electron main process.
- **Path alias**: `@/` maps to `src/`.
- **Window dragging**: Use CSS `WebkitAppRegion: "drag"` as inline style (Electron only respects CSS property, not HTML attributes).
- **Transparent windows**: `transparent: true` + `frame: false` in BrowserWindow options.
- **Mutable win ref**: `electron/main.ts` uses a mutable `win` object — all handlers read `win.mainWindow` at runtime (not captured at registration time).
- **Asset paths**: Use `import.meta.env.BASE_URL` prefix for public assets (e.g., `${import.meta.env.BASE_URL}background.png`). Absolute paths like `/background.png` break in packaged app.
- **Config**: YAML format (`Koring.yml`). 打包后存 `app.getPath('userData')`（开发模式在项目根目录）；主进程内存缓存为唯一权威，渲染进程经 `config:update` 提交、`config:changed` 同步，不在渲染端直接写盘。Sparse save（只写非默认值）。
- **Auth**: JSON file (`koring-auth.json`)，打包后存 userData（与配置同策略）。
- **Launch is config-driven**: `launch:launch` 由主进程读取权威配置映射为 `@xmcl/core` 的 `LaunchOption`（`buildLaunchOptions`），前端只传实例名 + 游戏根目录 + 账户档案。
- **HeroUI 3 基于 react-aria**：Switch / RadioGroup 等使用 `onChange`（不是 `onValueChange`），`onValueChange` 在 HeroUI 3 中不存在且静默失效。
- **设置子页面统一原语**：`src/components/setting/`（SettingCard/SettingRow/SettingBadge/SettingListItem/controls.tsx + `fieldCls`），一套样式组合；Radio 必须显式渲染 `<Radio.Control><Radio.Indicator /></Radio.Control>` 才有圆点；HeroUI field 默认边框宽度为 0，输入框需叠加 `fieldCls`。
- **游戏目录导入**：版本从**当前扫描目录**导入（`sourceGamePath`），实例建在主库；主目录变更自动重扫；批量导入幂等（已存在跳过）；相对 `gameDir`（默认 `.minecraft`）由主进程 `resolveGamePath` 按 exe 目录/项目根归一化。
- **设置页结构（参考 PCL2）**：通用（主页/Koring 账户/关于/版权）与其他（服务与反馈/赞助/开发者）保留；游戏组（账户·离线登录、Java、目录、高级·含快速进入服务器）、个性化组（主题背景/主界面/语言/辅助）、网络组（下载/安全识别）已对接设置接口；以太/陶瓦联机页暂为占位。新增配置段：`app.language`（语言偏好）、`ui.showInstanceTitle/showTaskButton`（主界面元素）、`advanced.server`（快速进入服务器，启动自动加入）。
- **离线账号登录**：`auth:offline-login` 处理器生成离线 UUID（MD5(OfflinePlayer:用户名)）；微软登录 UI 标注"开发中"。
- **AboutVersion（关于此版本）**：`src/components/about-version/` 拉取当前版本 GitHub 发布说明，解析后**按提交类型（新增/修复/优化/重构/文档/其他）分类卡片**展示（不渲染原始 Markdown）；OOBE/UPvP 流程步骤为「版本卡片 → 关于此版本」。

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, Tailwind CSS v4, shadcn/ui, Zustand |
| Main Process | Node.js, TypeScript, @xmcl/* packages |
| Build | pnpm, Vite, electron-builder |
