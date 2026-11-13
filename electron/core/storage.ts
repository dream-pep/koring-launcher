/**
 * 存储占用扫描（设置 → 通用 → 存储）。
 *
 * 数据面拆成五块：
 * 1. 软件数据 —— 启动器自身的缓存（userData 内 Chromium 各类缓存目录）、联机组件
 *    （terracotta 数据目录 + terracotta.tmp-* 残留）、更新资源（强制更新安装包缓存 +
 *    electron-updater 下载缓存）；
 * 2. 实例占用 —— 每个安装位置（游戏根目录）一行，位置下列出各实例与「共享资源」；
 * 3. Koring Device 数据 —— userData 里启动器自身的数据（协议 / 配置 / 偏好 / 日志 /
 *    索引 / 自定义资源 / 本地），同类多个条目归并成一行并以子资源展示；
 * 4. 隐私数据 —— 账号相关（登录凭据 / 账户数据 / 网络数据）；
 * 5. 其他数据 —— userData 剩余未分类条目，以及与所有已统计根目录互不相交时的
 *    共享资源目录（resourceDir）。
 *
 * 不做重复统计：
 * - 位置扫描 = 先走「排除各实例根」的共享部分，再逐个实例走一遍（位置总量 = 共享 + 实例）；
 * - userData 严格位于某位置内部时，位置扫描会整体排除 userData（其占用由「其他数据」承担）；
 * - userData 本身是某个安装位置时：该位置扫描排除软件数据目录，且不再单独统计第三方数据分类；
 * - 配置的游戏根目录互相嵌套时取最外层，嵌套的行不重复列出（外层总量天然包含它）；
 * - 资源目录与全部已统计根目录相交时视为已合并，不再单独统计。
 *
 * 扫描为异步有界并发（8 个目录 worker、16 个一批 stat），跳过符号链接/联接点，
 * 遇到无权限目录只计数不中断；进度经回调节流后交由 IPC 广播。
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import electron from 'electron';
import { getConfig } from '../config';
import { createLogger } from './logger';
import { listInstallLocations, listInstances, type InstallLocation } from './instance';
import { resolveGamePath } from './paths';
import { terracottaService } from './terracotta';
import { forcedUpdateService } from './forced-update';

const { app } = electron;
const log = createLogger('storage');

// ==================== 对外类型 ====================

/** 类别色调：渲染端按 tone 取基础色，location 再按 colorIndex 取色板 */
export type StorageTone = 'cache' | 'online' | 'update' | 'instance' | 'device' | 'secure' | 'other';

/** 一条占用条目（可为分组行或明细行） */
export interface StorageEntry {
  id: string;
  label: string;
  path: string;
  bytes: number;
  exists: boolean;
  detail?: string;
  tone: StorageTone;
  /** 安装位置专用：色板下标（按位置顺序） */
  colorIndex?: number;
  children: StorageEntry[];
}

export interface StorageSection {
  id: 'software' | 'instances' | 'device' | 'secure' | 'other';
  title: string;
  /** 分类基准色（device / secure / other 三组在长条中各聚合为一片） */
  tone: StorageTone;
  bytes: number;
  entries: StorageEntry[];
}

/** 圆环图的一片：顶层条目的扁平投影 */
export interface StorageSlice {
  id: string;
  label: string;
  bytes: number;
  tone: StorageTone;
  colorIndex?: number;
}

export interface StorageReport {
  sections: StorageSection[];
  slices: StorageSlice[];
  totalBytes: number;
  scannedFiles: number;
  skipped: number;
  warnings: string[];
  userDataPath: string;
  durationMs: number;
  scannedAt: number;
}

export type StorageScanPhase = 'preparing' | 'scanning' | 'aggregating' | 'done';

export interface StorageScanProgress {
  phase: StorageScanPhase;
  label: string;
  current: number;
  total: number;
  scannedBytes: number;
  scannedFiles: number;
}

// ==================== 基础工具 ====================

const PROGRESS_THROTTLE_MS = 120;
const DIR_WORKERS = 8;
const STAT_BATCH = 16;

function normalizeForCompare(target: string): string {
  const resolved = path.resolve(target).replace(/[\\/]+$/, '');
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isSamePath(a: string, b: string): boolean {
  return normalizeForCompare(a) === normalizeForCompare(b);
}

/** child 严格位于 parent 内部（相等不算） */
function isStrictlyInside(child: string, parent: string): boolean {
  const c = normalizeForCompare(child);
  const p = normalizeForCompare(parent);
  if (c === p) return false;
  return c.startsWith(p + path.sep) || c.startsWith(p + '/');
}

function isDirectory(target: string): boolean {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function safeReaddir(target: string): fs.Dirent[] {
  try {
    return fs.readdirSync(target, { withFileTypes: true });
  } catch {
    return [];
  }
}

function formatFileCount(count: number): string {
  return `${count.toLocaleString()} 个文件`;
}

// ==================== 目录遍历 ====================

interface WalkResult {
  bytes: number;
  files: number;
  skipped: number;
}

/**
 * 有界并发遍历：目录队列 + 8 个 worker；文件按 16 个一批 stat。
 * exclude 中的目录（按规范化路径比较）整个跳过，符号链接/联接点不跟随。
 * 传入 sink 时遍历过程直接写入该对象（调用方可实时读取累计值）。
 */
async function walkDirectory(
  root: string,
  exclude: ReadonlySet<string>,
  onTick?: () => void,
  sink: WalkResult = { bytes: 0, files: 0, skipped: 0 },
): Promise<WalkResult> {
  const result = sink;
  const queue: string[] = [root];
  let active = 0;

  const processDir = async (dir: string): Promise<void> => {
    // 不标注 fs.Dirent：@types/node 中 fs.promises.readdir 的返回类型来自 node:fs 声明，
    // 与 fs 模块侧 Dirent（多必填 path 字段）不兼容，交给推断保持一致
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      result.skipped += 1;
      return;
    }

    const files: string[] = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        result.skipped += 1;
        continue;
      }
      if (entry.isDirectory()) {
        if (!exclude.has(normalizeForCompare(full))) queue.push(full);
        continue;
      }
      if (entry.isFile()) {
        files.push(full);
        continue;
      }
      result.skipped += 1;
    }

    for (let index = 0; index < files.length; index += STAT_BATCH) {
      const batch = files.slice(index, index + STAT_BATCH);
      const sizes = await Promise.all(
        batch.map(async (file) => {
          try {
            const stat = await fs.promises.stat(file);
            return stat.isFile() ? stat.size : -1;
          } catch {
            return -1;
          }
        }),
      );
      for (const size of sizes) {
        if (size < 0) {
          result.skipped += 1;
        } else {
          result.bytes += size;
          result.files += 1;
        }
      }
      onTick?.();
    }
    if (files.length === 0) onTick?.();
  };

  await new Promise<void>((resolve) => {
    const pump = (): void => {
      if (queue.length === 0) {
        if (active === 0) resolve();
        return;
      }
      while (active < DIR_WORKERS && queue.length > 0) {
        const dir = queue.shift() as string;
        active += 1;
        processDir(dir)
          .catch(() => {
            result.skipped += 1;
          })
          .finally(() => {
            active -= 1;
            pump();
          });
      }
    };
    pump();
  });

  return result;
}

// ==================== 路径来源 ====================

/** userData 内 Chromium / Electron 的缓存目录候选 */
const CACHE_DIR_NAMES = [
  'Cache',
  'Code Cache',
  'GPUCache',
  'ShaderCache',
  'GrShaderCache',
  'DawnCache',
  'DawnGraphiteCache',
  'DawnWebGPUCache',
  'Service Worker',
  'CacheStorage',
  'blob_storage',
  'Crashpad',
  'component_crx_cache',
  'Shared Dictionary',
  'VideoDecodeStats',
  'SharedStorage',
] as const;

const CACHE_DIR_LABELS: Record<string, string> = {
  'Cache': '网页缓存',
  'Code Cache': '代码缓存',
  'GPUCache': '图形缓存',
  'ShaderCache': '着色器缓存',
  'GrShaderCache': '图形着色器缓存',
  'DawnCache': 'WebGPU 缓存',
  'DawnGraphiteCache': 'WebGPU 图形缓存',
  'DawnWebGPUCache': 'WebGPU 计算缓存',
  'Service Worker': 'Service Worker',
  'CacheStorage': '缓存存储',
  'blob_storage': '二进制存储',
  'Crashpad': '崩溃报告',
  'component_crx_cache': '组件缓存',
  'Shared Dictionary': '共享字典缓存',
  'VideoDecodeStats': '视频解码统计',
  'SharedStorage': '共享存储',
};

/** userData 顶层条目的友好名（未归类的「其他数据」条目与子资源行用） */
const OTHER_LABELS: Record<string, string> = {
  'Koring.yml': '启动器配置',
  'Koring.yml.bak': '配置备份',
  'koring-auth.json': '登录凭据',
  'koring-accounts.json': '账户数据',
  'koring.log': '运行日志',
  'koring.log.old': '历史日志',
  'logs': '日志文件',
  'Crashes': '崩溃记录',
  'crash-dumps': '崩溃转储',
  'Local State': '本地状态',
  'Preferences': '偏好设置',
  'lockfile': '锁文件',
  '.updaterId': '更新标识',
  'Network': '网络数据',
  'Local Storage': '本地存储',
  'Session Storage': '会话存储',
  'IndexedDB': '索引数据库',
  'WebStorage': 'Web 存储',
  'shared_proto_db': '共享协议数据',
  'SingletonLock': '单实例锁',
  'SingletonCookie': '单实例锁',
  'SingletonSocket': '单实例锁',
};

function otherEntryLabel(name: string): string {
  if (OTHER_LABELS[name]) return OTHER_LABELS[name];
  if (name.startsWith('background-custom')) return '自定义背景';
  return name;
}

/** userData 顶层条目在「其他数据」里的归类：Koring Device 数据 / 隐私数据 / 其他数据 */
interface OtherGroupSectionSpec {
  id: 'device' | 'secure' | 'other';
  title: string;
  tone: StorageTone;
  /** 归并条目及其展示顺序（other 分类为空：每个顶层条目单独成行） */
  items: Array<{ key: string; label: string }>;
  /** userData 顶层条目名 → items[].key */
  members: Record<string, string>;
  /** 顶层条目名前缀通配 → items[].key（如多个 background-custom 合成「自定义资源」） */
  prefixes: Array<{ prefix: string; key: string }>;
}

const OTHER_SECTION_SPECS: OtherGroupSectionSpec[] = [
  {
    id: 'device',
    title: 'Koring Device 数据',
    tone: 'device',
    items: [
      { key: 'protocol', label: '协议' },
      { key: 'config', label: '配置' },
      { key: 'preferences', label: '偏好' },
      { key: 'logs', label: '日志' },
      { key: 'index', label: '索引' },
      { key: 'custom', label: '自定义资源' },
      { key: 'local', label: '本地' },
    ],
    members: {
      'shared_proto_db': 'protocol',
      'Koring.yml': 'config',
      'Koring.yml.bak': 'config',
      'Preferences': 'preferences',
      'Local State': 'preferences',
      'koring.log': 'logs',
      'koring.log.old': 'logs',
      'koring-crash.log': 'logs',
      'logs': 'logs',
      'Crashes': 'logs',
      'crash-dumps': 'logs',
      'IndexedDB': 'index',
      'Local Storage': 'local',
    },
    prefixes: [{ prefix: 'background-custom', key: 'custom' }],
  },
  {
    id: 'secure',
    title: '隐私数据',
    tone: 'secure',
    items: [
      { key: 'auth', label: '登录凭据' },
      { key: 'accounts', label: '账户数据' },
      { key: 'network', label: '网络数据' },
    ],
    members: {
      'koring-auth.json': 'auth',
      'koring-accounts.json': 'accounts',
      'Network': 'network',
    },
    prefixes: [],
  },
  {
    id: 'other',
    title: '其他数据',
    tone: 'other',
    items: [],
    members: {},
    prefixes: [],
  },
];

/** 顶层条目名 → 归属分类与归并条目；未命中即落「其他数据」单独成行 */
function resolveOtherGroup(name: string): { sectionId: 'device' | 'secure' | 'other'; key: string; label: string } {
  for (const spec of OTHER_SECTION_SPECS) {
    const key = spec.members[name];
    if (!key) continue;
    const item = spec.items.find((it) => it.key === key);
    if (item) return { sectionId: spec.id, key: item.key, label: item.label };
  }
  for (const spec of OTHER_SECTION_SPECS) {
    const rule = spec.prefixes.find((it) => name.startsWith(it.prefix));
    if (!rule) continue;
    const item = spec.items.find((it) => it.key === rule.key);
    if (item) return { sectionId: spec.id, key: item.key, label: item.label };
  }
  return { sectionId: 'other', key: `entry:${name}`, label: otherEntryLabel(name) };
}

/** electron-updater 的缓存基目录（与其 AppUpdater 的 baseCachePath 逻辑一致） */
function updaterCacheBase(): string {
  if (process.platform === 'win32') {
    return process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Caches');
  }
  return process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
}

/** 解析 electron-updater 实际使用的缓存目录（打包后优先读 app-update.yml） */
function resolveUpdaterCacheDir(): string | null {
  const names: string[] = [];
  if (app.isPackaged) {
    try {
      const raw = fs.readFileSync(path.join(process.resourcesPath, 'app-update.yml'), 'utf-8');
      const match = raw.match(/^updaterCacheDirName:\s*(.+)$/m);
      if (match) names.push(match[1].trim());
    } catch {
      // 无 app-update.yml（如 dev / 部分 Linux 打包）时走候选名
    }
  }
  names.push(`${app.getName()}-updater`, app.getName(), 'koring-launcher-updater');

  const base = updaterCacheBase();
  for (const name of names) {
    const dir = path.join(base, name);
    if (isDirectory(dir)) return dir;
  }
  return null;
}

// ==================== 扫描计划结构 ====================

interface Accumulator {
  bytes: number;
  files: number;
  skipped: number;
}

interface GroupChildPlan {
  id: string;
  label: string;
  path: string;
  exists: boolean;
  acc: Accumulator;
}

interface GroupPlan {
  id: string;
  label: string;
  tone: 'cache' | 'online' | 'update';
  /** 打开目录用：第一个存在的子目录，否则第一个候选 */
  path: string;
  exists: boolean;
  children: GroupChildPlan[];
}

interface InstancePlan {
  id: string;
  label: string;
  path: string;
  acc: Accumulator;
}

interface LocationPlan {
  path: string;
  label: string;
  colorIndex: number;
  instances: InstancePlan[];
  shared: Accumulator;
}

interface OtherChildPlan {
  id: string;
  label: string;
  path: string;
  kind: 'dir' | 'file';
  /** kind = file 时直接量得 */
  bytes: number;
  acc: Accumulator;
  /** 归属分类 */
  sectionId: 'device' | 'secure' | 'other';
  /** 归并条目 key：同一分类下同 key 的成员合并成一行 */
  groupKey: string;
  /** 归并条目展示名 */
  groupLabel: string;
  /** 该成员自身的展示名（作为子资源行，如「运行日志」「配置备份」） */
  memberLabel: string;
}

interface ScanJob {
  label: string;
  run: () => Promise<WalkResult>;
}

function makeGroup(
  id: string,
  label: string,
  tone: 'cache' | 'online' | 'update',
  candidates: Array<{ id: string; label: string; path: string }>,
): GroupPlan {
  const seen = new Set<string>();
  const children: GroupChildPlan[] = [];
  for (const candidate of candidates) {
    if (!candidate.path) continue;
    const key = normalizeForCompare(candidate.path);
    if (seen.has(key)) continue;
    seen.add(key);
    children.push({ ...candidate, exists: isDirectory(candidate.path), acc: { bytes: 0, files: 0, skipped: 0 } });
  }
  const firstExisting = children.find((child) => child.exists);
  return {
    id,
    label,
    tone,
    path: firstExisting?.path ?? children[0]?.path ?? '',
    exists: children.some((child) => child.exists),
    children,
  };
}

function locationDisplayLabel(loc: InstallLocation, aliases: Record<string, string>): string {
  return aliases[loc.path] || aliases[loc.resolvedPath] || loc.label;
}

// ==================== 主扫描流程 ====================

export async function scanStorage(onProgress?: (progress: StorageScanProgress) => void): Promise<StorageReport> {
  const startedAt = Date.now();
  const userData = app.getPath('userData');
  const warnings: string[] = [];

  const config = getConfig();
  const aliases = config.game.dirAliases ?? {};

  // ---- 阶段 1：制定计划（廉价 readdir/stat，不做递归）----

  onProgress?.({ phase: 'preparing', label: '正在统计目录…', current: 0, total: 0, scannedBytes: 0, scannedFiles: 0 });

  // 软件数据三组
  const cacheGroup = makeGroup(
    'software:cache',
    '缓存',
    'cache',
    CACHE_DIR_NAMES.map((name) => ({
      id: `cache:${name}`,
      label: CACHE_DIR_LABELS[name] ?? name,
      path: path.join(userData, name),
    })),
  );

  const onlineCandidates = [{ id: 'online:terracotta', label: '联机运行时数据', path: terracottaService.getDataDir() }];
  for (const entry of safeReaddir(userData)) {
    if (entry.name.startsWith('terracotta.tmp-')) {
      onlineCandidates.push({
        id: `online:${entry.name}`,
        label: '联机临时文件',
        path: path.join(userData, entry.name),
      });
    }
  }
  const onlineGroup = makeGroup('software:online', '联机组件', 'online', onlineCandidates);

  const updateCandidates = [
    { id: 'update:installer', label: '安装包缓存', path: forcedUpdateService.getDownloadDir() },
  ];
  const updaterCacheDir = resolveUpdaterCacheDir();
  if (updaterCacheDir) {
    updateCandidates.push({ id: 'update:cache', label: '更新下载缓存', path: updaterCacheDir });
  }
  const updateGroup = makeGroup('software:update', '更新资源', 'update', updateCandidates);

  const softwareGroups = [cacheGroup, onlineGroup, updateGroup];
  /** 软件数据已声明的目录：其他分类扫描时整体排除，避免重复统计 */
  const claimedSoftwareDirs = softwareGroups.flatMap((group) => group.children.map((child) => child.path));

  // 安装位置：去嵌套（外层优先）
  const allLocations = listInstallLocations().filter((loc) => loc.exists);
  const keptLocations: InstallLocation[] = [];
  for (const candidate of allLocations) {
    const outer = keptLocations.find((kept) => isStrictlyInside(candidate.resolvedPath, kept.resolvedPath));
    if (!outer) {
      keptLocations.push(candidate);
      continue;
    }
    const viaUserData =
      isStrictlyInside(candidate.resolvedPath, userData) && isStrictlyInside(userData, outer.resolvedPath);
    warnings.push(
      viaUserData
        ? `安装位置「${locationDisplayLabel(candidate, aliases)}」位于「${locationDisplayLabel(outer, aliases)}」内部且处于启动器数据目录中，其占用计入「其他数据」`
        : `安装位置「${locationDisplayLabel(candidate, aliases)}」位于「${locationDisplayLabel(outer, aliases)}」内部，已合并到外层位置统计`,
    );
  }

  /** userData 本身被配置为某个安装位置：不再单独统计第三方数据分类 */
  const userDataIsLocation = keptLocations.some((loc) => isSamePath(loc.resolvedPath, userData));

  const locationPlans: LocationPlan[] = keptLocations.map((loc, index) => {
    const instances = listInstances(loc.resolvedPath).map((info, order) => ({
      id: `location:${index}:instance:${order}`,
      label: info.config.name || info.name,
      path: info.path,
      acc: { bytes: 0, files: 0, skipped: 0 } as Accumulator,
    }));
    return {
      path: loc.resolvedPath,
      label: locationDisplayLabel(loc, aliases),
      colorIndex: index,
      instances,
      shared: { bytes: 0, files: 0, skipped: 0 },
    };
  });

  // 其他数据：userData 顶层剩余条目按 device / secure / other 归类 + （不相交时的）共享资源目录
  const otherChildren: OtherChildPlan[] = [];
  const otherSkippedRef = { count: 0 };
  if (!userDataIsLocation) {
    const excludeOther = new Set<string>(claimedSoftwareDirs.map(normalizeForCompare));
    for (const loc of keptLocations) {
      // 已单独统计的安装位置嵌在 userData 内时不重复计入
      if (isStrictlyInside(loc.resolvedPath, userData)) excludeOther.add(normalizeForCompare(loc.resolvedPath));
    }

    for (const entry of safeReaddir(userData)) {
      const full = path.join(userData, entry.name);
      if (excludeOther.has(normalizeForCompare(full))) continue;
      if (entry.isSymbolicLink()) {
        otherSkippedRef.count += 1;
        continue;
      }
      const group = resolveOtherGroup(entry.name);
      const base = {
        id: `other:${entry.name}`,
        label: group.label,
        path: full,
        sectionId: group.sectionId,
        groupKey: group.key,
        groupLabel: group.label,
        memberLabel: otherEntryLabel(entry.name),
        acc: { bytes: 0, files: 0, skipped: 0 },
      };
      if (entry.isFile()) {
        try {
          otherChildren.push({
            ...base,
            kind: 'file',
            bytes: fs.statSync(full).size,
          });
        } catch {
          otherSkippedRef.count += 1;
        }
        continue;
      }
      if (entry.isDirectory()) {
        otherChildren.push({ ...base, kind: 'dir', bytes: 0 });
        continue;
      }
      otherSkippedRef.count += 1;
    }
  }

  // 共享资源目录：仅在与其他全部已统计根目录互不相交时单独统计
  let resourceChild: OtherChildPlan | null = null;
  const rawResourceDir = config.game.resourceDir ? resolveGamePath(config.game.resourceDir) : '';
  if (rawResourceDir && isDirectory(rawResourceDir)) {
    const roots = [...keptLocations.map((loc) => loc.resolvedPath), userData];
    const overlaps = roots.some(
      (root) => isStrictlyInside(rawResourceDir, root) || isStrictlyInside(root, rawResourceDir) || isSamePath(rawResourceDir, root),
    );
    if (overlaps) {
      warnings.push('共享资源目录位于已统计的目录内，其占用已包含在对应分类中');
    } else {
      resourceChild = {
        id: 'other:resource-dir',
        label: '共享资源目录',
        path: rawResourceDir,
        kind: 'dir',
        bytes: 0,
        acc: { bytes: 0, files: 0, skipped: 0 },
        sectionId: 'other',
        groupKey: 'entry:resource-dir',
        groupLabel: '共享资源目录',
        memberLabel: '共享资源目录',
      };
    }
  }

  // ---- 阶段 2：生成任务清单 ----

  const jobs: ScanJob[] = [];

  const pushJob = (label: string, target: string, acc: Accumulator, exclude: ReadonlySet<string>): void => {
    jobs.push({
      label,
      run: async () => {
        // sink 由 walkDirectory 直接写入 → onTick 期间能读到实时累计值
        const sink: WalkResult = { bytes: 0, files: 0, skipped: 0 };
        const walked = await walkDirectory(target, exclude, () => emitJobTick(sink), sink);
        acc.bytes += walked.bytes;
        acc.files += walked.files;
        acc.skipped += walked.skipped;
        emitJobTick(walked);
        return walked;
      },
    });
  };

  for (const group of softwareGroups) {
    for (const child of group.children) {
      if (!child.exists) continue;
      pushJob(
        `扫描${group.label} · ${child.label}`,
        child.path,
        child.acc,
        new Set<string>(),
      );
    }
  }

  for (const plan of locationPlans) {
    // 位置 = 共享部分（排除各实例根 / userData）+ 各实例
    const exclude = new Set<string>(plan.instances.map((instance) => normalizeForCompare(instance.path)));
    const userDataInside = isStrictlyInside(userData, plan.path);
    const userDataEqual = isSamePath(userData, plan.path);
    if (userDataInside) exclude.add(normalizeForCompare(userData));
    if (userDataEqual) {
      // userData 即该位置：软件数据的目录已在「软件数据」统计过，这里排除
      for (const dir of claimedSoftwareDirs) exclude.add(normalizeForCompare(dir));
    }
    pushJob(`扫描 ${plan.label} · 共享资源`, plan.path, plan.shared, exclude);
    for (const instance of plan.instances) {
      pushJob(`扫描实例 · ${instance.label}`, instance.path, instance.acc, new Set<string>());
    }
  }

  for (const child of otherChildren) {
    if (child.kind !== 'dir') continue;
    const sectionTitle = OTHER_SECTION_SPECS.find((spec) => spec.id === child.sectionId)?.title ?? '其他数据';
    pushJob(`扫描${sectionTitle} · ${child.groupLabel}`, child.path, child.acc, new Set<string>());
  }
  if (resourceChild) {
    pushJob('扫描共享资源目录', resourceChild.path, resourceChild.acc, new Set<string>());
  }

  // ---- 阶段 3：顺序执行（进度节流广播）----

  let scannedBytes = 0;
  let scannedFiles = 0;
  let scannedSkipped = otherSkippedRef.count;
  let currentLabel = '';
  let currentLocalBytes = 0;
  let currentLocalFiles = 0;
  let currentIndex = 0;
  let lastEmitAt = 0;

  const emitJobTick = (local: WalkResult): void => {
    currentLocalBytes = local.bytes;
    currentLocalFiles = local.files;
    const now = Date.now();
    if (now - lastEmitAt < PROGRESS_THROTTLE_MS) return;
    lastEmitAt = now;
    onProgress?.({
      phase: 'scanning',
      label: currentLabel,
      current: currentIndex + 1,
      total: jobs.length,
      scannedBytes: scannedBytes + currentLocalBytes,
      scannedFiles: scannedFiles + currentLocalFiles,
    });
  };

  for (let index = 0; index < jobs.length; index += 1) {
    currentIndex = index;
    currentLocalBytes = 0;
    currentLocalFiles = 0;
    currentLabel = jobs[index].label;
    lastEmitAt = 0; // 每个任务立即发一次
    const result = await jobs[index].run();
    scannedBytes += result.bytes;
    scannedFiles += result.files;
    scannedSkipped += result.skipped;
  }

  onProgress?.({
    phase: 'aggregating',
    label: '正在汇总数据…',
    current: jobs.length,
    total: jobs.length,
    scannedBytes,
    scannedFiles,
  });

  // ---- 阶段 4：聚合 ----

  const groupToEntry = (group: GroupPlan): StorageEntry => {
    const children = group.children
      .filter((child) => child.exists)
      .sort((a, b) => b.acc.bytes - a.acc.bytes)
      .map<StorageEntry>((child) => ({
        id: child.id,
        label: child.label,
        path: child.path,
        bytes: child.acc.bytes,
        exists: true,
        detail: child.acc.files > 0 ? formatFileCount(child.acc.files) : undefined,
        tone: group.tone,
        children: [],
      }));
    return {
      id: group.id,
      label: group.label,
      path: group.path,
      bytes: group.children.reduce((sum, child) => sum + child.acc.bytes, 0),
      exists: group.exists,
      detail: group.exists && children.length > 0 ? formatFileCount(group.children.reduce((sum, child) => sum + child.acc.files, 0)) : undefined,
      tone: group.tone,
      children,
    };
  };

  const locationEntries: StorageEntry[] = locationPlans.map((plan, index) => {
    const instanceEntries = plan.instances
      .map<StorageEntry>((instance) => ({
        id: instance.id,
        label: instance.label,
        path: instance.path,
        bytes: instance.acc.bytes,
        exists: true,
        tone: 'instance',
        colorIndex: plan.colorIndex,
        children: [],
      }))
      .sort((a, b) => b.bytes - a.bytes);
    const total = plan.shared.bytes + plan.instances.reduce((sum, instance) => sum + instance.acc.bytes, 0);
    return {
      id: `location:${index}`,
      label: plan.label,
      path: plan.path,
      bytes: total,
      exists: true,
      detail: `${plan.instances.length} 个实例 · ${formatFileCount(plan.shared.files + plan.instances.reduce((sum, instance) => sum + instance.acc.files, 0))}`,
      tone: 'instance',
      colorIndex: plan.colorIndex,
      children:
        plan.shared.bytes > 0
          ? [
              ...instanceEntries,
              {
                id: `location:${index}:shared`,
                label: '共享资源',
                path: plan.path,
                bytes: plan.shared.bytes,
                exists: true,
                tone: 'instance',
                colorIndex: plan.colorIndex,
                children: [],
              },
            ]
          : instanceEntries,
    };
  });

  /** 把某分类的成员按归并 key 聚合成条目（同 key 多项合成一行；零占用的不展示） */
  const buildOtherEntries = (spec: OtherGroupSectionSpec, members: OtherChildPlan[]): StorageEntry[] => {
    const buckets = new Map<string, OtherChildPlan[]>();
    for (const member of members) {
      const bucket = buckets.get(member.groupKey);
      if (bucket) bucket.push(member);
      else buckets.set(member.groupKey, [member]);
    }

    const toEntry = (key: string, bucket: OtherChildPlan[]): StorageEntry | null => {
      const bytes = bucket.reduce((sum, item) => sum + (item.kind === 'file' ? item.bytes : item.acc.bytes), 0);
      const files = bucket.reduce((sum, item) => sum + (item.kind === 'file' ? 1 : item.acc.files), 0);
      if (bytes <= 0 && files <= 0) return null;
      const primary = bucket.find((item) => item.kind === 'dir') ?? bucket[0];
      // 「其他数据」沿用原始条目 id；device / secure 使用归并 key，便于稳定联动
      const id = spec.id === 'other' ? primary.id : `other:${spec.id}:${key}`;
      // 归并了多项的条目（如 配置 = 启动器配置 + 配置备份）把成员作为子资源行展示
      const members = [...bucket].sort(
        (a, b) => (b.kind === 'file' ? b.bytes : b.acc.bytes) - (a.kind === 'file' ? a.bytes : a.acc.bytes),
      );
      const labelCount = new Map<string, number>();
      for (const item of bucket) labelCount.set(item.memberLabel, (labelCount.get(item.memberLabel) ?? 0) + 1);
      const labelSeen = new Map<string, number>();
      const children: StorageEntry[] =
        members.length > 1
          ? members.map<StorageEntry>((item) => {
              // 同名子资源（如多张自定义背景）追加序号区分
              let label = item.memberLabel;
              if ((labelCount.get(label) ?? 0) > 1) {
                const nth = (labelSeen.get(label) ?? 0) + 1;
                labelSeen.set(label, nth);
                label = `${label} ${nth}`;
              }
              return {
                id: `${id}:child:${item.id}`,
                label,
                path: item.kind === 'file' ? path.dirname(item.path) : item.path,
                bytes: item.kind === 'file' ? item.bytes : item.acc.bytes,
                exists: true,
                detail: item.kind === 'dir' && item.acc.files > 0 ? formatFileCount(item.acc.files) : undefined,
                tone: spec.tone,
                children: [],
              };
            })
          : [];
      return {
        id,
        label: primary.groupLabel,
        path: primary.kind === 'file' ? path.dirname(primary.path) : primary.path,
        bytes,
        exists: true,
        detail: files > 0 ? formatFileCount(files) : undefined,
        tone: spec.tone,
        children,
      };
    };

    // 先按声明顺序输出（协议 / 配置 / 偏好 / 日志 / 索引 / 自定义资源 / 本地），其余按占用降序
    const ordered: StorageEntry[] = [];
    for (const item of spec.items) {
      const bucket = buckets.get(item.key);
      buckets.delete(item.key);
      if (!bucket || bucket.length === 0) continue;
      const entry = toEntry(item.key, bucket);
      if (entry) ordered.push(entry);
    }
    const rest: StorageEntry[] = [];
    for (const [key, bucket] of buckets) {
      const entry = toEntry(key, bucket);
      if (entry) rest.push(entry);
    }
    rest.sort((a, b) => b.bytes - a.bytes);
    return [...ordered, ...rest];
  };

  const otherMembers: OtherChildPlan[] = resourceChild ? [...otherChildren, resourceChild] : otherChildren;

  const sections: StorageSection[] = [
    {
      id: 'software',
      title: '软件数据',
      tone: 'cache',
      bytes: 0,
      entries: softwareGroups.map(groupToEntry),
    },
    {
      id: 'instances',
      title: '实例占用',
      tone: 'instance',
      bytes: 0,
      entries: locationEntries,
    },
    ...OTHER_SECTION_SPECS.map<StorageSection>((spec) => ({
      id: spec.id,
      title: spec.title,
      tone: spec.tone,
      bytes: 0,
      entries: buildOtherEntries(
        spec,
        otherMembers.filter((member) => member.sectionId === spec.id),
      ),
    })),
  ];
  for (const section of sections) {
    section.bytes = section.entries.reduce((sum, entry) => sum + entry.bytes, 0);
  }

  // 长条切片：软件数据 / 实例占用逐条目出片；三组其他数据各聚合为一片（明细仍逐条展示在下方列表）
  const slices: StorageSlice[] = [];
  for (const section of sections) {
    if (section.id === 'device' || section.id === 'secure' || section.id === 'other') {
      if (section.bytes > 0) {
        slices.push({ id: `section:${section.id}`, label: section.title, bytes: section.bytes, tone: section.tone });
      }
      continue;
    }
    for (const entry of section.entries) {
      slices.push({
        id: entry.id,
        label: entry.label,
        bytes: entry.bytes,
        tone: entry.tone,
        colorIndex: entry.colorIndex,
      });
    }
  }

  const report: StorageReport = {
    sections,
    slices,
    totalBytes: sections.reduce((sum, section) => sum + section.bytes, 0),
    scannedFiles,
    skipped: scannedSkipped,
    warnings,
    userDataPath: userData,
    durationMs: Date.now() - startedAt,
    scannedAt: Date.now(),
  };

  log.info(
    `[storage] 扫描完成：${(report.totalBytes / 1024 / 1024).toFixed(1)}MB / ${scannedFiles.toLocaleString()} 文件 / ` +
      `耗时 ${report.durationMs}ms / 跳过 ${scannedSkipped}`,
  );

  onProgress?.({
    phase: 'done',
    label: '扫描完成',
    current: jobs.length,
    total: jobs.length,
    scannedBytes,
    scannedFiles,
  });

  return report;
}
