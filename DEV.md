# Koring Launcher — 开发文档

## 技术栈

| 层 | 技术 |
|---|---|
| Frontend | React 19 + Vite 7 + TypeScript |
| UI | Tailwind CSS v4 + shadcn/ui (base-ui) |
| 状态管理 | Zustand |
| Backend | Rust / Tauri 2 |
| Sidecar | Node.js / TypeScript / @xmcl/* |
| 配置存储 | YAML (serde_yaml) + Windows Registry |
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

## 配置存储架构

### 概览

| 数据类型 | 存储位置 | 格式 | 说明 |
|---------|---------|------|------|
| 用户设置 | 程序目录 `Koring.yml` | YAML | 所有可配置项 |
| 账户凭证 | Windows Registry `HKCU\Software\KoringLauncher` | REG_SZ | token/xboxProfile |
| 实例配置 | 实例目录 `koring-instance.json` | JSON | per-instance |
| 任务历史 | localStorage `koring-task-history` | JSON | 临时，max 50 |

### Koring.yml 结构

```yaml
version: 1

theme:
  darkMode: auto          # auto | light | dark
  parallax: true

a11y:
  reduceMotion: false
  reduceTransparency: false
  highContrast: false
  contentBlurOpacity: 50  # 0-100

background:
  bgType: image           # image | color
  image: /background.png
  blur: 0                 # 0-20
  opacity: 100            # 0-100

game:
  gameDir: .minecraft
  resourceDir: ""
  savesDir: ""
  instancesDir: .minecraft/instances

java:
  javaPath: ""
  memMode: auto           # auto | custom
  memGB: 4                # 1-16
  gc: auto                # auto | zgc | g1
  jvmArgs: ""

advanced:
  afterLaunch: close      # close | minimize | keep
  winMode: default        # default | fullscreen | custom
  customWidth: 854
  customHeight: 480
  gameArgs: ""
  preLaunchCmd: ""
  debugMode: false

download:
  fileSource: mirror      # mirror | official | official-only
  versionSource: mirror
  threads: 16             # 1-64
  speedLimit: 0           # KB/s, 0=不限速

network:
  securityId:
    enabled: false
    authUrl: ""
```

### 注册表结构

```
HKCU\Software\KoringLauncher
  └─ auth
       ├─ username      (REG_SZ)
       ├─ uuid          (REG_SZ)
       ├─ accessToken   (REG_SZ)
       ├─ refreshToken  (REG_SZ)
       └─ xboxProfile   (REG_SZ, JSON string)
```

### 向上兼容策略

1. **版本号** — `version` 字段，每次结构变更递增
2. **默认值填充** — 加载时缺失字段自动补全，不丢数据
3. **迁移函数** — `migrate_v0_to_v1()` 等，按版本链执行
4. **未知字段保留** — YAML 解析器保留不认识的字段
5. **Debounce 写入** — 300ms debounce 避免频繁 IO

### Rust 实现

**新文件：**
- `src-tauri/src/config.rs` — `AppConfig` 结构体、`load_config()`、`save_config()`、`merge_defaults()`、`migrate()`
- `src-tauri/src/registry.rs` — `read_auth()`、`write_auth()`、`delete_auth()`

**Tauri 命令：**
- `get_config` → 返回 `AppConfig` JSON
- `save_config(cfg)` → 写入 `Koring.yml`
- `get_auth` → 从注册表读取 `AuthData`
- `save_auth(auth)` → 写入注册表
- `delete_auth_cmd` → 删除注册表认证数据

### 前端实现

**新文件：**
- `src/api/config.ts` — `getConfig()`、`saveConfig()` 类型定义
- `src/api/auth-registry.ts` — `getAuth()`、`saveAuth()`、`deleteAuth()`
- `src/stores/configStore.ts` — 统一配置 Zustand store

**configStore 接口：**
```ts
useConfigStore.getState().config         // 完整配置
useConfigStore.getState().loaded         // 是否已加载
useConfigStore.getState().init()         // 从 Rust 加载
useConfigStore.getState().setTheme({...})  // 部分更新 + debounce 写回
useConfigStore.getState().setA11y({...})
useConfigStore.getState().setBackground({...})
useConfigStore.getState().setGame({...})
useConfigStore.getState().setJava({...})
useConfigStore.getState().setAdvanced({...})
useConfigStore.getState().setDownload({...})
useConfigStore.getState().setNetwork({...})
```

**Store 委托模式：**
themeStore / a11yStore / backgroundStore / authStore 都是 configStore 的薄包装层：
- 读取时从 `configStore.config.*` 同步
- 写入时通过各自的 `set*()` 同时更新本地状态和 configStore
- 提供 `sync*FromConfig()` 函数在 App 启动时同步

**App 启动流程：**
```
configStore.init() → syncThemeFromConfig() → syncA11yFromConfig() → syncBackgroundFromConfig() → authStore.initFromRegistry()
```

---

## 项目结构

```
koring-launcher/
├── src/                        # 前端源码
│   ├── App.tsx                 # 路由入口 + configStore 初始化
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
│   │   │   └── TaskCard.tsx           # 单个任务卡片 (进度条+日志)
│   │   ├── ui/                        # shadcn/ui 组件
│   │   │   ├── sheet.tsx, button.tsx, switch.tsx, slider.tsx
│   │   │   ├── progress.tsx, badge.tsx, separator.tsx
│   │   │   ├── label.tsx, radio-group.tsx, alert-dialog.tsx
│   │   ├── VersionCard.tsx            # 版本/更新卡片 (Silk 背景+毛玻璃)
│   │   ├── UnderConstruction.tsx      # "装修中" 占位组件
│   │   └── StartupPopup.tsx           # 启动弹窗 (环境变量控制)
│   ├── stores/
│   │   ├── configStore.ts     # 统一配置 store (→ Koring.yml)
│   │   ├── themeStore.ts      # 主题 (委托 configStore)
│   │   ├── a11yStore.ts       # 无障碍 (委托 configStore)
│   │   ├── backgroundStore.ts # 背景 (委托 configStore)
│   │   ├── authStore.ts       # 认证 (→ Registry)
│   │   ├── routeStore.ts      # 路由 (历史栈)
│   │   ├── taskStore.ts       # 任务队列 (localStorage)
│   │   ├── instanceStore.ts   # 实例管理
│   │   ├── installStore.ts    # Minecraft 安装
│   │   ├── launchStore.ts     # 游戏启动
│   │   ├── modsStore.ts       # Mod 搜索
│   │   ├── updateStore.ts     # 应用更新
│   │   └── devStore.ts        # 开发者调试
│   ├── api/
│   │   ├── config.ts          # AppConfig 读写 (→ Tauri invoke)
│   │   ├── auth-registry.ts   # AuthData 读写 (→ Registry)
│   │   ├── instance.ts        # 实例 API
│   │   ├── auth.ts            # 登录 API
│   │   ├── sidecar.ts         # 通用 sidecar IPC
│   │   └── ...
│   ├── hooks/
│   │   └── useTheme.ts         # 同步 darkMode → .dark class
│   ├── lib/
│   │   ├── mode.ts             # BUILD_MODE 常量
│   │   └── utils.ts            # cn() 工具函数
│   ├── types/
│   │   └── task.ts             # Task 类型定义
│   └── pages/                  # 页面组件
├── src-tauri/                  # Rust 后端
│   ├── Cargo.toml              # 依赖: serde, serde_json, serde_yaml, winreg
│   ├── tauri.conf.json         # 窗口配置 + Bundle + Updater
│   ├── capabilities/default.json   # 权限声明
│   ├── src/
│   │   ├── lib.rs              # 插件注册 + splash/main + 命令注册
│   │   ├── config.rs           # AppConfig 读写 + 迁移 + 默认值
│   │   ├── registry.rs         # Windows Registry 读写
│   │   ├── commands/mod.rs     # Tauri 命令 (→ sidecar + config + auth)
│   │   └── sidecar.rs          # Sidecar 进程管理
│   └── binaries/               # Sidecar 二进制文件
├── sidecar/                    # Node.js Sidecar
│   └── src/
│       ├── handlers/           # 10 个 handler
│       ├── utils/paths.ts      # 路径工具 + InstanceConfig
│       └── protocol/types.ts   # IPC 消息类型
├── splash.html                 # 启动动画 HTML 入口
├── build-vs.cmd                # VS 环境编译脚本
└── dev-vs.cmd                  # VS 环境开发脚本
```

---

## 页面路由

### 顶层路由 (标题栏可见)

| Key | Label | 组件 | 说明 |
|---|---|---|---|
| `home` | 首页 | `pages/home/index.tsx` | StartCard 启动组件 |
| `store` | 资源 | `pages/store/index.tsx` | 🚧 装修中 |
| `today` | 资讯 | `pages/today/index.tsx` | 🚧 装修中 |
| `play-link` | 联机 | `pages/play-link/index.tsx` | 🚧 装修中 |
| `setting` | 设置 | `pages/setting/index.tsx` | 侧边栏 + 内容区 |

### 隐藏路由

| Key | Label | 组件 |
|---|---|---|
| `task-queue` | 任务队列 | `pages/task-queue.tsx` |
| `debug` | 调试 | `pages/debug/index.tsx` |
| `debug-splash` | 启动动画调试 | `pages/debug/splash-debug.tsx` |
| `debug-display` | 显示效果调试 | `pages/debug/display-debug.tsx` |
| `debug-version-card` | 版本卡片调试 | `pages/debug/version-card-debug.tsx` |
| `debug-task` | 任务队列调试 | `pages/debug/task-debug.tsx` |

### 路由导航 (历史栈)

路由使用动态历史栈替代静态 parentMap。每次 `navigate()` 压入历史，`goBack()` 弹出。

---

## Zustand Stores

### configStore (统一配置中心)

所有用户设置的单一数据源。读写通过 Tauri invoke 与 `Koring.yml` 同步。

```ts
config: AppConfig       // 完整配置
loaded: boolean         // 是否已从 Rust 加载

init()                  // 从 Rust 加载配置
setTheme(patch)         // 部分更新 + debounce 300ms 写回
setA11y(patch)
setBackground(patch)
setGame(patch)
setJava(patch)
setAdvanced(patch)
setDownload(patch)
setNetwork(patch)
```

### themeStore (委托 configStore)

```ts
darkMode: "auto" | "light" | "dark"
parallax: boolean
setDarkMode(mode)       // 更新 DOM + configStore
setParallax(v)          // configStore
syncThemeFromConfig()   // 启动时从 config 同步
```

### a11yStore (委托 configStore)

```ts
reduceMotion, reduceTransparency, highContrast, contentBlurOpacity
syncA11yFromConfig()
```

### backgroundStore (委托 configStore)

```ts
type: "image" | "color", image, blur, opacity
setImage / setColor / setBlur / setOpacity / reset
syncBackgroundFromConfig()
```

### authStore (委托 Registry)

```ts
user: AuthResult | null
initFromRegistry()      // 从 Windows Registry 加载
loginOffline(username)  // 通过 sidecar + 保存到 registry
logout()                // 清除 registry
```

### routeStore (历史栈导航)

```ts
current: RouteKey
history: RouteKey[]     // 导航历史栈
navigate(key)           // 压入历史
goBack()                // 弹出历史
```

### taskStore (localStorage)

任务队列。localStorage 持久化历史 (max 50)。

### 其他 Store

- `devStore` — 开发者调试 (内存)
- `installStore` — Minecraft 安装 (内存，ephemeral)
- `launchStore` — 游戏启动 (内存，ephemeral)
- `modsStore` — Mod 搜索 (内存，ephemeral)
- `updateStore` — 应用更新 (内存，ephemeral)
- `instanceStore` — 实例管理 (sidecar 查询)

---

## 核心组件

### 三层布局 (RootLayout)

```
z-0   BackgroundLayer     全屏背景图 + 视差 + 模糊 + 强内容遮罩
z-1   ContentLayer        页面内容区 (top: 40px, overflow-auto)
z-100 SystemLayer         自定义标题栏 (TitleBar)
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

### StartCard 启动组件 (首页)

胶囊形启动组件，位于首页左下角:
- 左: 设置齿轮图标 (→ setting)
- 中: "启动游戏" 按钮 (primary 色, rounded-full)
- 右: 实例选择图标 (Package)

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

```
core:default, core:window:default, core:window:allow-*,
core:webview:allow-create-webview-window,
opener:default, process:default, shell:allow-execute,
updater:default, dialog:default
```

## Rust 依赖

```toml
tauri = "2"
tauri-plugin-opener, tauri-plugin-process, tauri-plugin-dialog,
tauri-plugin-shell, tauri-plugin-updater
serde = { version = "1", features = ["derive"] }
serde_json = "1"
serde_yaml = "0.9"
uuid = { version = "1", features = ["v4"] }
tokio = { version = "1", features = ["time"] }
[target.'cfg(windows)'.dependencies]
winreg = "0.52"
```

## IPC 协议

前端 → `invoke()` → Rust `commands::*` → sidecar stdin (JSON) → sidecar stdout (JSON) → Tauri 事件 → 前端

Sidecar 命令: `install-minecraft`, `install-mod-loader`, `get-version-list`, `launch-game`, `offline-login`, `search-mods`, `install-mod`, `create-instance`, `list-instances`

Rust 直接命令: `get_config`, `save_config`, `get_auth`, `save_auth`, `delete_auth_cmd`
