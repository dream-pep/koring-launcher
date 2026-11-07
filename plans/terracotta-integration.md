# 陶瓦联机（Terracotta）集成方案与契约

> 上游项目：<https://burningtnt.github.io/Terracotta/> · 仓库 <https://github.com/burningtnt/Terracotta>
> 本文是实现契约：主进程、渲染端、打包脚本三方按此文档并行开发，字段名与取值必须逐字一致。

## 1. 结论与许可

采用**「打包未修改二进制 + 仅通过官方 HTTP API 通信」**的集成方式（HMCL 同款路径）：

- Terracotta 为 AGPLv3 + 例外条款。官方允许两种不传染的集成方式：①打包未修改的二进制且不与本项目链接；②仅通过内置 HTTP API 交互。本方案两者同时满足。
- 额外义务：UI 中必须在明显位置标识版权并给出上游链接（`Powered by Terracotta · 陶瓦联机`）。这一条**必须**实现，不是可选项。
- 不在本项目内重新实现 EasyTier / Scaffolding 协议，不做协议层耦合。

## 2. 架构

```
渲染进程 (React)                 主进程 (Electron)
┌──────────────────┐   IPC    ┌──────────────────────────────┐
│ play-link 页面    │◀────────▶│ handlers/terracotta.ts       │
│ zustand store     │  invoke  │   ↓                          │
│ api/terracotta.ts │  event   │ core/terracotta.ts (服务)     │
└──────────────────┘          │   ↓ spawn + HTTP             │
                              │ core/terracotta-protocol.ts  │
                              └──────────┬───────────────────┘
                                         │ HTTP 127.0.0.1:{随机端口}
                                   terracotta 进程（内置 HTTP 服务）
```

铁律：
- **渲染进程绝不直接请求 `127.0.0.1:{port}`**。Terracotta 的 HTTP 服务无鉴权且无 CORS，只能由主进程访问。
- 二进制按上游发行版**原样**打包，不重编译、不打补丁、不修改资源段。
- 二进制进程生命周期由主进程独占管理；应用退出必须 `GET /panic?peaceful=true`。

## 3. 上游 API 速查（v0.4.2 实测）

启动：`terracotta --hmcl <portFile>`。服务就绪后把 `{"port": N}` 原子写入 `<portFile>`（先写 `.tmp` 再改名）。

> Windows 注意：`--hmcl` 进程只是**引导器**，fork 出真正的工作进程后最多等 8 秒即退出。**不能用引导进程的 exit 事件判断崩溃**，存活判定只能靠 HTTP 轮询。

| 接口 | 说明 |
| --- | --- |
| `GET /meta` | `{version, compile_timestamp, easytier_version, yggdrasil_port, target_tuple, target_arch, target_os}` |
| `GET /state` | 状态机；`index` 单调递增，必须丢弃 `index` 未增长的响应。建议 500ms 轮询 |
| `GET /state/ide` | 重置回 `waiting`（200） |
| `GET /state/scanning?room=&player=&public_nodes=` | 开房（`public_nodes` 可重复）。仅 `waiting` 生效，否则静默忽略仍 200 |
| `GET /state/guesting?room=&player=&public_nodes=` | 加入房间；`room` 必填；格式错误或非 `waiting` → **400** |
| `GET /log?fetch=true` | 取 `application.log` |
| `GET /panic?peaceful=true` | 优雅退出（直接 panic 是调试入口，勿用） |

`/state` 返回的 `state` 取值：`waiting` / `host-scanning` / `host-starting` / `host-ok` / `guest-connecting` / `guest-starting` / `guest-ok` / `exception`。

- `host-ok`：`room`、`profile_index`、`profiles`
- `guest-ok`：`url`（直连地址，端口 25565 时是 `127.0.0.1`，否则 `127.0.0.1:{port}`）、`profiles`
- `guest-*`：`room`、`difficulty`（`UNKNOWN`/`EASIEST`/`SIMPLE`/`MEDIUM`/`TOUGH`）
- `exception`：`type` 0=无法连接房主/房间已关闭，1=与房主连接中断，2=加入方 EasyTier 崩溃，3=房主 EasyTier 崩溃，4=房主 MC 服务器失联房间自动关闭，5=脚手架协议错误。**exception 后必须调 `/state/ide` 才能回到 waiting**。
- `profiles[]` 成员：`{ machine_id, name, vendor, kind: "HOST" | "LOCAL" | "GUEST" }`；10 秒无心跳即从列表移除。

房间码：`U/NNNN-NNNN-SSSS-SSSS`，16 位负载字符集为 `0-9A-HJ-NP-Z`（去掉 I、O 的 34 个字符，顺序 `0-9, A-H, J-N, P-Z`）；映射为 0..33 后按**小端序**读成整数必须能被 7 整除。前缀 `U/` 不参与校验（已实测：`U/2D0M-04L3-25M7-HSQ0` 通过、`U/BAD` 返回 400）。校验用 `BigInt`，本地预校验可显著改善体验，但**最终以 HTTP 400 为准**。

已知缺陷：在 `guest-connecting` 等非 `waiting` 状态调用 `/state/ide` 后，进程可能直接消失。主进程必须能自愈（连续 5 次轮询失败 → 标记 `crashed`，允许重新启动）。

## 4. 文件清单与权责（互不重叠）

| 归属 | 文件 | 说明 |
| --- | --- | --- |
| 主进程 | `electron/core/terracotta-protocol.ts` | **新建**。纯 Node，不 import electron：类型、房间码校验、HTTP 客户端、`/state` 解析 |
| 主进程 | `electron/core/terracotta.ts` | **新建**。服务单例：定位二进制、下载安装、spawn、端口文件、轮询、广播、启停 |
| 主进程 | `electron/handlers/terracotta.ts` | **新建**。IPC handler，统一 `{success,data,error}` 返回 |
| 主进程 | `electron/main.ts` | 修改：注册 handler；`before-quit` 优雅停止陶瓦 |
| 主进程 | `electron/config.ts` | 修改：`NetworkConfig.terracotta` + `DEFAULTS` |
| 主进程 | `electron/preload.ts` | 修改：暴露 `terracotta*` 白名单方法 |
| 主进程 | `src/types/electron.d.ts` | 修改：`ElectronAPI` 补充声明（返回 `Promise<unknown>` 即可） |
| 渲染端 | `src/api/terracotta.ts` | **新建**。类型 + `ipcInvoke` 包装 |
| 渲染端 | `src/stores/terracottaStore.ts` | **新建**。zustand：status 镜像、订阅事件、动作 |
| 渲染端 | `src/pages/play-link/index.tsx` | 重写 |
| 渲染端 | `src/pages/play-link/*.tsx` | **新建** 子组件 |
| 渲染端 | `src/pages/setting/network/tawa-online.tsx` | 重写 |
| 渲染端 | `src/api/config.ts` | 修改：渲染端 `AppConfig` 镜像补 `terracotta` |
| 打包 | `scripts/fetch-terracotta.js` | **新建**。构建期预取二进制到 `build/terracotta/` |
| 打包 | `package.json` | 修改：`fetch:terracotta` 脚本，并挂进 `dist:*` |
| 打包 | `electron-builder.yml` | 修改：`extraResources` 增加陶瓦目录 |
| 打包 | `.gitignore` | 确认 `build/` 已忽略（二进制不入库） |
| 文档 | `README.md` / `DEV.md` | 修改：联机页占位状态描述更新为已实现 |
| 文档 | `plans/terracotta-integration.md` | 本文 |

## 5. 二进制获取与存放

上游资产命名：`terracotta-{version}-{platform}-{arch}-pkg.tar.gz`，其中：

| Node `platform` / `arch` | 资产 platform-arch |
| --- | --- |
| win32 / x64 | `windows-x86_64` |
| win32 / arm64 | `windows-arm64` |
| darwin / x64 | `macos-x86_64` |
| darwin / arm64 | `macos-arm64` |
| linux / x64 | `linux-x86_64` |
| linux / arm64 | `linux-arm64` |
| linux / loong64 | `linux-loongarch64` |
| linux / riscv64 | `linux-riscv64` |

- 固定版本 `v0.4.2`（可用环境变量 `TERRACOTTA_VERSION` 覆盖）。下载地址由 `https://api.github.com/repos/burningtnt/Terracotta/releases/tags/{version}` 的 `assets[].browser_download_url` 解析，避免硬编码完整 URL。
- 解包后必须**整目录保留**，不可只拷 exe：Windows 包内含 `VCRUNTIME140.DLL`，缺失则无法启动。
- 存放优先级（`resolveBinary()`）：
  1. `config.network.terracotta.binaryPath`（用户自定义，存在即用）
  2. 打包内置 → `path.join(process.resourcesPath, 'terracotta')`
  3. 开发环境 → `path.join(__dirname, '..', 'build', 'terracotta')`（即仓库 `build/terracotta/`）
  4. 用户数据缓存 → `path.join(app.getPath('userData'), 'terracotta')`（运行时下载目标）
- 可执行文件名：**保留上游原样，不重命名**（Windows 实为 `terracotta-0.4.2-windows-x86_64.exe`）。定位时先找精确名 `terracotta(.exe)`，找不到再在目录里扫描 `^terracotta` 前缀、Windows 需 `.exe` 结尾、且 >1MB 的文件。
- 解包实现：`zlib.gunzipSync` + 手写 tar（512 字节头、ustar 前缀）解析，**不引入新的 npm 依赖**；跳过目录项与 `pax` 扩展头，只落普通文件，并做路径穿越校验（拒绝 `..`/绝对路径）。
- 运行时安装：下载到 `userData/terracotta.tmp-{ts}/`，校验（exe 存在且 > 1MB）后 `rename` 成 `userData/terracotta`；失败清理临时目录并上报错误。

## 6. 配置结构（`electron/config.ts`）

```ts
export interface TerracottaConfig {
  /** 昵称；留空 = 使用当前登录账户名 */
  playerName: string;
  /** 附加公共节点（host:port），与上游内置节点一起作为 public_nodes 传入 */
  publicNodes: string[];
  /** 进入联机页时自动启动陶瓦服务 */
  autoStart: boolean;
  /** 自定义二进制路径；留空 = 自动定位/下载 */
  binaryPath: string;
}

export interface NetworkConfig {
  securityId: SecurityIdConfig;
  terracotta: TerracottaConfig;
}
```

`DEFAULTS.network.terracotta = { playerName: '', publicNodes: [], autoStart: true, binaryPath: '' }`。

渲染端 `src/api/config.ts` 的 `AppConfig` 镜像同步补上同名字段。配置读写走现有 `config:update` / `configStore`，不要新增配置文件。

## 7. IPC 契约

所有通道统一返回 `{ success: boolean; data?: T; error?: string }`（与 `src/api/ipc.ts` 的 `ipcInvoke` 兼容）。

### 7.1 类型

```ts
export type TcPhase = 'stopped' | 'starting' | 'running' | 'crashed';

export type TcStateName =
  | 'waiting' | 'host-scanning' | 'host-starting' | 'host-ok'
  | 'guest-connecting' | 'guest-starting' | 'guest-ok'
  | 'exception' | 'unknown';

export interface TcProfile {
  machineId: string;
  name: string;
  vendor: string;
  kind: 'HOST' | 'LOCAL' | 'GUEST';
}

export interface TcSnapshot {
  /** 进程/连接状态 */
  phase: TcPhase;
  /** 上游状态机当前状态 */
  state: TcStateName;
  /** 上游单调 index（丢弃未增长响应） */
  index: number;
  /** 房间码；无则空串 */
  room: string;
  /** 加入方直连地址；无则空串 */
  url: string;
  /** UNKNOWN/EASIEST/SIMPLE/MEDIUM/TOUGH；无则空串 */
  difficulty: string;
  /** 成员列表 */
  profiles: TcProfile[];
  /** 面向用户的错误文案；无则空串 */
  error: string;
  /** exception 类型；无则 -1 */
  exceptionType: number;
}

export interface TcBinaryInfo {
  installed: boolean;
  /** 可执行文件绝对路径；未安装空串 */
  path: string;
  /** 版本号（从 /meta 或目录名推断）；未知空串 */
  version: string;
  /** custom | bundled | dev | downloaded | none */
  source: 'custom' | 'bundled' | 'dev' | 'downloaded' | 'none';
}

export interface TcInstallState {
  active: boolean;
  /** idle | download | extract | verify | done | error */
  stage: 'idle' | 'download' | 'extract' | 'verify' | 'done' | 'error';
  percent: number;
  transferred: number;
  total: number;
  message: string;
}

export interface TerracottaStatus {
  binary: TcBinaryInfo;
  phase: TcPhase;
  /** 当前端口；未知 0 */
  port: number;
  meta: { version: string; easytierVersion: string; targetTuple: string } | null;
  snapshot: TcSnapshot;
  install: TcInstallState;
}
```

> 所有字符串字段一律用空串而非 `null`，UI 判断简单。

### 7.2 通道

| 通道 | 入参 | 返回 |
| --- | --- | --- |
| `terracotta:status` | 无 | `TerracottaStatus` |
| `terracotta:install` | `{ force?: boolean }` | `TerracottaStatus`（立即返回，进度走事件） |
| `terracotta:start` | `{ player?: string }` | `TerracottaStatus` |
| `terracotta:stop` | 无 | `TerracottaStatus` |
| `terracotta:host` | `{ player?: string; publicNodes?: string[] }` | `TerracottaStatus` |
| `terracotta:guest` | `{ room: string; player?: string; publicNodes?: string[] }` | `TerracottaStatus` |
| `terracotta:reset` | 无 | `TerracottaStatus` |
| `terracotta:fetch-log` | 无 | `{ content: string }` |
| `terracotta:open-dir` | 无 | `{ path: string }` |
| `terracotta:pick-binary` | 无 | `{ path: string }` |
| `terracotta:clear-binary` | 无 | `TerracottaStatus` |

行为约定：
- `install`：正在安装则复用当前任务；完成后自动刷新 `binary` 与 `version`。
- `start`：未安装 → 报错「陶瓦联机尚未安装」。已运行 → 直接返回当前状态。启动超时 20s。
- `host` / `guest`：若未运行则先 `start`；`guest` 先用本地校验房间码，非法直接返回 `success:false` + 可读文案（不要等上游 400）。
- `reset`：调用 `/state/ide`；进程若已消失（预期内的已知缺陷）则置 `phase='stopped'` 并返回成功，由 UI 提供「重新启动」。
- 所有 `player` 缺省值解析顺序：入参 → `config.network.terracotta.playerName` → 当前账户用户名 → `''`。
- `publicNodes` 缺省取配置值；与上游内置节点合并方式为直接重复传参（上游支持多个 `public_nodes`）。

### 7.3 事件（主进程 → 渲染进程 `webContents.send`）

| 事件 | 载荷 | 时机 |
| --- | --- | --- |
| `terracotta:status` | `TerracottaStatus` | 状态/成员/安装进度任何变化（轮询有 diff 才发） |
| `terracotta:install-progress` | `TcInstallState` | 下载/解包阶段（节流 ≥ 100ms） |

预加载层暴露：

```ts
terracottaStatus(): Promise<unknown>;
terracottaInstall(payload?: { force?: boolean }): Promise<unknown>;
terracottaStart(payload?: { player?: string }): Promise<unknown>;
terracottaStop(): Promise<unknown>;
terracottaHost(payload?: { player?: string; publicNodes?: string[] }): Promise<unknown>;
terracottaGuest(payload: { room: string; player?: string; publicNodes?: string[] }): Promise<unknown>;
terracottaReset(): Promise<unknown>;
terracottaFetchLog(): Promise<unknown>;
terracottaOpenDir(): Promise<unknown>;
terracottaPickBinary(): Promise<unknown>;
terracottaClearBinary(): Promise<unknown>;
onTerracottaStatus(cb: (data: unknown) => void): () => void;
onTerracottaInstallProgress(cb: (data: unknown) => void): () => void;
```

## 8. 服务实现要点（`electron/core/terracotta.ts`）

- 单例 `export const terracottaService = new TerracottaService()`；`setBroadcaster(fn)` 由 handler 注册时注入（广播给所有 `BrowserWindow.getAllWindows()`）。
- 端口文件：`path.join(app.getPath('temp'), 'koring-terracotta-port.json')`，spawn 前删除，100ms 轮询读取，20s 超时。
- spawn：`spawn(exe, ['--hmcl', portFile], { cwd: dirname(exe), stdio: 'ignore', windowsHide: true })`；监听 `'error'` 事件上报；**忽略 `'exit'` 作为死亡信号**。
- 轮询：500ms `GET /state`，`AbortSignal.timeout(1500)`；成功一次即清零失败计数；连续 5 次失败 → `phase='crashed'`，停止轮询，保留快照并给出「服务已退出」。
- 广播节流：`index` 未增长且其余字段无变化 → 不发事件。
- `stop()`：`GET /panic?peaceful=true`，2s 超时；**连接被重置/失败一律视为成功**（实测服务会先断连再退出）；随后清理定时器、`phase='stopped'`、`port=0`。
- 异常兜底：`GET /state` 抛错不影响其他 IPC；所有 handler 内部 try/catch。

## 9. UI 契约

### 9.1 联机页 `src/pages/play-link/index.tsx`

按 `status.phase` / `status.snapshot.state` 分支渲染，同一时刻只有一个主卡片：

| 条件 | 展示 |
| --- | --- |
| `!binary.installed` | 说明 + 「下载并安装」（带进度条）+「选择本地二进制」+ 版权链接 |
| `phase === 'stopped'` | 介绍文案 + 「启动陶瓦联机」；`autoStart` 开启且未启动时自动触发一次 |
| `phase === 'starting'` | 加载态「正在启动联机服务…」 |
| `phase === 'crashed'` | 错误态 + 「重新启动」 |
| `state === 'waiting'` | 双卡：**创建房间**（昵称输入，默认取配置）/ **加入房间**（房间码输入） |
| `host-scanning` | 「正在等待游戏房间…请在单人存档中打开『对局域网开放』」+ 取消 |
| `host-starting` | 创建中 + 房间码 |
| `host-ok` | 大号房间码 + 复制 + 成员列表 + 「关闭房间」+「停止服务」 |
| `guest-connecting` / `guest-starting` | 「正在加入…」+ 房间码 + 难度标签 + 取消 |
| `guest-ok` | 「已加入」+ 直连地址（复制）+ 成员列表 + 「断开连接」 |
| `exception` | 按 `exceptionType` 映射中文文案 + 「返回」 |

房间码输入：自动转大写、按 4 位插入 `-`、允许粘贴带 `U/` 前缀（内部保留前缀提交）；本地校验失败即时红字提示。
所有按钮在请求进行中禁用（store 内 `pending` 标记）。
页面底部固定小字版权：`Powered by Terracotta · 陶瓦联机`，点击经 `shell:openExternal` 打开上游文档站。

### 9.2 设置页 `src/pages/setting/network/tawa-online.tsx`

沿用 `PageHeader` + `SettingCard` / `SettingRow`（参考同目录 `security-id.tsx`、`download.tsx`）：

1. **基础**：显示名（Input，占位「留空则使用当前账户名」）、自动启动（Switch）
2. **网络**：公共节点（Textarea，每行一个 `host:port`，保存时 trim + 过滤空行）
3. **程序与版本**：已安装版本/来源/路径（只读展示）、重新安装、打开数据目录、选择本地二进制、恢复自动定位
4. **版权**：`Powered by Terracotta · 陶瓦联机` 说明段 + 上游链接

写入配置：`useConfigStore` 的既有更新入口（读同目录页面的用法，不要自造通道）。

## 10. 打包

- `scripts/fetch-terracotta.js`：`node scripts/fetch-terracotta.js [--force]`
  - 幂等：目标已存在且 exe 有效则跳过；`--force` 重新下载
  - 输出 `build/terracotta/`（`build/` 已在 `.gitignore`，二进制不入库）
  - **无论成功失败都必须让目录存在**（失败时写入 `build/terracotta/NOTICE.txt` 说明），否则 `electron-builder` 的 `extraResources` 会因缺失目录报错
  - 下载失败默认**警告不中断**构建（运行时仍可安装）；CI 可用 `TERRACOTTA_STRICT=1` 改为硬失败
  - 同时写入 `build/terracotta/LICENSE`（从上游仓库下载 `LICENSE`），满足 AGPL 再分发要求
- `electron-builder.yml`：

  ```yaml
  extraResources:
    - from: build/.env
      to: .env
    - from: build/terracotta
      to: terracotta
  ```

- `package.json`：新增 `fetch:terracotta`，并让 `dist:dev` / `dist:beta` / `dist:run`（以及 `pack` / `dist:win` / `dist:mac` / `dist:linux`，避免直接调用时 extraResources 源目录缺失报错）在 `build:*` 之后、`electron-builder` 之前执行。

## 11. 验证

```bash
pnpm build:main          # tsc -p tsconfig.electron.json 必须零错误
pnpm build:renderer:dev  # vite build 必须零错误
pnpm fetch:terracotta    # 生成 build/terracotta/，冒烟确认 exe + DLL 存在
```

手工冒烟（Windows 本机）：
1. `pnpm dev` 打开联机页 → 未安装态 → 点击安装（或直接用 `build/terracotta/`）→ 版本显示
2. 启动服务 → 状态 `waiting`
3. 创建房间 → `host-scanning`（无 MC 局域网时停留在此，符合预期）
4. 取消 → 回到 `waiting`
5. 输入非法房间码 → 本地报错，不发请求
6. 应用退出后 `Get-Process terracotta*` 应为空（panic 生效）

## 12. 版本升级

上游发版后只需：更新 `scripts/fetch-terracotta.js` 与 `electron/core/terracotta.ts` 里的默认版本常量 → 重新打包。API 向后兼容风险点：`/state` 字段增删（解析需容忍未知字段、缺字段给默认值）。
