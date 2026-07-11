# Koring Launcher — 开发文档

## 技术栈

| 层 | 技术 |
|---|---|
| Frontend | React 19 + Vite 7 + TypeScript |
| UI | Tailwind CSS v4 + shadcn/ui (base-ui) |
| 状态管理 | Zustand |
| Main Process | Electron + Node.js / TypeScript / @xmcl/* |
| 配置存储 | YAML (js-yaml) |
| 认证存储 | JSON 文件 (koring-auth.json) |
| 包管理 | pnpm |
| 目标平台 | Windows (x64) |

## 快速命令

```bash
pnpm install                        # 安装依赖
pnpm dev                            # 完整开发环境 (renderer + main)
pnpm dev:renderer                   # 仅前端 (Vite, port 1420)
pnpm dev:main                       # 仅主进程 (tsc + electron)
pnpm build                          # 生产构建 (vite + tsc)
pnpm dist:dev                       # dev 图标 + Windows 安装包
pnpm dist:beta                      # beta 图标 + Windows 安装包
pnpm dist:run                       # production 图标 + Windows 安装包
```

## 构建流程

### 开发调试

```bash
pnpm dev
  → pnpm build:main                 # 先编译主进程 TS→JS
  → concurrently:
      pnpm dev:renderer             # Vite dev server (localhost:1420, HMR)
      electron .                    # 加载 localhost:1420
```

- 前端热更新（HMR）
- 主进程修改后需重启 `pnpm dev`
- 调试工具：`Ctrl+Shift+I` 打开 DevTools

### 生产打包

```bash
pnpm dist:beta
  → pnpm build                      # 1. 编译 renderer + main
  → pnpm icon:beta                  # 2. 复制 public/icons/beta/ → build/
  → electron-builder --win          # 3. 读取 build/icon.ico 打包
  → 输出 dist-electron/koring-launcher-1.0.0-setup.exe
```

## 构建模式

| 模式 | `VITE_BUILD_MODE` | 图标目录 | Badge | 说明 |
|---|---|---|---|---|
| dev | `"dev"` | `public/icons/dev/` | 🟢 DEV | 开发预览版 |
| beta | `"beta"` | `public/icons/beta/` | 🟡 BETA | 测试版 |
| run | `"run"` | `public/icons/run/` | 无 | 正式版 |

模式由 `src/lib/mode.ts` 导出 `BUILD_MODE`, `isDev`, `isBeta`, `isRun`, `DEFAULT_BG`, `LOGO_SVG`, `APP_ICON`。

## 环境变量 (.env.*)

```env
VITE_BUILD_MODE=dev|beta|run
VITE_APP_ICON=dev.png|beta.png|run.png
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
│   ├── App.tsx                 # 路由入口 + configStore 初始化
│   ├── index.css               # 全局样式 + CSS 变量 + 动画
│   ├── layouts/
│   │   └── RootLayout.tsx      # 三层布局: BackgroundLayer + ContentLayer + SystemLayer
│   ├── components/
│   │   ├── background/
│   │   │   └── BackgroundLayer.tsx    # 全屏背景层 + 视差 + 强内容遮罩
│   │   ├── system/
│   │   │   ├── TitleBar.tsx           # 自定义标题栏 (WebkitAppRegion: drag)
│   │   │   └── WindowControls.tsx     # 窗口按钮 (WebkitAppRegion: no-drag)
│   │   ├── splash/
│   │   │   └── Splash.tsx             # 启动动画 (React 组件)
│   │   ├── silk/
│   │   │   └── Silk.tsx               # WebGL 丝绸着色器 (Three.js)
│   │   ├── task/
│   │   │   ├── TaskButton.tsx         # 标题栏任务指示器
│   │   │   └── TaskCard.tsx           # 单个任务卡片
│   │   ├── ui/                        # shadcn/ui 组件
│   │   ├── VersionCard.tsx            # 版本/更新卡片
│   │   ├── UnderConstruction.tsx      # "装修中" 占位组件
│   │   └── StartupPopup.tsx           # 启动弹窗
│   ├── stores/
│   │   ├── configStore.ts     # 统一配置 store (→ Koring.yml)
│   │   ├── themeStore.ts      # 主题 (委托 configStore)
│   │   ├── a11yStore.ts       # 无障碍 (委托 configStore)
│   │   ├── backgroundStore.ts # 背景 (委托 configStore)
│   │   ├── authStore.ts       # 认证 (→ koring-auth.json)
│   │   ├── routeStore.ts      # 路由 (历史栈)
│   │   ├── taskStore.ts       # 任务队列 (localStorage)
│   │   ├── instanceStore.ts   # 实例管理
│   │   ├── installStore.ts    # Minecraft 安装
│   │   ├── launchStore.ts     # 游戏启动
│   │   ├── modsStore.ts       # Mod 搜索
│   │   ├── updateStore.ts     # 应用更新
│   │   └── devStore.ts        # 开发者调试
│   ├── api/
│   │   ├── ipc.ts             # 核心 IPC 工具 (invoke, onIpcEvent)
│   │   ├── config.ts          # AppConfig 读写
│   │   ├── auth.ts            # 登录 API
│   │   ├── background.ts      # 背景控制
│   │   ├── install.ts         # Minecraft 安装
│   │   ├── launch.ts          # 游戏启动
│   │   ├── mods.ts            # Mod 搜索
│   │   ├── instance.ts        # 实例 API
│   │   └── update.ts          # 应用更新
│   ├── hooks/
│   │   └── useTheme.ts         # 同步 darkMode → .dark class
│   ├── lib/
│   │   ├── mode.ts             # BUILD_MODE, DEFAULT_BG, LOGO_SVG, APP_ICON
│   │   └── utils.ts            # cn() 工具函数
│   ├── types/
│   │   └── task.ts             # Task 类型定义
│   └── pages/                  # 页面组件
├── electron/                    # Electron 主进程
│   ├── main.ts                  # 主入口, 窗口管理, splash→main 过渡
│   ├── preload.ts               # Context bridge (window.electronAPI)
│   ├── config.ts                # YAML 配置管理 (稀疏保存)
│   ├── auth.ts                  # 认证数据持久化 (JSON 文件)
│   ├── core/                    # @xmcl/* 集成
│   │   ├── auth.ts              # Microsoft OAuth, Xbox Live, MC auth
│   │   ├── installer.ts         # @xmcl/installer
│   │   ├── launcher.ts          # @xmcl/core 游戏启动
│   │   ├── modrinth.ts          # Modrinth/CurseForge API
│   │   └── instance.ts          # 实例管理
│   ├── handlers/                # IPC 处理器
│   │   ├── config.ts            # 配置读写
│   │   ├── auth.ts              # 认证操作
│   │   ├── install.ts           # 安装操作
│   │   ├── launch.ts            # 游戏启动
│   │   ├── mods.ts              # Mod 操作
│   │   ├── instance.ts          # 实例操作
│   │   ├── background.ts        # 背景操作
│   │   ├── task.ts              # 任务系统
│   │   ├── system.ts            # 系统信息
│   │   └── window.ts            # 窗口控制 + splash 管理
│   └── types/
│       └── electron.d.ts        # TypeScript 声明
├── public/                      # 静态资源
│   ├── icons/
│   │   ├── dev/icon.ico, icon.png
│   │   ├── beta/icon.ico, icon.png
│   │   └── run/icon.ico, icon.png
│   ├── background.png           # 默认背景图
│   ├── koring-licon.svg         # Logo
│   └── ...
├── build/                       # 构建资源 (gitignored, 由 switch-icon.js 生成)
│   ├── icon.ico
│   └── icon.png
├── scripts/
│   └── switch-icon.js           # 图标切换脚本
├── splash.html                  # 启动动画 HTML 入口
├── electron-builder.yml         # 打包配置
├── vite.config.ts               # Vite 配置
├── tsconfig.electron.json       # 主进程 TS 编译配置
└── package.json
```

---

## 配置存储架构

### 概览

| 数据类型 | 存储位置 | 格式 | 说明 |
|---------|---------|------|------|
| 用户设置 | 程序目录 `Koring.yml` | YAML | 所有可配置项 |
| 认证数据 | 程序目录 `koring-auth.json` | JSON | token/xboxProfile |
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

### 向上兼容策略

1. **版本号** — `version` 字段，每次结构变更递增
2. **默认值填充** — 加载时缺失字段自动补全，不丢数据
3. **迁移函数** — `migrate_v0_to_v1()` 等，按版本链执行
4. **未知字段保留** — YAML 解析器保留不认识的字段
5. **Debounce 写入** — 300ms debounce 避免频繁 IO

---

## Electron 主进程

### 窗口管理

| 窗口 | 尺寸 | 特性 |
|---|---|---|
| splash | 480×320 | 无边框, 透明, 不可缩放, 居中 |
| main | 1000×700 (min 800×600) | 无边框, 透明, 初始隐藏 |

### 启动流程

```
app.whenReady()
  → registerAllHandlers()       # 注册所有 IPC 处理器
  → createSplashWindow()        # 立即显示 splash
  → createMainWindow()          # 后台创建 main (show: false)
  → ready-to-show + 1.5s min   # 两个条件都满足后:
      → mainWindow.show()       # 显示主窗口
      → splashWindow.close()    # 关闭 splash
```

### Mutable Win Ref

`electron/main.ts` 使用可变的 `win` 对象，所有处理器在运行时读取 `win.mainWindow`（而非注册时捕获）：

```typescript
const win: { mainWindow: BrowserWindow | null; splashWindow: BrowserWindow | null } = {
  mainWindow: null,
  splashWindow: null,
};

// 处理器中：
registerInstallHandlers(win);   // 传入 ref
// handler 内部：
win.mainWindow?.webContents.send('install:progress', data);
```

### IPC 处理器

| 频道 | 说明 |
|---|---|
| `config:get` / `config:save` | 配置读写 |
| `auth:offline-login` / `auth:get` / `auth:save` / `auth:delete` | 认证操作 |
| `install:minecraft` / `install:mod-loader` / `install:version-list` | 安装操作 |
| `launch:launch` / `launch:diagnose` | 游戏启动 |
| `mods:search` / `mods:install` | Mod 操作 |
| `instance:create` / `instance:list` / `instance:delete` | 实例操作 |
| `background:set-image` / `background:set-color` / `background:reset` | 背景操作 |
| `task:progress` / `task:completed` | 任务进度 |
| `system:info` | 系统信息 |
| `window:minimize` / `window:maximize` / `window:close` | 窗口控制 |
| `window:openSplash` / `window:closeSplash` | Splash 管理 |
| `dialog:openFile` | 文件选择器 |

---

## Zustand Stores

### configStore (统一配置中心)

所有用户设置的单一数据源。读写通过 IPC 与 `Koring.yml` 同步。

```ts
config: AppConfig       // 完整配置
loaded: boolean         // 是否已加载

init()                  // 从主进程加载配置
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

### backgroundStore (委托 configStore)

```ts
type: "image" | "color", image, blur, opacity
setImage / setColor / setBlur / setOpacity / reset
syncBackgroundFromConfig()
```

### authStore (委托 JSON 文件)

```ts
user: AuthResult | null
initFromFile()          // 从 koring-auth.json 加载
loginOffline(username)  // 通过主进程 + 保存到文件
logout()                // 清除文件
```

### 其他 Store

- `routeStore` — 历史栈导航
- `taskStore` — 任务队列 (localStorage)
- `devStore` — 开发者调试 (内存)
- `installStore` — Minecraft 安装 (内存)
- `launchStore` — 游戏启动 (内存)
- `modsStore` — Mod 搜索 (内存)
- `updateStore` — 应用更新 (内存)
- `instanceStore` — 实例管理

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

### WindowControls 窗口控制

使用 `<button>` 元素，CSS `WebkitAppRegion: "no-drag"` 实现按钮可点击。

### BackgroundLayer 背景层

- 支持 `image` (CSS background-image) 和 `color` (CSS background-color) 两种类型
- 视差效果: 鼠标移动时背景偏移 ±20px, scale(1.05)
- 强内容遮罩: 非 home 页面自动显示 (可通过 `contentBlurOpacity` 控制)
- 深色模式叠加层: `bg-black/35`

### TaskQueue 任务系统

- 执行器模式: `addTask(type, title, desc, async (ctx) => {...})`
- 支持并行执行 (多个任务同时运行)
- AbortController 取消机制
- localStorage 持久化历史 (max 50)
- 任务类型: `install` / `download` / `update` / `launch` / `auth` / `sync` / `custom`
