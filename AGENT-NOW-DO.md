<!--
//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/

// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发
-->

# 欢迎来到 AGENT-NOW-DO

AGENT-NOW-DO是一个综合型列表，它记录了所有已完成的功能并且简要的描述了该功能提供了什么接口，他现在UI情况，还有进度。

如果你是AGENT请按照下列要求进行填写：
1.标题请填写这个功能的简要描述
2.内容请填写这个功能提供了什么接口，他现在UI情况，还有进度。
3.请填写这个功能的进度，100%表示已完成。
4.如果这个功能的UI情况是已完成，那么请填写已完成。

```markdown
标题：[功能描述]
内容：[接口描述]
进度：[进度]
```

# AGENT-NOW-DO

> 记录本次「以 Aurora.Craft 功能结构为蓝本，补齐 koring-launcher 后端能力并预留数据接口」全过程的调研结论、代码改动、接口定义与待决策项。
> 本次**不涉及 UI 实现**，UI 由人工设计；本文件即为「数据接口契约 + 功能清单」的交接文档。

- 参考项目：`D:\github-code-plan\Aurora.Craft`（只读，未做任何修改）
- 目标项目：`c:\Users\ab090\Documents\GitHub\koring-launcher`
- 完成时间：2026-10-23

---

## 0. 一句话结论

Aurora.Craft 的主链路（Bun + mirinjs + 自研安装器）**不可直接替换**本项目（Electron + @xmcl），但它的**功能结构**（安装 / 实例 / 启动 / 资源 / 配置 / 窗口 / 任务 七块）可以作为接口划分蓝本。

本次已按该结构**补齐本项目缺失的后端能力**，并对外暴露了带完整 TypeScript 类型的 IPC 数据接口；主进程编译通过。

---

## 1. 调研结论

### 1.1 Aurora.Craft 的功能结构（完整清点）

它只有 **8 个控制器、约 15 个接口**。

| 模块 | 提供的功能 | 设置项 | 显示内容 |
|---|---|---|---|
| `install` | 拉版本清单、安装实例、拉加载器版本 | `mcVersion`、`loader.type/version`、`library`、`name`、`url` | 版本号、加载器类型、加载器版本、安装位置 |
| `instance` | 查重、读配置、扫描 | `library`、`name` | `name` / `version` / `loader` 三字段 |
| `launch` | 启动游戏 | `library`、`name` | 无 |
| `modrinth` | 通用搜索 | `query`、`facets`、`index`、`offset`、`limit` | 图标、标题、简介、下载量、关注、分类、环境、许可、画廊 |
| `tool` | 默认安装目录 | 无 | 一个 OS 数据目录路径 |
| `config` | 按名字读写 TOML | `name`（settings 等） | 原始键值 |
| `window` | 最小化、关闭 | 无 | 无 |
| `event.task` | 任务进度广播 | 无 | `id` / `status` / `progress` / `detail` / `expand` |

UI 页面只有 5 个：主页、下载页（游戏/整合包 Tab）、实例页、设置页、任务抽屉。

### 1.2 三个硬阻塞（决定「不能直接替换」）

| 阻塞点 | Aurora.Craft | koring-launcher |
|---|---|---|
| 运行时 | Bun（`Bun.file` / `Bun.write` / `Bun.CryptoHasher`）+ `mirinjs` `rpc.router` + `ky` + `smol-toml` | Electron / Node + `@xmcl/*` + `ipcMain.handle` + JSON / YAML |
| 下载源 | 硬编码官方源（`piston-meta.mojang.com` / `resources.download.minecraft.net`） | BMCLAPI 多源 + 自定义源（`download-options.ts` 唯一入口） |
| UI 栈 | shadcn/Radix + motion + valtio + TanStack Query + tabler icons | HeroUI + zustand + sonner |

### 1.3 逐能力对照

| 能力 | Aurora.Craft | koring-launcher | 判定 |
|---|---|---|---|
| 原版安装 | 自研（jar sha1 校验、libraries 并发 16、assets 并发 32、natives marker） | `installTask` + `installDependenciesTask` | 保留本项目 |
| Forge / NeoForge | **未实现**（UI 仅文案占位） | `task.ts` 已实现四种加载器 | 保留本项目（替换即倒退） |
| Fabric / Quilt | 自研 profile 注入 | `installFabric` / `installQuiltVersion` | 保留本项目 |
| 启动 | `spawn javaw` + 手拼参数 + 写死 `far1sh` / 假 UUID / `-Xmx4G` | `@xmcl/core` launch + watcher + playtime 累计 | 保留本项目 |
| Java 管理 | 无 | `java:scan` / `java:resolve` / `java:plan` | 保留本项目 |
| 账户 | 无 | 离线 + 正版 + Koring OIDC | 保留本项目 |
| 实例元数据 | `ac.config.toml`，仅 3 字段 | `instance.json`，20+ 字段 | 保留本项目 |
| 实例查重 | `readdir().length > 0`（空目录漏判） | 见本次补齐 `instance:check` | 本项目更强 |
| 安装位置（多目录） | **有**（`settings.library[]`） | 原本缺失 | **本次补齐** |
| 加载器版本列表 | fabric / quilt | forge / fabric / quilt（缺 neoforge） | **本次补齐 neoforge** |
| Modrinth 搜索排序 | 有 `index` | 缺 `index` | **本次补齐** |

### 1.4 借鉴但不移植的 4 处

1. 加载器版本下拉（真实列表，而非手输）—— 本次已由 `instance:loader-catalog` 支持。
2. 下载速度显示（250ms 采样 + 0.3 指数平滑）—— 依赖 Bun writer + ky，**未移植**；如需做，见第 8 节。
3. 并发重试退避 —— `@xmcl` 已有校验与重试，**未移植**。
4. 多安装位置 —— 已用 `config.game.gameDirs` 复用实现，**未新增配置字段**。

### 1.5 顺带发现：本项目的死代码

- `electron/core/installer.ts` 是早期自研实现（无 natives / assets，`installModLoader` 为空壳）。
- 消费链：`src/api/install.ts` → `src/stores/installStore.ts`，而 `useInstallStore` 仅被 `src/stores/index.ts` 导出，**无任何组件消费**。
- 真实安装走 `executorName: "install"`（`electron/core/task.ts`）。
- 该文件的 `MIRROR_RULES` / `rewriteToMirror` 与 `electron/core/download-options.ts` **完全重复**。
- 本次**未删除**（避免超出「预留接口」范围），建议后续单独提交清理。

---

## 2. 代码改动清单

### 2.1 `electron/core/instance.ts`

新增 4 个区块，并改动 1 处既有函数。

#### (1) 引入路径解析

```ts
import { resolveGamePath } from './paths';
```

#### (2) 实例名校验（新）

- `RESERVED_DEVICE_NAMES`：Windows 保留设备名（CON / PRN / AUX / NUL / COM1-9 / LPT1-9）。
- `MAX_INSTANCE_NAME_LENGTH = 64`。
- `InstanceNameProblemCode`：`empty | too-long | invalid-char | reserved-name | exists | location-missing`。
- `InstanceNameCheck`：预检结果结构。
- `normalizeInstanceName(raw)`：仅 `trim()`，内部空白是否替换交由 UI 决定。
- `validateInstanceName(name)`：纯格式校验（不查磁盘）。
- `checkInstanceName(name, gamePath)`：格式 + 目录占用 + **大小写不敏感的同名冲突**。
- `assertValidInstanceName(name)`：落盘前强校验，非法直接抛错。

与 Aurora 的差异：Aurora 用「目录非空」判定重名，存在「同名空目录漏判」；本实现判定目录存在即冲突，并额外报告大小写冲突。

#### (3) 安装位置与多目录聚合（新）

- `InstallLocation`：`path` / `resolvedPath` / `label` / `isDefault` / `exists` / `writable` / `instanceCount` / `versionCount`。
- `listInstallLocations()`：默认目录 = `config.game.gameDir`（首位），其余 = `config.game.gameDirs`；按解析后路径去重。
- `InstanceWithLocation extends InstanceInfo`：额外 `gamePath` / `locationLabel` / `isDefaultLocation`。
- `listAllInstances()`：跨所有位置扫描，单位置损坏不影响其他位置，按 `lastPlayedDate` 倒序。
- 内部工具：`countSubdirectories` / `isWritable` / `normalizeForCompare`。
- **未新增配置字段**：直接复用 `game.gameDirs`（语义 = 额外游戏目录 = 另一个安装位置）。

#### (4) NeoForge 版本列表（新）

`@xmcl/installer` 只提供 `installNeoForged`，**没有版本列表 API**，因此改读 maven 元数据：

- `NEOFORGE_MAVEN_BASES`：优先 `bmclapi2.bangbang93.com/maven`，回退 `maven.neoforged.net/releases`。
- `fetchMavenVersions(artifactPath)`：请求 `maven-metadata.xml`，正则提取 `<version>`，带 10 分钟内存缓存。
- `compareVersionDesc(a, b)`：纯数字段按数值倒序，含非数字段退回字符串比较。
- `neoForgeArtifactFor(mcVersion)`：
  - `1.20.1` 及更早 → `net/neoforged/forge`，前缀 `47.`
  - `1.20.2+` → `net/neoforged/neoforge`，前缀 `<minor>.<patch>.`（`1.20.4` → `20.4.`）
- `getNeoForgeVersionList(mcVersion?)`。

#### (5) 加载器目录（新）

- `LoaderType`：`none | fabric | quilt | forge | neoforged`
- `LoaderOption`：`type` / `label` / `requiresVersion` / `supported` / `versions[]` / `latest` / `note?`
- `getLoaderCatalog(mcVersion?)`：并行拉四种加载器，**单个失败不影响其他**（该加载器 `versions` 为空并写 `note`）。

#### (6) 改动既有函数：`createInstance`

```diff
 ): InstanceInfo {
+  assertValidInstanceName(name);
   const instancePath = path.join(gamePath, 'instances', name);
   if (exists(instancePath)) {
-    throw new Error(`Instance already exists: ${name}`);
+    throw new Error(`已存在同名实例：${name}`);
   }
```

效果：非法字符 / 保留名 / 超长名称在创建时直接报错，避免产生无法迁移的目录。`importExistingInstance` 内部也走 `createInstance`，因此同样受保护。

### 2.2 `electron/handlers/instance.ts`

新增 import 与 **5 个 handler**：

| 通道 | 入参 | 返回 | 说明 |
|---|---|---|---|
| `instance:check` | `{ name, gamePath }` | `InstanceNameCheck` | 安装表单实时校验 |
| `instance:locations` | — | `InstallLocation[]` | 所有安装位置 |
| `instance:list-all` | — | `{ locations, instances }` | 跨位置聚合实例 |
| `instance:neoforge-version-list` | `{ mcVersion? }` | `string[]` | 新增加载器列表 |
| `instance:loader-catalog` | `{ mcVersion? }` | `LoaderOption[]` | 安装表单一次性元数据 |

均沿用既有 `ok()` / `fail()` 包装，返回 `{ success, data, error }`。

### 2.3 `electron/core/modrinth.ts`

#### 类型扩充

`ModSearchResult` 新增：`author` / `projectType` / `follows` / `latestVersion` / `license` / `gallery` / `featuredGallery` / `color` / `clientSide` / `serverSide` / `dateCreated` / `dateModified`。

新增导出类型：`ModSearchIndex = 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated'`。

#### 搜索支持排序

- `searchModrinth(..., index)`：向 Modrinth 搜索接口透传 `index`。
- `searchMods(..., index)`：新增末位参数并透传。

#### 详情字段补全

`getModDetail` 从 `/project/{id}` 映射：`followers → follows`、`published → dateCreated`、`updated → dateModified`、`license.name → license`、`gallery[] → gallery[]` + `featuredGallery`，并补 `projectType` / `color` / `clientSide` / `serverSide`。

### 2.4 `electron/handlers/mods.ts`

`mods:search` 负载新增可选 `index`，透传给 `searchMods`。

### 2.5 `src/api/instance.ts`（渲染端接口层）

新增类型与函数：

```ts
getNeoForgeVersionList(mcVersion?) => Promise<string[]>

type InstanceNameProblemCode
interface InstanceNameCheck
checkInstanceName(name, gamePath) => Promise<InstanceNameCheck>

interface InstallLocation
getInstallLocations() => Promise<InstallLocation[]>

interface InstanceWithLocation extends InstanceInfo
listAllInstances() => Promise<{ locations; instances }>

type LoaderType
interface LoaderOption
getLoaderCatalog(mcVersion?) => Promise<LoaderOption[]>
```

### 2.6 `src/api/mods.ts`（渲染端接口层）

- `ModSearchResult` 同步新增 12 个可选字段。
- 新增 `ModSearchIndex`、`ModProjectType`（`mod | modpack | resourcepack | shader`）。
- `searchMods(...)` 新增末位参数 `index`。

---

## 3. 接口契约（给 UI 用）

```
InstanceNameCheck {
  name, normalized, path,
  available, code, reason,
  conflicts: string[]
}
code: empty | too-long | invalid-char | reserved-name | exists | location-missing

InstallLocation {
  path, resolvedPath, label,
  isDefault, exists, writable,
  instanceCount, versionCount
}

InstanceWithLocation extends InstanceInfo {
  gamePath, locationLabel, isDefaultLocation
}

LoaderOption {
  type, label, requiresVersion, supported,
  versions: string[], latest, note?
}

ModSearchIndex  = relevance | downloads | follows | newest | updated
ModProjectType  = mod | modpack | resourcepack | shader
```

### 3.1 已可直接使用的既有接口（无需新增）

| 能力 | 通道 |
|---|---|
| Minecraft 版本清单 | `instance:version-list` |
| 加载器版本（单独拉） | `instance:forge/fabric/quilt-version-list` |
| 创建实例 | `instance:create` |
| 安装 / 修复（事件推送） | `instance:install` / `instance:repair` → `instance:progress` + `instance:install-complete` |
| 实例 CRUD | `instance:list` / `instance:info` / `instance:update` / `instance:delete` |
| 实例图标 | `instance:icon` / `instance:set-icon` / `instance:reset-icon` |
| 启动 / 诊断 | `launch:launch` / `launch:diagnose` |
| 实例启动环境体检 | `instance:launch-info` |
| 资源搜索 | `mods:search` / `mods:categories` / `mods:game-versions` |
| 资源详情与版本 | `mods:detail` / `mods:versions` |
| 资源安装 | `mods:install`（`gamePath` 可传 `InstanceInfo.path`） |
| 任务控制 | `task:start` / `task:cancel` / `task:pause` / `task:resume` |
| 任务事件 | `task:progress`（`event`: started / progress / log / paused / resumed / cancelled / completed / failed） |
| 配置 | `config:get` / `config:update` / `config:save` / `config:reset` |
| Java | `java:scan` / `java:resolve` / `java:plan` |
| 窗口 | `window:minimize` / `window:maximize` / `window:close` / `window:isMaximized` |
| 目录选择 | `dialog:openFile` / `dialog:openFolder` / `system:open-path` |

---

## 4. 设置项清单

### 4.1 全局配置（`config:update`，按 section patch）

| 分区 | 字段 | 含义 |
|---|---|---|
| `game` | `gameDir` | 默认游戏目录（即默认安装位置） |
| | `gameDirs[]` | 额外游戏目录 → **即安装位置列表** |
| | `resourceDir` | 共享 resources 目录（留空 = 实例自包含） |
| `java` | `autoJavaPath` / `javaPath` | 自动选择 / 手动指定 |
| | `memMode` / `memGB` | 内存模式 / 大小 |
| | `gc` / `jvmArgs` | GC 策略 / 额外 JVM 参数 |
| `download` | `source` | `official` / `bmclapi` / `custom` |
| | `threads` | 并发数 |
| | `customVersionManifest` / `customMavenHost` / `customAssetsHost` | 自定义源 |
| `advanced` | `debugMode` | 落盘日志（`koring.log`） |
| | `preLaunchCmd` / `afterLaunch` | 前 / 后置命令 |
| | `winMode` / `customWidth` / `customHeight` | 窗口模式与尺寸 |
| | `gameArgs` | 额外游戏参数 |
| | `server{ ip, port }` | 启动后自动进服 |
| `ui` | `showInstanceTitle` / `showTaskButton` / `showQuickActions` | 界面开关 |
| | `homeTitleDetail` | 副标题：`version` / `loader` / `playtime` / `none` |
| `background` | `bgType` / `image` / `blur` / `opacity` | 背景类型 / 图片 / 模糊 / 透明度 |
| `appInfo` | `language` | 界面语言 |

> 另有 `theme` / `a11y` / `activation` / `securityId` / `network` / `update` 等分区，字段见 `electron/config.ts`。

### 4.2 实例级配置（`instance:update`，写入 `instance.json`）

`runtime{ minecraft, forge, neoForged, fabricLoader, quiltLoader, optifine }`、`launchVersion`、`resourcePath`、`importMode`、`java`、`minMemory` / `maxMemory`、`vmOptions[]`、`mcOptions[]`、`server`、`showLog`、`hideLauncher`、`icon`、`favorite`、`category`、`creationDate` / `lastAccessDate` / `lastPlayedDate` / `playtime`。

### 4.3 安装表单可选项（本次接口直接提供）

| 表单项 | 数据来源 | 可用选项 |
|---|---|---|
| Minecraft 版本 | `instance:version-list` | `release` / `snapshot` / `old_beta` / `old_alpha` |
| 加载器类型 | `instance:loader-catalog` | 原版 / Fabric / Quilt / Forge / NeoForge（均 `supported: true`） |
| 加载器版本 | 同上 `versions[]` | 真实版本列表，新→旧，`latest` 可预选 |
| 实例名称 | `instance:check` | 实时校验：非法字符、保留名、长度、重名、大小写冲突 |
| 安装位置 | `instance:locations` | 默认 + 额外目录，含 `writable` 与 `instanceCount` |

---

## 5. 每块功能应显示什么（数据字段映射）

| 页面 | 展示内容 | 数据字段 |
|---|---|---|
| 下载 / 版本列表 | 版本号、类型图标（正式/测试/旧版）、发布时间 | `id`、`type`、`releaseTime` |
| 安装表单 | 名称、三个下拉、实时错误提示 | `InstanceNameCheck.reason`、`LoaderOption.label/versions/latest/note`、`InstallLocation.label` |
| 实例列表 | 图标、名称、版本、加载器、最近游玩、分类/收藏、健康状态、所属位置 | `InstanceWithLocation` 全字段 |
| 实例详情 | 启动将用哪个版本、资源根、缺什么、一键修复 | `launch.versionId/via/resourceRoot/gameRoot`、`dependency.ready/missingLibraries/missingVersions/missingJar/missingAssetIndex` |
| 资源浏览 | 图标、标题、简介、下载量、关注、分类、客户端/服务端需求、许可、画廊 | `ModSearchResult` 的 `iconUrl/name/description/downloads/follows/categories/clientSide/serverSide/license/gallery/color` |
| 资源版本列表 | 版本名、游戏版本、加载器、文件名、大小、是否主文件 | `ModVersionResult` |
| 任务中心 | 标题、阶段、进度、日志、暂停/取消 | `Task.title/progress.stage/logs/status`、`task:*` 事件 |
| Java 设置 | 路径、版本、主版本、是否匹配当前 MC | `JavaInfo`、`JavaPlan.requiredMajor/pickedPath` |

> Aurora 的任务字段 `detail`（描述）/ `expand`（右侧补充）在本项目对应 `progress.stage`（阶段）+ `current` / `total`。如需「正在下载 xxx 3/120」这类文案，需要再加一层文本映射（见第 8 节）。

---

## 6. 组件关系

```
┌─────────────────────── 渲染进程 (React) ───────────────────────┐
│                                                                │
│  页面/组件                                                      │
│    ├─ InstallDialog ──► checkInstanceName / getLoaderCatalog    │
│    │                    / getInstallLocations                   │
│    │                    └─► taskStore.addSidecarTask            │
│    │                         (executorName: "install")          │
│    ├─ Gallery ────────► listAllInstances                        │
│    ├─ InstanceDetail ─► getInstanceInfo / diagnoseInstance      │
│    ├─ ResourceBrowse ─► searchMods / getModVersions             │
│    └─ TaskCenter ─────► taskStore ──► onIpcEvent("task:progress")│
│                                                                │
│  src/api/*.ts  ← 唯一出口，全部 ipcInvoke + 类型               │
└────────────────────────────┬───────────────────────────────────┘
                             │ window.electronAPI.invoke / on
┌────────────────────────────▼───────────────────────────────────┐
│                     主进程 (Electron)                           │
│  electron/handlers/*  ── ipcMain.handle，统一 {success,data,error}│
│         │                                                       │
│         ▼                                                       │
│  electron/core/*                                                │
│    ├─ instance.ts ──► @xmcl/installer（安装 / 版本 / 加载器）    │
│    ├─ task.ts ──────► @xmcl/task 任务树 ──► task:progress 广播  │
│    ├─ launcher.ts ──► @xmcl/core launch                         │
│    ├─ modrinth.ts ──► api.modrinth.com                          │
│    ├─ download-options.ts ── BMCLAPI 镜像改写（所有下载唯一入口）│
│    └─ config.ts ──── Koring.yml 稀疏持久化                      │
└─────────────────────────────────────────────────────────────────┘
```

### 三条关键链路

1. **安装**

   `InstallDialog` → `taskStore.addSidecarTask(executorName:"install", params:{ name, gamePath, runtime })`
   → 主进程 `task:start` → `electron/core/task.ts` 子任务树 `create → minecraft → loader → dependencies`
   → `task:progress` 回流 → 任务中心。

   - **不需要先调 `instance:create`**，执行器内部会建。
   - `gamePath` 传 `InstallLocation.resolvedPath` 即可装到任意位置。

2. **列表**

   `listAllInstances()` 一次返回「位置 + 实例」，已按 `lastPlayedDate` 倒序，页面无需自己遍历目录。

3. **名称校验**

   `checkInstanceName` 与 `createInstance` 是**同源判定**（后端也有强校验），UI 只需防抖调用即可。

依赖方向严格单向：`api → handlers → core → @xmcl`，没有任何组件直接触碰 `ipcRenderer` 或 Node API。

---

## 7. 验证结果

| 命令 | 结果 |
|---|---|
| `pnpm build:main`（`tsc -p tsconfig.electron.json`） | **通过**，exit 0 |
| `npx tsc -p tsconfig.json --noEmit`（渲染端） | exit 2，**全部为项目原有报错**，与本次改动无关 |

渲染端既有报错清单（未修复，仅供参考）：

- `src/components/system/TitleBar.tsx` / `WindowControls.tsx` / `src/pages/crash/index.tsx`：`WebkitAppRegion` 不在 `CSSProperties` 类型中（缺少 Electron 样式类型声明）。
- `src/components/ui/select.tsx`：`className` / `Props<string,false>` 类型不匹配。
- `src/pages/crash/index.tsx`：未使用变量 `VERSION`、`crashInfo`。
- `src/pages/debug/task-debug.tsx`：`void` 传给 `string` 参数。
- `src/pages/debug/version-card-debug.tsx`：`overlayOpacity` 不是 `VersionCardProps` 的属性。
- `src/pages/oobe/index.tsx`：期望 1 个参数却传 0 个。
- `src/pages/store/ResourceBrowseView.tsx`：HeroUI `SelectRoot` 不支持 `size`。
- `src/stores/taskStore.ts`：`XmclTaskEvent` 声明未使用。

> 本次新增代码未引入任何新的 TS 错误；错误列表中不含 `src/api/instance.ts`、`src/api/mods.ts`、`electron/core/*`。

---

## 8. 待决策 / 后续可做

### 需要你确认

1. **安装位置是否复用 `game.gameDirs`**
   当前实现按「额外游戏目录 = 另一个安装位置」处理，未新增配置字段。
   若你希望「扫描目录」与「安装位置」是两个独立概念，需新增 `game.installLocations[]`。

2. **任务文案映射**
   是否补 `detail` / `expand` 文本层（如「正在下载 xxx 3/120」），让任务中心信息更完整。

3. **渲染端类型错误**
   上述 8 处既有报错是否要一并修（主要是 `WebkitAppRegion` 类型声明缺失，加一个 `env.d.ts` 声明即可消除大半）。

### 可做的后续项

| 项 | 说明 | 风险 |
|---|---|---|
| 清理死代码链 | 删除 `electron/core/installer.ts`、`src/api/install.ts`、`src/stores/installStore.ts` 及 `stores/index.ts` 导出 | 低（附带消除双份 `MIRROR_RULES`） |
| `InstallDialog` 接新接口 | 把加载器改为真实下拉，位置改为 `instance:locations`，名称为 `instance:check` | 低 |
| NeoForge 安装冒烟测试 | `task.ts` 已实现安装，但版本列表是本次新增，需实测 `1.20.1`（`47.x`）与 `1.20.4+`（`20.4.x`）两条路径 | 中 |
| 下载速度显示 | 渲染端对 `task:progress` 采样（250ms + 0.3 平滑），单位是「进度/秒」而非 MB/s | 中（易误导） |
| 整合包安装 | Aurora 也只是占位（点击无实现），如需做，要引入 modpack 解析（`.mrpack` / CurseForge zip） | 高 |

---

## 9. 明确未做的事（边界声明）

1. **未修改 `D:\github-code-plan\Aurora.Craft` 的任何文件**（纯只读调研）。
2. **未用 Aurora 替换本项目主链路**：其 Forge / NeoForge 未实现、无 Java 管理与账户体系、下载源硬编码官方源，替换会造成功能倒退。
3. **未引入新依赖**：没有加 `smol-toml` / `ky` / `mirinjs` / `valtio` / `tanstack-query`。
4. **未改动任何 UI 组件**，也未新增页面。
5. **未删除既有死代码**（`installer.ts` 链路），仅记录在第 1.5 节。
6. **未执行安装 / 启动的实机验证**，只做了 TypeScript 编译校验。

---

## 10. 本次改动文件总表

| 文件 | 类型 | 说明 |
|---|---|---|
| `electron/core/instance.ts` | 修改 | 实例名校验、安装位置、多目录聚合、NeoForge 版本、加载器目录 |
| `electron/handlers/instance.ts` | 修改 | 新增 5 个 IPC handler |
| `electron/core/modrinth.ts` | 修改 | 排序参数、完整字段、详情补全 |
| `electron/handlers/mods.ts` | 修改 | `mods:search` 支持 `index` |
| `src/api/instance.ts` | 修改 | 新类型与函数（渲染端契约） |
| `src/api/mods.ts` | 修改 | 新类型与 `index` 参数 |
| `AGENT-NOW-DO.md` | 新增 | 本文件 |

---

## 11. 追加：Minecraft 官方资讯（2026-10-24）

标题：Minecraft 官方资讯（资讯页）

内容：主进程拉取 Mojang 官方启动器内容接口，经 IPC 提供给渲染端资讯页展示，支持平台筛选 / 关键字 / 分页 / 强制刷新。接口与类型见下，UI 可继续由人工重设计（数据接口不变）。

进度：后端 100%，资讯页 UI 初版 100%。

### 数据源

- `https://launchercontent.mojang.com/v2/news.json`（与官方启动器同源）
- 条目字段：`title / tag / category / date / text / playPageImage / newsPageImage / readMoreLink / newsType[] / id`
- 图片是相对路径 `/v2/images/xxx.png`，主进程统一拼成绝对地址再下发
- 实测 100 条，按日期倒序（最新 2026-10-20）

### 新增文件

| 文件 | 说明 |
|---|---|
| `electron/core/news.ts` | 官方资讯抓取与归一化：`net.fetch`（15s 超时）、内存缓存 10 分钟、并发去重、图片绝对地址、日期倒序、`listNews` / `getNewsTypes` / `clearNewsCache` |
| `electron/handlers/news.ts` | IPC handler：`news:list`、`news:types` |
| `electron/main.ts` | 注册 `registerNewsHandlers()`（第 19 行 import、`registerAllHandlers()` 内调用） |
| `src/api/news.ts` | 渲染端契约：`NewsEntry` / `NewsListResult` / `NewsQuery` / `getNews()` / `getNewsTypes()` |
| `src/pages/today/index.tsx` | 资讯页：首屏大图 + 卡片网格 + 平台筛选 + **无限滚动（每页 12 条，触底前约一行预加载）** + 刷新 + 骨架屏/错误/空态 |

### IPC 契约

```
news:list  { category?, newsType?, search?, limit?, offset?, refresh? }
        →  { entries: NewsEntry[], total, fetchedAt, cached }

news:types { refresh? } → string[]   // Java / Bedrock / Dungeons / DungeonsII / Legends
```

`refresh: true` 跳过 10 分钟缓存强制刷新；`cached` 表示本次结果是否来自缓存。

### 验证

- `npx tsc -p tsconfig.electron.json --noEmit`：通过
- `npx tsc -p tsconfig.json --noEmit`：23 条报错全部为第 7 节既有清单，新文件零报错
- `npx vite build`：通过
- Electron 运行时冒烟（真实网络）：100 条、缓存命中、`newsType`/`search`/`limit+offset` 过滤、图片绝对地址、日期倒序 —— 全部通过

### 无限滚动与防卡策略

- **分页在主进程**：`news:list` 的 `limit` / `offset` / `newsType` 真正切片，渲染端不持有全量数据；平台 chips 用 `news:types` 从全量推导，不受分页影响。
- **预加载提前量**：每页 12 条（3 列布局 4 行）；底部哨兵用 `IntersectionObserver` + `rootMargin: "0px 0px 420px 0px"`，距列表底部约一行时就开始取下一页（不挂 scroll 监听，主线程零滚动开销）。
- **防卡策略**：
  - 单飞：`loadingRef` 保证同一时刻只有一个请求；
  - 冷却：两次自动加载至少间隔 `320ms`，滚动抖动不会连发；
  - 令牌：`tokenRef` 丢弃过期响应，切筛选/刷新时不会串数据；
  - 追加走 `startTransition`，不阻塞滚动与点击；卡片 `React.memo` + 稳定 `key`，翻页只渲染新增项；按 `id` 去重；
  - 追加期间在网格内渲染同结构同高的骨架卡片，避免布局跳动（CLS）；图片 `loading="lazy"` + `decoding="async"` + 固定宽高比；
  - 内容不足一屏时 `IntersectionObserver` 不会再触发，另有兜底 effect 按冷却节奏补页；到底后不再渲染哨兵；
  - 加载更多失败只在底部行内重试，不清空已加载列表。

### 说明

- 参考项目 `D:\github-code-plan\Aurora.Craft` **没有**资讯功能（全仓 grep 与 git 全量路径均无 `news`/资讯），因此按官方内容接口自建，未移植其代码。
- 平台筛选项由渲染端从数据动态推导（排除无意义的 `News page`），新增平台无需改代码。

---

## 12. 实例页（对齐 PCL-CE 结构，2026-10-25）

标题：实例页（版本管理）
内容：按 `D:\github-code-plan\PCL-CE` 的版本管理页结构（只读参考，不复制其代码/素材）重做实例页：左侧版本列表 + 右侧详情 + 6 个页签；同时补齐实例内模组/存档/截图/资源包的本地管理接口。
进度：主体 100%；整合包安装、崩溃分析、版本导出/快捷方式未做（见「未做」）。

### 页面结构（`src/pages/instance/`）

| 文件 | 职责 |
|---|---|
| `index.tsx` | 页面容器：左栏（搜索/排序/收藏/分类/新建/列表）+ 右侧详情；安装与修复事件、启动、删除确认 |
| `InstanceIcon.tsx` | 实例图标（logo.png → 图片，否则手柄图标） |
| `CreateDialog.tsx` | 新建实例三步向导：基本信息（名称实时校验/显示名/安装位置）→ 版本与加载器（`instance:version-list` + `loader-catalog`）→ 内存与确认（可选创建后立即下载） |
| `InstanceDetail.tsx` | 右侧详情：头部（图标/名称/版本/加载器/路径、启动/修复/体检/打开目录/收藏/删除）+ 不完整提示 + 页签（概览/设置/模组/存档/截图/资源包） |
| `tabs/ModsTab.tsx` | 模组：启用/禁用清单、搜索、批量启停/删除、逐项开关、jar 元数据展示 |
| `tabs/SavesTab.tsx` | 存档：图标/LevelName/大小/时间、备份、删除、打开目录 |
| `tabs/ScreenshotsTab.tsx` | 截图：320px 缩略图网格、点开系统看图、删除 |
| `tabs/ResourcePacksTab.tsx` | 资源包 / 光影包：只读列表（`.disabled`/`.old` 视为禁用）、打开目录 |

路由：`src/App.tsx` 的 `gallery` 路由由 `GalleryPlaceholder` 改为 `InstancePage`（路由 key 仍为 `gallery`，顶栏标签仍是「实例」）。

### 新增 IPC 契约

```
instance:mods-list          { instancePath } → { mods: LocalModInfo[], disabled: LocalModInfo[] }
instance:mods-set-enabled   { instancePath, fileNames, enabled } → { changed: string[], skipped: string[] }
instance:mods-delete        { instancePath, fileNames } → { changed: string[], skipped: string[] }

instance:saves-list         { instancePath } → SaveInfo[]
instance:saves-delete       { instancePath, dirNames } → { deleted: string[], failed: {name,error}[] }
instance:saves-backup       { instancePath, dirNames } → string[]   // 备份目录路径
instance:screenshots-list   { instancePath } → ScreenshotInfo[]
instance:screenshots-delete { instancePath, fileNames } → { deleted: string[], failed: {name,error}[] }
instance:resourcepacks-list { instancePath } → ResourcePackInfo[]
```

类型（渲染端 `src/api/instance-mods.ts` / `src/api/instance-assets.ts`）：

- `LocalModInfo { fileName, filePath, enabled, sizeBytes, displayName, version, modLoader, description, metaParsed, iconDataUrl? }`
- `SaveInfo { dirName, dirPath, levelName, hasLevelDat, sizeBytes, lastModified, iconDataUrl }`
- `ScreenshotInfo { fileName, filePath, sizeBytes, mtime, thumbDataUrl }`
- `ResourcePackInfo { fileName, rawFileName, filePath, kind: 'resourcepack'|'shaderpack', sizeBytes, enabled, mtime }`

### 关键实现要点

- **启用/禁用语义（对齐 PCL-CE）**：禁用 = 文件名追加 `.disabled`；`.old` 也视为禁用；启用 = 去掉后缀。依据 `PageInstanceCompResource.xaml.cs:2054-2061`、`ModLocalComp.cs:415-425`。目标重名时跳过不覆盖。
- **jar 元数据解析不引依赖**：Node 内置 `fs` 读 zip 中央目录 + `zlib.inflateRawSync` 解目标条目，支持 fabric/quilt JSON、`mods.toml`、`neoforge.mods.toml`、`mcmod.info`，zip64/损坏回退文件名。
- **图片不落渲染端**：图标/存档图标/截图缩略图都由主进程 `nativeImage` 压到 64/96/320px 后转 dataURL，避免把 8MB 原图塞进渲染端。
- **存档名**：内置极简 NBT 读取器取 `Data.LevelName`（gzip 自动识别），失败回退目录名。
- **安全**：所有文件名/目录名一律 `basename` 校验并归一化，拒绝路径穿越；缺失文件按空处理不抛错。

### 验证

- `npx tsc -p tsconfig.electron.json --noEmit`：通过（0 输出）
- `npx tsc -p tsconfig.json --noEmit`：23 条既有报错不变，新增文件零报错
- `npx vite build`：通过
- 模组接口自测：67 项断言（清单解析、`.disabled`/`.old` 归属、启停往返、重名冲突、路径穿越、删除幂等）
- 资产接口自测：50 项断言 + 真实 Electron IPC 往返 9/9（通道名与返回结构）
- 主进程启动：`npx electron .` 正常完成「IPC handlers / 资源协议 / 渲染日志桥注册完成」，无重复 handler 报错

### 未做（后续可接）

1. 整合包安装（`.mrpack` / CurseForge zip）与导出整合包；
2. 崩溃分析 / 日志查看 —— **已在第 13 节实现**（实例页「日志」页签）；
3. 资源包/光影的启停写入（当前只读，按 `.disabled`/`.old` 判定）；
4. 版本复制 / 创建快捷方式 / 存档导入导出；
5. 快捷键（PCL 的部分交互细节）；右键菜单已实现（启动 / 打开目录 / 复制实例 ID / 收藏 / 删除）；
6. 模组依赖检查与更新检测（需要 Modrinth 版本比对）。

---

## 13. 崩溃分析 + 任务队列展示对齐（2026-10-25）

标题：崩溃分析（对齐 PCL 能力）
内容：主进程纯本地规则匹配实例的 `crash-reports/` 与 `logs/`，经 IPC 提供给实例页「日志」页签，展示「一句结论 + 证据 + 建议 + 环境信息 + 日志尾部」。
进度：100%（MVP，20 条规则；未做云端原因库与多日志级联）。

### 新增文件

| 文件 | 说明 |
|---|---|
| `electron/core/crash-analysis.ts` | 规则库（20 条）+ 崩溃报告头部元信息解析 + 大文件只读头尾（单个 4MB 上限）+ 日志尾部 80 行；导出 `listCrashLogFiles` / `analyzeInstanceCrash` |
| `electron/handlers/crash-analysis.ts` | `registerCrashAnalysisHandlers()` → `instance:crash-analysis` |
| `src/api/crash-analysis.ts` | 类型（`CrashAnalysisResult` / `CrashFinding` / `CrashMeta` 等）+ `analyzeInstanceCrash()` |
| `src/pages/instance/tabs/LogsTab.tsx` | 结论卡、结论列表（严重度配色 + 置信度 + 证据 + 建议）、环境信息、文件切换、日志尾部折叠、复制结论 |
| `src/pages/instance/InstanceDetail.tsx` | 新增「日志」页签 |
| `electron/main.ts` | 注册 `registerCrashAnalysisHandlers()` |

### 规则覆盖（20 条）

内存不足、32 位 Java 内存上限、Java 过低、Java 过高（与「过低」互斥，避免自相矛盾）、Mixin 注入失败、缺 Mixin 引导、重复模组、缺前置/版本不匹配、模组类缺失、模组初始化失败、Fabric 加载错误、Forge/NeoForge 加载错误、OpenGL 不可用、像素格式不支持、显卡驱动访问冲突、文件校验失败、权限拒绝、资源包过大、OptiFine 与 Forge 冲突、ShadersMod 与 OptiFine 冲突；全部不命中时给 `unknown` 兜底建议。

### IPC 契约

```
instance:crash-analysis { instancePath, fileName? }
  → { files: CrashLogFile[], source: string | null, summary: string,
      findings: [{ id, title, severity, confidence, evidence: string[], suggestion }],
      meta: { minecraftVersion?, javaVersion?, memory?, loader?, description?, causedBy?, exitCode? },
      tail: string[], elapsedMs: number }
```

### 任务队列（PCL 展示对齐）

- 已有：状态徽标、进度百分比、阶段文案、日志展开、暂停/继续/取消/重试/移除；
- 本次补：阶段行追加 `current/total` 计数（即 PCL 的「正在下载 xxx 3/120」效果，`src/components/task/TaskCard.tsx`）。

### 验证

- `npx tsc -p tsconfig.electron.json --noEmit`：通过
- `npx tsc -p tsconfig.json --noEmit`：23 条既有报错不变，新文件零报错
- `npx vite build`：通过
- Electron 运行时自测 21 项断言全过：优先分析崩溃报告、OOM 规则排第一、Mixin 失败命中、meta 解析（MC/Java/内存/加载器/退出码）、指定 `latest.log`、空实例、未知兜底、误报收敛（不再同时报 Java 过新/过旧、Fabric 版本行不再误报）

---

## 14. 设置 →「游戏」五页对齐 PCL（2026-10-25）

标题：设置-游戏分页对齐 PCL 启动设置
内容：按 `plans/pclce-game-settings-spec.md`（498 行分析规格）重做「设置 → 游戏」五个分页；选择器与开关统一改用 shadcn/ui（`@base-ui/react`）组件；补齐 PCL 对应设置项并在启动链真实接线。
进度：100%（可兑现项）；无法兑现项以「暂不支持」说明卡呈现，不做假设置。

### 页面结构（`src/pages/setting/game/`）

| 分页 | 文件 | 内容 |
|---|---|---|
| 游戏（新增） | `game.tsx` | 启动器行为（6 档，含隐藏/退出后关闭/重开）、窗口大小（默认/全屏/自定义+宽高）、快速进服（地址+端口）、IP 协议偏好、暂不支持项说明 |
| 游戏账户&档案 | `game-account.tsx` | 原有账户/档案/登录方式 + 新增「正版验证方式（设备代码流，固定）」说明卡 |
| Java虚拟机与内存 | `java-mem.tsx` | 自动 Java / 预览 / 手动路径 / 扫描列表；新增 `-Xms` 初始内存滑块、锁定内存开关、`java.exe` 开关；内存滑块改用 shadcn Slider（上限 32G） |
| 游戏目录 | `game-dir.tsx` | 原有自动查找/当前目录/共享资源目录/版本导入；新增**目录重命名（显示名）**与**上移/下移排序**，当前目录固定首位 |
| 高级设置 | `advanced.tsx` | 游戏参数尾部、启动前命令、调试模式、暂不支持项说明、危险区「重置本页」；启动器行为/窗口/进服已迁到「游戏」页，不重复 |

侧边栏：`src/pages/setting/index.tsx` 的「游戏」分组新增首项「游戏」（Rocket 图标），共 5 页。

### 组件统一（shadcn/ui）

- `src/components/setting/controls.tsx`：`SettingSelect` 由 HeroUI Select 改为 `@/components/ui/select`（shadcn 风格，`@base-ui/react`），`SettingSwitch` 继续用 `@/components/ui/switch`；
- `src/components/ui/select.tsx`：修掉 `Select` 根组件多余的 `className` 类型（顺带消除 2 条历史 TS 报错，渲染端报错 23 → 21）；
- 内存滑块改用 `@/components/ui/slider`。

### 新增配置字段（主进程 + 渲染端 + store 三处同步）

| 字段 | 类型 | 默认 | 接线点 |
|---|---|---|---|
| `java.initialMemGB` | number | 0（不设置） | `launch-options.ts`：自定义模式下 `-Xms = min(initialMemGB, memGB)` |
| `java.lockMemory` | boolean | false | `launch-options.ts`：为真时 `-Xms = -Xmx` |
| `java.preferredIpStack` | `ipv4` / `default` / `ipv6` | default | `launch-options.ts`：追加 `-Djava.net.preferIPv4Stack=true` / `preferIPv6Stack=true` |
| `java.useJavaExe` | boolean | false | `resolveJavaPath()` 末尾把 `javaw.exe` 换成 `java.exe` |
| `game.dirAliases` | `Record<string,string>` | `{}` | 设置页目录显示名（仅展示，不改路径） |

同时修正两处类型不一致：`src/api/config.ts` 的 `UiConfig` 补 `homeTitleDetail` / `showQuickActions`；`GameConfig` 去掉主进程没有的 `savesDir` / `instancesDir`。
`advanced.afterLaunch` 扩到 6 档（新增 `hide` / `hide-exit` / `hide-reopen`），`electron/handlers/launch.ts` 在 `window-ready` 隐藏窗口、`exit` 时按模式退出或重新显示。

### 不做（写进页面说明，避免假设置）

默认实例隔离档位、游戏窗口标题/左下角版本信息、进程优先级、高性能显卡、渲染器、正版验证方式切换、JLW/LegacyFix/LWJGL Unsafe Agent、下载限速与单文件连接数 —— 均因架构或依赖缺失无法兑现，已在对应分页的「暂不支持」卡片写明原因。

### 验证

- `npx tsc -p tsconfig.electron.json --noEmit`：通过
- `npx tsc -p tsconfig.json --noEmit`：21 条历史报错（比之前少 2 条），新文件零报错
- `npx vite build`：✓ built in 17.19s
- Electron 运行时自测（launch-options）：初始内存 2G / 最大 8G、锁定内存 `-Xms=-Xmx=8G`、`-Xms` 回退 `min(2,memGB)`、IPv4/IPv6 参数注入、default 不注入 —— 6 项断言全过

---

## 15. 版本选择模型：实例页只「选择」，首页负责启动（2026-10-25）

标题：实例页选择版本 + 首页启动
内容：把「选中哪个版本」从实例页的局部状态提升为全局唯一状态，实例页不再启动游戏；首页标题与启动按钮都跟随选中版本；显示名改动即时同步到首页。
进度：100%。

### 行为

- **全局只能有一个选中版本**：配置 `game.selectedInstance: string`（实例 ID，空 = 未选择）作为唯一来源，主进程稀疏保存，重启后由首页恢复。
- **实例页**：详情头部「启动游戏」按钮改为「选择该版本」（已选中时显示「当前选中版本」并禁用）；右键菜单「启动游戏」同步改为「选择该版本」；列表项对选中版本显示绿色对勾。实例页不再发起启动。
- **首页**：`InstanceTitle` 显示选中版本的显示名（`config.description || name`，未选择时显示「选择实例」）；`StartCard` 只启动选中的版本，未选择时提示并跳转实例管理。首页挂载时按 `game.selectedInstance` 恢复选择（`src/stores/instanceStore.ts` 新增 `setCurrent`）。
- **名称编辑**：实例详情头部显示名旁新增铅笔按钮，内联输入框 + 「保存」按钮（Enter 保存 / Esc 取消），调用 `instance:update` 持久化到 `instance.json`；设置页签仍保留带「保存设置」的完整表单。
- **同步**：`fetchInstances` 刷新列表时同步 `currentInstance` 的引用（`src/stores/instanceStore.ts`），保存显示名后首页标题立即更新；删除实例时若删的是选中版本则清空 `game.selectedInstance`。

### 涉及文件

- `electron/config.ts`：`GameConfig.selectedInstance` + 默认值（mergeDeep 保证旧配置文件兼容）
- `src/api/config.ts`、`src/stores/configStore.ts`：同步类型与默认值
- `src/stores/instanceStore.ts`：新增 `setCurrent`；`fetchInstances` 同步 `currentInstance`
- `src/pages/instance/index.tsx`：`selectVersion` 替换 `play`；列表对勾、右键菜单、删除时清理选择
- `src/pages/instance/InstanceDetail.tsx`：`selected` / `onSelect` 替换 `launching` / `onPlay`；头部内联改名 + 保存
- `src/pages/home/index.tsx`：挂载时恢复选中版本
- `src/pages/home/InstanceTitle.tsx`：显示显示名而非实例 ID
- `src/pages/home/StartCard.tsx`：未选择时的提示文案

### 验证

- `npx tsc -p tsconfig.electron.json --noEmit`：通过
- `npx tsc -p tsconfig.json --noEmit`：仅剩历史报错，改动文件零报错
- `npx vite build`：✓ built in 19.68s

### 未做

- 未实机点击验证（需 `pnpm dev` 人工过一遍：实例页选择 → 返回首页看标题 → 启动；改名后回首页看标题是否同步）。
