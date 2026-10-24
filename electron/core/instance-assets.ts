/**
 * 实例内资产（存档 / 截图 / 资源包）扫描与操作（主进程）。
 *
 * 设计要点：
 * - 只读扫描为主：目录 / 文件不存在一律按「空」处理，不抛错，避免实例刚建好时页面报错；
 * - 所有用户传入的文件名 / 目录名都经过 basename 校验，只允许操作某个根目录的**直接子项**，防止目录穿越；
 * - 缩略图在主进程用 nativeImage 生成 dataURL 后返回，绝不把原始大图（截图常见数 MB）塞给渲染端；
 * - 存档 `level.dat` 为 gzip + NBT，这里内置一个极简 NBT 读取器只取 `Data.LevelName`，
 *   解析失败回退目录名，不为读取一个名字引入 NBT 依赖；
 * - 资源包启用/禁用沿用 PCL-CE 语义（见 ModLocalComp.cs）：`.disabled` / `.old` 后缀 = 已禁用。
 */

import electron from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { createLogger } from './logger';

const { nativeImage } = electron;
const log = createLogger('instance-assets');

/** 实例内各资产子目录名 */
const SAVES_DIR = 'saves';
const SCREENSHOTS_DIR = 'screenshots';
const RESOURCEPACKS_DIR = 'resourcepacks';
const SHADERPACKS_DIR = 'shaderpacks';
/** 备份根目录：<实例>/backups/saves/<存档名>-<yyyyMMdd-HHmmss>/ */
const BACKUP_DIR = path.join('backups', 'saves');

/** 存档图标缩略图边长（像素） */
const SAVE_ICON_SIZE = 96;
/** 截图缩略图宽度（像素） */
const SCREENSHOT_THUMB_WIDTH = 320;
/** 目录遍历最大深度（防御异常目录结构 / 符号链接环） */
const MAX_COPY_DEPTH = 64;

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

/** 存档（saves/ 下的一个目录） */
export interface SaveInfo {
  /** 存档目录名（= 回退显示名） */
  dirName: string;
  /** 存档目录绝对路径 */
  dirPath: string;
  /** level.dat 中的显示名（LevelName）；解析失败回退目录名 */
  levelName: string;
  /** 是否存在 level.dat（损坏 / 不完整存档也能展示，但 UI 可据此提示） */
  hasLevelDat: boolean;
  /** 目录总大小（字节，递归统计；单个文件读取失败按 0 累加） */
  sizeBytes: number;
  /** 最后修改时间（毫秒时间戳）：优先 level.dat，缺失时取目录 */
  lastModified: number;
  /** icon.png 的 96px 缩略 dataURL；无图标或解码失败为 null */
  iconDataUrl: string | null;
}

/** 截图（screenshots/ 下的 png / jpg / jpeg） */
export interface ScreenshotInfo {
  fileName: string;
  filePath: string;
  sizeBytes: number;
  /** 最后修改时间（毫秒时间戳） */
  mtime: number;
  /** 320px 宽缩略 dataURL；解码失败为 null */
  thumbDataUrl: string | null;
}

/** 资源包种类 */
export type ResourcePackKind = 'resourcepack' | 'shaderpack';

/** 资源包 / 光影包（只读列表，不含启停） */
export interface ResourcePackInfo {
  /** 磁盘上的真实文件名（可能带 .disabled / .old 后缀） */
  fileName: string;
  /** 去掉 .disabled / .old 后缀后的展示名 */
  rawFileName: string;
  filePath: string;
  kind: ResourcePackKind;
  sizeBytes: number;
  /** 是否启用：文件名带 .disabled / .old 后缀 = 已禁用（PCL-CE 语义） */
  enabled: boolean;
  /** 最后修改时间（毫秒时间戳） */
  mtime: number;
}

/** 批量删除结果：删除成功 / 失败（失败项不抛错，由调用方决定如何提示） */
export interface DeleteResult {
  deleted: string[];
  failed: { name: string; error: string }[];
}

const EMPTY_DELETE_RESULT = (): DeleteResult => ({ deleted: [], failed: [] });

// ---------------------------------------------------------------------------
// 通用工具
// ---------------------------------------------------------------------------

/** 目录名 / 文件名直接子项校验：只允许「某个根目录的直接子项」，防目录穿越 */
function resolveChildPath(parentDir: string, childName: string): string | null {
  if (typeof childName !== 'string') return null;
  // 空名 / 当前目录 / 上级目录一律拒绝
  if (!childName || childName === '.' || childName === '..') return null;
  if (childName.includes('\0')) return null;
  // basename 必须等于自身：拦截 ".."、"a/b"、"a\\b"、"C:\\x"、绝对路径等
  if (path.basename(childName) !== childName) return null;
  // Windows 保留字符（NTFS 数据流 / 非法路径字符），列表来源不会出现，属兜底校验
  if (process.platform === 'win32' && /[<>:"/\\|?*\u0000-\u001f]/.test(childName)) return null;
  const full = path.resolve(parentDir, childName);
  const rel = path.relative(parentDir, full);
  // 归一化后必须仍是 parentDir 下的单层子项
  if (!rel || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) return null;
  if (rel !== path.basename(rel)) return null;
  return full;
}

/** 实例路径归一化：空 / 非法返回 null（调用方按「空」处理） */
function normalizeInstancePath(instancePath: unknown): string | null {
  if (typeof instancePath !== 'string' || !instancePath.trim()) return null;
  try {
    return path.resolve(instancePath);
  } catch {
    return null;
  }
}

/** 安全 readdir：目录不存在 / 不是目录 / 无权限都返回空数组 */
function safeReaddir(dirPath: string): fs.Dirent[] {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

/** 安全 stat：失败返回 null */
function safeStat(targetPath: string): fs.Stats | null {
  try {
    return fs.statSync(targetPath);
  } catch {
    return null;
  }
}

/** 递归统计目录大小（不跟随符号链接，防环） */
function dirSizeBytes(dirPath: string): number {
  let total = 0;
  const stack: string[] = [dirPath];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const entry of safeReaddir(current)) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        const stat = safeStat(full);
        if (stat) total += stat.size;
      }
      // 符号链接等特殊项直接跳过，避免越界统计
    }
  }
  return total;
}

/** 用 nativeImage 生成缩略 dataURL；失败返回 null（静默，不阻断列表） */
function makeThumbDataUrl(filePath: string, width: number): string | null {
  try {
    const image = nativeImage.createFromPath(filePath);
    if (image.isEmpty()) return null;
    const size = image.getSize();
    if (!size.width || !size.height) return null;
    // 只缩不放：小图保留原尺寸，避免无谓放大还撑大数据体积
    const thumb = size.width > width ? image.resize({ width, quality: 'good' }) : image;
    const dataUrl = thumb.toDataURL();
    return dataUrl || null;
  } catch (e) {
    log.debug('生成缩略图失败', filePath, e);
    return null;
  }
}

/** yyyyMMdd-HHmmss（本地时区，用于备份目录名） */
function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/** 目录已存在时追加 -2 / -3…，避免同一秒内重复备份互相覆盖 */
function uniquePath(targetPath: string): string {
  if (!fs.existsSync(targetPath)) return targetPath;
  for (let index = 2; index < 10000; index += 1) {
    const candidate = `${targetPath}-${index}`;
    if (!fs.existsSync(candidate)) return candidate;
  }
  return targetPath;
}

/** 递归复制目录（不跟随符号链接；文件级失败向上抛出，由调用方清理半成品） */
function copyDirRecursive(srcDir: string, destDir: string, depth = 0): void {
  if (depth > MAX_COPY_DEPTH) throw new Error('目录嵌套过深，已跳过复制');
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const from = path.join(srcDir, entry.name);
    const to = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(from, to, depth + 1);
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to);
    }
    // 符号链接等特殊项跳过：备份只包含真实文件
  }
}

// ---------------------------------------------------------------------------
// 极简 NBT 读取：只取 level.dat 里 Data.LevelName
// ---------------------------------------------------------------------------

const NBT_TAG_END = 0;
const NBT_TAG_BYTE = 1;
const NBT_TAG_SHORT = 2;
const NBT_TAG_INT = 3;
const NBT_TAG_LONG = 4;
const NBT_TAG_FLOAT = 5;
const NBT_TAG_DOUBLE = 6;
const NBT_TAG_BYTE_ARRAY = 7;
const NBT_TAG_STRING = 8;
const NBT_TAG_LIST = 9;
const NBT_TAG_COMPOUND = 10;
const NBT_TAG_INT_ARRAY = 11;
const NBT_TAG_LONG_ARRAY = 12;

interface NbtCursor {
  pos: number;
}

function nbtNeed(buf: Buffer, cursor: NbtCursor, bytes: number): void {
  if (cursor.pos + bytes > buf.length) throw new RangeError('NBT 数据不完整');
}

function nbtReadU8(buf: Buffer, cursor: NbtCursor): number {
  nbtNeed(buf, cursor, 1);
  const value = buf[cursor.pos];
  cursor.pos += 1;
  return value;
}

function nbtReadU16(buf: Buffer, cursor: NbtCursor): number {
  nbtNeed(buf, cursor, 2);
  const value = buf.readUInt16BE(cursor.pos);
  cursor.pos += 2;
  return value;
}

function nbtReadI32(buf: Buffer, cursor: NbtCursor): number {
  nbtNeed(buf, cursor, 4);
  const value = buf.readInt32BE(cursor.pos);
  cursor.pos += 4;
  return value;
}

/** 带长度前缀的 UTF-8 字符串（Java 版 NBT 使用 modified UTF-8，资源包名场景按普通 UTF-8 读取足够） */
function nbtReadString(buf: Buffer, cursor: NbtCursor): string {
  const length = nbtReadU16(buf, cursor);
  nbtNeed(buf, cursor, length);
  const value = buf.toString('utf8', cursor.pos, cursor.pos + length);
  cursor.pos += length;
  return value;
}

/** 跳过任意类型标签的 payload（不解析内容，只推进游标） */
function nbtSkipPayload(buf: Buffer, cursor: NbtCursor, tagType: number): void {
  switch (tagType) {
    case NBT_TAG_BYTE:
      nbtNeed(buf, cursor, 1);
      cursor.pos += 1;
      return;
    case NBT_TAG_SHORT:
      nbtNeed(buf, cursor, 2);
      cursor.pos += 2;
      return;
    case NBT_TAG_INT:
    case NBT_TAG_FLOAT:
      nbtNeed(buf, cursor, 4);
      cursor.pos += 4;
      return;
    case NBT_TAG_LONG:
    case NBT_TAG_DOUBLE:
      nbtNeed(buf, cursor, 8);
      cursor.pos += 8;
      return;
    case NBT_TAG_BYTE_ARRAY: {
      const length = nbtReadI32(buf, cursor);
      if (length < 0) throw new RangeError('NBT 数组长度为负');
      nbtNeed(buf, cursor, length);
      cursor.pos += length;
      return;
    }
    case NBT_TAG_STRING: {
      const length = nbtReadU16(buf, cursor);
      nbtNeed(buf, cursor, length);
      cursor.pos += length;
      return;
    }
    case NBT_TAG_INT_ARRAY: {
      const length = nbtReadI32(buf, cursor);
      if (length < 0) throw new RangeError('NBT 数组长度为负');
      nbtNeed(buf, cursor, length * 4);
      cursor.pos += length * 4;
      return;
    }
    case NBT_TAG_LONG_ARRAY: {
      const length = nbtReadI32(buf, cursor);
      if (length < 0) throw new RangeError('NBT 数组长度为负');
      nbtNeed(buf, cursor, length * 8);
      cursor.pos += length * 8;
      return;
    }
    case NBT_TAG_LIST: {
      const elementType = nbtReadU8(buf, cursor);
      const length = nbtReadI32(buf, cursor);
      if (length < 0) throw new RangeError('NBT 列表长度为负');
      for (let i = 0; i < length; i += 1) nbtSkipPayload(buf, cursor, elementType);
      return;
    }
    case NBT_TAG_COMPOUND: {
      while (true) {
        const childType = nbtReadU8(buf, cursor);
        if (childType === NBT_TAG_END) return;
        nbtReadString(buf, cursor); // 子标签名（跳过）
        nbtSkipPayload(buf, cursor, childType);
      }
    }
    default:
      throw new RangeError(`未知 NBT 标签类型：${tagType}`);
  }
}

/** 解析 NBT 根 compound 中的 Data.LevelName；任何异常都返回 null */
function parseLevelNameFromNbt(buf: Buffer): string | null {
  try {
    const cursor: NbtCursor = { pos: 0 };
    const rootType = nbtReadU8(buf, cursor);
    nbtReadString(buf, cursor); // 根标签名（通常为空串）
    if (rootType !== NBT_TAG_COMPOUND) return null;
    while (true) {
      const tagType = nbtReadU8(buf, cursor);
      if (tagType === NBT_TAG_END) return null;
      const tagName = nbtReadString(buf, cursor);
      if (tagType === NBT_TAG_COMPOUND && tagName === 'Data') {
        // LevelName 是 Data 的直接子标签，逐项扫描即可
        while (true) {
          const childType = nbtReadU8(buf, cursor);
          if (childType === NBT_TAG_END) return null;
          const childName = nbtReadString(buf, cursor);
          if (childType === NBT_TAG_STRING && childName === 'LevelName') {
            const levelName = nbtReadString(buf, cursor).trim();
            return levelName || null;
          }
          nbtSkipPayload(buf, cursor, childType);
        }
      }
      nbtSkipPayload(buf, cursor, tagType);
    }
  } catch {
    return null;
  }
}

/** 读取 level.dat 的存档名：自动识别 gzip（Java 版默认）与未压缩 NBT，失败返回 null */
function readLevelName(levelDatPath: string): string | null {
  try {
    const raw = fs.readFileSync(levelDatPath);
    if (raw.length === 0) return null;
    // gzip 魔数 0x1f 0x8b；否则按未压缩 NBT 尝试
    const nbt = raw.length >= 2 && raw[0] === 0x1f && raw[1] === 0x8b ? zlib.gunzipSync(raw) : raw;
    return parseLevelNameFromNbt(nbt);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 存档
// ---------------------------------------------------------------------------

/** 扫描 saves/*，按最后修改时间倒序返回；saves 不存在时返回空数组 */
export function listInstanceSaves(instancePath: string): SaveInfo[] {
  const basePath = normalizeInstancePath(instancePath);
  if (!basePath) return [];
  const savesDir = path.join(basePath, SAVES_DIR);
  const startedAt = Date.now();
  const saves: SaveInfo[] = [];

  for (const entry of safeReaddir(savesDir)) {
    if (!entry.isDirectory()) continue;
    const dirPath = path.join(savesDir, entry.name);
    const levelDatPath = path.join(dirPath, 'level.dat');
    let hasLevelDat = false;
    let levelName = entry.name; // 解析失败回退目录名
    let levelDatMtime = 0;
    try {
      const stat = fs.statSync(levelDatPath);
      if (stat.isFile()) {
        hasLevelDat = true;
        levelDatMtime = stat.mtimeMs;
        const parsed = readLevelName(levelDatPath);
        if (parsed) levelName = parsed;
      }
    } catch {
      // level.dat 不存在 / 不可读：按无 level.dat 处理
    }
    const dirStat = safeStat(dirPath);
    // mtimeMs 是带小数的毫秒数，取整后交给渲染端（避免 IPC 里出现 1792857620957.0803 这种值）
    const lastModified = Math.round(levelDatMtime || dirStat?.mtimeMs || 0);
    const iconPath = path.join(dirPath, 'icon.png');
    saves.push({
      dirName: entry.name,
      dirPath,
      levelName,
      hasLevelDat,
      sizeBytes: dirSizeBytes(dirPath),
      lastModified,
      iconDataUrl: makeThumbDataUrl(iconPath, SAVE_ICON_SIZE),
    });
  }

  saves.sort((a, b) => b.lastModified - a.lastModified);
  log.debug(`扫描存档完成：${saves.length} 个（${Date.now() - startedAt}ms）`, savesDir);
  return saves;
}

/** 删除 saves/ 下的指定存档目录；目录不存在视为已删除（幂等），失败项收集后返回 */
export function deleteInstanceSaves(instancePath: string, dirNames: string[]): DeleteResult {
  const result = EMPTY_DELETE_RESULT();
  const basePath = normalizeInstancePath(instancePath);
  if (!basePath || !Array.isArray(dirNames)) return result;
  const savesDir = path.join(basePath, SAVES_DIR);

  for (const dirName of new Set(dirNames)) {
    const target = resolveChildPath(savesDir, dirName);
    if (!target) {
      result.failed.push({ name: String(dirName), error: '非法目录名（疑似目录穿越）' });
      continue;
    }
    if (!fs.existsSync(target)) {
      // 文件/目录不存在按空处理：删除是幂等的，重复删除不报错
      result.deleted.push(dirName);
      continue;
    }
    const stat = safeStat(target);
    if (!stat || !stat.isDirectory()) {
      result.failed.push({ name: dirName, error: '目标不是存档目录' });
      continue;
    }
    try {
      fs.rmSync(target, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 });
      result.deleted.push(dirName);
    } catch (e) {
      result.failed.push({ name: dirName, error: e instanceof Error ? e.message : String(e) });
      log.warn(`删除存档失败：${target}`, e);
    }
  }
  return result;
}

/**
 * 备份 saves/ 下的指定存档目录到 `<实例>/backups/saves/<存档名>-<yyyyMMdd-HHmmss>/`。
 * @returns 成功创建的备份目录绝对路径列表（失败项只记日志，不抛错）
 */
export function backupInstanceSaves(instancePath: string, dirNames: string[]): string[] {
  const basePath = normalizeInstancePath(instancePath);
  if (!basePath || !Array.isArray(dirNames)) return [];
  const savesDir = path.join(basePath, SAVES_DIR);
  const backupRoot = path.join(basePath, BACKUP_DIR);
  const backupPaths: string[] = [];

  for (const dirName of new Set(dirNames)) {
    const source = resolveChildPath(savesDir, dirName);
    if (!source) {
      log.warn('备份存档：非法目录名，已跳过', dirName);
      continue;
    }
    if (!fs.existsSync(source)) {
      log.debug('备份存档：目录不存在，已跳过', source);
      continue;
    }
    let dest: string | null = null;
    try {
      dest = uniquePath(path.join(backupRoot, `${dirName}-${formatTimestamp(new Date())}`));
      copyDirRecursive(source, dest);
      backupPaths.push(dest);
      log.info(`存档已备份：${source} → ${dest}`);
    } catch (e) {
      // 半成品备份没有价值：清理失败目录，避免用户看到不完整备份
      if (dest) {
        try {
          fs.rmSync(dest, { recursive: true, force: true, maxRetries: 1, retryDelay: 100 });
        } catch {
          // 清理失败也不影响其它存档的备份
        }
      }
      log.warn(`备份存档失败：${source}`, e);
    }
  }
  return backupPaths;
}

// ---------------------------------------------------------------------------
// 截图
// ---------------------------------------------------------------------------

const SCREENSHOT_EXTS = ['.png', '.jpg', '.jpeg'];

function isScreenshotFile(fileName: string): boolean {
  return SCREENSHOT_EXTS.some((ext) => fileName.toLowerCase().endsWith(ext));
}

/** 扫描 screenshots/*.png|jpg|jpeg，按修改时间倒序；返回 320px 宽缩略图 dataURL */
export function listInstanceScreenshots(instancePath: string): ScreenshotInfo[] {
  const basePath = normalizeInstancePath(instancePath);
  if (!basePath) return [];
  const screenshotsDir = path.join(basePath, SCREENSHOTS_DIR);
  const startedAt = Date.now();
  const screenshots: ScreenshotInfo[] = [];

  for (const entry of safeReaddir(screenshotsDir)) {
    if (!entry.isFile() || !isScreenshotFile(entry.name)) continue;
    const filePath = path.join(screenshotsDir, entry.name);
    const stat = safeStat(filePath);
    if (!stat) continue;
    screenshots.push({
      fileName: entry.name,
      filePath,
      sizeBytes: stat.size,
      mtime: Math.round(stat.mtimeMs),
      thumbDataUrl: makeThumbDataUrl(filePath, SCREENSHOT_THUMB_WIDTH),
    });
  }

  screenshots.sort((a, b) => b.mtime - a.mtime);
  log.debug(`扫描截图完成：${screenshots.length} 张（${Date.now() - startedAt}ms）`, screenshotsDir);
  return screenshots;
}

/** 删除 screenshots/ 下的指定截图文件；文件不存在视为已删除（幂等） */
export function deleteInstanceScreenshots(instancePath: string, fileNames: string[]): DeleteResult {
  const result = EMPTY_DELETE_RESULT();
  const basePath = normalizeInstancePath(instancePath);
  if (!basePath || !Array.isArray(fileNames)) return result;
  const screenshotsDir = path.join(basePath, SCREENSHOTS_DIR);

  for (const fileName of new Set(fileNames)) {
    const target = resolveChildPath(screenshotsDir, fileName);
    if (!target) {
      result.failed.push({ name: String(fileName), error: '非法文件名（疑似目录穿越）' });
      continue;
    }
    if (!fs.existsSync(target)) {
      result.deleted.push(fileName);
      continue;
    }
    const stat = safeStat(target);
    if (!stat || !stat.isFile()) {
      result.failed.push({ name: fileName, error: '目标不是截图文件' });
      continue;
    }
    try {
      fs.rmSync(target, { force: true });
      result.deleted.push(fileName);
    } catch (e) {
      result.failed.push({ name: fileName, error: e instanceof Error ? e.message : String(e) });
      log.warn(`删除截图失败：${target}`, e);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// 资源包 / 光影包（只读）
// ---------------------------------------------------------------------------

/** PCL-CE 语义：.disabled（玩家禁用）/ .old（更新前旧文件）都视为未启用 */
const PACK_DISABLED_SUFFIXES = ['.disabled', '.old'];

/** 拆出展示名与启用状态（fileName 保留磁盘原名） */
function splitPackFileName(fileName: string): { rawFileName: string; enabled: boolean } {
  const lower = fileName.toLowerCase();
  for (const suffix of PACK_DISABLED_SUFFIXES) {
    if (lower.endsWith(suffix)) {
      return { rawFileName: fileName.slice(0, fileName.length - suffix.length), enabled: false };
    }
  }
  return { rawFileName: fileName, enabled: true };
}

const RESOURCEPACK_EXTS = ['.zip', '.jar'];
const SHADERPACK_EXTS = ['.zip'];

function isPackFile(fileName: string, exts: string[]): boolean {
  const { rawFileName } = splitPackFileName(fileName);
  const lower = rawFileName.toLowerCase();
  return exts.some((ext) => lower.endsWith(ext));
}

/** 收集某个包目录下的包文件 */
function collectPacks(
  packDir: string,
  kind: ResourcePackKind,
  exts: string[],
  output: ResourcePackInfo[]
): void {
  for (const entry of safeReaddir(packDir)) {
    if (!entry.isFile() || !isPackFile(entry.name, exts)) continue;
    const filePath = path.join(packDir, entry.name);
    const stat = safeStat(filePath);
    if (!stat) continue;
    const { rawFileName, enabled } = splitPackFileName(entry.name);
    output.push({
      fileName: entry.name,
      rawFileName,
      filePath,
      kind,
      sizeBytes: stat.size,
      enabled,
      mtime: Math.round(stat.mtimeMs),
    });
  }
}

/**
 * 扫描 resourcepacks/（.zip / .jar）与 shaderpacks/（.zip），返回启用状态。
 * 只读：不修改文件名，不实现启停（启用/禁用由后续 UI + 独立 IPC 负责）。
 */
export function listInstanceResourcePacks(instancePath: string): ResourcePackInfo[] {
  const basePath = normalizeInstancePath(instancePath);
  if (!basePath) return [];
  const packs: ResourcePackInfo[] = [];
  collectPacks(path.join(basePath, RESOURCEPACKS_DIR), 'resourcepack', RESOURCEPACK_EXTS, packs);
  collectPacks(path.join(basePath, SHADERPACKS_DIR), 'shaderpack', SHADERPACK_EXTS, packs);
  // 资源包在前、光影包在后；同类按展示名排序
  const kindOrder: Record<ResourcePackKind, number> = { resourcepack: 0, shaderpack: 1 };
  packs.sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind] || a.rawFileName.localeCompare(b.rawFileName));
  log.debug(`扫描资源包完成：${packs.length} 个`, basePath);
  return packs;
}
