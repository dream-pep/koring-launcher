# PCL-CE 实例/版本页结构分析 → koring-launcher 实例页 UI + 交互规格

> 来源：只读分析 `D:\github-code-plan\PCL-CE`（PCL 社区版，C#/WPF + PCL.Core）。
> 本文件**只提炼结构、字段与交互流程**，不复制其代码、图标、文案；所有结论后标注来源文件与行号/方法名，便于复核。
> 行号以本文件撰写时的 PCL-CE 工作副本为准（文件路径前缀省略为 `PCL/…` = `Plain Craft Launcher 2/…`）。

---

## 0. 一句话结论

PCL 的「版本管理」不是单个页面，而是三层：**版本选择（副页面：左=游戏目录、右=按类型分组的版本卡片列表）→ 选中实例 → 实例详情（副页面：左=实例子导航、右=概览/设置/模组/存档/截图/资源包/导出/安装/服务器）**。
真正的「启用/禁用模组」是**文件级重命名**：禁用 = 文件名追加 `.disabled`（旧版本备份用 `.old`），**不是**单独的 disabled 目录，也不是配置项。
（`PCL/Modules/Minecraft/ModLocalComp.cs:43-45,390-433`、`PCL/Modules/Minecraft/ModJarInJarCache.cs:93-98`、`PCL/Pages/PageInstance/PageInstanceCompResource.xaml.cs:2053-2088`）

---

## 1. 页面骨架

### 1.1 PCL 的页面层级（关键发现，先纠正一个常见误读）

`PageInstanceLeft.xaml` **不是**版本列表，而是「实例详情页」的左侧子导航；版本列表在 `PageSelectLeft/PageSelectRight`。

| 层级 | 页面 | 构成 | 来源 |
| --- | --- | --- | --- |
| 主页面 | 启动/主页 `Launch` | 左（宽 300）= 登录卡 + 启动按钮 + 「选择实例」；右 = 动态卡片 + 社区提示 + 日志 | `PCL/Pages/PageLaunch/PageLaunchLeft.xaml:8-52`、`PageLaunchRight.xaml:5-22` |
| 副页面 | 版本选择 `InstanceSelect` | 左 = 游戏目录列表（宽 250–300）；右 = 搜索框 + 分组卡片列表 | `PCL/Pages/PageSelectLeft.xaml:13-17`、`PageSelectRight.xaml:8-19` |
| 副页面 | 实例设置 `InstanceSetup` | 左 = 实例子导航（`PageInstanceLeft`）；右 = 各子页 | `PCL/Pages/PageInstance/PageInstanceLeft.xaml`、`FormMain.xaml.cs:1360-1473` |

页面枚举（`PageType`）：`Launch=0, Download=1, Setup=2, Tools=3, InstanceSelect=5, TaskManager=6, InstanceSetup=7, CompDetail=8, HelpDetail=9, GameLog=10, VersionSaves=12`；子页枚举 `PageSubType`：`VersionOverall=0, VersionSetup=1, VersionExport=2, VersionWorld=3, VersionScreenshot=4, VersionMod=5, VersionModDisabled=6, VersionResourcePack=7, VersionShader=8, VersionSchematic=9, VersionInstall=10, VersionServer=11, VersionModJarInJar=12`，存档详情 `VersionSavesInfo=0, VersionSavesDatapack=1`。
（`PCL/FormMain.xaml.cs:1360-1416`、`:1421-1473`、`:1478` `PageNameGet`）

> koring 目前把「版本列表 + 实例详情」放在同一页（`src/pages/instance/index.tsx` 左 292px 列表 + `InstanceDetail.tsx` 右栏 tab）。**建议保留单页左右分栏**（桌面端 PCL 的三层是被窗口宽度逼出来的），但吸收 PCL 的分组/右键/子页信息架构，详见 §3/§10。

### 1.2 实例选择页（版本列表）

- 左栏（`MyPageLeft`）：`MyScrollViewer MaxWidth=300 MinWidth=250` 内 `StackPanel PanList`，**全部由代码构建**。
  - 分组标题「游戏文件夹」（`PageSelectLeft.xaml.cs:61-67`）。
  - 每个游戏目录一个 `MyListItem`（RadioBox 样式）：`Title=目录名`、`Info=目录路径`、`Height=40`、右侧一个齿轮图标按钮（点击 = 打开同一右键菜单）、支持拖拽排序。
  - 右键菜单（按目录类型区分，`PageSelectLeft.xaml.cs:74-156`）：
    - 原始目录：重命名 / 上移 / 下移 / 打开 / 刷新 / 删除（若为唯一目录且是启动器自带 `.minecraft`，文案变「清空」）。
    - 被重命名的原始目录：多一条「恢复名称」。
    - 自定义目录：多一条「从列表移除」。
    - 第一项隐藏「上移」、最后一项隐藏「下移」（`:159-166`）。
  - 底部「添加或导入」区（`:210-260`）：新建文件夹（仅当启动器目录下无 `.minecraft`）/ 添加已有文件夹 / 导入整合包。
- 右栏（`MyPageRight`）：顶部 `MySearchBox`（占位「搜索实例」）+ 滚动区 `StackPanel PanMain` + 三个浮层卡片：空态卡、搜索空态卡、加载卡。
  （`PageSelectRight.xaml:14-54`）

### 1.3 实例详情页（右栏 + 左侧子导航）

左侧子导航结构（`PageInstanceLeft.xaml:5-175`，每项 `Height=36`、`MinPaddingRight=35`、Unicode 图标用 lucide）：

```
分组「游戏」(TextBlock, 12px, opacity .6)
  概览     Tag=0  layout-dashboard
  版本设置 Tag=1  settings        [+ 行内按钮：初始化设置 rotate-ccw]
  安装/更新 Tag=10 wrench         [+ 行内按钮：刷新]
  导出     Tag=2  package         [+ 行内按钮：刷新]
分组「资源」(TextBlock TextResource)
  存档     Tag=3  globe           [+ 刷新]
  截图     Tag=4  image           [+ 刷新]
  模组     Tag=5  puzzle          [+ 刷新]
  （模组不可安装时替换为同位置的「不可安装 Mod」提示页 ItemModDisabled Tag=6）
  资源包   Tag=7  layers          [+ 刷新]
  光影     Tag=8  sparkles        [+ 刷新]
  投影     Tag=9  file-box        [+ 刷新]
  服务器   Tag=11 server          [+ 刷新]
```

- 显隐规则（`PageInstanceLeft.xaml.cs:26-97` `RefreshModDisabled`）：按用户偏好 `Config.Preference.Hide` 隐藏对应项；7 个资源项全隐藏时连分组标题一起隐藏；`McInstance.Modable` 决定显示「模组」还是「不可安装 Mod」入口；「安装/导出/存档/截图/资源包/光影/投影/服务器」各自可被隐藏。
- 子页切换：`PageGet(id)` 缓存页面实例，`PageChange(id)` 130ms 动画换页（`PageInstanceLeft.xaml.cs:201-342`）。
- 「版本设置」行内初始化按钮（`:170-183` `Reset`）：二次确认后调用 `PageInstanceSetup.Reset()`，即把该实例的所有独立设置恢复默认。

### 1.4 与 koring 现状的对应

| PCL | koring 现状 | 建议 |
| --- | --- | --- |
| 版本列表（`PageSelectRight` 分组卡片） | 单列列表（`src/pages/instance/index.tsx:309-386`），支持搜索/排序/收藏/分类筛选 | 增加分组视图或「分组标题」；列表项补加载器标签与健康状态（已有黄色圆点） |
| 实例详情（`PageInstanceLeft` + 各子页） | 右栏顶部信息 + 6 个 tab（`InstanceDetail.tsx:37-46,431-452`） | 保留 tab，但补齐 概览/设置/模组/存档/截图/资源包 的 PCL 字段与交互 |
| 左侧子导航 | 无 | 不建议照搬；tab 更适合桌面宽屏，且已有交互惯性 |

---

## 2. 版本列表（实例选择页右栏）

### 2.1 列表项字段

构建于 `PageSelectRight.xaml.cs:377-422` `McVersionListItem`：

| 字段 | 来源 | 说明 |
| --- | --- | --- |
| Title | `mcInstance.Name` | 实例目录名 |
| Info | `mcInstance.Desc`（自定义描述优先，未加载时为「尚未加载」） | `McInstance.Desc` 定义：`PCL/Modules/Minecraft/McInstance.cs:16` |
| Logo | 自定义 `PCL\Logo.png` 优先，否则默认方块图标；加载失败回退 RedstoneBlock | `:403-418` |
| Tags（一行小标签） | `VanillaName` + `Forge/NeoForge/Cleanroom/LabyMod/Quilt/Fabric` 版本 + `LiteLoader` + `OptiFine` 版本 | `:385-402`，只取首个加载器（`else if` 链） |
| 行高 | 42 | `:381` |
| 收藏态 | 行内按钮实心/空心爱心 | `:430-456` |
| 错误态 | `state == Error`：图标按钮变「打开文件夹」，右键也变打开文件夹 | `:469-498` |

koring 对应（`src/pages/instance/index.tsx:353-386`）：图标 36px、显示名（description||name）、收藏星标、`!healthy` 黄点、`runtime.minecraft · loaderLabels · 最近游玩`——**缺** vanilla/加载器 version 分段标签；建议补 `加载器 + 版本号`。

### 2.2 分组与排序

- 分组：`Dictionary<McInstanceCardType, List<McInstance>>`（`ModInstanceList.cs:45`），卡片类型：`Star=-1, Auto=0, Hidden=1, API=2, OriginalLike=3, Rubbish=4, Fool=5, Error=6`（`McInstanceCardType.cs:3-13`）。
- 分组算法（`ModInstanceList.cs:367-500` `InitMcInstanceListWithoutCache`）：
  1. 收藏的实例单独成「收藏」卡（Hidden 的除外）。
  2. 依次抽出 Error → Fool → API（Forge/NeoForge/LiteLoader/Fabric/LegacyFabric/Quilt/Cleanroom/LabyMod）。
  3. 老实例（Old）进「不常用」；最新快照进「常规」；其余快照进「不常用」。
  4. 每个大版本（`McInstanceInfo.Drop`）取最新的「原版」与「OptiFine」进「常规」，其余进「不常用」。
  5. 用户自定义分类（`displayType`）覆盖自动分类，但收藏卡永远优先（`:490-499`）。
  6. 「隐藏」卡只在「显示隐藏实例」模式下出现（`PageSelectRight.xaml.cs:144`）。
- 卡片顺序固定：`Star → API → OriginalLike → Rubbish → Fool → Error → Hidden`（`ModInstanceList.cs:516-527`）。
- 卡片内版本排序（`ModInstanceList.cs:529-580`）：
  1. 发布时间 `releaseTime` 新的在前（年份 >= 2000 时有效）；
  2. 加载器种类优先级：Fabric > Quilt > LegacyFabric > NeoForge > Forge > Cleanroom > LabyMod > OptiFine > LiteLoader；
  3. 组件版本号（ForgeLikeCode / OptiFineCode）大的在前；
  4. 名称 ordinal 倒序。
- 卡片标题带数量（收藏卡不带）：`{名称} ({n})`（`PageSelectRight.xaml.cs:258`）。
- 「不常用 / 错误 / 愚人节」卡片默认折叠，只有一张卡时强制展开（`:278-293`）。

### 2.3 行内按钮与右键

行内（鼠标悬停展开，`PageSelectRight.xaml.cs:424-499`）：
1. 收藏 / 取消收藏（heart / heart-filled）
2. 打开文件夹（folder-open）
3. 删除（trash-2）
4. 实例设置（settings，仅非 Error 实例）
5. 右键：非 Error = 直接进入实例设置；Error = 打开文件夹

koring 对应：目前列表项**无行内按钮**，操作都在右侧详情头部（启动/修复/体检/打开目录/收藏/删除）。建议至少补「右键菜单 = 打开目录 / 编辑描述 / 复制实例名 / 删除」；行内按钮可只保留「打开目录」。

### 2.4 搜索 / 排序 / 空态 / 加载失败

- 搜索防抖：普通输入 75ms，清空时 50ms；只有最后一次输入超过间隔才刷新（`PageSelectRight.xaml.cs:22-23,56-97`）。
- 命中范围：`Name` / `Desc` / `GetDefaultDescription()`（去逗号小写），大小写不敏感（`:146-153`）。
- 空态（`:295-363`）：
  - 完全没实例 → 大卡：标题 + 2px 分割线 + 说明 + 「下载游戏」按钮（`PageSelectRight.xaml:20-36`）；若「下载」功能被隐藏则不显示按钮。
  - 有实例但搜索无结果 → 搜索空态卡（标题 + 说明，区分「输入为空」与「无匹配」文案）。
  - 显示隐藏实例模式下无隐藏实例 → 专门的空态（隐藏标题/说明，无下载按钮）。
- 加载失败（`PageSelectRight.xaml:49-54`、`.cs:117-122`）：加载卡上的 `MyLoading` 可点击，`State==Failed` 时点击重新扫描。
- 无结果时隐藏搜索框（`hasVisibleFolders == false`），避免用户找不到入口。

### 2.5 删除确认（回收站 vs 永久）

`PageSelectRight.xaml.cs:529-616` `DeleteVersion`（与 `PageInstanceOverall.xaml.cs:736-812` `BtnManageDelete_Click` 保持同步，两处注释明确要求）：

- 按住 Shift = 永久删除（提示文案不同），否则进**回收站**（`FileSystem.DeleteDirectory(..., RecycleOption.SendToRecycleBin)`）。
- 隔离实例（`PathIndie != mcFolderSelected`）追加「会连同隔离目录一起删除」警告。
- 确认框：确认/取消（返回码 1/2）。
- 删除前清理 `options.txt` 的 ini 缓存与实例配置缓存；删除后局部移除或强制刷新；删的是当前选中实例时自动改选第一项。

koring 对应：`deleteInstance` + `useConfirmDialogStore`（带 5s 倒计时），文案「实例目录下所有文件都会被删除，且无法恢复」（`index.tsx:203-221`）——**没有回收站/Shift 永久删除**；建议至少文案诚实（当前是永久删除）。

---

## 3. 实例概览页

### 3.1 区块顺序

`PageInstanceOverall.xaml`（整页为滚动堆叠卡片）：

1. **预览卡**（无标题）：把版本列表项原样放进来，`IsHitTestVisible=false`（`:10-12`）。
2. **信息卡**「信息」：异步加载，先放 `MyLoading`（`:13-17`）。
3. **个性化卡**「个性化」：图标下拉、分类下拉、重命名/编辑描述/收藏三个按钮（`:18-87`）。
4. **快捷方式卡**「快捷方式」：实例文件夹 / 存档文件夹 / Mod 文件夹（`:88-104`）。
5. **管理卡**「管理」：导出启动脚本、测试游戏、补全文件、重置、删除（红色）、修补核心（`:105-129`）。

### 3.2 信息区字段（`PageInstanceOverall.xaml.cs:104-226` `GetInstanceInfo`）

每项 = 图标 + 标题 + 值，`WrapPanel` 排列：

| 行 | 条件 | 说明 |
| --- | --- | --- |
| 启动次数 | 恒有 | 0 = 「从未启动」（红石灯熄灭图标），>0 = 次数 |
| 整合包版本 | 有 `States.Instance.ModpackVersion` | 来自实例配置 |
| Minecraft | 恒有 | `Info.VanillaName` |
| Forge / NeoForge / Cleanroom / Fabric / Quilt / OptiFine / LiteLoader / Legacy Fabric / LabyMod | 对应 `HasXxx` | 值为版本号；LiteLoader 无版本号显示「已安装」 |

若实例来自整合包，会在信息区上方插入一张整合包项目卡（`:113-129,216-220`）。
启动次数与游玩时长来自持久化计数（`States.Instance.LaunchCount`）。

koring 对应：`InstanceDetail.tsx:456-510` 已有「文件完整性 + 启动版本/加载器/游戏目录/资源根/游玩时长/最近游玩/创建时间 + 4 个计数卡」；**缺**「启动次数」「启动器版本/整合包版本」「各加载器版本号细分」，可补。

### 3.3 个性化（`PageInstanceOverall.xaml.cs:228-501`）

- **图标**下拉：自动 / 自定义（选本地图片） / 12 种方块图标（圆石、命令方块、金块、草方块、土径、铁砧、红石块、红石灯亮/灭、鸡蛋、Fabric、Quilt、NeoForge、Cleanroom）。
  - 自定义：复制图片到 `<实例>/PCL/Logo.png`；选非自定义则删除该文件（`:426-479`）。
- **分类**下拉：自动 / 隐藏 / 可安装 Mod / 常规 / 不常用 / 愚人节（`:60-68`）。
  - 改为「隐藏」需二次确认（首次还弹「隐藏实例说明」），确认后写缓存失效标记并强制重扫（`:260-291`）。
- **重命名**（`:320-423`）：
  - 校验：`FolderNameValidator(versions 目录, ignoreCase=false)`，重名/非法字符拦截。
  - 仅大小写不同：先用 `_temp` 中转再改，避免 Windows 大小写重命名失败。
  - 连带重命名 `<旧名>-natives` 目录与 `<旧名>.jar`；替换 `PCL/Setup.ini` 内旧路径；更新根目录 `PCL.ini` 的 `Version`；重写实例 json 的 `id`（先读原始 json 防止 HMCL 项被合并）。
  - 失败提示统一「操作失败」并记日志。
- **描述**：输入框（可空，空 = 显示默认描述），保存后重载实例并刷新列表（`:295-317`）。
- **收藏**：切换收藏后强制重扫列表（收藏会影响分组卡片）（`:482-501`）。
- 任何显示类改动都写 `PCL.ini` 的 `InstanceCache=""` 使缓存失效并 `ForceRun` 重扫（`:245-247,465-469` 等）。

koring 对应：`updateInstance` patch 支持 description/category/favorite/vmOptions/mcOptions/server/内存/java/launchVersion（`src/api/instance.ts:123`）；**实例重命名（改目录名）目前没有**，建议新增 `instance:rename`（涉及 jar/natives/json/配置 key 迁移，可直接沿用 PCL 的顺序）。

### 3.4 快捷方式（`:505-533`）

- 实例文件夹：`<实例路径>`
- 存档文件夹：`PathIndie + saves\`（先 `CreateDirectory`）
- Mod 文件夹：`PathIndie + mods\`（先 `CreateDirectory`；实例不可装 Mod 时按钮隐藏，`:78`）

koring 对应：只有「打开目录」；可加「打开存档/模组目录」（`openPath`）。

### 3.5 管理操作（`:536-845`）

| 操作 | 行为要点 |
| --- | --- |
| 导出启动脚本 | 选保存路径 → 调启动管线 `SaveBatch=路径`（不真正启动游戏）；离线账号提示「脚本导出中」，其它账号提示含「账号信息会含在脚本里」的警告；启动任务进行中禁止导出 |
| 测试游戏 | 以 `IsTest=true` 启动，启动成功后回到主页（不写入正式启动统计） |
| 补全文件（修复） | 同名任务去重；「忽略文件检查」开关打开时直接提示；实际调用下载管线 `DlClientFix(instance, true, assets 索引=AlwaysDownload)`；成功/失败/取消分别提示（失败含错误详情） |
| 重置（重装） | 限制：版本 < 1.5.2 且 Forge、或 Quilt 不支持；二次确认；先把 `<实例>.json`/`.jar` 备份到 `<实例>/PCLInstallBackups/`，再走安装请求重建，成功后回主页 |
| 删除 | 同 §2.5：Shift 永久 / 否则回收站；隔离实例警告；删完强制刷新并返回上一页 |
| 修补核心 | 选一个 jar 追加进 `<实例>.jar`（`GameCore.AddToCore`），完成后关闭该实例的资源校验（`DisableAssetVerifyV2=true`） |

koring 对应：`repairInstance`、`diagnoseInstance`、`installInstance`（重装可复用）、`deleteInstance`、`openPath` 已有；**导出启动脚本 / 测试游戏 / 修补核心 / 备份** 需实现（可低优先级）。

---

## 4. 版本设置页（实例独立设置）

### 4.1 交互模型（重要差异）

- **没有保存按钮**：所有控件 `Tag` = 配置 key（如 `VersionArgumentTitle`、`VersionRamType/2`），改动即时写入该实例的配置命名空间（`PageInstanceSetup.xaml.cs:191-239` `SetByTag` → `ConfigService.TrySetValue(tag, value, PathInstance)`）。
- 页面每次进入都 `Reload()` 重读全部配置；1 秒定时器刷新内存条（`:70-91,93-163`）。
- 「重置」= 认证设置（未锁定登录方式时）+ 实例设置整体恢复默认（`:166-188`）。
- 底部「前往全局设置」入口（`PageInstanceSetup.xaml:421-424`、`.cs:242-245`）。
- 控件语义：`TextArgumentInfo` 有黑名单校验（禁止 `" “ ”`）；`TextServerAuthServer` 用 HTTP 地址校验（`PageInstanceSetup.xaml:73-82,260-303`）。

koring 现状：`SettingsTab` 采用「本地草稿 + 保存按钮」（`InstanceDetail.tsx:121-309`），且字段更少——**可以保留草稿+保存**（体验更好），但需补齐字段并对齐取值。

### 4.2 启动选项（`PageInstanceSetup.xaml:15-93`）

| 设置项 | 控件 | 取值/默认 | 含义 |
| --- | --- | --- | --- |
| 实例隔离 | Combo（启用/关闭） | 默认按全局方案自动推导 | 关闭 = 使用全局游戏根目录；开启 = 用实例目录作为游戏根（mods/saves 等都在实例内） |
| 窗口标题 | 可编辑下拉（带样例格式） | 空 = 跟随全局 | 传给 `-Dminecraft.launcher.title` 类参数；支持变量占位 |
| 使用默认标题 | CheckBox | 默认随全局 | 勾选后不再套用自定义标题 |
| 自定义信息 | TextBox（黑名单引号） | 空 = 跟随全局 | 用于实例列表/启动参数的附加描述 |
| Java | ComboBox | 默认「自动选择」 | 可指定某个已扫描的 Java 路径 |

- 实例隔离的默认值推导逻辑（`PCL/Modules/Minecraft/McInstance.cs:65-115` `PathIndie`）：
  1. 旧版独立设置（`IndieV1`）已决定过 → 迁移沿用；
  2. 实例目录下已有 `mods` 文件或 `saves` 存档 → 自动开启；
  3. 否则按全局 `IndieSolutionV2`：`0` 关闭 / `1` 仅可装 Mod 的实例 / `2` 仅非正式版 / `3` 非正式版或可装 Mod / 其它 = 全部隔离。
- 结论：**「Modable」= 有 Fabric/LegacyFabric/Quilt/Forge/LiteLoader/NeoForge/Cleanroom 或用户强制分类为「可安装 Mod」**（`McInstance.cs:130-142`）。

### 4.3 内存（`PageInstanceSetup.xaml:94-216`）

- 三选一 Radio：
  - **跟随全局**（默认，`RadioRamType2`）
  - **自动**（`RadioRamType0`）：按物理内存比例自动分配
  - **自定义**（`RadioRamType1`）：启用两个滑块
- 自定义滑块：最大内存 `SliderRamCustom`（`MaxValue=49`、初始 `Value=13`，单位 GiB，步进 0.1）；初始内存 `SliderRamInitialCustom`（`MaxValue=49`、默认 `0`）。
  - 实际上限会按「物理内存 - 已用」动态刷新，49 只是控件上限。
  - **全局「锁定内存」开启时**：初始内存与最大内存强制相等，初始内存滑块禁用（`PageInstanceSetup.xaml.cs:248-255` `RamType`）。
- 内存可视化条：已用（渐变）/ 游戏分配（半透明）/ 空余，底部显示 `已用 / 总` 与 `游戏分配` 两个 GiB 数字（`PageInstanceSetup.xaml:175-214`）。
- 警告：32 位 Java 用黄色提示；分配过多（超过物理内存阈值）显示「分配过大」提示（`:96-100`）。

koring 对应：`config.minMemory` / `maxMemory`（GB 整数，默认 1/4），`SettingsTab` 用 number input；**缺**「跟随全局/自动/自定义」三态与内存条可视化，建议补一个 `memoryMode: 'global'|'auto'|'custom'` 字段。

### 4.4 服务器（`PageInstanceSetup.xaml:217-315`）

| 设置项 | 控件 | 取值/默认 |
| --- | --- | --- |
| 登录方式限制 | Combo 4 项 | 不限制（默认）/ 仅正版（Microsoft）/ 仅第三方验证 / 正版或第三方 |
| 认证服务器 | TextBox（HTTP 校验） | 空 = 跟随全局；选了「仅第三方/正版或第三方」时显示 |
| 注册地址 | TextBox（可空） | 同上组合显隐 |
| 显示名称 | TextBox | 认证服务器显示名 |
| 自动进入服务器 | TextBox（黑名单 `http://` `https://` 与引号） | 空 = 不自动进入；格式 `host` 或 `host:port` |
| 使用 LittleSkin | 按钮 | 一键填入 LittleSkin 认证地址 |
| 锁定登录方式 | 按钮（默认禁用） | 锁定后不允许在启动页切换账号 |
| 新建档案 | 按钮 | 为该第三方认证服务器新建设置文件 |

警告提示：登录方式限制与当前账号不匹配时的黄色提示；HTTPS 服务器证书安全性提示；HTTP 明文提示（`:219-227`）。

koring 对应：`config.server {host, port?, name?}` 只有自动进服；**登录方式/认证服务器/注册地址** 需实现（依赖 @xmcl 认证能力，可先做字段与校验）。

### 4.5 高级（`PageInstanceSetup.xaml:316-420`，默认折叠）

| 设置项 | 控件 | 取值/默认 | 说明 |
| --- | --- | --- | --- |
| 渲染器 | Combo | 跟随全局（默认）/ 游戏默认 / 软件渲染 / DirectX12 / Vulkan | 实际写入启动参数的 renderer 选择 |
| JVM 参数（头部） | 多行 TextBox | 空 = 跟随全局；`MaxLength=4000` | 追加在自动生成的 JVM 参数前 |
| 游戏参数（尾部） | TextBox | 空 = 跟随全局 | 追加在游戏参数尾部 |
| 类路径头 | TextBox | 空 = 跟随全局 | 覆盖/前置 classpath |
| 启动前命令 | TextBox | 空 = 无 | 启动游戏前执行的 shell 命令 |
| 等待命令执行完成 | CheckBox | 默认关（且仅在命令非空时显示） | 勾选则阻塞等待命令结束 |
| 忽略 Java 兼容性检查 | CheckBox | 默认关 | 跳过 Java 版本范围校验 |
| 关闭文件校验 | CheckBox | 默认关 | 启动/修复时不做资源文件完整性校验 |
| 使用全局代理 | CheckBox | 默认关 | 该实例下载走全局代理设置 |
| 关闭 JLW | CheckBox | 默认关；ARM64 系统强制勾选并禁用 | 关闭 Java 的 Jailbreak/窗口特性（具体含义见 PCL 文案） |
| 关闭 LF | CheckBox | 默认关 | 关闭 LWJGL 的某些兼容行为 |
| 使用调试 Log4j2 配置 | CheckBox | 默认关 | 输出更详细日志 |
| 关闭 LWJGL Unsafe Agent | CheckBox | 默认关 | 规避新版 LWJGL 的 Unsafe agent 兼容问题 |

koring 对应：`vmOptions` / `mcOptions` 已有；**渲染器、启动前命令、忽略 Java 检查、关闭文件校验、代理**等需实现（大部分可直接映射到启动参数/`launch-options.ts`）。

### 4.6 默认值速查

| 项 | 默认 |
| --- | --- |
| 登录方式限制 | 不限制 |
| 内存方案 | 跟随全局 |
| 自定义最大/初始内存 | 13 GiB / 0 GiB（控件初始值，上限 49） |
| 渲染器 | 跟随全局 |
| 实例隔离 | 自动推导（见 §4.2） |
| 其余 CheckBox | 全部关闭 |
| 认证服务器/注册地址/显示名/自动进服 | 空 |

---

## 5. 模组子页（模组 / 资源包 / 光影 / 投影共用一套页面）

> 同类页面：`PageInstanceCompResource` 通过构造参数 `ModComp.CompType` 复用（`PageInstanceCompResource.xaml.cs:102`），模组额外有「Jar-in-Jar」「检查冲突」「更新」等能力。

### 5.1 页面骨架（`PageInstanceCompResource.xaml`）

```
搜索框 MySearchBox（占位「搜索已安装的资源」）
管理卡 PanManage（按钮换行自适应）：
  返回上级（子文件夹内才显示） | 打开文件夹(高亮) | 从文件安装 | 下载新资源 |
  全选 | 导出信息 | Jar-in-Jar（仅模组） | 检查冲突（仅模组，默认隐藏）
列表卡 PanListBack：
  左：筛选 Radio 组（全部 / 已启用 / 已禁用 / 可更新 / 错误 / 重复，带数量）
  右：排序按钮 BtnSort（arrow-up-down，点击弹出菜单）
  StackPanel PanList（行项目，44px/项）
空态卡 PanEmpty（标题 + 分割线 + 说明 + 4 按钮：返回上级/从文件安装(高亮)/下载新/打开文件夹）
特殊空态 PanSchematicEmpty（投影页缺投影模组：下载模组 / 选择实例）
加载卡 PanLoad（MyLoading）
底部多选条 CardSelect（默认隐藏，出现时上浮动画）：
  已选 n 个 | 更新 | 启用 | 禁用 | 收藏 | 分享 | 删除 | 取消
```

来源：`PageInstanceCompResource.xaml:12-60`（管理/筛选/排序/列表）、`:63-101`（空态）、`:102-106`（加载）、`:107-137`（多选条）。

- 多选区展开时列表底部留白 95px，否则 15px（`PageInstanceCompResource.xaml.cs:868`）。
- 投影/原理图页隐藏多选条里的「更新 / 收藏 / 分享」（`:846-862`）。
- 筛选按钮**按需显示**：数量为 0 且未被选中时隐藏（如「可更新」只在有更新时出现），并实时更新计数文案（`:773-800`）。

### 5.2 列表项字段（`MyLocalModItem`）

`PCL/Pages/PageInstance/MyLocalModItem.xaml:1-113` + `.xaml.cs:46-197`，行高 44，列宽 `6|34|7|Auto|1*|4`：

| 元素 | 内容 |
| --- | --- |
| 图标 | 34×34 圆角 6；来源 jar 内 logo / 资源站图标；无图标用 `Icons/NoIcon.png` |
| 标题 | 按配置「名称方案」二选一：文件名 或 译名；禁用项显示去掉 `.disabled`/`.old` 后的文件名 |
| 副标题 | 译名 + 版本号（`名称 | 版本`），灰 12px |
| 状态角标 | 非启用状态时右下角叠 20×20 状态图标（`Icons/{Fine|Disabled|Unavailable}.png`） |
| 更新按钮 | 有更新时显示 `lucide/upload`，tooltip = 「当前版本→新版本」+ 发布时间差 |
| 标签 | 资源站 tags（项目标签，非筛选） |
| 详情行 | 文件名/描述（`描述: ...`），12px 灰；未解析到信息时显示「信息不可用」 |
| 行内按钮 | 打开文件位置 / 详情 / 启用-禁用切换（circle-check / circle-minus）/ 删除 |

koring 对应（`ModsTab.tsx:34-89`）：已有复选框、图标（iconDataUrl）、displayName、version、加载器徽标、文件名、大小、Switch、删除；**缺**「更新按钮」「标签」「状态角标」「详情/打开文件位置」「描述」。

### 5.3 启用/禁用：文件级语义（重点，已确认）

结论：**禁用 = 文件名追加 `.disabled` 后缀；启用 = 去掉 `.disabled`。** 历史版本的禁用文件还可能是 `.old`（旧版本备份），两种情况都视为「已禁用」。

源码依据（足够支撑实现）：

1. `PCL/Modules/Minecraft/ModLocalComp.cs:43-45`（扫描时接受的后缀）：
   ```
   path.EndsWithF(".jar.disabled") || path.EndsWithF(".zip.disabled", true) ||
   path.EndsWithF(".litemod.disabled", true) || path.EndsWithF(".jar.old", true) ||
   path.EndsWithF(".zip.old", true) || path.EndsWithF(".litemod.old", true)
   ```
2. 同一文件 `:390` `RawPath`（注释「去除最后的 .disabled 和 .old」）、`:410` `RawFileName => FileName.Replace(".disabled","").Replace(".old","")`。
3. `:415-426` 状态判定：
   ```
   if (!IsFileAvailable) return LocalFileStatus.Unavailable;
   if (path.EndsWithF(".disabled", true) || path.EndsWithF(".old", true)) return LocalFileStatus.Disabled;
   return LocalFileStatus.Fine;
   ```
   `enum LocalFileStatus { Fine=0, Disabled=1, Unavailable=2 }`（`:428-433`）。
4. `PCL/Modules/Minecraft/ModJarInJarCache.cs:93-98` 注释直接写明：「**启/禁用是纯改名、mtime 不变；剥 .disabled 后复用同键**」。
5. 启停实现 `PageInstanceCompResource.xaml.cs:2023-2160` `EDModsCore`：
   ```
   禁用：newPath = modEntity.path + (File.Exists(path + ".old") ? ".old" : ".disabled");
   启用：newPath = modEntity.RawPath;              // 去掉 .disabled/.old
   FileSystem.Rename(modEntity.path, newPath);
   ```
   - 冲突处理（`:2063-2088`）：若目标名已存在且源文件也存在 → 比较两者 MD5，不同则弹「文件冲突」错误并跳过；相同则视为已切换。
   - 未找到文件 → 记日志并整表重载（`:2090-2099`）。
   - 改名成功后复用已解析元数据（`CopyLoadedStateFrom`），不重新解压 jar（`:2108-2110`）。
6. 数据包同样机制（`PCL/Pages/PageInstance/PageInstanceSaves/PageInstanceSavesDatapack.xaml.cs:1072-1086` 注释「启用/禁用数据包（通过重命名文件夹为 .disabled）」）。
7. 资源包/光影也走同一套（同页面 `EDModsCore`，`PageInstanceCompResource.xaml.cs` 通用于 `CompType.ResourcePack/Shader`）。

实现约束（写后端/前端时务必注意）：
- 禁用**不是隐藏**：文件仍在列表里，用「已禁用」筛选/分组可见；PCL 用状态角标 + 灰色文字区分。
- `.old` 与 `.disabled` 同时存在时，禁用优先写 `.old`（防止覆盖已有备份）。
- 删除时要把「原名 + `.disabled`/`.old` 变体」一起删（`DeleteModsCore` `:2389-2401`）。
- 启用同名冲突：不能盲目覆盖，必须先比对 MD5（或提示用户）。
- 我们的后端 `electron/core/instance-mods.ts`（他人已实现）返回 `LocalModInfo.fileName`（磁盘真实名，含后缀）与 `enabled`，`setInstanceModsEnabled(instancePath, fileNames, enabled)` 即按此语义实现——**前端必须传磁盘真实文件名**，不要传去掉后缀的名字。

### 5.4 批量操作

- 选中：每行复选框；点击行（非文件夹）切换选中；文件夹项单击=选中、**双击（≤300ms）= 进入文件夹**（`PageInstanceCompResource.xaml.cs:618-646`、`:369-417` 文件夹导航）。
- 底栏按钮（`PageInstanceCompResource.xaml.cs:1905-2532`）：
  - 启用 / 禁用：对选中项批量重命名（`.disabled`）。
  - 删除：确认后批量删除（Shift = 永久删除，否则回收站；`:1930-1955`、`:2382-2507`）。
  - 更新：仅对 `CanUpdate` 的选中项执行（`:2163-2171`）。
  - 收藏 / 分享：需要项目信息已联网解析（`Comp != null` 且 `Id` 非空），否则禁用按钮。
  - 取消选择：清空选中（同时带收起动画）。
- 按钮可用性按选中项状态实时计算：有启用项才能「禁用」，有禁用项才能「启用」，有可更新项才能「更新」（`:812-863`）。
- 删除确认文案：单文件/多文件、永久/回收站四种组合分别提示（`:2472-2489`）。

koring 现状（`ModsTab.tsx:216-232`）：已有选中条「启用/禁用/删除」，但**没有**「全选」「更新」「收藏/分享」「取消选择」；可补「全选 / 反选 / 取消」。

### 5.5 筛选（`PageInstanceCompResource.xaml.cs:1606-1654`）

| 筛选项 | 判定 |
| --- | --- |
| 全部 | 恒真 |
| 已启用 | `State == Fine` |
| 已禁用 | `State == Disabled` |
| 可更新 | `CanUpdate`（需联网比对，未解析则为 false） |
| 错误 | `State == Unavailable`（文件损坏/被占用/格式不识别） |
| 重复 | 同一资源站项目 ID 出现 >1 次 |

数量算法：遍历当前数据源（搜索时为搜索结果）统计（`:754-800`）。「全部」文案在搜索中会变成「搜索结果(n)」。

koring：没有筛选（只有搜索 + 启用/禁用两段）。建议补「全部/已启用/已禁用/错误」四段（更新、重复可二期）。

### 5.6 排序（`:1657-1898`）

- 方法：`FileName`（文件名）/ `CompName`（资源名称，默认）/ `TagNums`（标签数量）/ `CreateTime`（添加时间）/ `ModFileSize`（文件大小）。
- 规则：**文件夹始终置顶**；其余按所选键排序（时间/大小大的在前；标签多的在前）；无效项保持原相对顺序并排最后（`:1730-1767`）。
- UI：排序按钮文字 = 「排序：{名称}」，点击弹菜单选择（`:1661-1726`）。

koring：**无排序**（列表按 IPC 返回顺序）。建议补「文件名/大小/修改时间」三档 + 文件夹置顶。

### 5.7 搜索（`:3033-3102`）

- 防抖 350ms，带 `CancellationToken` 取消上一次（`:3039-3071`）。
- 模糊匹配权重（`ModBase.Search`，阈值 0.35、最大深度 `MaxLocalSearchDepth`）：
  - `Name` / `FileName` 权重 1.0
  - 版本号 0.2
  - 描述 0.4
  - 项目原始名 / 译名 1.0
  - 项目描述 0.4
  - 标签拼接 0.2
- 搜索只影响显示，不影响选中集合（无命中的选中项会被清理，`:738-739`）。

koring：搜索仅匹配 displayName/fileName/version（`ModsTab.tsx:122-131`），可接受；建议补 description 与标签。

### 5.8 更新提示

- 单个：行内 `BtnUpdate`（有更新才显示），tooltip 含「当前→最新」版本对比与发布时间差（`MyLocalModItem.xaml.cs:17-60`）。
- 批量：底栏「更新」只处理选中且可更新项；更新过程会写入 `.old` 备份（`PageInstanceCompResource.xaml.cs:2023-2056`、`:2178` `UpdateResource`）。
- 无更新时筛选「可更新」按钮不显示。

koring：**模组更新能力未实现**（`@xmcl/modrinth` 已有 `searchMods/getModVersions/installMod`）。建议二期：按 jar 内 modid+version 匹配 Modrinth 工程，再展示更新按钮。

### 5.9 依赖 / 冲突提示（Jar-in-Jar）

- 内置（jar-in-jar）依赖解析：禁用/删除某个 mod 前，先找出「依赖它的内嵌 mod」（`_JijFindAffected`，`PageInstanceCompResource.xaml.cs:1996-2003`）。
- 若有受影响项 → 弹单选对话框（`_AskJijCascade` `:2006-2021`）：
  - 仅此项
  - 连带禁用（删除时多一个「连带删除」）
  - 取消
- 内嵌解析尚未完成时，先弹「解析未完成，继续将先同步补齐列表」确认（`_ConfirmCascadeReady` `:1958-1994`）。
- 「检查冲突」按钮：仅模组页显示（默认隐藏），用于已安装模组间冲突检查（`:31-34`、`BtnManageCheck`）。

koring：无。建议二期做「缺失前置/重复 modid」轻量检测（读 jar 元数据即可），无需完整 JIJ。

### 5.10 空态 / 加载 / 错误

- 空：`PanEmpty` 大卡（模组页文案「还没有安装模组」+ 4 个按钮）；搜索无结果时用行内提示「没有匹配的模组」，不显示空卡（`PageInstanceCompResource.xaml.cs` 搜索态 + `ModsTab.tsx:248-253,304-306` 参考）。
- 加载：`PanLoad` 居中加载卡；列表在加载完成后一次性构建（PCL 无逐项骨架屏）。
- 错误：`MyLoading` 支持失败态 + 点击重试（`Load_Click` `:335-339`）；操作失败 toast/hint（`HintService.Hint(..., HintType.Error)`）。
- 子文件夹导航时显示「返回上级」按钮，且列表内文件夹项置顶（`:803-806`、`:702-707`）。

koring：`ModsTab` 已有 loading/error/empty 三态与重试；**缺**文件夹项与「返回上级」（PCL mods 目录可含子目录，我们的后端目前只扫顶层文件，建议先不做）。

### 5.11 资源包 / 光影复用

同一页面按 `CompType` 切换：
- 资源包：`resourcepacks/`（.zip/.jar），图标按钮与筛选/排序/启停同模组；**无**更新/JarInJar/冲突检查。
- 光影：`shaderpacks/`（.zip），同上。
- 投影：`schematics/`（无对应模组时显示专门空态并引导下载投影模组）。
- 关键：资源包/光影的启停**同样用 `.disabled` 后缀**（同 `EDModsCore` 路径）。

koring：`ResourcePacksTab.tsx` 已有只读列表（`listInstanceResourcePacks` 返回 `enabled`）；后端（他人实现）目前只读——若要启停，需要后端补 `setInstanceResourcePackEnabled`（同 `.disabled` 语义），前端加开关。

---

## 6. 存档子页

### 6.1 列表（`PageInstanceSaves.xaml` + `.xaml.cs`）

- 布局：搜索框 → 「快捷操作」卡（打开文件夹(高亮) / 下载新存档 / 粘贴文件）→ 「存档列表」卡（右上排序按钮 + `StackPanel PanList`）→ 空态卡 `PanNoWorld`（标题/分割线/说明/三个按钮）。
- 列表项（`PageInstanceSaves.xaml.cs:203-307`）：`MyListItem`，`Logo=存档 icon.png`，`Title=存档文件夹名`，`Info=「创建时间 · 最后修改时间」`。
  - 注意：**PCL 列表不解析 `level.dat` 的存档名**，直接用目录名；`level.dat` 解析只在「存档详情」页做。
  - 点击行 → 进入存档详情页；行内按钮：打开 / 删除 / 复制 / 详情 /（支持时）快捷游玩。
- 排序：`文件名`（默认）/ `创建时间` / `修改时间`，菜单选择（`:445-502`）。
- 搜索：100ms 防抖，仅匹配目录名，模糊匹配（`ModBase.Search` 阈值 0.35）（`:504-544`）。
- 自动刷新：`FileSystemWatcher` 监听 `saves/` 目录创建/删除/重命名，100ms 防抖后重载列表（`:89-134`）。
- 删除：直接进回收站（`RecycleOption.SendToRecycleBin`），删除期间行禁用并显示「删除中」；成功后移除行（`:225-248`）。
- 复制：把存档目录路径写入剪贴板文件列表（`Clipboard.SetFileDropList`）+ 提示「粘贴前请关闭游戏」类警告（`:249-277`）。
- 粘贴：读取剪贴板文件列表，逐个复制目录进 `saves/`；重名提示「已存在同名存档」；源不是目录则提示（`:389-435`）。
- 快捷游玩：仅当实例启动参数包含 `--quickPlaySingleplayer` 时显示按钮（`:286-305,323-338`），点击以 `WorldName=存档目录名` 启动游戏。
- 下载新存档：跳到下载页的「存档」频道，并把当前实例作为筛选器（`:437-441`）。

### 6.2 缩略图来源与尺寸

- 来源：`<存档目录>/icon.png`；存在时复制到 `<实例>/PCL/ImgCache/<md5>.png` 再给 UI，避免占用原文件；不存在则用 `Icons/NoIcon.png`（`PageInstanceSaves.xaml.cs:189-201`）。
- PCL 侧未做像素级 downscale（是 WPF Image 控件按显示尺寸缩放）；**我们后端已按 96px 生成 dataURL**（`src/api/instance-assets.ts:24-25`），够用。

### 6.3 存档详情页 + 数据包子页

`PageInstanceSavesInfo.xaml/.cs`（进入方式：列表行点击/详情按钮）：

- 左侧子导航（`PageInstanceSaves\PageInstanceSavesLeft.xaml:9-30`）：存档详情（info）/ 数据包（file-archive，带刷新）/ 快捷操作-打开文件夹。
- 详情字段（`PageInstanceSavesInfo.xaml.cs:37-113`，`PCL.Core.Minecraft.Saves.SaveManager.LoadSaveAsync`）：
  - 版本 `VersionName (VersionId)`；若无 VersionName 则按字段推断并给黄色提示（1.9 / 1.8 / 1.3 三档）
  - 存档名 `LevelName`
  - 种子（可点击复制 + 跳 Chunkbase 地图链接，`OpenChunkbase` `:317-355`）
  - 最后游玩时间
  - 出生点 `X / Y / Z`
  - 游戏模式（生存/创造/冒险/旁观/极限）
  - 游玩时长（天/时/分/秒格式）
- 可改写设置（写回 `level.dat`，有写锁防并发）：
  - 允许作弊：不允许 / 允许（`:115-161`）
  - 难度：和平/简单/普通/困难 + 「锁定难度」复选框（极限模式隐藏锁定项）（`:163-228`）
- 数据包页：启用/禁用 = 目录名追加 `.disabled`（`PageInstanceSavesDatapack.xaml.cs:1072-1086`）。

koring 现状：`SavesTab.tsx`（7KB）已有列表/删除/备份；后端 `listInstanceSaves` 已解析 `LevelName`（比 PCL 列表更优），并有 `backupInstanceSaves`。**缺**：详情页（level.dat 全字段）、可改写难度/作弊、快捷游玩、粘贴导入、文件监听自动刷新。

### 6.4 建议的存档列表字段（结合 PCL + 我们已经有的后端）

| 字段 | 来源 |
| --- | --- |
| 缩略图 | `icon.png` → 96px dataURL |
| 显示名 | `levelName`（解析失败回退 `dirName`）——PCL 只用目录名，我们可做得更好 |
| 最后修改 | `lastModified` |
| 大小 | `sizeBytes` |
| 状态 | `hasLevelDat == false` → 标「可能损坏」 |
| 操作 | 打开目录 / 备份 / 删除 / 详情 |

---

## 7. 截图子页

### 7.1 列表 / 缩略图 / 懒加载（`PageInstanceScreenshot.xaml.cs`）

- 目录：`PathIndie + screenshots\`（不存在则创建）。
- 扫描：顶层文件，扩展名 `*.png *.jpg *.jpeg *.bmp *.webp *.tiff`，按创建时间**倒序**（`:92-113`）。
- 过滤：跳过隐藏文件、0 字节文件、处理期间消失的文件（`:149-152`）。
- 布局：`WrapPanel` 网格卡片；卡片 = 缩略图（固定高 120，`Stretch=Uniform`）+ 下方按钮行（打开 / 删除 / 复制）。
- **缩略图解码尺寸**：WPF `BitmapImage.DecodePixelWidth=400, DecodePixelHeight=200`（`:168-184`）——即按缩略显示尺寸解码，避免整张 4K 图进内存。我们后端用 320px 宽 dataURL，思路一致。
- **懒加载**：首屏 20 张，滚动到底部再追加 20 张（`:112,123-254`）；每次追加带 200ms 淡入。
- 空态：`PanNoPic` 大卡（标题/线/说明/「打开文件夹」）；正常态顶部有「快捷操作-打开文件夹」卡。
- tooltip 显示相对路径（适配高清截图模组的子目录，`:157`）。

### 7.2 操作（`:280-339`）

| 操作 | 行为 |
| --- | --- |
| 打开 | 系统默认程序打开图片（`Basics.OpenPath`） |
| 删除 | 进回收站；移除卡片并刷新空态 |
| 复制 | 复制图片到剪贴板（重试 5 次，失败提示） |
| 打开文件夹 | 打开 `screenshots/` |

koring 现状：`ScreenshotsTab.tsx` 已有列表 + 缩略图（320px）+ 删除；**缺**打开原图/复制到剪贴板/懒加载（数据量大时应补）。

---

## 8. 「流程顺手」的关键交互

### 8.1 新建 / 安装引导（PCL = 单页清单，不是逐步向导）

`PCL/Pages/PageInstance/PageInstanceInstall.xaml` + `.xaml.cs`：

- 结构（`:24-39,40-45,46-395`）：
  - 顶部一组黄色/红色警告 Hint（旧版 OptiFabric / 旧版 Fabric API / 需要 Fabric API / OptiFabric 与 OptiFine 关系 / 建议装 OptiFine）。
  - 一个「已选摘要」卡（`:40-45`，图标 + 文本 + 修改笔图标）。
  - **Minecraft 版本卡**（必选，`CardMinecraft`）。
  - **加载器卡片组**（每张卡 `IsSwapped=True, CanSwap=True`：折叠时只显示一行摘要 + 清除按钮；展开后是版本列表）：Forge / Cleanroom / NeoForge / Fabric / Legacy Fabric / OptiFine / OptiFabric / LiteLoader（+ 相应 API 卡）。卡片摘要行：图标 + 版本文本；清除按钮（×）把该加载器置空。
  - 底部固定「开始安装 / 修改」按钮（`:398-403`）。
  - 安装中视图 `PanMinecraft`（默认折叠）：进度 + 日志（由 `EnterSelectPage/ExitSelectPage` 切换，`:215-357`）。
  - 加载卡 `PanLoad`：每个卡片有独立 `MyLoading`（获取版本列表），失败时显示错误文案（`GetLoaderError` `:182-207`：Loading/NoVersion/GetFailed/UnknownUnloaded）。
- 提交流程（`:99-178` `BtnSelectStart_Click`）：
  1. 功能开关 `minecraft-loader-install` 检查。
  2. Quilt 实例直接拒绝（「Quilt 不支持通过此管线重装/修改」）。
  3. 若已选加载器且全局隔离方案是「关闭/仅非正式版」→ 弹「版本隔离」警告，用户可取消。
  4. 重置动作时二次确认。
  5. 删除 LabyMod 隔离目录残留 `labymod-neo`；备份 `<实例>.json` / `<实例>.jar` 到 `PCLInstallBackups/`。
  6. 未变更的独立 API（Fabric API 等）不重复安装。
  7. 构造 `McInstallRequest` 提交下载/安装管线 → 成功回主页；失败保持页面。
- 安装完成后：PCL 会刷新实例列表并自动选中新实例（`PageInstanceLeft` 选择逻辑见 `PageSelectRight` 刷新）。

koring 现状：`CreateDialog.tsx`（21KB）+ `store/InstallDialog.tsx` 已是分步/表单引导，**不需要照搬 PCL 单页清单**；建议吸收：
- 加载器选择后的「摘要 + 清除」交互；
- 安装前「实例隔离」提醒；
- 失败卡片就地显示错误 + 重试，而不是全局 toast 一闪而过。

### 8.2 启动前检查与提示

PCL 启动页按钮状态机（`PCL/Pages/PageLaunch/PageLaunchLeft.xaml.cs`）：
- 加载中：按钮文案「加载中…」，版本名「加载中…」（`:291-293`）。
- 实例没问题：「启动游戏」+ 版本名（`:302-304`）。
- 没有实例：「下载游戏」+「实例不存在」（`:313-315`）。
- 实例正在安装/更新：禁止启动，提示「实例正在安装，无法启动」（`:237`）；同理禁止打开实例设置（`:381`）。
- 启动过程：左栏切换为 `PanLaunching` 覆盖层（`PageLaunchLeft.xaml:53-156`）：加载动画 + 标题（启动中 / 已启动 / 导出脚本中）+ 实例名 + 进度条 + 4 行信息（当前步骤 / 登录方式 / 进度% / 下载速度，后两项按需显示）+ 底部小贴士 + 「取消」按钮。
- 登录方式显示：离线 / Microsoft / 第三方（含认证服务器名）（`.cs:573-590`）。
- 启动失败：错误弹窗（含 `Launch.Error.Title`）并可复制日志（`ModLaunch.cs:428-450`）。

我们应实现的启动前检查（对照已有能力）：
1. 登录状态（无账号 → 提示登录后启动，`index.tsx:173-177` 已有）。
2. 依赖体检：`dependency.ready` / `missingJar` / `missingLibraries` / `missingAssetIndex` / `missingVersions`（`src/api/instance.ts:56-63`）→ 在概览页 + 启动前拦截提示「建议先修复」。
3. 实例安装中/更新中 → 禁用启动按钮。
4. 内存/Java 合法性（`maxMemory < minMemory`、Java 路径不存在）→ 启动前 toast + 引导到设置页。

### 8.3 启动中 / 失败 / 重试

- 启动中：按钮 loading + 全局启动状态（`useLaunchStore`），禁止重复点击。
- 失败：错误信息落 toast + 概览页「启动文件不完整」告警区（已有 `InstanceDetail.tsx:416-428`）。
- 重试：列表加载失败 → 「重试」按钮（已有）；模组/存档列表失败 → 就地「重试」（已有）。

### 8.4 加载 / 空 / 错误态统一规范（从 PCL 抽象）

| 状态 | PCL 表现 | 我们的实现建议 |
| --- | --- | --- |
| 首次加载 | 居中 `MyLoading` 卡（不可点） | 列表骨架屏（我们已有）或居中加载 |
| 加载失败 | 加载卡可点击重试 + 错误文案 | 错误结果卡片：图标 + 原因 + 「重试」 |
| 空（无数据） | 大卡：标题 + 2px 分割线 + 说明 + 主按钮（下载/安装/打开目录） | 复用 `components/ui/empty.tsx`，主按钮高亮 |
| 空（搜索无结果） | 就地小字提示 + 「清除筛选」 | 已有，保留 |
| 操作进行中 | 行禁用 + 文案「删除中」/loading | 按钮 `isDisabled` + spinner；避免整页 loading |
| 操作结果 | 顶部 Hint（成功绿/失败红） | 已有 `sonner` toast，保留 |

### 8.5 搜索防抖 / 文件监听（体验细节）

- 搜索防抖：列表类 75–100ms；资源类 350ms（重算法）；存档搜索 100ms + watcher。
- 存档目录用 `FileSystemWatcher` 自动刷新（避免用户手动刷新）；我们可在存档/截图页轮询或监听（Electron 主进程 `fs.watch` + 事件推送）。
- 删除走回收站（PCL 所有「删除」默认回收站，Shift 才永久）；我们的 `deleteInstance*` 目前是永久删除，建议至少给二次确认 + 文案明示，后续可接 `shell.trashItem`。

---

## 9. PCL 元素 → koring 数据/接口 映射表

> 状态：✅ 已有可用；🟡 部分可用/需扩展；❌ 需实现。
> 接口名以 `src/api/*.ts` / `electron/handlers/*.ts` 现有风格给出。

| # | PCL 元素/行为 | 需要的数据 | koring 接口 | 状态/备注 |
| --- | --- | --- | --- | --- |
| 1 | 游戏目录列表（`PageSelectLeft`） | 目录名/路径/类型 | `getInstallLocations()` / `scanGameDir()` / `inspectGameFolder()` | ✅ `src/api/instance.ts:282-402`；拖拽排序、右键菜单需 UI |
| 2 | 版本卡片分组（收藏/可装Mod/常规/不常用/愚人节/错误/隐藏） | 分组键 + 组内实例 | 需新增 `groupInstances()`（渲染端按 `config.favorite/category`+loader 推导） | 🟡 目录已有 favorite/category；卡片分组与「隐藏实例」❌ |
| 3 | 版本列表项（名字/描述/图标/标签） | name、config.description、icon、runtime | `listInstances(gamePath)` + `getInstanceIcon` | ✅ |
| 4 | 行内按钮：收藏/打开目录/删除/设置；右键 | 同上 | `updateInstance({favorite})`、`openPath`、`deleteInstance` | 🟡 删除/收藏已有；右键菜单 ❌ |
| 5 | 搜索（name/desc/加载器版本） | 已在前端做 | 前端 useMemo | ✅ |
| 6 | 排序（最近/名称/创建/时长） | creationDate/lastPlayedDate/playtime | 前端 | ✅ |
| 7 | 删除确认（回收站/Shift 永久/隔离警告） | 实例路径、是否隔离 | `deleteInstance` + `useConfirmDialogStore` | 🟡 需加「隔离/回收站」文案与实现 |
| 8 | 概览信息（启动次数/加载器版本） | `launchCount`、`runtime.*` | 需在 `InstanceConfig` 增 `launchCount`；版本号已有 | 🟡 |
| 9 | 个性化：图标 | 自定义图标文件 | `getInstanceIcon/setInstanceIcon/resetInstanceIcon` | ✅ |
| 10 | 个性化：分类/收藏/描述 | category/favorite/description | `updateInstance` | ✅ |
| 11 | 个性化：重命名实例（改目录名） | 新名 + 旧名 | 需新增 `renameInstance(name, gamePath, newName)` → `instance:rename` | ❌（需迁移 json/jar/natives/配置 key） |
| 12 | 快捷方式：实例/存档/Mod 目录 | 路径 | `openPath` | 🟡 只需 UI 按钮 |
| 13 | 管理：导出启动脚本 | 实例配置 + Java/账号 | 需新增 `exportLaunchScript()`（复用启动参数生成，写 .bat） | ❌ |
| 14 | 管理：测试游戏 | 启动选项 `IsTest` | `launchStore.launch()` + 测试标记 | 🟡 需加 test 参数 |
| 15 | 管理：补全文件/修复 | 缺失清单 | `repairInstance` + `diagnoseInstance` | ✅ |
| 16 | 管理：重置/重装 | 安装请求 | `installInstance`（重装）+ 备份 | 🟡 备份到 `PCLInstallBackups` ❌ |
| 17 | 管理：修补核心 | 追加 jar | 需新增 `patchGameCore(instancePath, jarPath)` | ❌ |
| 18 | 版本设置：内存（跟随全局/自动/自定义 + 滑块） | min/max + memoryMode | `InstanceConfig` 需增 `memoryMode`；`updateInstance` 已支持内存 | 🟡 |
| 19 | 版本设置：Java 选择 | java 路径 + 已扫描列表 | `config.java` + `handlers/java.ts`（需列表 API 校验） | 🟡 |
| 20 | 版本设置：启动参数/JVM 参数 | vmOptions/mcOptions | `updateInstance` | ✅ |
| 21 | 版本设置：渲染器/启动前命令/忽略检查/关校验/代理 | 启动选项 | 需扩展 `InstanceConfig` + `launch-options.ts` | ❌ |
| 22 | 版本设置：自动进入服务器 + 登录限制/认证服务器 | server + auth 字段 | `config.server` 已有 host/port；认证字段 ❌ | 🟡 |
| 23 | 版本设置：实例隔离 | indie 开关 | `config.resourcePath`/`importMode` 间接表达；建议新增 `isolation` 字段 | 🟡 |
| 24 | 版本设置：重置 | 实例配置 | 需新增 `resetInstanceSettings()` 或 `updateInstance` 全量默认 | ❌ |
| 25 | 模组清单（启用/禁用） | `LocalModInfo[]` | `listInstanceMods(instancePath)` → `{mods, disabled}` | ✅ `src/api/instance-mods.ts` |
| 26 | 模组启用/禁用（`.disabled`） | 真实文件名 + 目标状态 | `setInstanceModsEnabled(instancePath, fileNames, enabled)` | ✅ 已实现；前端传**磁盘真实文件名** |
| 27 | 模组删除（含 .disabled/.old 变体） | 真实文件名 | `deleteInstanceMods` | ✅ |
| 28 | 模组多选批量 | 文件名集合 | 同上（批量入参） | ✅ 后端支持；UI 已有基础 |
| 29 | 模组筛选（全部/启用/禁用/更新/错误/重复） | 逐项状态 | 前端基于 `enabled`/`metaParsed` 可做前四类；更新/重复 ❌ | 🟡 |
| 30 | 模组排序（文件名/名称/大小/时间） | sizeBytes、mtime | 后端未返回 mtime → 扩展 `LocalModInfo.mtime` | 🟡 |
| 31 | 模组搜索（名称/文件名/版本/描述） | displayName/fileName/version/description | 已有字段，前端补匹配 | ✅ |
| 32 | 模组更新检查/更新 | modid+version → Modrinth | `electron/core/modrinth.ts` `searchMods/getModVersions/installMod` + 新 `instance:mods-check-updates` | ❌ |
| 33 | 依赖/内嵌依赖（JIJ）级联 | 依赖图 | 需新增 jar-in-jar 扫描 + 依赖反向索引 | ❌（可二期） |
| 34 | 从文件安装模组（拖入/选文件） | 文件路径列表 | 需新增 `installModsFromFiles(instancePath, files)`（复制到 mods） | ❌ |
| 35 | 打开 mods 目录 / 导出模组信息 | 路径/清单 | `openPath` + 需新增导出 | 🟡 |
| 36 | 资源包/光影列表 + 启停（`.disabled`） | 文件名/启用态 | 只读：`listInstanceResourcePacks` ✅；启停 ❌（需新增 `setInstanceResourcePackEnabled`） | 🟡 |
| 37 | 存档列表（含 level.dat 名称/图标/大小） | SaveInfo | `listInstanceSaves` | ✅ |
| 38 | 存档删除/备份 | 目录名 | `deleteInstanceSaves` / `backupInstanceSaves` | ✅ |
| 39 | 存档详情（版本/种子/出生点/游戏模式/时长） | level.dat 全字段 | 需扩展 `SaveInfo` 或新增 `getInstanceSaveDetail(dirName)`（NBT 读取） | ❌ |
| 40 | 存档快速游玩（`--quickPlaySingleplayer`） | 存档目录名 | 需新增启动选项 `worldName` + 能力探测 | ❌ |
| 41 | 存档粘贴导入 / 复制路径 | 剪贴板文件列表 | 需新增 `importSavesFromPaths`；复制可用前端 clipboard（Electron 受限） | ❌ |
| 42 | 存档/模组/截图文件监听自动刷新 | fs 事件 | 需新增 `instance:watch` 事件通道（Electron `fs.watch`） | ❌（可选） |
| 43 | 截图列表/缩略图/删除 | ScreenshotInfo | `listInstanceScreenshots` / `deleteInstanceScreenshots` | ✅ |
| 44 | 截图打开原图/复制到剪贴板 | 文件路径 | 需新增 `openImage(path)`（`shell.openPath`）/ `copyImageToClipboard` | ❌ |
| 45 | 加载/失败/空态、防抖、提示 | — | 前端组件（`components/ui/empty`、`skeleton`、`sonner`） | ✅ 规范见 §8.4 |
| 46 | 启动进度面板（步骤/登录方式/进度/速度） | 下载/启动任务事件 | `onInstallProgress`/`onInstallComplete` + `useLaunchStore` | 🟡 事件已有，UI 未做进度面板 |

---

## 10. 与现状的差异清单（按优先级）

**P0（把已有后端接上 UI，最小可用）**
1. `InstanceDetail.tsx:514-517` 目前模组/存档/截图/资源包 tab 仍渲染 `PendingTab`，而 `ModsTab.tsx`、`SavesTab.tsx`、`ScreenshotsTab.tsx`、`ResourcePacksTab.tsx` 已存在 → 接线并传 `instance.path`。
2. 模组页补齐：更新按钮位置预留、筛选（全部/已启用/已禁用）、全选、排序、文件夹置顶（`LocalModInfo` 已够用）。
3. 存档页补齐：备份入口（`backupInstanceSaves` 已有）、损坏标记（`hasLevelDat`）。
4. 资源包页：启停开关（需后端补 `.disabled` 改名接口）。

**P1（体验对齐）**
5. 版本列表：右键菜单（打开目录/编辑描述/复制实例名/删除）、`description` 为空时显示 name、补加载器版本分段标签。
6. 设置页：内存三态（跟随全局/自动/自定义）、内存条可视化、「恢复默认」。
7. 概览页：补「启动次数」「各加载器版本」行；快捷方式补「存档/模组目录」。
8. 删除确认：明确「永久删除」或接回收站（`shell.trashItem`），隔离实例警告。

**P2（PCL 独有能力，按需）**
9. 实例重命名（目录迁移）。
10. 导出启动脚本 / 测试游戏 / 修补核心。
11. 模组更新检查（Modrinth）、Jar-in-Jar 依赖级联、从文件安装模组。
12. 存档详情（level.dat 解析与难度/作弊改写）、快速游玩。
13. 截图打开原图/复制、懒加载。

**不要照搬的东西**
- PCL 的方块图标资源、`ColorBrush*` 主题变量、`MyListItem/MyCard` 控件体系、文案 key 与具体措辞 → 用我们的 lucide 图标、Tailwind token、shadcn/HeroUI 组件与中文文案自行撰写（合规要求：不复制其素材/文案）。
- PCL 的「即时保存」设置模型：我们保留草稿+保存更符合桌面端习惯（但要提供「恢复默认」）。
- PCL 的左侧实例子导航：桌面端已有 tab，不必引入二级左栏。

---

## 11. 来源文件清单（复核用）

| 主题 | 文件 |
| --- | --- |
| 实例子导航 | `Plain Craft Launcher 2/Pages/PageInstance/PageInstanceLeft.xaml(.cs)` |
| 实例概览/个性化/快捷方式/管理 | `.../PageInstance/PageInstanceOverall.xaml(.cs)` |
| 实例设置 | `.../PageInstance/PageInstanceSetup.xaml(.cs)` |
| 模组不可安装提示页 | `.../PageInstance/PageInstanceModDisabled.xaml(.cs)` |
| 模组/资源包/光影/投影列表页 | `.../PageInstance/PageInstanceCompResource.xaml(.cs)` |
| 模组列表项 | `.../PageInstance/MyLocalModItem.xaml(.cs)` |
| 存档列表 | `.../PageInstance/PageInstanceSaves.xaml(.cs)` |
| 存档详情/数据包 | `.../PageInstance/PageInstanceSaves/PageInstanceSavesInfo.xaml(.cs)`、`.../PageInstanceSavesDatapack.xaml(.cs)`、`.../PageInstanceSavesLeft.xaml(.cs)` |
| 截图 | `.../PageInstance/PageInstanceScreenshot.xaml(.cs)` |
| 安装/修改版本 | `.../PageInstance/PageInstanceInstall.xaml(.cs)` |
| 版本选择（游戏目录 + 版本卡片） | `Plain Craft Launcher 2/Pages/PageSelectLeft.xaml(.cs)`、`.../PageSelectRight.xaml(.cs)` |
| 启动页 | `Plain Craft Launcher 2/Pages/PageLaunch/PageLaunchLeft.xaml(.cs)`、`PageLaunchRight.xaml(.cs)` |
| 页面枚举 | `Plain Craft Launcher 2/FormMain.xaml.cs:1360-1499` |
| 实例模型 | `Plain Craft Launcher 2/Modules/Minecraft/McInstance.cs`、`McInstanceInfo.cs`、`McInstanceState.cs`、`McInstanceCardType.cs` |
| 分组/排序 | `Plain Craft Launcher 2/Modules/Minecraft/ModInstanceList.cs` |
| 模组文件模型 + 禁用语义 | `Plain Craft Launcher 2/Modules/Minecraft/ModLocalComp.cs`、`ModJarInJarCache.cs`、`ModFolder.cs` |
| 存档 NBT | `PCL.Core/Minecraft/Saves/SaveManager.cs`（经 `PageInstanceSavesInfo.xaml.cs` 调用） |
