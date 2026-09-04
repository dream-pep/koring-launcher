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
│   │   ├── setting/                   # 设置页原语（HeroUI 统一）
│   │   │   ├── SettingSurface.tsx     # 卡片唯一原语（HeroUI Surface + 磨砂 + 圆角）
│   │   │   ├── SettingCard.tsx        # 设置卡片（SettingSurface + 标准 padding）
│   │   │   ├── SettingRow.tsx         # 设置行（label/desc + 控件）
│   │   │   ├── SettingBadge.tsx       # 统一徽章（neutral/primary/success/warning/info/error/violet）
│   │   │   ├── SettingListItem.tsx    # 列表项行（版本行/扫描行，支持选中态）
│   │   │   ├── SectionTitle.tsx       # PageHeader/SectionTitle（HeroUI Typography）
│   │   │   ├── controls.tsx           # 设置控件（Select/NumberField/Switch/Radio/TextArea/FilePicker + fieldCls）
│   │   │   └── Surface.tsx            # Surface 兼容别名（旧 API，样式与卡片统一）
│   │   ├── about-version/              # 版本更新内容展示
│   │   │   ├── parse.ts                # release-notes 解析（details 切块 + conventional commit 分类）
│   │   │   └── index.tsx               # AboutVersion 组件（getReleaseNotes → 分类卡片）
│   │   ├── feedback/                    # 反馈表单按钮
│   │   │   └── FeedbackButton.tsx       # HeroUI 按钮 → 系统浏览器打开 YouTrack 表单直链
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
│   │   ├── config.ts          # AppConfig 读写 + updateConfig(section, patch)
│   │   ├── auth.ts            # 登录 API
│   │   ├── background.ts      # 背景控制
│   │   ├── install.ts         # Minecraft 安装
│   │   ├── launch.ts          # 统一游戏启动 (launchGame / onGameEvent)
│   │   ├── java.ts            # Java 检测 (scanJava / resolveJava)
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
│   │   ├── launch-options.ts    # 配置→LaunchOption 映射 (parseArgs/buildLaunchOptions/resolveJavaPath)
│   │   ├── paths.ts             # 相对 gameDir 归一化 (resolveGamePath)
│   │   ├── device-id.ts         # 设备唯一标识（主板/硬盘/BIOS 指纹 → MachineGuid 回退 → SHA-256 UUID 样式）
│   │   ├── modrinth.ts          # Modrinth/CurseForge API
│   │   └── instance.ts          # 实例管理（含 importExistingInstance sourceGamePath）
│   ├── handlers/                # IPC 处理器
│   │   ├── config.ts            # 配置读写 + config:update/config:changed
│   │   ├── auth.ts              # 认证操作
│   │   ├── install.ts           # 安装操作
│   │   ├── launch.ts            # 统一游戏启动 + afterLaunch
│   │   ├── java.ts              # Java 检测 (java:scan / java:resolve)
│   │   ├── mods.ts              # Mod 操作
│   │   ├── instance.ts          # 实例操作（gamePath 统一 resolveGamePath）
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
| 用户设置 | 打包：`app.getPath('userData')/Koring.yml`；开发：项目根 `Koring.yml` | YAML | 所有可配置项 |
| 认证数据 | 打包：`userData/koring-auth.json`；开发：项目根 | JSON | token/xboxProfile |
| 崩溃日志 | 打包：`userData/koring-crash.log`；开发：项目根 | JSONL | 崩溃记录，max 1000 行 |
| 任务历史 | localStorage `koring-task-history` | JSON | 临时，max 50 |

> 打包模式统一使用系统用户数据目录，避免安装到 Program Files 等只读目录时写入失败。
> 旧版「exe 旁」文件在启动时由 `migrateLegacyFiles()`（`electron/main.ts`）自动复制迁移，复制不删除。

### 主进程权威写入模型（single source of truth）

```
渲染进程 setX(patch) ──config:update {section, patch}──▶ 主进程 updateConfig()
                                                          ├─ 深度合并到内存缓存（getConfig()）
                                                          ├─ 300ms debounce 稀疏写盘（saveConfig）
                                                          └─ 广播 config:changed（完整配置）
渲染进程 onConfigChanged ──▶ configStore.applyChanged() 覆盖本地镜像
```

- 主进程内存缓存（`electron/config.ts` 的 `current`）是唯一权威；**渲染进程不直接写盘**。
- 启动游戏（`launch:launch`）直接读内存 `getConfig()`，保证永远用最新配置，无磁盘竞争。
- 退出时 `flushConfig()`（`window-all-closed`）强制写盘。
- 认证（Koring 账户）同步进配置时同样走 `updateConfig({ koringUser })` / `deleteConfigKey('koringUser')`。

### Koring.yml 结构

```yaml
version: 1
oobe: true                # 首次启动引导完成标记

app:
  language: zh-CN         # zh-CN | en-US（语言包开发中，仅保存偏好 + <html lang>）

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
  gameDirs: []            # 已添加的游戏目录列表

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
  server:                 # 快速进入服务器（ip 空则不自动加入）
    ip: ""
    port: 25565

download:
  fileSource: mirror      # mirror | official | official-only
  versionSource: mirror
  threads: 16             # 1-64
  speedLimit: 0           # KB/s, 0=不限速

network:
  securityId:
    enabled: false
    authUrl: ""

ui:
  showInstanceTitle: true # 首页实例标题
  showTaskButton: true    # 标题栏任务队列按钮
```

### 向上兼容策略

1. **版本号** — `version` 字段，每次结构变更递增
2. **默认值填充** — 加载时缺失字段自动补全，不丢数据（`loadConfig` 与 `DEFAULTS` 深度合并）
3. **迁移函数** — 结构变更时在 `migrate()` 中按版本链执行
4. **未知字段保留** — YAML 解析器保留不认识的字段
5. **Debounce 写入** — 主进程 300ms debounce 稀疏写盘，避免频繁 IO
6. **稀疏保存** — `diffValue(config, DEFAULTS)` 只写非默认值；默认值改回后从文件移除

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
| `config:get` / `config:update` / `config:save` | 配置读写；`config:update` 提交 `{section, patch}`，主进程合并 + debounce 写盘 + 广播 `config:changed` |
| `config:changed`（事件） | 主进程广播完整配置，渲染端 `configStore.applyChanged` 覆盖镜像 |
| `config:preload`（事件） | 启动时推送初始配置 + isFirstLaunch |
| `auth:offline-login` / `auth:get` / `auth:save` / `auth:delete` | 认证操作 |
| `install:minecraft` / `install:mod-loader` / `install:version-list` | 安装操作 |
| `launch:launch` / `launch:diagnose` | 统一游戏启动：`{instanceName, gamePath, profile, server?}`；主进程读权威配置 → `buildLaunchOptions` → `@xmcl/core launch`；事件经 `launch:event` 推送（stdout/stderr/window-ready/exit） |
| `java:scan` / `java:resolve` | Java 环境检测（JAVA_HOME/PATH/常见目录）/ 路径校验 |
| `mods:search` / `mods:install` | Mod 操作 |
| `instance:create` / `instance:list` / `instance:delete` / `instance:install` / `instance:import` | 实例操作（启动统一走 `launch:launch`） |
| `background:set-image` / `background:set-color` / `background:reset` | 背景操作 |
| `task:progress` / `task:completed` | 任务进度 |
| `system:info` / `system:open-path` | 系统信息 / 打开路径 |
| `window:minimize` / `window:maximize` / `window:close` | 窗口控制 |
| `window:openSplash` / `window:closeSplash` | Splash 管理 |
| `dialog:openFile` / `dialog:openFolder` | 文件/文件夹选择器 |

### 游戏启动链路（配置驱动）

```
launchStore.launch(instanceName, gamePath)
  → launchGame({instanceName, gamePath, profile, server?})   # src/api/launch.ts
  → ipc launch:launch                                        # electron/handlers/launch.ts
      → getConfig()               # 主进程内存权威配置
      → getInstanceInfo()         # 实例 runtime / path / 健康检查
      → resolveJavaPath()         # config.javaPath → 系统扫描 → PATH
      → buildLaunchOptions()      # electron/core/launch-options.ts（配置→LaunchOption 映射）
      → @xmcl/core launch() + createMinecraftProcessWatcher
      → 事件 launch:event（stdout/stderr/window-ready/exit）+ playtime 累计
      → window-ready 时按 advanced.afterLaunch 处理启动器窗口（close/minimize/keep）
```

**配置 → 启动参数映射**（`buildLaunchOptions`）：

| 配置字段 | 映射 |
|---|---|
| `java.memMode=auto` | 实例 minMemory/maxMemory（未设则 1024/4096） |
| `java.memMode=custom` | `min=min(2,memGB)G`，`max=memGB G` |
| `java.gc=zgc/g1` | `-XX:+UseZGC` / `-XX:+UseG1GC` |
| `java.jvmArgs` | 引号感知 `parseArgs` 并入 `extraJVMArgs` |
| `advanced.gameArgs` | `parseArgs` 并入 `extraMCArgs` |
| `advanced.winMode` | `resolution`（fullscreen / custom 宽高） |
| `advanced.preLaunchCmd` | `prependCommand`（Windows 批处理需 `cmd /c` 前缀） |
| `advanced.debugMode` | `-Dkoring.debugMode=true` + 日志流 |
| profile / server | `gameProfile`+`accessToken` / `server` |

---

## Zustand Stores

### configStore (主进程权威模型的渲染端镜像)

配置的渲染端镜像。所有 setter 只向主进程提交 `{section, patch}`（`config:update`），不直接写盘；主进程合并后广播 `config:changed`，`applyChanged` 以广播为准覆盖本地。

```ts
config: AppConfig       // 完整配置（镜像）
loaded: boolean         // 是否已加载

init()                  // 兜底：从主进程加载配置（config:get）
applyPreloaded()        // 启动预载（config:preload）
applyChanged()          // 主进程广播覆盖（config:changed）
setTheme(patch)         // 乐观更新本地 + submit("theme", patch)
setA11y(patch)
setBackground(patch)
setGame(patch)
setJava(patch)
setAdvanced(patch)
setDownload(patch)
setNetwork(patch)
setInstances(list)      // 数组整体替换
setOobe(value)
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

### 设置原语与控件规范（HeroUI 3）

所有设置子页面共用 `src/components/setting/` 原语，**一套样式组合**：

| 原语 | 说明 |
|---|---|
| `SettingSurface` | 卡片唯一原语（HeroUI Surface + 磨砂 blur + rounded-xl + 统一边框/背景） |
| `SettingCard` | 设置卡片（= SettingSurface + px-5 py-4） |
| `SettingRow` | 设置行（label/desc 用 HeroUI Typography + 右侧控件） |
| `SectionTitle` / `PageHeader` | HeroUI Typography.Heading / Paragraph |
| `SettingBadge` | 统一徽章：neutral / primary / success / warning / info / error / violet |
| `SettingListItem` | 列表项行（版本行/扫描行，支持 selected 高亮） |
| `SettingSelect` / `SettingNumberField` / `SettingSwitch` / `SettingRadioGroup` / `SettingTextArea` / `SettingFilePicker` | HeroUI 控件封装 |
| `fieldCls` | 输入框统一样式类（见下方注意） |

**HeroUI 3 控件要点（易踩坑）**：

1. **事件用 `onChange` 而非 `onValueChange`**——HeroUI 3 基于 react-aria，`onValueChange` 不存在且静默失效（全项目已统一修复）。
2. **Radio 必须显式渲染圆点**：`<Radio.Control><Radio.Indicator /></Radio.Control>`，否则无选中指示器。
3. **field 默认无边框**：HeroUI 默认主题 `--field-border-width: 0px`，Input/TextArea/NumberField/Radio 需叠加 `fieldCls`（或等价边框类）保证视觉完整；Select.Trigger 已内置边框类。
4. **Select 单选**：`selectedKey` + `onSelectionChange`（回调可能是 `Key | null` 或 `Set<Key>`，控件内已做兼容）。
5. **NumberField**：Group 内需显式渲染 Increment/Decrement 按钮。

### 游戏目录版本识别（设置页 → 导入）

- 扫描任意目录（主目录 / 已添加目录）→ `instance:scan-dir` → `scanGameDirectories`（读 `versions/` 子目录，检测 JSON/JAR 健康度与 Forge/Fabric/Quilt/OptiFine 加载器）。
- **导入源 = 当前扫描目录**：`handleImport`/`handleImportAll` 传 `scanTarget` 作为 `sourceGamePath`，实例仍创建在主库 `gameDir/instances/`。
- **主目录变更自动重扫**（`useEffect([gameDir])`），旧结果先清空。
- **批量导入幂等**：先取 `listInstances` 名集合，已存在实例跳过并计入「跳过」。
- **相对 gameDir 归一化**：`electron/core/paths.ts` 的 `resolveGamePath` 在 IPC 边界（instance/launch/task）统一应用，相对路径按 exe 目录（打包）/ 项目根（开发）解析，与 `.minecraft` 创建位置一致。

### 设置子页面状态（参考 PCL2 组织）

| 分组 | 页面 | 状态 | 对接 |
|---|---|---|---|
| 通用 | 主页 / Koring 账户 / 关于 / 版权 | 保留 | — |
| 游戏 | 游戏账户&档案 | 实装 | `auth:offline-login`（离线账号）；微软按钮占位 |
| 游戏 | Java虚拟机与内存 | 实装 | `java:scan` / `java:resolve` / `java.*` |
| 游戏 | 游戏目录 | 实装 | `instance:scan-dir` / `instance:import`（sourceGamePath） |
| 游戏 | 高级设置 | 实装 | `advanced.*`（含快速进入服务器 `advanced.server`） |
| 个性化 | 主题与背景 | 实装 | `theme.*` / `background.*` |
| 个性化 | 主界面 | 实装 | `ui.showInstanceTitle` / `ui.showTaskButton`（应用到 InstanceTitle / WindowControls） |
| 个性化 | 语言 | 实装 | `app.language`（保存 + `<html lang>`；语言包开发中） |
| 个性化 | 辅助功能 | 实装 | `a11y.*` |
| 网络 | 下载 | 实装 | `download.*` |
| 网络 | 安全识别服务 | 实装 | `network.securityId` |
| 网络 | 以太联机 / 陶瓦联机 | 占位 | 无后端接口 |
| 其他 | 服务与反馈 / 赞助我们 / 开发者选项 | 保留 | — |

### 版本更新内容（AboutVersion）

- `src/components/about-version/`：AboutVersion 组件通过 `getReleaseNotes()`（GitHub release-notes.md，主进程自动切加速源、回退最新版）拉取**当前版本**说明，经 `parseReleaseNotes()` 解析后按提交类型分组，每组卡片 + 图标展示（feat 新增 / fix 修复 / perf 优化 / refactor 重构 / docs 文档 / other 其他）。
- **OOBE / UPvP 流程**：`版本卡片 → 关于此版本 → …`（`oobe/about-version`、`upvp/about-version` 引用 AboutVersion；原 step-version 的下一步分别指向这两个新页）。
- **Release notes 受控格式约定（与 CI release 模板对齐）**：`## 更新了什么内容` 下每条变更一个 `<details>`（`<summary>·Commit {sha}</summary>`，正文首行为 conventional commit `type(scope): subject`，换行后为说明）；无提交时写 `· 无提交记录`。解析器亦兼容无 details 的列表兜底。
