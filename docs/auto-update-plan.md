# Koring Launcher 自动更新方案（v1 规划稿）

> 状态：**M1 完成；M2 主进程更新模块完成（2026-08-28，UI 待做）**
> 目标平台：**Windows 优先**（NSIS exe 安装包），macOS/Linux 后续复用同一套架构
> 决策记录：
> - 安装器模式：**保持 assisted 安装器（`oneClick: false` + 可改安装目录）→ 每次更新整包下载**
> - 更新托管：**GitHub Releases**
> - 当前交付：**M1 基础设施 + M2 主进程更新模块（GitHub 优先 + 加速源兜底）已完成**

---

## 1. 背景与目标

- 项目：Electron 33 + React 19 + TS + electron-builder 25（Windows NSIS 安装包，`dist:dev/beta/run` 三模式打包）
- 现状：`package.json` 版本 1.1.2，无任何更新机制；用户需手动下载新版安装包
- 目标：客户端内自动检查新版本 → 下载 → 静默重装 → 自动重启，先跑通 Windows

## 2. 技术选型

**选 electron-updater**（electron-builder 官方配套，与现有打包链无缝衔接）。

| 方案 | 说明 | 结论 |
|---|---|---|
| electron-updater | 自动生成 `latest.yml` 清单、SHA512 校验、进度事件、失败重试、断点续传 | ✅ 选用 |
| electron-simple-updater | 只支持替换 asar，不支持 NSIS 重装 | ❌ |
| update-electron-app | 只面向 GitHub，定制性差 | ❌ |
| 自研差分/自建服务 | 灰度、强制更新、统计需要时再评估 | 后期可选 |

**版本兼容**：electron-builder 25.1.8 ↔ electron-updater ^6.x（官方同仓库发布，6.x 与 24/25/26 打包器配套）。

## 3. 关键约束（已确认）

### 3.1 assisted 安装器 → 整包下载

当前 `electron-builder.yml` 为 assisted 安装器：

```yaml
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
```

electron-updater 的 NSIS **差分更新（blockmap 增量）只支持一键安装（per-user oneClick）**；
assisted 安装器安装目录不固定，**退化为每次下载完整 `koring-launcher-<version>-setup.exe`**。

**已决策：接受整包下载**，不改安装体验。含义：
- 每次更新下载全量安装包（预计几十 MB 级别），CDN/带宽按此评估；
- 后续若用户量大、包体过大，可再评估改 oneClick 启用差分，或自研增量（代价高，不优先）。

### 3.2 代码签名（重要）

Windows 下 electron-updater 会对下载的安装包做 Authenticode 校验：当前 exe 有签名时，要求新安装包发布者一致；
当前 exe 未签名时校验会被跳过（记警告）。

- **未签名**：开发/内测可跑通全流程，但国内杀软对未签名 exe 误报率高；
- **正式对外发布前必须做代码签名**（OV 证书起步，EV 更佳），并让发布流水线对 setup.exe 签名；
- 签名后 electron-builder 默认会校验一致性，无需额外配置，但要保证**发布流水线签名证书与产物一致**。

## 4. 整体架构

```
┌───────────────────────────── 客户端 ─────────────────────────────┐
│  React UI (src/)  ⇄  preload.ts (contextBridge)  ⇄  主进程       │
│                     │  electronAPI.onUpdateStatus()  │           │
│                     └────────── IPC ────────────────┘           │
│  主进程 electron/updater.ts（封装 electron-updater）             │
│  electron/handlers/update.ts（IPC handler）                     │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTPS
                               ▼
                  ┌───────────────────────────┐
                  │   GitHub Releases  (仓库)  │
                  │  · koring-launcher-1.2.1  │
                  │    -setup.exe             │
                  │  · latest.yml             │
                  └───────────────────────────┘
                   （国内网络差 → 见 §5.3 加速对策）
```

## 5. 服务端：GitHub Releases

### 5.1 发布产物

electron-builder 配置 `publish: { provider: github }` 后，`electron-builder --publish always`
（或 `--publish` 搭配 CI token）会自动：

1. 打包 Windows 产物；
2. 创建/更新 GitHub Release（tag 取自版本号，如 `v1.2.1`）；
3. 上传 `koring-launcher-1.2.1-setup.exe` + `latest.yml`（+ `latest.yml.blockmap`，assisted 模式下不用但会生成）。

`latest.yml` 是更新清单（版本、文件路径、大小、sha512），electron-updater 靠它发现新版本并校验完整性：

```yaml
version: 1.2.1
files:
  - url: koring-launcher-1.2.1-setup.exe
    sha512: <base64-sha512>
    size: 81234567
path: koring-launcher-1.2.1-setup.exe
sha512: <base64-sha512>
releaseDate: '2025-01-01T00:00:00.000Z'
```

### 5.2 配置示例（electron-builder.yml 增加段）

```yaml
publish:
  provider: github
  owner: <GitHub 用户名/组织>
  repo: <仓库名>
  # releaseType: release   # 默认 release；beta 通道可设 draft/prerelease
```

打包时 electron-builder 会把 `app-update.yml`（含 provider 信息）写进 `resources/`，
electron-updater 在运行时读取它——**没有 publish 配置就不会生成 app-update.yml，更新会直接报错**（M1 验收点）。

### 5.3 国内网络注意（务必先评估）

electron-updater 的 GitHub provider 走 `api.github.com`（发现版本）与 `github.com/.../releases/download/...`（下载），
国内部分网络环境访问慢或不稳定。对策（按需选）：

- **现状接受**：很多应用直接走 GitHub，配合失败重试 + 手动"下载最新版"兜底按钮；
- **CDN 加速（推荐后续做）**：改为 `generic` provider，把 `latest.yml` + exe 同步到
  OSS/COS + CDN（或 ghproxy 类代理），`app-update.yml` 指向 CDN URL；
- **自建/商业 CDN 代理 GitHub Releases**：等用户量上来再评估。

> 方案设计上保持 provider 可切换：`electron/updater.ts` 只面向 electron-updater 统一 API，
> 未来从 `github` 切 `generic` 只需改 electron-builder.yml + 重新打包，业务代码不动。

## 6. Windows 更新流程（整包下载版）

```
应用启动
 ├─ 加载完成且空闲后（延迟 10~15s）→ 静默 checkForUpdates()
 │    （避开启动加载与 Minecraft 下载抢带宽；首启/开发模式跳过）
 ├─ 无更新 → 结束，静默
 └─ 有更新 → 发 update:status{state:'available', version}
       │
       ▼
  前端提示"发现新版本 vX.Y.Z"（非强制，可忽略/稍后）
       │  用户点"下载更新"
       ▼
  autoUpdater.downloadUpdate()
   ├─ download-progress → update:status{state:'downloading', percent, speed, ...}
   ├─ 下载完成 → SHA512 校验（latest.yml）→ update:status{state:'downloaded'}
   │
   ▼
  前端提示"重启并安装"（可暂缓；退出时 autoInstallOnAppQuit 兜底）
       │  用户确认
       ▼
  autoUpdater.quitAndInstall()
   ├─ 应用退出 → NSIS 静默安装（不弹 UI，沿用原安装目录）
   └─ 安装完成自动重启 → 运行新版本

失败路径：
  · 网络失败 → 提示重试（electron-updater 自带断点续传/重试）
  · 校验失败 → 清除缓存重下；仍失败则提示手动下载最新版
  · 静默安装失败 → 提示手动下载；保留旧版本可用
```

### 更新状态机（前端 store 用）

```
idle → checking → available → downloading → downloaded → installing → relaunch
        └─not-available→ idle        └─ error → idle(可重试)
```

## 7. 代码结构规划

```
electron/
  updater.ts              # 新增：封装 electron-updater
                          #   · 初始化（读 app-update.yml、设日志）
                          #   · 守卫：!app.isPackaged 时跳过（开发模式）
                          #   · check() / download() / quitAndInstall() / 状态查询
                          #   · 订阅 checking/available/not-available/download-progress/downloaded/error
                          #   · 转发为 update:status 事件（带完整 payload）
  handlers/update.ts      # 新增：IPC handler
                          #   · update:check            → 触发检查
                          #   · update:download         → 触发下载
                          #   · update:quitAndInstall   → 重启安装
                          #   · update:getState         → 查询当前状态/版本信息
  main.ts                 # 改：import { registerUpdateHandlers }；注册；启动后延迟静默检查
  preload.ts              # 改：暴露
                          #   · checkForUpdates() / downloadUpdate() / quitAndInstall()
                          #   · onUpdateStatus(cb) → 订阅 update:status（沿用现有 on() 模式）

src/
  api/update.ts           # 新增：IPC 封装 + TS 类型（UpdateStatus）
  stores/update.ts        # 新增：zustand store，维护状态机
  components/settings/... # 更新 UI：设置页"关于/更新"区块
                          #   · 当前版本号 + 检查更新按钮
                          #   · 下载进度条（百分比/速度/剩余大小）
                          #   · "重启并安装"确认
  components/...          # 可选：新版可用 toast / 弹窗（非强制打扰）
```

**依赖注意**：`electron-updater` 必须放 **`dependencies`**（不能是 devDependencies），
否则 asar 打包后运行时找不到模块——最常见事故，M1 验收必须覆盖。

## 8. 版本与多通道

- 沿用现有 `scripts/version.js` 升版（`pnpm version:set 1.2.0`），版本必须严格 semver 递增；
- electron-updater 只认 package.json 的 `version`，升版后需重新打包发布；
- **dev / beta / run 三模式的通道隔离放加固阶段（M5）**：
  - GitHub provider 多通道依赖 tag 约定（如 `v1.2.1-beta.1`），行为略绕，先只用默认 latest 通道跑通；
  - 届时按产品需要决定：beta 走 prerelease/draft release，run 走正式 release，或切 generic + 不同 URL。

## 9. 里程碑与验收

| 阶段 | 内容 | 验收标准 |
|---|---|---|
| **M1 基础设施** | ① `dependencies` 加 electron-updater；② electron-builder.yml 加 publish(github)；③ 升版打包 `pnpm dist:run` | 产物目录出现 `latest.yml`；解包 asar 的 `resources/app-update.yml` 存在；electron-updater 在 asar 内可 require |
| **M2 主进程** | updater.ts + handlers/update.ts + preload 暴露 | 手动触发 `update:check` 能返回状态；事件能推送到渲染进程（dev 下用 `forceDevUpdateConfig` 或打包版验证） |
| **M3 前端 UI** | update store + 设置页更新区块 + 启动静默检查 | 完整交互：检查/提示/进度/重启安装/失败重试 |
| **M4 联调冒烟** | 发布 v1.2.0 → 再发布 v1.2.1，真机从 1.2.0 升到 1.2.1 | Windows 真机全流程通过，含取消下载、断网重试、校验失败场景 |
| **M5 加固** | ~~代码签名~~（SignPath 远程签名已接入 CI，见 §12）；国内加速（CDN/generic）评估；通道隔离；强制更新开关；临时文件清理 | 可对外发布 |

## 10. 风险与对策

| 风险 | 影响 | 对策 |
|---|---|---|
| electron-updater 误放 devDependencies | 打包后更新直接报错 | M1 验收强制检查 asar 内依赖 |
| 未配置 publish → 无 app-update.yml | 运行时报 "app-update.yml not found" | M1 验收点；文档示例已给 |
| 未签名 exe 被杀软拦截 | 下载/安装被拦，更新失败 | 正式发布前签名（M5）；内测接受现状 |
| assisted 静默安装弹 UI / 请求管理员 | 更新中断 | M4 用现有 `build/installer-custom.nsh` 专门联调；必要时加 `runAfterFinish`/静默参数处理 |
| api.github.com 国内访问差 | 检查/下载慢或失败 | 失败重试 + 手动下载兜底；后续 CDN 加速（§5.3） |
| 检查频率过高 | 浪费带宽、触发限流 | 启动延迟 10~15s + 手动按钮；间隔建议 ≥1h |
| 磁盘满 / %LOCALAPPDATA% 权限 | 下载/解压失败 | 失败回退提示，清理 `updaterCacheDirName` 缓存 |
| 版本号不递增 | 永远查不到更新 | CI/脚本校验 `version:set` 只允许升版 |
| 更新失败后应用状态异常 | 用户卡在旧版本 | 保持旧版可用；UI 提供手动下载入口；错误上报（可复用现有 crash 体系） |

## 11. 后续待决策（不阻塞 M1~M4）

- 是否需要强制更新 / 最低版本策略
- 国内加速方案何时落地（generic + OSS/COS/CDN）
- macOS / Linux 更新的排期（架构已预留，届时分别补 zip/dmg 与 AppImage 产物与签名）

## 12. SignPath 代码签名接入（2026-08-28 落地）

**方案**：electron-builder 自定义签名（`win.sign: scripts/signpath-sign.js`），
构建时对内部 exe（`Koring Launcher.exe`、elevate.exe、卸载器）与最终 `setup.exe`
逐个提交 SignPath 远程签名，签名发生在 blockmap / latest.yml 生成之前，
**清单 sha512 与 blockmap 自动对应签名后产物**，electron-updater 校验无缝。

**SignPath 后台准备（已确认值）**：
- Organization ID：`31ecd033-d59e-492b-a70b-b00a54bbc7c2`（已写入 workflow env）
- API Token：用户详情页生成（CI 用途），放入 GitHub Secrets `SIGNPATH_API_TOKEN`
- slug：项目 `Koring_Launcher`；签名策略 `Koring_Launcher_Dev_builder`（均写入 workflow env）；
  产物配置 DEFAULT 在项目仅一个配置时可省略 `SIGNPATH_ARTIFACT_CONFIG_SLUG`

**⚠️ 待办约束**：
- **测试证书**：当前策略 Purpose 为 **Test signing**（测试证书），用户机器默认不信任
  （SmartScreen / 杀软警告；`signtool verify` 会报"不受信任"——预期现象），
  正式对外发布需生产证书（OV/EV）+ 对应生产签名策略（届时只换 `SIGNPATH_SIGNING_POLICY_SLUG`）。
- 审批流程：已在 SignPath 后台关闭人工审批（自动批准），CI 可全自动；策略 Purpose 已改为 Release signing。

**新增/改动文件**：
- `scripts/signpath-sign.js` — 签名模块（无 token 自动跳过，本地构建不受影响）
- `.github/workflows/release.yml` — 手动触发：选择 beta/run → 构建 → 签名 → 发布 GitHub Release（见 §13）
- `scripts/release-notes.ps1` — 中文 Release 发布说明生成器
- `electron-builder.yml` — `win.sign` 挂载

**CI Secrets**：仅 `SIGNPATH_API_TOKEN`（必填）+ `SIGNPATH_ARTIFACT_CONFIG_SLUG`（可选）；
组织 ID 与 slugs 已在 workflow 中写死。

**2026-08-28 实测结果**（与官方 PowerShell 模块对齐后的真实签名）：
- 协议：`POST {base}/v1/{orgId}/SigningRequests`（**multipart/form-data**，字段 ProjectSlug /
  SigningPolicySlug / ArtifactConfigurationSlug? / Description / 文件部件 **Artifact**）→
  响应 **Location 头** = 请求 URL → 轮询 `status`/`isFinalStatus` → 完成后取 **signedArtifactLink** 下载；
  认证 `Authorization: Bearer <token>`。
- ✅ 98.3MB setup.exe 提交成功；自动批准生效（InProgress → Completed 无人工介入）
- ✅ 小文件端到端签名成功，`signtool verify` 显示签名链 **Issued to: Lingke Network**
- ⚠️ 本机到 SignPath 下载 100MB+ 产物极慢（20min+），CI（GitHub Actions）网络环境不受影响；
  模块已加下载重试（3 次）+ 临时文件替换

**2026-08-28 CI 首跑教训（配额）**：
- ⚠️ **SignPath 年度配额 ≈ 500MB**（"Yearly quota for artifact size has been exceeded"），
  一次全量签名构建（sha1+sha256 双签）即消耗 ~458MB，直接耗尽配额，发布失败。
- 修复（已落地）：`win.signtoolOptions.signingHashAlgorithms: [sha256]` —— 只按 SHA256 单签，
  每个文件只签一次，配额减半（全量构建 ~278MB）；
  可选 `SIGNPATH_ONLY_INSTALLER=true` 只签 setup.exe（~97MB/构建）。
- **内部测试策略（已落地）**：workflow 设置 `SIGNPATH_SKIP_ON_QUOTA=true` —— 配额耗尽时
  跳过签名、照常发布（产物未签名，electron-updater 发布者校验自动跳过）；首次命中后记住状态，
  后续文件不再重复提交。⚠️ 正式发布务必移除该开关。
- **治本仍需升级 SignPath 套餐**或等待年度配额重置；正式发布（run）建议全量签名 + 生产证书。

**验证点（首次 CI 运行）**：确认 SignPath 请求全部 Completed、`latest.yml` 的 sha512
与上传的 signed setup.exe 一致、签名链显示 "Lingke Network"。

## 13. 发布流水线（手动触发 / BUILD ID / 中文 Release）

**触发方式**：Actions 页面 → Run workflow，仅手动触发（不再使用 tag 触发）。
- `mode`：`beta`（测试，发布为 GitHub prerelease）/ `run`（正式，发布为普通 release）
- `ref`：构建来源分支/tag/commit（留空 = 默认分支）
- `sign`：是否使用 SignPath 签名
- **无 `version` 输入**：base 自动读 `package.json`（版本单一事实源，消除本地/CI 版本双轨）

**版本号与 BUILD ID（2026-08-30 起）**：
- BUILD ID = `github.run_number`（严格递增、无分钟级冲突）
- **beta**：`{base}-beta.{buildId}`（如 `1.2.1-beta.13`，tag `v1.2.1-beta.13`，GitHub 标记 prerelease）
- **run**：`{base}-{buildId}`（如 `1.2.1-13`，tag `v1.2.1-13`，**带构建尾号**，普通 release 不加 `--prerelease`）
- ⚠️ **数字标识与频道**：数字 prerelease 在 `allowPrerelease=true` 的通道逻辑里会被当作"自定义频道"
  （`beta`/`alpha` 之外）。但**正式版用户（woker）`allowPrerelease=false`**，走 `/releases/latest`
  （按 GitHub 的 prerelease **标记**而非 semver）→ 只要 run 发布时不加 `--prerelease`，
  `1.2.1-13` 就是最新正式版，可正常识别与更新。**run 发布切勿加 `--prerelease`**。
- **兼容性**（semver 数字 < 字母）：`1.2.1-beta.13 > 1.2.1-12 > 1.2.1-2608271921 > 1.2.1`，
  所有旧数字版本（含时间 ID 与 Run Number 时代）都能平滑升级到新格式；beta 用户可被正式版覆盖
- beta release 额外上传 `latest-beta.yml`（GitHub provider 频道取件兜底；实际先取 `beta.yml` 404 后回退 `latest.yml`）
- 构建元数据（commit / buildId）由 `scripts/gen-build-info.js` 写入 `src/lib/buildInfo.ts` →
  打包进渲染层，VersionCard / 关于页显示**构建来源 commit**（`scripts/version.js build ci` 负责统一设版本）

**发布内容**（`gh release create`，中文正文由 `scripts/release-notes.ps1` 生成）：
- `# Koring Launcher Releases {base}` + 版本信息（当前版本 / 编译状态 BETA/RUN / 签名状态 / **构建来源 commit**）
- `## 更新了什么内容`：自上个 `v*` tag 以来的提交记录，每条默认折叠
  （`<details><summary>·Commit 1cf906d</summary>…</details>`）
- 上传产物：setup.exe + latest.yml + release-notes.md（electron-updater 更新清单）
- **Release 标题命名（仅展示名，tag/真实版本号不变）**：run → `{full}`（如 `1.2.1-13`），
  beta → `BETA {base}`（如 `BETA 1.2.1`）

**⚠️ 版本语义注意（electron-updater，2026-08-30 已修复并落地）**：
- **根因**：GitHub provider 用 Atom feed + 频道逻辑选版本，频道只认 `alpha`/`beta` 字符串标识。
  数字 prerelease（`1.2.1-4`）在 `allowPrerelease=true` 的通道循环里会被当作"自定义频道"跳过，
  `allowPrerelease` 又由当前版本自动决定（含 prerelease 即开启）。
- **修复**：beta 用 `{base}-beta.{buildId}`（频道 `beta`，正常识别）；run 用 `{base}-{buildId}`
  且发布**不带** `--prerelease` → 正式版用户（`allowPrerelease=false`）走 `/releases/latest`
  按 GitHub 标记取最新正式版，正常识别。
- 同格式升级：`1.2.1-beta.14 > 1.2.1-beta.13`（数值比较）✓；`1.2.1-14 > 1.2.1-13` ✓
- 注意：当前版本为 `1.2.1-13`（数字尾号）时切到 runner 通道，通道逻辑会把 "13" 当自定义频道 → 无匹配，
  属预期边缘情况（数字尾号构建请使用 woker 通道）；`1.2.1-beta.x` 的 runner 用户不受影响。
- 所有旧数字版本（`1.2.1-12` / `1.2.1-2608271921`）都小于 `1.2.1-beta.13`，平滑升级，无需提升 base

## 14. M2 主进程更新模块（2026-08-28，UI 待做）

**新增/改动**：
- `electron/updater.ts` — 更新服务：electron-updater（GitHub provider）优先，失败后加速源兜底；
  状态机 idle/checking/available/not-available/downloading/downloaded/error，进度事件，`quitAndInstall`
- `electron/handlers/update.ts` — IPC：`update:check` / `update:download` / `update:pause` / `update:resume` /
  `update:cancel` / `update:quitAndInstall` / `update:getState` / `update:getReleaseNotes` /
  `update:getChannels` / `update:setChannel` / `update:setTestVersion` / `update:compareVersions`，
  状态变化广播 `update:status` 到所有窗口
- 开发者工具：`window:openDevTools`（打开 Chromium DevTools）+ 更新功能测试页
  （`debug-update`：设置测试版本号 / 检查更新 / 获取发布说明 / 版本识别列表 / 版本比对 / 下载）
- `electron/main.ts` — 注册 handler + 启动后 12s 延迟静默检查（开发模式自动跳过）
- `electron/preload.ts` + `src/types/electron.d.ts` — 暴露更新 API（UI 未接，待 M3）

**加速源兜底（实测）**：
- GitHub 直连在本机网络不可用；`gh.ddlc.top` 已实测可代理 `releases/download`（latest.yml + 102MB 安装包）与 `/releases/latest` 页面
- 发现机制（无需 GitHub API）：`{镜像}/https://github.com/{owner}/{repo}/releases/latest` 页面 HTML 提取 tag →
  `autoUpdater.setFeedURL({ provider: 'generic', url: '{镜像}/.../download/{tag}/' })` → 检查/下载
- 镜像列表可用环境变量 `UPDATE_MIRRORS` 覆盖；后续建议自建 OSS/CDN（generic 直连镜像根目录）

**状态机与 IPC 契约**（前端 M3 实现时使用）：
```
idle → checking → available → downloading → downloaded → quitAndInstall()
        └─not-available→ idle      └─ error → idle(可重试)
```
`update:status` payload：`{ state, manual, version?, currentVersion?, percent?, transferred?, total?, bytesPerSecond?, source?, channel?, error? }`

## 16. 更新通道（woker / runner，2026-08-30）

- **可扩展通道注册表**（`electron/updater.ts` 的 `UPDATE_CHANNELS`）：新增通道只需追加一项，
  UI 通过 `update:getChannels` 动态渲染
- **woker（慢走模式，默认）**：`allowPrerelease=false` → 仅获取正式版（稳定）更新
- **runner（跑步模式）**：`allowPrerelease=true` → 可获取预览版（测试版）更新
- 通道持久化在 `Koring.yml` 的 `update.channel`；`update:setChannel` 即时切换，下次检查生效
- UI：设置 → 关于 → **更新设置**区块的「更新通道」**下拉框**（选项由 `update:getChannels` 动态渲染）

## 15. 更新日志独立页面（2026-08-28）

- **独立路由页面** `src/pages/update/index.tsx`（route key `update`），不使用设置页 layout
- 顶栏（TitleBar）在 sub 模式下**只显示「返回」+ 页面标题「更新日志」**（routeStore 新增 `titleInBar`，
  其余页面仍显示品牌名）
- 页面内容：顶部 `VersionCard`，下方 Markdown 渲染当前版本发布说明
  （主进程 `update:getReleaseNotes`：GitHub 直连优先 + 加速源兜底，读 release 附件 `release-notes.md`；
  当前版本无发布说明时回退最新版本并标注）
- **入口**：除 OOBE 与更新日志页本身外，所有 VersionCard 的「检查更新」按钮点击后**跳转到本页**；
  在本页内点击则直接执行检查
- **完整下载流程（2026-08-30）**：底部遮罩驱动 —— 检查更新 → 「下载版本更新」→
  进度条（百分比/已下载/总大小/速度）+ **暂停/继续/取消**（基于 electron-updater CancellationToken）→
  「安装更新」（先写入 installing 状态并 flush 配置，再 quitAndInstall）
- **发布说明切换**：默认显示当前版本；检测到可用更新后自动切到最新版本（`getReleaseNotes(v{version})`），
  退出重进回到当前版本
- **进度持久化**：每次状态/进度变化写入 `Koring.yml` 的 `update` 段
- **版本引导（upvp）**：`Koring.yml` 增加 `appVersion` 字段（启动时不自动刷新）。
  程序版本 ≠ `appVersion` → 进入 `upvp` 引导：更新已完成 → 检查版本
  （程序版本更大 →「已更新至 X」；更小 → 版本倒退警告）→ 测试版更新需同意
  Beta 协议（复用 OOBE 协议页）→ 结束页写入 `appVersion = 程序版本` 后进主页
  （state/version/percent/transferred/total/source/error）；应用启动时清理上次的进行中状态
- 配套改动：发布流水线 `gh release create` 上传 `release-notes.md` 附件
  （旧版本发布的 release 无此附件，页面会显示回退/空态）
