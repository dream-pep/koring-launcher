# Koring Launcher — 开发文档

## 技术栈

| 层 | 技术 |
|---|---|
| Frontend | React 19 + Vite 7 + TypeScript |
| UI | Tailwind CSS v4 + shadcn/ui (base-ui) |
| 状态管理 | Zustand |
| Backend | Rust / Tauri 2 |
| Sidecar | Node.js / TypeScript / @xmcl/* |
| 包管理 | pnpm |
| 目标平台 | ARM64 Windows (`aarch64-pc-windows-msvc`) |

## 快速命令

```bash
pnpm dev                # 前端 dev server (port 1420)
pnpm dev:t              # 前端 + Rust dev (需 VS 环境)
./dev-vs.cmd            # VS ARM64 环境启动 dev
pnpm build              # 生产构建 (switch-icon run + tsc + vite build)
pnpm build:beta         # Beta 构建 (switch-icon beta + tsc + vite build --mode beta)
./build-vs.cmd          # Rust 编译 (production, NSIS 打包)
./build-vs.cmd --mode beta  # Rust 编译 (beta, 跳过打包)
```

## 构建模式

| 模式 | `VITE_BUILD_MODE` | 图标 | Badge | 说明 |
|---|---|---|---|---|
| dev | `"dev"` | `dev.png` | 🟢 DEV | 开发预览版 |
| beta | `"beta"` | `beta.png` | 🟡 BETA | 测试版 |
| run | `"run"` | `run.png` | 无 | 正式版 |

模式由 `src/lib/mode.ts` 导出 `BUILD_MODE`, `isDev`, `isBeta`, `isRun`。

## 环境变量 (.env.*)

```env
VITE_BUILD_MODE=dev|beta|run
VITE_APP_ICON=/dev.png|/beta.png|/run.png
VITE_START_POP=true|false              # 启动弹窗开关
VITE_START_POP_TITLE="..."             # 弹窗标题
VITE_START_POP_INFO="..."              # 弹窗内容
VITE_START_POP_BOUTTON="..."           # 弹窗按钮文字
```

---

## 项目结构

```
koring-launcher/
├── src/                        # 前端源码
│   ├── App.tsx                 # 路由入口 (Zustand 路由)
│   ├── index.css               # 全局样式 + CSS 变量 + 动画
│   ├── layouts/
│   │   └── RootLayout.tsx      # 三层布局: BackgroundLayer + ContentLayer + SystemLayer
│   ├── components/
│   │   ├── background/
│   │   │   └── BackgroundLayer.tsx    # 全屏背景层 + 视差 + 强内容遮罩
│   │   ├── system/
│   │   │   ├── SystemLayer.tsx        # 系统层容器 (z-[100])
│   │   │   ├── TitleBar.tsx           # 自定义标题栏 (40px, 胶囊菜单/返回按钮)
│   │   │   └── WindowControls.tsx     # 窗口按钮 + DEV/BETA badge + TaskButton
│   │   ├── splash/
│   │   │   └── Splash.tsx             # 启动动画 (独立窗口, HTML+React)
│   │   ├── silk/
│   │   │   └── Silk.tsx               # WebGL 丝绸着色器 (Three.js)
│   │   ├── task/
│   │   │   ├── TaskButton.tsx         # 标题栏任务指示器 (SVG 圆弧动画)
│   │   │   ├── TaskSheet.tsx          # 任务队列侧面板 (z-[110])
│   │   │   └── TaskCard.tsx           # 单个任务卡片 (进度条+日志)
│   │   ├── ui/                        # shadcn/ui 组件
│   │   │   ├── sheet.tsx, button.tsx, switch.tsx, slider.tsx
│   │   │   ├── progress.tsx, badge.tsx, separator.tsx
│   │   │   ├── label.tsx, radio-group.tsx, alert-dialog.tsx
│   │   ├── VersionCard.tsx            # 版本/更新卡片 (Silk 背景+毛玻璃)
│   │   ├── UnderConstruction.tsx      # "装修中" 占位组件
│   │   └── StartupPopup.tsx           # 启动弹窗 (环境变量控制)
│   ├── stores/                 # Zustand 状态管理
│   ├── hooks/
│   │   └── useTheme.ts         # 同步 darkMode → .dark class
│   ├── lib/
│   │   ├── mode.ts             # BUILD_MODE 常量
│   │   └── utils.ts            # cn() 工具函数
│   ├── api/                    # Sidecar IPC 封装
│   ├── types/
│   │   └── task.ts             # Task 类型定义
│   └── pages/                  # 页面组件
├── src-tauri/                  # Rust 后端
│   ├── tauri.conf.json         # 窗口配置 + Bundle + Updater
│   ├── capabilities/default.json   # 权限声明
│   ├── src/
│   │   ├── lib.rs              # 插件注册 + splash/main 窗口逻辑
│   │   ├── commands/mod.rs     # Tauri 命令 (→ sidecar)
│   │   └── sidecar.rs          # Sidecar 进程管理
│   └── binaries/               # Sidecar 二进制文件
├── splash.html                 # 启动动画 HTML 入口 (加载 Splash.tsx)
├── build-vs.cmd                # VS 环境编译脚本
└── dev-vs.cmd                  # VS 环境开发脚本
```

---

## 页面路由

### 顶层路由 (标题栏可见)

| Key | Label | 组件 | 说明 |
|---|---|---|---|
| `home` | 首页 | `pages/home/index.tsx` | 欢迎页 |
| `store` | 资源 | `pages/store/index.tsx` | 🚧 装修中 |
| `today` | 资讯 | `pages/today/index.tsx` | 🚧 装修中 |
| `play-link` | 联机 | `pages/play-link/index.tsx` | 🚧 装修中 |
| `setting` | 设置 | `pages/setting/index.tsx` | 侧边栏 + 内容区 |

### 隐藏路由 (debug)

| Key | Label | 组件 |
|---|---|---|
| `debug` | 调试 | `pages/debug/index.tsx` |
| `debug-splash` | 启动动画调试 | `pages/debug/splash-debug.tsx` |
| `debug-display` | 显示效果调试 | `pages/debug/display-debug.tsx` |
| `debug-version-card` | 版本卡片调试 | `pages/debug/version-card-debug.tsx` |
| `debug-task` | 任务队列调试 | `pages/debug/task-debug.tsx` |

### 路由层级 (返回导航)

```
home / store / today / play-link / setting
  └─ debug
       ├─ debug-splash
       ├─ debug-display
       ├─ debug-version-card
       └─ debug-task
```

### 设置子页面 (setting 内部侧边栏)

| 分组 | Key | 组件 | 状态 |
|---|---|---|---|
| **通用** | `home` | `general/home.tsx` | ✅ 设置首页 (搜索+快捷入口) |
| | `account` | `general/account.tsx` | ✅ Koring 账户 (微软登录) |
| | `game-account` | `game/game-account.tsx` | 🚧 占位 |
| | `about` | `general/about.tsx` | ✅ 关于 (版本卡+链接) |
| | `copyright` | `general/copyright.tsx` | ✅ 版权声明 |
| **游戏** | `java-mem` | `game/java-mem.tsx` | ✅ Java/内存/JVM 参数 |
| | `game-dir` | `game/game-dir.tsx` | ✅ 游戏目录路径 |
| | `advanced` | `game/advanced.tsx` | ✅ 高级设置 |
| **个性化** | `theme-bg` | `personalization/theme-bg.tsx` | ✅ 主题+背景 (文件选择器) |
| | `ui` | `personalization/ui.tsx` | ✅ UI 设置 |
| | `lang` | `personalization/lang.tsx` | ✅ 语言设置 |
| | `a11y` | `personalization/a11y.tsx` | ✅ 无障碍 |
| **网络** | `download` | `network/download.tsx` | ✅ 下载设置 |
| | `security-id` | `network/security-id.tsx` | ✅ 第三方认证 |
| | `ether-online` | `network/ether-online.tsx` | 🚧 占位 |
| | `tawa-online` | `network/tawa-online.tsx` | 🚧 占位 |
| **其他** | `feedback` | `other/feedback.tsx` | 🚧 占位 |
| | `sponsor` | `other/sponsor.tsx` | 🚧 占位 |
| | `developer` | _(→ debug route)_ | 跳转调试页 |

---

## Zustand Stores

### routeStore

管理页面路由和标题栏模式。

```ts
// State
current: RouteKey           // 当前路由 key
titleBarMode: TitleBarMode  // "default" | "sub" | "window"
direction: TransitionDirection  // "forward" | "backward"

// Actions
navigate(key)       // 跳转路由 (View Transitions API 动画)
goBack()            // 返回父路由 (通过 parentMap)
setTitleBarMode(m)  // 手动设置标题栏模式
```

### themeStore

深色模式和视差设置。

```ts
// State
darkMode: "auto" | "light" | "dark"   // 默认 "auto"
parallax: boolean                       // 默认 true

// Actions
setDarkMode(mode)   // 应用深色模式到 DOM (.dark class)
setParallax(v)      // 设置视差开关
```

### backgroundStore

背景图片/颜色/模糊/透明度 (localStorage 持久化)。

```ts
// State (localStorage: "koring-background")
type: "image" | "color"   // 默认 "image"
image: string              // 默认 "/background.png"
blur: number               // 默认 0 (0-20)
opacity: number            // 默认 1 (0-1)

// Actions
setImage(url)     // 设置背景图 (通过 convertFileSrc 转换本地路径)
setColor(color)   // 设置纯色背景
setBlur(blur)      // 设置模糊
setOpacity(op)     // 设置透明度
reset()            // 恢复默认
```

### a11yStore

无障碍设置。

```ts
// State
reduceMotion: boolean          // 默认 false
reduceTransparency: boolean    // 默认 false
highContrast: boolean          // 默认 false
contentBlurOpacity: number     // 默认 50 (0-100)

// Actions
setReduceMotion(v)
setReduceTransparency(v)
setHighContrast(v)
setContentBlurOpacity(v)
```

### devStore

开发者调试控制。

```ts
// State
forceDisableContentBlur: boolean       // 默认 false
previewMode: string | null             // 默认 null
previewUpdateState: PreviewUpdateState | null  // 默认 null
overlayOpacity: number                 // 默认 30
blurAmount: number                     // 默认 12

// Actions
setForceDisableContentBlur(v)
setPreviewMode(v)
setPreviewUpdateState(v)
setOverlayOpacity(v)
setBlurAmount(v)
```

### updateStore

应用更新。

```ts
// State
checking: boolean
downloading: boolean
installed: boolean
progress: DownloadProgress | null
update: Update | null
error: string | null

// Actions
check()     // 检查更新 (调用 @tauri-apps/plugin-updater)
install()   // 下载并安装
reset()     // 清除状态
```

### taskStore

任务队列系统 (localStorage 持久化历史)。

```ts
// State (localStorage: "koring-task-history", max 50)
tasks: Task[]
sheetOpen: boolean

// Derived
isRunning()        // 是否有运行中/等待中的任务
activeTasks()      // 运行中+等待中的任务列表
completedTasks()   // 已完成/失败/取消的任务列表

// Actions
addTask(type, title, desc, executor)  // 添加任务并自动开始
cancelTask(id)     // 取消任务 (AbortController)
removeTask(id)     // 删除任务
retryTask(id)      // 重试失败任务
clearHistory()     // 清空历史
openSheet() / closeSheet()
```

### authStore

账户认证 (localStorage: "koring-user")。

```ts
// State
user: AuthResult | null    // { username, uuid, accessToken, expiresAt, xboxProfile }
loading: boolean
error: string | null

// Actions
loginOffline(username)
startMicrosoftLogin(clientId)
completeMicrosoftLogin(code, clientId)
logout()
```

### installStore

Minecraft 安装。

```ts
// State
versions: VersionManifest | null
installing: boolean
loading: boolean
error: string | null

// Actions
fetchVersions(type?)
install(version, gamePath, javaPath?)
installLoader(mcVersion, gamePath, loaderType, loaderVersion?, javaPath?)
```

### launchStore

游戏启动。

```ts
// State
launching: boolean
launched: boolean
gameResult: LaunchResult | null
events: GameEvent[]
error: string | null

// Actions
launch(options: LaunchOptions)
diagnose(gamePath, version)
reset()
```

### modsStore

Mod 搜索与安装。

```ts
// State
searchResults: ModSearchResult[]
currentMod: ModSearchResult | null
modVersions: ModVersionResult[]

// Actions
search(query?, gameVersion?, loader?, source?)
getDetail(projectId, source)
getVersions(projectId, gameVersion?, loader?, source?)
install(projectId, versionId, gamePath, source?)
```

### instanceStore

游戏实例管理。

```ts
// State
instances: InstanceInfo[]
currentInstance: InstanceInfo | null

// Actions
fetchInstances(instancesPath)
create(name, gamePath, mcVersion, ...)
remove(name, instancesPath)
select(name, instancesPath)
```

---

## 核心组件

### 三层布局 (RootLayout)

```
z-0   BackgroundLayer     全屏背景图 + 视差 + 模糊 + 强内容遮罩
z-1   ContentLayer        页面内容区 (top: 40px, overflow-auto)
z-100 SystemLayer         自定义标题栏 (TitleBar)
z-110 TaskSheet           任务队列面板 (右滑入)
z-200 StartupPopup        启动弹窗 (环境变量控制)
```

### TitleBar 标题栏

三种模式:
- **`default`**: 左侧品牌文字 + 中间胶囊菜单 (可拖拽切换) + 右侧窗口控制
- **`sub`**: 左侧返回按钮 + 品牌文字 + 右侧窗口控制 (隐藏 TaskButton)
- **`window`**: 仅窗口控制

### BackgroundLayer 背景层

- 支持 `image` (CSS background-image) 和 `color` (CSS background-color) 两种类型
- 视差效果: 鼠标移动时背景偏移 ±20px, scale(1.05)
- 强内容遮罩: 非 home 页面自动显示 (可通过 `contentBlurOpacity` 控制)
- 深色模式叠加层: `bg-black/35`

### VersionCard 版本卡片

- Silk WebGL 动画背景 + 毛玻璃叠加层
- 三种更新状态: `latest` / `hasUpdate` / `installed`
- 颜色方案: dev=amber, beta=emerald, run=blue
- 可通过 props 覆盖 mode 和 state (用于 debug)

### TaskQueue 任务系统

- 执行器模式: `addTask(type, title, desc, async (ctx) => {...})`
- 支持并行执行 (多个任务同时运行)
- AbortController 取消机制
- localStorage 持久化历史 (max 50)
- 任务类型: `install` / `download` / `update` / `launch` / `auth` / `sync` / `custom`

---

## Tauri 窗口配置

| 窗口 | 尺寸 | 特性 |
|---|---|---|
| splashscreen | 480×320 | 无边框, 透明, 不可缩放, 居中 |
| main | 900×600 (min 800×600) | 无边框, 透明, 隐藏启动 |

## 权限 (capabilities/default.json)

```json
core:default, core:window:default, core:window:allow-*,
core:webview:allow-create-webview-window,
opener:default, process:default, shell:allow-execute,
updater:default, dialog:default
```

## Rust 插件

```toml
tauri-plugin-opener, tauri-plugin-process, tauri-plugin-dialog,
tauri-plugin-shell, tauri-plugin-updater
```

## IPC 协议

前端 → `invoke()` → Rust `commands::sidecar_request` → sidecar stdin (JSON) → sidecar stdout (JSON) → Tauri 事件 → 前端

Sidecar 命令: `install-minecraft`, `install-mod-loader`, `get-version-list`, `launch-game`, `offline-login`, `search-mods`, `install-mod`, `create-instance`, `list-instances`, `background:*`
