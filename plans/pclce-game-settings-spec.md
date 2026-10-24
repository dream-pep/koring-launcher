# PCL-CE「启动设置」分析 → koring-launcher「设置 → 游戏」实现规格

> 分析对象：`D:\github-code-plan\PCL-CE`（PCL 社区版，C#/WPF，**只读参考**）。
> 产出目标：给 koring-launcher「设置 → 游戏」五个分页提供**设置项清单、控件形态、默认值、联动关系与字段映射**，可直接照着写 UI。
> 约束：本文只转述含义与结构，**不复制** PCL-CE 的代码、图标、文案原文。每条结论后标注 `来源文件:方法名` 或 `xaml 控件名`。
> 分析时间：2026-10-25。

---

## 0. 五个关键结论（先看这里）

1. **PCL「设置」左侧共 4 个分组**：游戏（启动 / Java / 游戏管理）、工具（联机）、启动器（界面 / 语言 / 杂项）、关于（关于 / 更新 / 反馈 / 日志）。「启动」相关的是**前 3 个子页**，不是一页。
   - 来源：`Plain Craft Launcher 2\Pages\PageSetup\PageSetupLeft.xaml`（`TextGameCategory`/`TextToolsCategory`/`TextLauncherCategory`/`TextAboutCategory` 及 `ItemLaunch`/`ItemJava`/`ItemGameManage`）。
2. **「启动」主页面 = 3 张卡片 + 1 个跳转按钮**：`启动选项`（8 行 10 控件）→ `游戏内存`（模式 + 最大/初始内存 + 可视化条）→ `高级启动选项`（默认折叠，12 项）→ 底部「切换到实例独立设置」。
   - 来源：`PageSetupLaunch.xaml`（`CardArgument` / 内存卡 / `Title=Setup.Launch.Advanced.Title` 卡 / `BtnSwitch`）。
3. **⚠️ 任务书里「PageSetupGameManage = 游戏目录/存档目录管理」的假设与源码不符**：该子页实际是「下载源 / 社区 / 无障碍」19 项（`PageSetupGameManage.xaml` 三张卡：Source / Community / Accessibility）。PCL 的**游戏目录管理在独立顶层页 `Pages\PageSelectLeft.xaml.cs`**（选择游戏文件夹，左栏列表 + 右键菜单 + 拖拽排序），不在设置子页里。
4. **PCL「启动」相关页面共约 59 个可配置点**：启动选项 10（8 行 + 自定义宽/高）、游戏内存 6 个可配置项（另 2 条警告 + 1 个可视化只读）、高级启动 12、Java 页 2 个动作 + 每个 Java 一组列表项、游戏管理页 19、游戏目录页 1 个列表 + 9 种操作。逐项清单见 §3。
5. **koring 现状差距**：现有字段可覆盖「窗口 / 可见性 / 参数 / 内存模式 / Java 自动 / 下载源 / 目录列表」；**明显缺口**是 `-Xms` 初始内存、锁定内存、IP 协议偏好、进程优先级、渲染器、GPU 偏好、java.exe、启动前等待、目录显示名/排序、下载 HTTP 模式等。逐项映射见 §5。

### 与 koring 现状的对照（关键文件）
- 配置模型：`electron/config.ts`（主进程权威，`DEFAULTS` 行 198-215）、`src/api/config.ts`（渲染端类型）、`src/stores/configStore.ts`（`DEFAULT_CONFIG` 行 53-70）。
- 启动参数落地：`electron/core/launch-options.ts:buildLaunchOptions`（行 65-129）。
- 现有游戏分页：`src/pages/setting/index.tsx:buildMenuData`（「游戏」组当前只有 4 项，行 75-83）、`src/pages/setting/game/{game-account,java-mem,game-dir,advanced}.tsx`。

---

## 1. PCL 设置左侧分组

### 1.1 分组结构（自上而下）

| 顺序 | 分组标题 | 子项（xaml Name） | Tag | 图标（lucide） | 子项右侧按钮 |
|---|---|---|---|---|---|
| 1 | 游戏 | `ItemLaunch` 启动 | 0 | rocket | 重置（初始化本页） |
| 2 | 游戏 | `ItemJava` Java | 9 | coffee | 刷新（重扫 Java） |
| 3 | 游戏 | `ItemGameManage` 游戏管理 | 2 | book-marked | 重置 |
| 4 | 工具 | `ItemGameLink` 联机 | 7 | bubbles | 重置 |
| 5 | 启动器 | `ItemUI` 界面 | 1 | palette | 重置 |
| 6 | 启动器 | `ItemLauncherLanguage` 语言 | 11 | earth | 重置 |
| 7 | 启动器 | `ItemLauncherMisc` 杂项 | 10 | monitor-cog | 重置 |
| 8 | 关于 | `ItemAbout` 关于 | 4 | info | — |
| 9 | 关于 | `ItemUpdate` 更新 | 8 | refresh-cw | — |
| 10 | 关于 | `ItemFeedback` 反馈 | 6 | message-circle | 刷新 |
| 11 | 关于 | `ItemLog` 日志 | 5 | scroll-text | — |

- 来源：`PageSetupLeft.xaml`（顺序与 `x:Name` 逐项对应）、`PageSetupLeft.xaml.cs:PageSetupLeft_Loaded`（默认选第一个未被隐藏的子页）。
- 隐藏机制：每个子页可由 `Config.Preference.Hide`（键 `UiHiddenSetupLaunch`/`SetupJava`/`SetupGameManage`/`SetupGameLink`/`SetupUi`/`SetupLauncherLanguage`/`SetupLauncherMisc`/`SetupAbout`/`SetupUpdate`/`SetupFeedback`/`SetupLog`，默认全 `false`）隐藏；「关于」分组无隐藏配置。
- 重置机制：`PageSetupLeft.xaml.cs:Reset(object,EventArgs)` 按 Tag 弹确认对话框再调对应页 `Reset()`（各页 `Reset()` 内部是 `Config.<组>.Reset()` + `Reload()`）。

### 1.2 「启动」三子页之间的关系
- 「启动」页管**全局默认启动参数**；选中实例时底部出现「切换到实例独立设置」，跳到实例页设置页签。
  - 来源：`PageSetupLaunch.xaml.cs:PageSetupLaunch_Loaded`（`BtnSwitch.Visibility` 取决于 `ModInstanceList.McMcInstanceSelected`）、`BtnSwitch_Click`（`ModMain.frmMain.PageChange(FormMain.PageType.InstanceSetup, FormMain.PageSubType.VersionSetup)`）。
- 全局与实例的**覆盖规则**（启动参数实现时用同名 `InstanceConfigGroup` 键，值为空则回落全局）：JVM 参数、游戏参数、渲染器、启动前命令/等待、标题、内存、Java 选择、隔离档位、进服地址。
  - 来源：`PCL.Core\App\Config.cs`（`[ConfigGroup("Instance")]` 行 614-641，`ArgConfig<T>` 包裹）。

---

## 2. 「启动」页分区顺序

| 顺序 | 卡片 | 标题 key | 是否可折叠 | 内容概要 |
|---|---|---|---|---|
| 1 | `CardArgument` | `Setup.Launch.Options.Title`（启动选项） | 否 | 实例隔离、窗口标题、自定义信息、启动器可见性、进程优先级、窗口大小、正版验证方式、IP 协议偏好 |
| 2 | 内存卡 | `Setup.Launch.Memory.Title`（游戏内存） | 否 | 自动/自定义、最大内存、初始内存、内存占用可视化、两条警告 |
| 3 | 高级卡 | `Setup.Launch.Advanced.Title`（高级启动选项） | **是**（`IsSwapped="True" CanSwap="True"`，默认折叠） | 渲染器、JVM 参数头部、游戏参数尾部、启动前命令、等待、7 个修复/优化开关 |
| — | `BtnSwitch` | `Setup.Launch.SwitchToInstanceSetup` | — | 「切换到实例独立设置」 |

- 来源：`PageSetupLaunch.xaml` 行 13/166/240/320。滚动容器 `PanBack`，进入页面滚回顶部（`PageSetupLaunch.xaml.cs:PageSetupLaunch_Loaded` → `PanBack.ScrollToHome()`）。

---

## 3. 逐项清单

> 约定：控件类型取 PCL 控件语义 → koring 可用控件：下拉=Select、开关=Switch、滑块=Slider、数字=NumberField、文本=Input、多行文本=TextArea、单选组=RadioGroup、按钮=Button、列表项=ListItem。
> 「默认」以 `PCL.Core\App\Config.cs` 的 `[ConfigItem]` 默认值为准（xaml 里写死的 IsSelected 只是设计期占位，运行时会被 `Reload()` 覆盖）。

### 3.1 卡片「启动选项」（`CardArgument`，8 行）

| # | 设置项 | 控件 | 可选值 / 范围 | 默认 | 含义（转述） | PCL 配置键 | 来源 |
|---|---|---|---|---|---|---|---|
| 1 | 默认实例隔离 | 下拉 | 0 关闭；1 隔离可装模组的实例（Forge/Fabric 等）；2 隔离非正式版（快照/预发布/远古/愚人节）；3 隔离可装模组 + 非正式版；4 隔离所有实例 | **4（隔离所有）** | 只影响**今后新安装**的实例；已有实例需在实例设置里改。档位决定实例存档/模组/资源包等放置路径（见 §4.3） | `LaunchArgumentIndieV2` | `PageSetupLaunch.xaml:ComboArgumentIndieV2`、`PageSetupLaunch.xaml.cs:Reload`、`Config.cs:LaunchConfigGroup` |
| 2 | 游戏窗口标题 | 可编辑下拉 | 自由文本；支持 `{user}` `{login}` `{name}` `{date}` `{time}` `{version}` | 空（不改标题） | 自定义游戏窗口标题，空则不覆盖；装了 Modern UI 模组会失效 | `LaunchArgumentTitle` | `PageSetupLaunch.xaml:TextArgumentTitle`、`PageSetupLaunch.xaml.cs:TextArgumentTitle_OnTextChanged` |
| 3 | 自定义信息 | 文本框 | 自由文本；**禁止**英文双引号与中文左右双引号 | `"PCLCE"`（xaml 里为 `"PCL"`） | 显示在游戏主界面左下角与 F3 调试页左上角的版本信息 | `LaunchArgumentInfo` | `PageSetupLaunch.xaml:TextArgumentInfo`（`BlacklistValidator`）、`Config.cs` |
| 4 | 启动器可见性 | 下拉 | 0 启动后立即关闭（会警告：崩溃检测/改标题失效）；1 历史占位（禁用不可选）；2 启动后隐藏、游戏退出后自动关闭；3 启动后隐藏、游戏退出后重新打开；4 启动后最小化；5 保持不变 | **5（保持不变）** | 游戏启动后启动器窗口怎么处理 | `LaunchArgumentVisible`（枚举 `LauncherVisibility`） | `PageSetupLaunch.xaml:ComboArgumentVisibie`、`PageSetupLaunch.xaml.cs:ComboArgumentVisibie_SelectionChanged`、`ConfigEnums.cs:LauncherVisibility` |
| 5 | 进程优先级 | 下拉 | 5 档：实时（最危险）、极高（High）、高（AboveNormal）、中（Normal）、低（BelowNormal） | **中/平衡** | 游戏进程优先级；「低」适合挂机，「实时」可能拖垮系统 | `LaunchArgumentPriority`（枚举 `GameProcessPriority`） | `PageSetupLaunch.xaml:ComboArgumentPriority`（`SelectedValuePath="Tag"`）、`ConfigEnums.cs` |
| 6 | 窗口大小 | 下拉 + 2 数字 | 0 全屏；1 默认（游戏默认分辨率）；2 与启动器尺寸一致；3 自定义尺寸；4 最大化。自定义宽 `1..9999`、高 `1..9999` | **1（默认）**，宽 854 / 高 480 | 决定 `--width/--height/--fullscreen`；仅「自定义」时显示宽高输入框 | `LaunchArgumentWindowType`、`LaunchArgumentWindowWidth`、`LaunchArgumentWindowHeight` | `PageSetupLaunch.xaml:ComboArgumentWindowType/TextArgumentWindowWidth/TextArgumentWindowHeight`、`PageSetupLaunch.xaml.cs:WindowTypeUIRefresh` |
| 7 | 正版验证方式 | 下拉（**禁用**） | 0 Web 账户管理器（暂时强制为设备代码流）；1 设备代码流 | **1（设备代码流）** | 微软登录时的 OAuth 流程形态；因依赖组件问题被强制指定 | `LoginMsAuthType` | `PageSetupLaunch.xaml:ComboMsAuthType`（`IsEnabled="False"`）、`Config.cs` 行 607 |
| 8 | IP 协议偏好 | 下拉 | 0 IPv4 优先（加 `-Djava.net.preferIPv4Stack=true`）；1 Java 默认（不加参数）；2 IPv6 优先（`-Djava.net.preferIPv6Stack=true`） | **1（Java 默认）** | 通过 JVM 参数控制游戏网络协议栈偏好；IPv4 优先可保证联机大厅正常 | `LaunchPreferredIpStack`（枚举 `JvmPreferredIpStack`） | `PageSetupLaunch.xaml:ComboPreferredIpStack`、`ConfigEnums.cs`、`zh-CN.xaml:Setup.Launch.Options.IpStack.ToolTip` |

> 备注：xaml 里 `ComboArgumentIndieV2` 设计期 `IsSelected=1`、`ComboPreferredIpStack` 设计期选中 IPv4，均会在 `Reload()` 时被配置值覆盖，**配置默认值才是真默认**。
> 额外约束：窗口大小 ToolTip 提示装了 Modern UI 模组会失效；Forge 1.12.2 等版本高度设定可能无效（`Setup.Launch.Options.WindowSize.CustomHeightBug`）。

### 3.2 卡片「游戏内存」

| # | 设置项 | 控件 | 可选值 / 范围 | 默认 | 含义 / 计算 | PCL 配置键 | 来源 |
|---|---|---|---|---|---|---|---|
| 1 | 内存分配模式 | 单选（2 项） | 自动配置 / 自定义 | **自动配置（0）** | 自动=按「剩余物理内存 + 模组数量」动态估算；自定义=用手动滑块 | `LaunchRamType`（0 自动 / 1 自定义） | `PageSetupLaunch.xaml:RadioRamType0/RadioRamType1`、`PageSetupLaunch.xaml.cs:RadioBoxChange` |
| 2 | 最大内存（-Xmx） | 滑块（刻度） | 刻度 0..动态上限；刻度→GB 分段映射 | **刻度 15 ≈ 3.0 GiB** | 仅在「自定义」可用；刻度与实际内存分段线性（公式见 §4.1） | `LaunchRamCustom` | `PageSetupLaunch.xaml:SliderRamCustom`、`PageSetupLaunch.xaml.cs:GetRamFromTick/RefreshRam` |
| 3 | 初始内存（-Xms） | 滑块（刻度） | 刻度 0..同上限；0=不主动设置 | **0（不设置）** | 仅手动模式且未开「锁定内存」时生效；实际值取 `min(刻度值, -Xmx)`；自定义 JVM 参数里已有 `-Xms` 则忽略本项 | `LaunchRamCustomInitial` | `PageSetupLaunch.xaml:SliderRamInitialCustom`、`PageSetupLaunch.xaml.cs:GetInitialRam/HasCustomXms` |
| 4 | 内存占用可视化条 | 只读图形 | — | — | 三段（已用 / 游戏分配 / 空余）+ 文本「已使用 X / 共 Y GiB」「游戏分配 Z GiB」，每秒刷新 | —（读系统内存） | `PageSetupLaunch.xaml:PanRamDisplay`、`PageSetupLaunch.xaml.cs:RefreshRam/RefreshRamText` |
| 5 | 32 位 Java 警告 | 提示条（黄） | — | 条件显示 | 分配 1 GiB 且未设 64 位 Java 且系统非 32 位且有可用 Java 时显示 | — | `PageSetupLaunch.xaml:LabRamWarn`、`PageSetupLaunch.xaml.cs:RefreshRam` |
| 6 | 分配过多警告 | 提示条（黄） | — | 条件显示 | 分配内存 / 物理内存 > 75% 时提示可能崩溃、建议自动 | — | `PageSetupLaunch.xaml:HintRamTooHigh`、`PageSetupLaunch.xaml.cs:RefreshRam` |
| 7 | 自动内存算法 | 只读 | — | — | 见 §4.1 公式（模组数 / OptiFine / 普通三套阈值 + 四段分配比例） | — | `PageSetupLaunch.xaml.cs:GetRam` |
| 8 | 32 位 Java 上限 | 只读规则 | 硬上限 1 GiB | — | 32 位 Java 时自动内存/手动内存都被截断为 1 GiB | — | `PageSetupLaunch.xaml.cs:GetRam`（`Math.Min(1d, ramGive)`） |

> 滑块的刻度不是线性 GB，UI 展示值必须走映射函数；滑块 `MaxValue` 随物理内存动态变化（公式见 §4.1），因此**不能把 Max 写死**。

### 3.3 卡片「高级启动选项」（默认折叠）

| # | 设置项 | 控件 | 可选值 / 范围 | 默认 | 含义（转述） | PCL 配置键 | 来源 |
|---|---|---|---|---|---|---|---|
| 1 | 渲染器 | 下拉 | 0 游戏默认；1 软渲染（llvmpipe）；2 DirectX12（d3d12）；3 Vulkan（zink） | **0（游戏默认）** | 改渲染后端；首次改非默认会弹「严重影响稳定性与性能」警告，取消则回滚 | `LaunchAdvanceRenderer` | `PageSetupLaunch.xaml:ComboAdvanceRenderer`、`PageSetupLaunch.xaml.cs:ComboAdvanceRenderer_SelectionChanged` |
| 2 | JVM 参数头部 | 多行文本框（最多 4000 字符）+ 还原按钮 | 自由文本；支持 `${library_directory}` 等替换标记 | 一段以 `-XX:+UseG1GC` 开头的默认串（含关闭自适应 sizing、省略异常栈、允许模糊进程命令、Forge 证书容错 2 项、log4j2 关闭 lookups，共 7 个标志） | 启动时附加的 JVM 参数；只有「确认有把握」才改；「还原」按钮仅在偏离默认时出现 | `LaunchAdvanceJvm` | `PageSetupLaunch.xaml:TextAdvanceJvm/BtnAdvanceJvmReset`、`PageSetupLaunch.xaml.cs:TextAdvanceJvm_TextChanged/BtnAdvanceJvmReset_Click` |
| 3 | 游戏参数尾部 | 文本框 | 自由文本；支持替换标记 | 空 | 直接拼到启动参数末尾（例：`--demo` 以试玩模式启动） | `LaunchAdvanceGame` | `PageSetupLaunch.xaml:TextAdvanceGame` |
| 4 | 启动前执行命令 | 文本框 | 自由文本（Windows 命令提示符语法） | 空 | 启动前执行命令/程序；支持 `{path}` `{minecraft}` `{verpath}` `{verindie}` `{java}` `{user}` `{login}` `{uuid}` `{name}` `{date}` `{time}` `{version}`；工作目录为 .minecraft | `LaunchAdvanceRun` | `PageSetupLaunch.xaml:TextAdvanceRun`、`zh-CN.xaml:Setup.Launch.Advanced.PreLaunchCommand.ToolTip` |
| 5 | 等待命令执行完成 | 开关 | 开/关 | **开（true）** | 勾选则等命令结束再继续启动；**仅当「启动前执行命令」非空时可见** | `LaunchAdvanceRunWait` | `PageSetupLaunch.xaml:CheckAdvanceRunWait`、`PageSetupLaunch.xaml.cs:TextAdvanceRun_TextChanged` |
| 6 | 禁用 Java Launch Wrapper | 开关 | 开/关 | **开（禁用）** | PCL 用 JLW 修老版本 Java 在中文路径下无法启动；被反作弊拦截时可关掉。ARM64 上强制勾选且禁用 | `LaunchAdvanceDisableJLW` | `PageSetupLaunch.xaml:CheckAdvanceDisableJLW`、`PageSetupLaunch.xaml.cs:Reload`（`SystemInfo.IsArm64System` 分支） |
| 7 | 禁用 LegacyFix | 开关 | 开/关 | 关（false） | PCL 对 1.5.x 及以下版本做的兼容修复 | `LaunchAdvanceDisableLF` | `PageSetupLaunch.xaml:CheckAdvanceDisableLF` |
| 8 | 要求 Java 使用高性能显卡 | 开关 | 开/关 | **开（true）** | 在 Windows 显卡设置里把 Java 登记为高性能显卡（双显卡机型可显著提升帧数） | `LaunchAdvanceGraphicCard` | `PageSetupLaunch.xaml:CheckAdvanceGraphicCard` |
| 9 | 使用 java.exe 而非 javaw.exe | 开关 | 开/关 | 关（false） | 让游戏进程有标准输入输出，缓解窗口迟迟不出现；但可能失去 HDR 等特性 | `LaunchAdvanceNoJavaw` | `PageSetupLaunch.xaml:CheckAdvanceNoJavaw` |
| 10 | 禁用 LWJGL Unsafe Agent | 开关 | 开/关 | 关（false） | PCL 针对 MC 26.1 / LWJGL 3.4.1 / JDK25+ FFM 的性能修复；仅 LWJGL 3.4.1 生效 | `LaunchAdvanceDisableLwjglUnsafeAgent` | `PageSetupLaunch.xaml:CheckAdvanceDisableLwjglUnsafeAgent` |
| 11 | 禁用自动崩溃分析 | 开关 | 开/关 | 关（false） | 崩溃时不再自动弹崩溃分析页 | `LaunchAdvanceDisableCrashAnalysis` | `PageSetupLaunch.xaml:CheckAdvanceDisableCrashAnalysis` |
| 12 | 锁定内存分配（-Xms = -Xmx） | 开关 | 开/关 | 关（false） | 额外追加 `-Xms` 使其等于 `-Xmx`，固定堆大小、隐式禁用堆内存归还能减少延迟抖动（利于 ZGC）；代价是全程占用接近最大分配 | `LaunchAdvanceLockMemory` | `PageSetupLaunch.xaml:CheckAdvanceLockMemory`、`PageSetupLaunch.xaml.cs:RamType`、`Config.cs` 行 494-497 注释 |
| — | 底部提示 | 提示条（蓝，可关闭） | — | — | 「更多高级启动选项在实例独立设置」 | — | `PageSetupLaunch.xaml:MoreInInstanceSetup` |

### 3.4 Java 页（`PageSetupJava`）

页面结构：**没有卡片标题**，只有「添加 Java」按钮卡 + 一个动态列表卡 + 加载遮罩。

| # | 设置项 | 控件 | 可选值 / 范围 | 默认 | 含义 | 存储 | 来源 |
|---|---|---|---|---|---|---|---|
| 1 | 添加 Java | 按钮 | 选择 `java.exe` 文件 | — | 选文件后校验并加入 Java 列表；已存在则提示；失败提示 | Java 列表配置（`ModJava.Javas.SaveConfig`） | `PageSetupJava.xaml:BtnAdd`、`PageSetupJava.xaml.cs:BtnAdd_Click` |
| 2 | 自动选择 | 单选列表项（第 1 项） | 选中=清空选择 | **默认选中** | 由启动器按实例 MC 版本自动挑 Java | `LaunchArgumentJavaSelect = ""` | `PageSetupJava.xaml.cs:OnLoadFinished` |
| 3 | Java 列表项 | 单选列表项（动态） | 每个检测到的 Java 一项 | — | 标题 `JRE/JDK + 主版本`；副标题 Java 目录；标签 `64 Bit/32 Bit` + 发行商；按钮：打开文件夹 / 详情弹窗 / 启用-禁用切换 | 启用状态存 Java 列表配置；选中项存 `LaunchArgumentJavaSelect`（exe 完整路径） | `PageSetupJava.xaml.cs:ItemBuild` |
| 4 | Java 不可用/禁用规则 | 交互约束 | — | — | 文件已不存在的 Java 不能选；被禁用的必须先启用才能选；正在使用中的 Java 不能直接禁用（提示先取消选中） | — | `PageSetupJava.xaml.cs:ItemBuild`（Check/btnEnableSwitch） |
| 5 | 禁用样式 | 视觉 | — | — | 禁用项标题加删除线并变灰，按钮图标变「启用」 | — | `PageSetupJava.xaml.cs:UpdateEnableStyle` |
| 6 | 刷新（左侧按钮） | 按钮 | — | — | 强制重扫系统 Java（`ScanJavaAsync(force:true)` + 可用性检查） | — | `PageSetupLeft.xaml:ItemJava` 的 `Refresh`、`PageSetupJava.xaml.cs:Load_GetJavaList` |

### 3.5 游戏管理页（`PageSetupGameManage`，实为下载/社区/无障碍）

#### 卡 1：下载（`Setup.GameManage.Source.Title`）

| # | 设置项 | 控件 | 可选值 / 范围 | 默认 | 含义 | PCL 配置键 | 来源 |
|---|---|---|---|---|---|---|---|
| 1 | 文件下载源 | 下拉 | 0 使用镜像源；1 优先官方、失败回退镜像；2 仅官方 | **1** | 游戏文件（jar/libraries/assets）下载源策略 | `ToolDownloadSource` | `PageSetupGameManage.xaml:ComboDownloadSource` |
| 2 | 版本列表源 | 下拉 | 0 仅镜像；1 优先官方后镜像；2 仅官方 | **1** | 版本清单 JSON 来源 | `ToolDownloadVersion` | `ComboDownloadVersion` |
| 3 | HTTP 协议 | 下拉 | Auto / HTTP 1.1 / HTTP 2 | Auto | 下载使用 HTTP 版本 | `ToolDownloadHttpMode`（枚举 `DownloadHttpMode`） | `ComboDownloadHttpMode` |
| 4 | 下载线程数 | 滑块 | 显示值 1..256（内部 0..255） | **63（显示 64）** | 并发下载线程；≥64 首次弹出性能警告 | `ToolDownloadThread` | `SliderDownloadThread`、`PageSetupGameManage.xaml.cs:SliderLoad/SliderDownloadThread_PreviewChange` |
| 5 | 单文件连接数 | 滑块 | 显示 1..8（内部 0..7） | **7（显示 8）** | 单文件分片连接数 | `ToolDownloadFileConnection` | `SliderDownloadFileConnection` |
| 6 | 下载限速 | 滑块 | 0..42；42=不限速；分段映射 0.1~20 MiB/s | **42（不限速）** | 全局限速 | `ToolDownloadSpeed` | `SliderDownloadSpeed`、`SliderLoad` |
| 7 | 下载目标文件夹 | 只读文本 | — | — | 提示默认安装位置规则（不在本页改） | — | `Setup.GameManage.Download.TargetFolder(.Hint)` |
| 8 | 自动选择版本 | 开关 | — | **开** | 下载时自动选最新匹配版本 | `ToolDownloadAutoSelectVersion` | `CheckDownloadAutoSelectVersion` |
| 9 | 修复 Authlib | 开关 | — | **开** | 自动修复 authlib-injector 相关依赖 | `ToolFixAuthlib` | `CheckFixAuthlib` |

#### 卡 2：社区（`Setup.GameManage.Community.Title`）

| # | 设置项 | 控件 | 可选值 / 范围 | 默认 | 含义 | PCL 配置键 | 来源 |
|---|---|---|---|---|---|---|---|
| 1 | 社区内容源 | 下拉 | 0 镜像；1 优先官方、回退镜像；2 仅官方 | **1** | 模组/整合包/资源包搜索下载源 | `ToolDownloadMod` | `ComboDownloadMod` |
| 2 | 文件名格式 | 下拉 | 5 档（0..4） | **1** | 下载文件重命名规则（仅简体中文环境显示） | `ToolDownloadTranslateV2` | `ComboDownloadTranslateV2`、`PageSetupGameManage.xaml.cs:PageSetupSystem_Loaded`（`Lang.IsChineseMainland`） |
| 3 | Mod 管理样式 | 下拉 | 0 标题用翻译名；1 标题用文件名 | **0** | 本地模组列表名称展示方式（仅简体中文环境显示） | `ToolModLocalNameStyle` | `ComboModLocalNameStyle` |
| 4 | 快捷下载行为 | 下拉 | 0 每次询问；1 装到当前实例；2 询问实例；3 询问路径 | **0** | 点「下载」时的默认落点 | `ToolDownloadQuickBehavior` | `ComboDownloadQuickBehavior` |
| 5 | 隐藏 Quilt | 开关 | — | **开** | 搜索结果中隐藏 Quilt 加载器项 | `ToolDownloadIgnoreQuilt` | `CheckDownloadIgnoreQuilt` |
| 6 | 自动安装依赖 | 开关 | — | **开** | 下载模组时自动装前置 | `ToolDownloadAutoInstallDependencies` | `CheckDownloadAutoInstallDependencies` |

#### 卡 3：无障碍/辅助（`Setup.GameManage.Accessibility.Title`）

| # | 设置项 | 控件 | 可选值 | 默认 | 含义 | PCL 配置键 | 来源 |
|---|---|---|---|---|---|---|---|
| 1 | 正式版更新提示 | 开关 | — | 关 | 有新正式版 MC 时提示 | `ToolUpdateRelease` | `CheckUpdateRelease` |
| 2 | 快照更新提示 | 开关 | — | 关 | 有新快照时提示 | `ToolUpdateSnapshot` | `CheckUpdateSnapshot` |
| 3 | 游戏语言自动切换启动器语言 | 开关 | — | **开** | 依据游戏语言自动切换启动器界面语言 | `ToolHelpChinese` | `CheckHelpLauncherLanguage` |
| 4 | 读取剪贴板 | 开关 | — | 关 | 自动识别剪贴板里的资源链接（xaml 中该开关定义在无障碍卡内，不在社区卡） | `ToolDownloadClipboard` | `CheckDownloadClipboard` |

### 3.6 游戏目录管理（真实位置：`Pages\PageSelectLeft.xaml.cs`，PCL 的「选择游戏文件夹」页）

| 区域 | 内容 | 交互 | 来源 |
|---|---|---|---|
| 列表 | 每项：显示名（Title）+ 完整路径（Info）+ 单选圆点；右上齿轮按钮开右键菜单 | 点击切换当前游戏目录；切换会重载实例列表 | `PageSelectLeft.xaml.cs:McFolderListUI/Folder_Change` |
| 文件夹类型 | Original（启动器自带 .minecraft）/ RenamedOriginal（改过名的自带目录）/ Custom（用户添加） | 决定右键菜单项不同 | `McFolderListUI`（`switch (folder.type)`） |
| 右键菜单 | 重命名、复原名称（仅改过名的自带目录）、上移、下移、打开、刷新、移出列表（仅 Custom）、删除（清空） | 首项隐藏上移、末项隐藏下移；支持拖拽排序 | 同上 + `MoveUp_Click/MoveDown_Click/Restore_Click/Rename_Click/Open_Click/Refresh_Click/Remove_Click/Delete_Click/Item_Drop` |
| 添加已有文件夹 | 按钮「添加已有文件夹」 | 选目录 → 要求输入显示名（≤40 字符，禁止 `>` 与竖线字符）→ 加入并切为当前；路径含 `!` `;` 直接拒绝；无权限提示；已在列表则更新显示名 | `Add_Click` / `AddFolder` |
| 新建 .minecraft | 按钮（仅当启动器同目录没有 .minecraft 时显示） | 在启动器所在目录创建 `.minecraft` 与 `versions`，生成 launcher_profiles.json，设为当前 | `Create_Click` |
| 导入整合包 | 按钮「导入整合包」 | 在当前选择的文件夹下安装整合包 | `Setup.Folder.ImportModpack.*` |
| 移出列表 | 仅 Custom；先问是否清理 PCL 在该目录的配置（PCL.ini 与 `versions/*/PCL/`）→ 删除配置 / 保留 / 取消 | 移出只改列表，不动游戏文件 | `Remove_Click` |
| 删除目录 | 两次确认（首次+最终警告）→ 后台删除整个目录；若只剩启动器自带 .minecraft 则按钮变「清空」：删完再重建空目录 | 不可恢复提示写明「除 MC 外的文件也会一起丢失」 | `Delete_Click` |
| 下载中保护 | 有下载任务时禁止添加、新建、切换目录 | 提示错误 Hint | `Add_Click/Create_Click/Folder_Change` |
| 存储格式 | 一条字符串：`显示名>路径` 再用 `｜`（竖线）拼接多条；当前目录另存，路径中启动器目录前缀替换为 `$` | 顺序即列表顺序 | `UpdateFolderOrder`、`AddFolder`、`Folder_Change` |

### 3.7 实例级启动设置（参考：PCL 实例设置页，用于我们实例页签/覆盖逻辑）

| 分类 | 键（`[ConfigGroup("Instance")]`，空=回落全局） | 默认 | 说明 |
|---|---|---|---|
| 内存 | `VersionRamType` 2（=跟随全局）/ `VersionRamCustom` 15 / `VersionRamCustomInitial` 0 | 跟随全局 | 实例覆盖内存模式与两档刻度 |
| Java | `VersionArgumentJavaSelect` "使用全局设置" / `VersionAdvanceJava` false（忽略 Java 兼容性） | 跟随全局 | 实例独立 Java 与跳过版本要求 |
| 参数 | `VersionAdvanceJvm` / `VersionAdvanceGame` / `VersionAdvanceRun` / `VersionAdvanceRunWait` / `VersionAdvanceRenderer` / `VersionAdvanceClasspathHead` | 空/true/0 | 实例级覆盖 |
| 修复开关 | `VersionAdvanceDisableJLW` / `VersionAdvanceDisableLF` / `VersionAdvanceDisableLwjglUnsafeAgent` / `VersionAdvanceUseProxyV2` / `VersionUseDebugLog4j2Config` | false | 实例级修复开关 |
| 标题 | `VersionArgumentTitle` / `VersionArgumentTitleEmpty`（=用全局标题）/ `VersionArgumentInfo` | 空/false | 实例级窗口标题、左下角信息 |
| 隔离 | `VersionArgumentIndie`（-1 = 跟随全局）/ `VersionArgumentIndieV2`（false = 跟随全局） | 跟随全局 | 单实例隔离档位 |
| 进服 | `VersionServerEnter` | 空 | 启动后自动进入的服务器 |

- 来源：`PCL.Core\App\Config.cs` 行 614-641。

---

## 4. 交互联动（实现时必须一起写）

### 4.1 内存：模式 ↔ 滑块可用性 ↔ 锁定内存 ↔ 显示数字

| 关联 | 规则 | 来源 |
|---|---|---|
| 模式 → 最大内存滑块 | 仅「自定义」时 `SliderRamCustom.IsEnabled`；自动模式下滑块禁用但保留值 | `PageSetupLaunch.xaml.cs:RamType` |
| 模式 + 锁定 → 初始内存滑块 | `SliderRamInitialCustom.IsEnabled = (mode==1 && !LockMemory)`；即锁定内存时 -Xms 恒等于 -Xmx，初始内存项失效 | `RamType` |
| 锁定内存 → 重新计算可用性 | 勾选/取消「锁定内存」后立刻重跑 `RamType(Config.Launch.MemoryAllocationMode)` | `PageSetupLaunch.xaml.cs:CheckBoxChange` |
| 刻度 → GiB 映射 `GetRamFromTick` | `v≤12 → v*0.1+0.3`；`12<v≤25 → (v-12)*0.5+1.5`；`25<v≤33 → (v-25)+8`；`v>33 → (v-33)*2+16` | `PageSetupLaunch.xaml.cs:GetRamFromTick` |
| 物理内存 → 滑块上限 | `tot≤1.5G`：`max(floor((tot-0.3)/0.1),1)`；`≤8G`：`floor((tot-1.5)/0.5)+12`；`≤16G`：`floor((tot-8)/1)+25`；`>16G`：`floor((tot-16)/2)+33` | `RefreshRam` |
| 自动模式取值 `GetRam` | 三套基准：可装模组实例（mods 文件数 n）最低 `0.5+n/150`、目标1 `1.5+n/90`、目标2 `2.7+n/50`、目标3 `4.5+n/25`；OptiFine 实例 0.5/1.5/3/5；普通实例 0.5/1.5/2.5/4。按比例 1 / 0.7 / 0.4 / 0.15 逐段从「可用物理内存」取 min(delta, avail*ratio)，最后 `max(结果, 最低值)`、四舍五入 1 位 | `PageSetupLaunch.xaml.cs:GetRam` |
| 32 位 Java 截断 | 若使用 32 位 Java，分配值 `min(1 GiB, 值)` | `GetRam` 末尾 |
| 初始内存生效条件 `GetInitialRam` | `LockMemory` / 自定义 JVM 参数含 `-Xms` / 非手动模式 / 刻度≤0 → **不生效**（返回 null，UI 不显示初始值后缀）；否则 `min(刻度值, -Xmx)` | `GetInitialRam`、`HasCustomXms` |
| 实例级 JVM 参数优先 | 实例 `VersionAdvanceJvm` 非空 → 完全忽略全局 JVM 参数；只有实例为空才跟随全局（判断 `-Xms` 也用这个规则） | `HasCustomXms` 注释与实现 |
| 可视化条 | 每秒刷新一次；`已用 = 总-可用`、`游戏分配 = min(分配, 可用)`、空余 = clamp；文本按宽度三档降级（全显示/半显示/只显数字） | `RefreshRam`、`RefreshRamText` |

### 4.2 窗口大小联动
- 窗口模式选中「自定义尺寸」才显示「宽 × 高」两个输入框与「×」分隔符；切到其他模式立即隐藏（`PageSetupLaunch.xaml.cs:WindowTypeUIRefresh`，条件 `SelectedIndex == 3`）。
- 宽/高 `IntValidator`：`1..9999`，超范围输入不写入配置。
- 提示：装了 Modern UI 模组时此项失效；个别老版本（Forge 1.12.2 等）高度可能无效。

### 4.3 版本隔离档位 → 影响哪些路径
- PCL 的 `IndieSolutionV2` 档位决定**新实例**的「实例隔离」默认开关，进而决定该实例的存档（saves）、模组（mods）、资源包、崩溃报告等落在「实例目录」还是「共享 `.minecraft`」。
- 档位 0（关闭）：所有实例共用同一套 saves/mods/resourcepacks；1：仅可装模组的实例（Forge/Fabric 等）隔离；2：仅非正式版（快照/预发布/远古/愚人节）隔离；3：两者都隔离；4：全部隔离。
- 改动只对**今后新装**实例生效；已有实例在各自实例设置里改，且改动后可能需手动迁移存档（迁移提示见 `zh-CN.xaml:Instance.Setup.Options.InstanceIsolation.Message`）。
- 实例级覆盖键：`VersionArgumentIndie`（-1 跟随全局）/ `VersionArgumentIndieV2`（false 跟随全局）；来源 `Config.cs` 行 637-638。
- 另外：添加「根目录整合包」目录时，PCL 会自动给可装模组且隔离目录没有 mods 的实例关闭单版本隔离（`PageSelectLeft.xaml.cs:AddFolder` → `Config.Instance.IndieV1=2 / IndieV2=false`）。

### 4.4 Java 自动 / 手动逻辑
- 自动：`LaunchArgumentJavaSelect` 为空字符串 → 走自动匹配（PCL 按版本要求 + 本机 Java 列表挑选；koring 现有 `electron/core/launch-options.ts:requiredJavaMajor` 已实现版本→主版本规则：1.20.5+ → 21、1.17–1.20.4 → 17、≤1.16.5 → 8）。
- 手动：选择一个 Java 列表项 → 写入该 Java 的 exe 完整路径；路径失效/被禁用时不改配置并提示。
- 禁用 Java 不能直接禁用「正在使用中」的那一个（`PageSetupJava.xaml.cs:btnEnableSwitch`）。
- 添加 Java 后必须重扫列表才能出现（`BtnAdd_Click` → `loader.Start(true,true)`）。
- 只有「自动选择」项被选中时 `SelectedJava` 才被清空，其他项选中即写入路径。

### 4.5 其他联动
| 联动 | 规则 | 来源 |
|---|---|---|
| 启动前命令 ↔ 等待复选框 | 命令输入框为空 → 「等待命令执行完成」隐藏；非空 → 显示 | `PageSetupLaunch.xaml.cs:TextAdvanceRun_TextChanged` |
| JVM 参数 ↔ 还原按钮 | 文本 == 配置默认值 → 按钮 Hidden；否则 Visible | `TextAdvanceJvm_TextChanged` |
| 渲染器 ↔ 警告 | 首次改到非默认：弹警告；取消 → 回滚选中项；确认 → 写入并记 `States.Hint.Renderer` 以后不再弹 | `ComboAdvanceRenderer_SelectionChanged` |
| 启动器可见性 ↔ 警告 | 选「启动后立即关闭」：弹警告；取消 → 回滚到原选项 | `ComboArgumentVisibie_SelectionChanged` |
| 实例隔离 ↔ 提示 | 每次切换档位都弹「只对新实例生效」提示 | `ComboArgumentIndie_SelectionChanged` |
| ARM64 ↔ JLW | ARM64 系统强制「禁用 Java Launch Wrapper」勾选且不可改，ToolTip 说明原因 | `PageSetupLaunch_Loaded` |
| 高级卡 ↔ 实例入口 | 高级卡默认折叠；底部提示可跳实例设置 | `PageSetupLaunch.xaml`（`CanSwap`/`MoreInInstanceSetup`） |
| 游戏管理 ↔ 语言 | 非简体中文环境隐藏「文件名格式」「Mod 管理样式」两行（行高置 0） | `PageSetupGameManage.xaml.cs:PageSetupSystem_Loaded` |
| 下载线程 ↔ 警告 | 滑块 ≥64 时首次提示下载线程过多 | `SliderDownloadThread_PreviewChange` |
| 游戏目录 ↔ 下载任务 | 有下载任务时禁止添加/新建/切换目录 | `PageSelectLeft.xaml.cs:Add_Click/Create_Click/Folder_Change` |
| 游戏目录 ↔ 当前目录 | 切换目录后重载实例列表；删除/移出后刷新列表 | `Folder_Change`、`Remove_Click`、`Delete_Click` |

---

## 5. 映射到 koring `AppConfig`

### 5.1 现有字段核对（先修正两处不一致）

| 问题 | 详情 | 建议 |
|---|---|---|
| ⚠️ 渲染端类型缺字段 | `electron/config.ts:UiConfig`（行 90-99）有 `homeTitleDetail` / `showQuickActions`，但 `src/api/config.ts:UiConfig`（行 64-69）只有 `showInstanceTitle` / `showTaskButton`；`src/stores/configStore.ts:66` 的默认值也只有 2 个字段 | 把 `src/api/config.ts` 与 `configStore.ts` 的 `UiConfig` 补齐（`homeTitleDetail: string`、`showQuickActions: boolean`），否则 TS 侧无法写这两个设置 |
| ⚠️ 渲染端类型多字段 | `src/api/config.ts:GameConfig`（行 22-30）有 `savesDir` / `instancesDir`，`electron/config.ts:GameConfig`（行 46-56）与 `DEFAULTS`（行 206）没有 | 要么在主进程补字段+默认值，要么从渲染端类型删掉；`game-dir` 页实际只用 `gameDir`/`gameDirs`/`resourceDir` |
| 已有可复用能力 | `electron/core/launch-options.ts:buildLaunchOptions` 已把 `winMode`/`customWidth`/`customHeight`/`gameArgs`/`jvmArgs`/`gc`/`memMode`/`memGB`/`preLaunchCmd`/`debugMode` 落到 `LaunchOption`；`electron/handlers/launch.ts` 已处理 `afterLaunch` | 新增字段时要同步在这里接线，否则是「假设置」 |

### 5.2 映射表（PCL 项 → koring 字段）

图例：✅ 已有等价字段且已接线 · 🟡 需新增字段或扩展枚举（字段建议见 §5.3）· ⚠️ 字段已有但语义/实现有缺口 · ❌ 无法等价（理由见 §5.4）

#### A. 「启动选项」卡片

| PCL 设置项 | koring 字段 | 状态 | 说明 |
|---|---|---|---|
| 默认实例隔离 | —（实例 `resourcePath`/`gamePath` 由启动计划决定） | ❌ | 我们按「实例自包含 / 共享资源目录」模型运作（`electron/core/launch-options.ts` 的 `gamePath`/`resourcePath`），没有全局隔离档位；若要做，应在实例创建流程里提供「是否隔离」选项（沿用 `instance.json` 的 `resourcePath`） |
| 游戏窗口标题 | — | ❌ | `@xmcl/core LaunchOption` 无自定义窗口标题能力；PCL 是启动后改窗口句柄标题。可后续用 native 插件实现，本期不做 |
| 自定义信息（左下角） | — | ❌ | 同上，需改游戏内存/Mod，无接口 |
| 启动器可见性 | `advanced.afterLaunch`（`close` / `minimize` / `keep`） | 🟡 | 已有 3 态并接线（`electron/handlers/launch.ts:14`）；缺 PCL 的「隐藏且退出后关闭」「隐藏且退出后重开」→ 扩展枚举 `hide-exit` / `hide-reopen` |
| 进程优先级 | — | 🟡 | 新增 `advanced.processPriority`；实现需 Win32 `SetPriorityClass`（Electron 无内置 API），可先落配置、UI 标注「实验性」 |
| 窗口大小 | `advanced.winMode` + `customWidth` + `customHeight` | ⚠️ | 已有 `default`/`fullscreen`/`custom` 并接线；缺 `maximized` 与「与启动器尺寸一致」→ 扩展枚举，`launcher` 可在启动时读主窗口尺寸 |
| 正版验证方式 | —（账户走 `koring-auth.json`，现有微软/离线账号） | 🟡 | 新增账户级配置（如 `account.msAuthFlow`：`device-code` / `web`）；若产品确定只做一种流程，可标 ❌ |
| IP 协议偏好 | — | 🟡 | 新增 `java.preferredIpStack`（`ipv4` / `default` / `ipv6`），接线即在 `extraJVMArgs` 追加 `-Djava.net.preferIPv4Stack=true` / `preferIPv6Stack`；成本最低、收益明确 |

#### B. 「游戏内存」卡片

| PCL 设置项 | koring 字段 | 状态 | 说明 |
|---|---|---|---|
| 内存分配模式（自动/自定义） | `java.memMode`（`auto` / `custom`） | ✅ | 已在 `launch-options.ts:79-83` 接线；自动模式目前是「实例 min/max 或 1024/4096」，比 PCL 动态公式简单 |
| 最大内存（-Xmx） | `java.memGB`（1–16，步进 1） | ✅ | 已接线 `maxMemory = memGB*1024`；建议放宽上限（按物理内存动态，PCL 公式见 §4.1） |
| 初始内存（-Xms） | — | 🟡 | 新增 `java.initialMemGB: number`（默认 0=不设置）；接线 `minMemory = min(2, memGB)` 改为「若 initialMemGB>0 用其值」 |
| 内存可视化条 | —（UI 只读） | 🟡 | 需主进程提供总内存/可用内存（`os.totalmem()/freemem()`，可由 `system` handler 暴露），渲染端画三段条 + 每秒刷新 |
| 32 位 Java 警告 | —（UI 条件提示） | 🟡 | 由 `java:plan`/`java:resolve` 返回的 major/arch 判断；仅在 32 位 Java 时提示 1 GiB 上限 |
| 分配过多警告 | —（UI 条件提示） | 🟡 | 分配 > 总内存 75% 时提示，纯前端计算 |
| 自动内存动态算法 | `java.memMode='auto'` | ⚠️ | 当前自动值来自实例 min/max；若要 PCL 级体验，需按「可用内存 + 模组数」重写（公式可直接用 §4.1 参数） |
| 锁定内存（-Xms=-Xmx） | — | 🟡 | 新增 `java.lockMemory: boolean`（默认 false）；接线：`if (lockMemory) minMemory = maxMemory` |

#### C. 「高级启动选项」卡片

| PCL 设置项 | koring 字段 | 状态 | 说明 |
|---|---|---|---|
| 渲染器 | — | 🟡 | 新增 `advanced.renderer`（`default` / `llvmpipe` / `d3d12` / `vulkan`）；接线为 JVM/环境参数（如 LWJGL 后端选择），需原生实验验证，先落配置+警告弹窗 |
| JVM 参数头部 | `java.jvmArgs` | ⚠️ | 字段已有并接线；语义差异：PCL 默认串自带 G1GC 等 7 个标志，koring 默认空 + 独立 `java.gc` 选项。**不要**照搬 PCL 默认串，保持我们「默认空 + GC 下拉」更清晰；UI 文案说明「留空=仅使用 GC 选项」 |
| 游戏参数尾部 | `advanced.gameArgs` | ✅ | 已接线 `extraMCArgs` |
| 启动前执行命令 | `advanced.preLaunchCmd` | ✅ | 已接线 `prependCommand`；支持引号解析（`parseArgs`） |
| 等待命令执行完成 | — | 🟡 | 新增 `advanced.preLaunchWait: boolean`（默认 true）；实现依赖 `@xmcl/core` prependCommand 的同步语义，需确认/自研 spawn；确认前可先隐藏该项 |
| 禁用 Java Launch Wrapper | — | ❌ | PCL 自研 Java Wrapper，我们没有对应组件 |
| 禁用 LegacyFix | — | ❌ | PCL 自研老版本兼容修复，无对应组件 |
| 要求 Java 使用高性能显卡 | — | 🟡 | 新增 `advanced.gpuPreference: boolean`（默认 true）；Windows 下写注册表/调用 `SetProcessDefaultGpuPreference`（需原生或 `reg` 命令，谨慎） |
| 使用 java.exe 而非 javaw.exe | — | 🟡 | 新增 `java.useJavaExe: boolean`（默认 false）；自动匹配时把 `javaw.exe` 换 `java.exe` |
| 禁用 LWJGL Unsafe Agent | — | ❌ | PCL 自研修复，无对应组件 |
| 禁用自动崩溃分析 | 崩溃分析页（`src/pages/crash/index.tsx` 存在） | 🟡 | 新增 `advanced.disableCrashAnalysis: boolean`（默认 false），崩溃自动弹页逻辑需接线 |
| 锁定内存分配 | — | 🟡 | 同 B 表 `java.lockMemory`（PCL 把该开关放在高级卡，可按我们 IA 放内存区） |

#### D. Java 页

| PCL 设置项 | koring 字段 | 状态 | 说明 |
|---|---|---|---|
| 自动选择 / 手动路径 | `java.autoJavaPath` + `java.javaPath` | ✅ | 已有（`java-mem.tsx`）+ 自动匹配预览（`java:plan`） |
| Java 列表 + 选中 | `java.javaPath`（单选） | ⚠️ | 我们只有「扫描→使用」一次性列表，不持久化多 Java 列表与启用/禁用；如需 PCL 体验，见 §5.3 `java.disabledJavaPaths` |
| 添加 Java 文件 | `java.javaPath` 文件选择器 | ✅ | 等价（`SettingFilePicker` + `java:resolve` 校验） |
| 启用/禁用 Java | — | 🟡 | 新增 `java.disabledJavaPaths: string[]`（默认 `[]`），扫描结果过滤/置灰 |
| 详情/打开文件夹 | —（可用 `system:open-path`） | ✅ | 现有 IPC 支持打开路径 |

#### E. 游戏管理页（下载/社区/无障碍）

| PCL 设置项 | koring 字段 | 状态 | 说明 |
|---|---|---|---|
| 文件下载源 | `download.source`（`official`/`bmclapi`/`custom`） | ⚠️ | 3 值 ≈ PCL 3 值，但语义不同：PCL 的「优先官方后回退镜像」我们没有（现在是单一源 + 自定义地址） |
| 版本列表源 | `download.source`（合并） | ⚠️ | 我们把文件源与版本清单源合并成一个；若要分开，见 §5.3 `download.versionSource` |
| HTTP 协议 | — | 🟡 | 新增 `download.httpMode`（`auto` / `http1.1` / `http2`） |
| 下载线程数 | `download.threads`（1–64） | ✅ | 已接线（PCL 上限更大，没必要跟） |
| 单文件连接数 | — | ❌ | `@xmcl/file-transfer` 无分片连接数控制（AGENT-NOW-DO 已注明旧 `speedLimit` 因此删除） |
| 下载限速 | — | ❌ | 同上，无带宽限制能力，避免「假设置」 |
| 自动选择版本 | — | 🟡 | 新增 `download.autoSelectVersion: boolean`（默认 true） |
| 修复 Authlib | — | 🟡 | 新增 `download.fixAuthlib: boolean`（默认 true）；若我们的依赖链不需要，可标 ❌ |
| 社区内容源 | —（当前仅 Modrinth） | ❌ | 产品上只接 Modrinth，CurseForge 镜像策略无意义 |
| 文件名格式 / Mod 管理样式 | — | 🟡 | 纯展示层规则，可新增 `download.filenameFormat` / `download.modNameStyle`（低优先级） |
| 快捷下载行为 / 自动装依赖 / 忽略 Quilt / 读剪贴板 | — | 🟡 | 分别新增 `download.quickDownloadBehavior` / `autoInstallDependencies` / `ignoreQuilt` / `readClipboard`（低优先级，需下载流程配合） |
| 正式版/快照更新提示 | — | 🟡 | 新增 `download.notifyRelease` / `notifySnapshot`（默认 false），需资讯/版本列表侧接线 |
| 游戏语言自动切启动器语言 | `app.language`（手动） | 🟡 | 新增 `app.autoLanguage: boolean`（默认 true） |

#### F. 游戏目录页

| PCL 功能 | koring 字段/能力 | 状态 | 说明 |
|---|---|---|---|
| 目录列表 + 当前目录 | `game.gameDir` + `game.gameDirs[]` | ✅ | 已有 `game-dir.tsx`（自动查找/当前目录/已添加目录） |
| 共享资源目录 | `game.resourceDir` | ✅ | 已有且启动解析使用（`launch-options.ts` 注释：实例 resourcePath → 实例目录 → 共享目录） |
| 显示名（重命名） | — | 🟡 | 新增 `game.dirAliases: Record<string,string>`（默认 `{}`，key=规范化路径），或把 `gameDirs` 升级为 `{ path, name }[]`（破坏性迁移，不推荐） |
| 上下移/拖拽排序 | `gameDirs[]` 顺序 | ⚠️ | 数组顺序即是顺序，但 UI 未提供排序；补 UI 即可，无需新字段 |
| 移出列表 / 删除目录 / 清空 | `gameDirs[]` | ⚠️ | 移出已有；「删除目录」与「清空」是危险操作，建议只做「移出列表 + 打开目录 + 资源管理器删除」，不在启动器内递归删除（与现有 `game-dir.tsx` 保守风格一致） |
| 添加已有 / 新建 .minecraft / 导入整合包 | `gameDirs[]` / 安装流程 | ⚠️ | 添加已有已有；新建 .minecraft 可加按钮；导入整合包依赖后续安装能力 |
| 无效目录/权限/下载中保护 | —（UI 校验） | 🟡 | 需要目录有效性探测时复用现有 `instance:locations`（含 `writable`/`instanceCount`） |

### 5.3 建议新增字段汇总（按优先级）

| 优先级 | 字段 | 类型 | 默认值 | 归属 section | 接线点 / 说明 |
|---|---|---|---|---|---|
| P0 | `java.initialMemGB` | `number` | `0` | `java` | 0=不设置；`launch-options.ts` 里 `minMemory = initialMemGB>0 ? initialMemGB*1024 : Math.min(2, memGB)*1024` |
| P0 | `java.lockMemory` | `boolean` | `false` | `java` | 为真时 `minMemory = maxMemory`；UI 上禁用初始内存滑块 |
| P0 | `java.preferredIpStack` | `'ipv4' \| 'default' \| 'ipv6'` | `'ipv4'`（对齐 PCL 推荐值；若想保守用 `'default'`） | `java` | 追加 `-Djava.net.preferIPv4Stack=true` / `preferIPv6Stack` |
| P0 | `advanced.afterLaunch` 扩展 | 枚举加 `'hide-exit' \| 'hide-reopen'` | 保持 `'close'` | `advanced` | `electron/handlers/launch.ts` 增加隐藏/退出分支 |
| P0 | `advanced.winMode` 扩展 | 枚举加 `'maximized' \| 'launcher'` | 保持 `'default'` | `advanced` | `launch-options.ts`：maximized 用 `resolution.maximized` 或启动后置最大化；launcher 读主窗口尺寸 |
| P1 | `java.useJavaExe` | `boolean` | `false` | `java` | 自动 Java 解析时替换 exe 名 |
| P1 | `advanced.preLaunchWait` | `boolean` | `true` | `advanced` | 需确认 @xmcl prependCommand 是否阻塞；不阻塞则暂不暴露 |
| P1 | `advanced.disableCrashAnalysis` | `boolean` | `false` | `advanced` | 崩溃自动弹页处判断 |
| P1 | `advanced.processPriority` | `'normal' \| 'above-normal' \| 'below-normal' \| 'high' \| 'realtime'` | `'normal'` | `advanced` | 需 Win32 能力；先落配置并标「实验性」 |
| P1 | `advanced.gpuPreference` | `boolean` | `true` | `advanced` | Windows 显卡首选项；谨慎实现 |
| P1 | `advanced.renderer` | `'default' \| 'llvmpipe' \| 'd3d12' \| 'vulkan'` | `'default'` | `advanced` | 实验性，需验证参数 |
| P1 | `game.dirAliases` | `Record<string,string>` | `{}` | `game` | 目录显示名；`game-dir.tsx` 显示时优先取别名 |
| P1 | `download.httpMode` | `'auto' \| 'http1.1' \| 'http2'` | `'auto'` | `download` | 下载器/`download-options.ts` 接线 |
| P2 | `java.disabledJavaPaths` | `string[]` | `[]` | `java` | 扫描结果置灰、自动匹配跳过 |
| P2 | `download.autoSelectVersion` | `boolean` | `true` | `download` | 下载表单默认选版本 |
| P2 | `download.fixAuthlib` | `boolean` | `true` | `download` | 依赖补齐阶段接线 |
| P2 | `download.notifyRelease` / `notifySnapshot` | `boolean` | `false` | `download` | 资讯/版本提示 |
| P3 | `download.filenameFormat` / `modNameStyle` / `quickDownloadBehavior` / `autoInstallDependencies` / `ignoreQuilt` / `readClipboard` | 见 §5.2 E | 对齐 PCL 默认 | `download` | 展示层规则，独立迭代 |
| P3 | `app.autoLanguage` | `boolean` | `true` | `app` | 语言自动切换 |
| 待定 | `account.msAuthFlow` | `'device-code' \| 'web'` | `'device-code'` | 新增 `account` section 或并入 `network` | 取决于账户模块设计 |

> 迁移提醒：`electron/config.ts:migrate()`（行 217-246）只做版本 1 迁移；新增字段靠 `mergeDeep(DEFAULTS, parsed)` 自动补默认值（行 291），**无需写迁移**，但在 `DEFAULTS`（行 198-215）与 `src/api/config.ts` / `configStore.ts` 两处都要加，否则渲染端读不到。

### 5.4 无法等价项及理由（先向用户说明，别做假设置）

| PCL 项 | 理由 | 建议处理 |
|---|---|---|
| 默认实例隔离（全局档位） | 架构不同：koring 用「实例自包含 / 共享资源目录」+ 实例级 `resourcePath` 决定路径，没有「按实例类型自动决定隔离」的全局策略 | 不做全局档位；在实例创建流程提供「隔离/共享」选择（已在实例页设置里可改） |
| 游戏窗口标题 / 自定义信息 | `@xmcl/core` 无改游戏窗口标题/内存字符串能力，PCL 是进程级注入/句柄操作 | 不做，或后续 native 插件 |
| 禁用 JLW / 禁用 LegacyFix / 禁用 LWJGL Unsafe Agent | 均为 PCL 自研组件，koring 启动链（@xmcl）没有对应物 | 不做；高级页只保留我们真实拥有的开关 |
| 单文件连接数 / 下载限速 | 下载库无此能力（AGENT-NOW-DO 已因「假设置」删除旧 `speedLimit`） | 不做 |
| 社区内容源（CurseForge 镜像策略） | 产品上只接 Modrinth | 不做 |

---

## 6. 建议的五页信息架构（「设置 → 游戏」）

> 当前 `src/pages/setting/index.tsx:buildMenuData` 的「游戏」组只有 4 项（游戏账户&档案 / Java虚拟机与内存 / 游戏目录 / 高级设置），**没有「游戏」首页**；需新增 `src/pages/setting/game/game.tsx` 并作为「游戏」组第 1 项（key 建议 `game`）。这样共 5 页，与任务目标一致。

### Page 1「游戏」— 启动行为（新增页）
定位：全局默认启动参数，对应 PCL「启动」页的前两张卡里**与版本无关**的部分（内存除外）。

| 顺序 | 分区/条目 | 控件 | 字段 | 备注 |
|---|---|---|---|---|
| 1 | 启动器行为（游戏启动后） | 下拉 | `advanced.afterLaunch`（扩展 5 态） | 对应 PCL 启动器可见性；含「立即关闭」警告 |
| 2 | 窗口大小 | 下拉 + 宽/高数字（仅自定义显示） | `advanced.winMode` + `customWidth` + `customHeight` | 对应 PCL 窗口大小；补 `maximized`/`launcher` |
| 3 | 快速进入服务器 | 服务器地址 + 端口 | `advanced.server.ip/port` | 从「高级设置」迁来更顺手（PCL 放在实例设置；全局放这里合理） |
| 4 | 进程优先级 | 下拉 5 档 | `advanced.processPriority`（新增） | 标注「实验性」 |
| 5 | IP 协议偏好 | 下拉 3 档 | `java.preferredIpStack`（新增） | PCL 放在启动选项；因为落点是 JVM 参数，UI 说明即可 |
| 6 | 游戏窗口标题 | 输入（占位/置灰） | ❌ | 文案说明「当前版本暂不支持，需游戏内设置」 |
| 7 | 左下角版本信息 | 输入（占位/置灰） | ❌ | 同上 |
| 8 | 默认实例隔离 | 说明卡 | ❌ | 说明我们的「共享资源目录」模型，并给「去实例设置」入口 |

### Page 2「游戏账户&档案」— 账户与启动档案（已有页，补 1 项）
| 顺序 | 内容 | 字段 | 备注 |
|---|---|---|---|
| 1 | 当前账号（微软/离线 + 状态） | 认证存储（`koring-auth.json`） | 现有 |
| 2 | 启动档案（用户名 / UUID / 认证方式 / 应用实例） | 现有 | 现有 |
| 3 | 登录方式（微软登录 / 离线） | 现有 | 现有 |
| 4 | 正版验证方式 | `account.msAuthFlow`（待定） | 对应 PCL `LoginMsAuthType`；产品未定时先用说明文案占位 |

### Page 3「Java虚拟机与内存」— Java + 内存 + JVM（已有页，补 4 项）
| 顺序 | 分区/条目 | 控件 | 字段 | 来源对照 |
|---|---|---|---|---|
| 1 | 自动选择 Java | 开关 | `java.autoJavaPath` | PCL 自动选择项 |
| 2 | 自动匹配预览（将使用 Java X · 路径 / 候选列表） | 只读卡 | `java:plan` | PCL 无（我们更好，保留） |
| 3 | 手动指定路径 + 校验状态 | 文件选择器 | `java.javaPath` | PCL Java 列表手动项 |
| 4 | 本机 Java 列表（启用/禁用、详情、打开目录） | 列表 | `java.disabledJavaPaths`（新增） | PCL Java 页列表 |
| 5 | 内存分配模式（自动/自定义） | 单选 | `java.memMode` | PCL 内存模式 |
| 6 | 最大内存（-Xmx） | 滑块 + 数值 | `java.memGB` | PCL 最大内存 |
| 7 | 初始内存（-Xms） | 滑块 + 数值（0=不设置） | `java.initialMemGB`（新增） | PCL 初始内存 |
| 8 | 锁定内存（-Xms=-Xmx） | 开关 | `java.lockMemory`（新增） | PCL 高级卡「锁定内存」 |
| 9 | 内存占用可视化条（总/可用/已分配 + 警告条） | 只读图形 | `system` 内存信息（新增 IPC 或已有） | PCL `PanRamDisplay` |
| 10 | 额外 JVM 参数 | 多行文本 | `java.jvmArgs` | PCL JVM 参数头部 |
| 11 | GC 算法 | 下拉 | `java.gc` | PCL 默认串内 G1GC 的等价物 |
| 12 | 使用 java.exe 而非 javaw.exe | 开关 | `java.useJavaExe`（新增） | PCL 高级卡同名项 |

> 顺序理由：先「用哪个 Java」再「给多少内存」再「额外参数/细节」，与 PCL 页签内注意力顺序一致（自动选择在列表顶、内存独立卡、JVM 参数在高级卡）。

### Page 4「游戏目录」— 多目录与资源根（已有页，补 2 项）
| 顺序 | 分区/条目 | 字段 | 来源对照 |
|---|---|---|---|
| 1 | 自动查找（扫描本机常见位置） | 现有扫描 | PCL 添加已有 |
| 2 | 当前游戏目录（路径 + 打开 + 切换） | `game.gameDir` | PCL 当前文件夹 |
| 3 | 共享资源目录（可选，清空=实例自包含） | `game.resourceDir` | PCL 无直接项（我们特有概念） |
| 4 | 已添加目录列表（显示名、路径、设为当前、重命名、上移/下移、移出、打开、刷新） | `game.gameDirs[]` + `game.dirAliases`（新增） | PCL 文件夹列表 + 右键菜单 |
| 5 | 新建 .minecraft / 导入整合包 | 已有/安装流程 | PCL 新建/导入 |
| 6 | 安全提示（下载/启动中禁止切换；删除目录不在启动器内做） | 文案 | PCL 下载中保护 |

### Page 5「高级设置」— 实验性/底层参数（已有页，补 4 项、移除 4 项）
| 顺序 | 分区/条目 | 控件 | 字段 | 说明 |
|---|---|---|---|---|
| 1 | 渲染器 | 下拉（含警告弹窗） | `advanced.renderer`（新增，实验性） | PCL 高级卡第 1 项 |
| 2 | 游戏参数尾部 | 输入 | `advanced.gameArgs` | PCL 游戏参数尾部 |
| 3 | 启动前执行命令 | 文件/输入 | `advanced.preLaunchCmd` | PCL 启动前命令 |
| 4 | 等待命令执行完成（条件显示） | 开关 | `advanced.preLaunchWait`（新增，待验证） | PCL 等待命令 |
| 5 | 要求使用高性能显卡 | 开关 | `advanced.gpuPreference`（新增） | PCL 高性能显卡 |
| 6 | 禁用自动崩溃分析 | 开关 | `advanced.disableCrashAnalysis`（新增） | PCL 同名项 |
| 7 | 调试模式 | 开关 | `advanced.debugMode` | 我们特有，保留（放在最上面或最后均可；建议最后） |
| 8 | 危险区：重置启动设置 | 危险按钮 | `config:reset`（分 section） | 对应 PCL 左栏「重置」 |
| — | ~~启动器行为 / 窗口大小 / 服务器~~ | — | — | 已迁至 Page 1「游戏」，避免两处重复 |
| — | ~~JVM 参数~~ | — | — | 已归 Page 3（PCL 也在 Java 相关语境） |

跨页原则：
- 一个字段只在一个页面出现（`advanced.afterLaunch`/`winMode`/`server` 迁到「游戏」页后，高级设置不再重复）。
- 「危险/实验性」项统一放「高级设置」，每个都带说明文案；PCL 的「首次修改警告」沿用（渲染器、立即关闭）。
- 全局与实例的关系：全局页只放默认值；实例页签覆盖同名字段，并显示「跟随全局」开关（对应 PCL `VersionArgumentTitleEmpty` / `VersionRamType=2` 等约定）。

---

## 7. 实施建议与风险

1. **先补齐三处类型一致性**（`src/api/config.ts` / `configStore.ts` 的 `UiConfig` 与 `GameConfig`），再动 UI，否则新字段在渲染端不可见（TS strict）。
2. **新增字段必须同时接线 `electron/core/launch-options.ts`**，否则就是「假设置」；P0 字段（-Xms、锁定内存、IP 栈）接线成本最低，建议第一批做。
3. **不要照搬 PCL 的 JVM 默认参数串**：我们已有 `java.gc` 独立下拉，`jvmArgs` 默认空更清晰；只在文案里提示「留空则仅使用 GC 选项」。
4. **不做无法等价的功能**（JLW、LegacyFix、窗口标题、下载限速等），避免用户勾了没效果；在文档/UI 里明确「不支持」。
5. **游戏管理页不要塞进「游戏目录」**：PCL 的 `PageSetupGameManage` 是下载/社区设置，我们的下载设置已独立在「网络 → 下载」页，**不要迁移**；「游戏目录」页只做目录管理。
6. **目录删除/清空**这类破坏性操作，PCL 做了两级确认；我们建议不提供启动器内递归删除，降低误删风险（与 `game-dir.tsx` 现状一致）。
7. 内存滑块用「刻度→GB」映射时，UI 展示值必须与写入 JVM 的值一致（同一函数），避免滑块 15 显示 3.0 GB 但实际传 15 GB 的错觉。

---

## 8. 来源索引

| 文件 | 用途 |
|---|---|
| `PCL-CE\Plain Craft Launcher 2\Pages\PageSetup\PageSetupLeft.xaml` / `.xaml.cs` | 设置左侧 4 分组、11 个子页、隐藏/重置/刷新逻辑 |
| `...\PageSetupLaunch.xaml` / `.xaml.cs` | 启动页 3 卡片全部控件、绑定、联动、内存公式、渲染器/可见性警告 |
| `...\PageSetupJava.xaml` / `.xaml.cs` | Java 页动态列表、自动选择、启用禁用、添加 |
| `...\PageSetupGameManage.xaml` / `.xaml.cs` | 下载/社区/无障碍 19 项（易被误认为游戏目录页） |
| `...\Pages\PageSelectLeft.xaml.cs` | 真正的游戏目录管理（列表/右键/拖拽/添加/删除/清空/切换/下载中保护） |
| `PCL.Core\App\Config.cs` | `LaunchConfigGroup` 全部键与默认值、`InstanceConfigGroup`、`Download/Tool` 默认值 |
| `PCL.Core\App\ConfigEnums.cs` | `GameWindowSizeMode` / `GameProcessPriority` / `LauncherVisibility` / `JvmPreferredIpStack` / `DownloadHttpMode` |
| `PCL.Core\App\Localization\Languages\zh-CN.xaml` | 各设置项文案含义（Setup.Launch.* 2790-2897、Select.Folder.* 2372-2431） |
| `koring-launcher\electron\config.ts` | `AppConfig` 主进程类型与 `DEFAULTS`、稀疏保存、迁移 |
| `koring-launcher\src\api\config.ts` / `src\stores\configStore.ts` | 渲染端类型与默认值（存在 §5.1 两处不一致） |
| `koring-launcher\electron\core\launch-options.ts` | 现有配置 → 启动参数接线（新增字段必须改这里） |
| `koring-launcher\src\pages\setting\{index,game\*}.tsx` | 现有五页 IA 与控件风格 |

> 本文档为只读分析产物，未修改 PCL-CE 任何文件，也未复制其代码/图标/文案原文。
