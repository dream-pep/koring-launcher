/**
 * 实例模组本地管理（主进程）。
 *
 * 只负责「实例目录下 mods/ 文件夹」的清单、启用/禁用、删除，不做下载、不写 UI。
 *
 * ── 启用/禁用语义（依据 PCL-CE 源码确认）──
 * - 禁用 = 文件名追加 `.disabled` 后缀；启用 = 去掉该后缀。
 *   依据：`D:\github-code-plan\PCL-CE\Plain Craft Launcher 2\Pages\PageInstance\
 *   PageInstanceCompResource.xaml.cs` 第 2054-2061 行：
 *   `if (State == Fine && !isEnable) newPath = path + ".disabled";`
 *   `else if (State == Disabled && isEnable) newPath = RawPath;`
 * - PCL 同时把 `.old` 后缀也视为「已禁用」（`Modules\Minecraft\ModLocalComp.cs`
 *   第 415-425 行：`if (path.EndsWithF(".disabled", true) || path.EndsWithF(".old", true))
 *   return LocalFileStatus.Disabled;`）。因此本模块列表时把 `.old` 也归入 disabled，
 *   启用时一并去掉 `.old`。
 * - 可识别的 Mod 文件扩展名同样照抄 PCL `ModLocalComp.cs` 第 37-48 行：
 *   `.jar` / `.zip` / `.litemod`（含对应 `.disabled` / `.old` 形式）。
 *
 * ── jar 元数据解析 ──
 * 不引入任何 zip 依赖：用 Node 内置 `fs` 读取 zip 中央目录 + `node:zlib` 的
 * `inflateRawSync` 解压目标条目，只取元数据 JSON/TOML 与图标，不整包解压。
 * 解析失败（非 zip、zip64、条目损坏）时回退文件名并标记 `metaParsed: false`。
 * 图标缩略图用 Electron 的 `nativeImage` 生成 64px dataURL；非 Electron 运行时
 * （如单元自测脚本）拿不到 nativeImage，则跳过图标，不影响其余字段。
 *
 * ── 安全 ──
 * 所有入参文件名一律先过 `sanitizeModFileName`：只允许 basename、拒绝 `..`、路径
 * 分隔符与非法字符，且必须是 Mod 文件；越权/不存在一律跳过而不是抛错。
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import electron from 'electron';
import { createLogger } from './logger';

const log = createLogger('instance-mods');

/** Mod 加载器标识；`unknown` = 元数据缺失或无法识别 */
export type LocalModLoader = 'fabric' | 'quilt' | 'forge' | 'neoforge' | 'unknown';

/** 单个本地 Mod 文件的信息 */
export interface LocalModInfo {
  /** 磁盘上的真实文件名（禁用时含 `.disabled` / `.old` 后缀） */
  fileName: string;
  /** 绝对路径 */
  filePath: string;
  /** 是否启用 */
  enabled: boolean;
  /** 文件字节数 */
  sizeBytes: number;
  /** 展示名：优先 jar 内元数据，失败时回退文件名（去后缀/扩展名） */
  displayName: string;
  /** 版本号；解析不到为空串 */
  version: string;
  /** 加载器；解析不到为 `unknown` */
  modLoader: LocalModLoader;
  /** 简介；解析不到为空串 */
  description: string;
  /** 是否成功从 jar 内解析出元数据 */
  metaParsed: boolean;
  /** 64px 图标缩略图 dataURL（仅在 Electron 运行时且 jar 内有图标时提供） */
  iconDataUrl?: string;
}

/** `listInstanceMods` 的结果：启用与禁用分开返回 */
export interface InstanceModsList {
  mods: LocalModInfo[];
  disabled: LocalModInfo[];
}

/**
 * 启用/禁用/删除的结果。
 * `changed` 为操作成功后的文件名（禁用后带 `.disabled`；删除后即被删文件名），
 * `skipped` 为未操作的文件名（不存在 / 状态已符合 / 目标重名 / 非法文件名）。
 */
export interface InstanceModsChangeResult {
  changed: string[];
  skipped: string[];
}

// ==================== 文件类型判定（PCL 语义） ====================

/** PCL `ModLocalComp.IsModFile` 认可的扩展名 */
const MOD_EXTENSIONS = ['.jar', '.zip', '.litemod'];

/** 视为「已禁用」的后缀（PCL 的 LocalFileStatus.Disabled 判定） */
const DISABLED_SUFFIXES = ['.disabled', '.old'];

/** 拆分禁用后缀与主文件名 */
function splitDisabledSuffix(fileName: string): { base: string; disabled: boolean } {
  const lower = fileName.toLowerCase();
  for (const suffix of DISABLED_SUFFIXES) {
    if (lower.endsWith(suffix)) {
      return { base: fileName.slice(0, fileName.length - suffix.length), disabled: true };
    }
  }
  return { base: fileName, disabled: false };
}

/** 判断是否为 Mod 文件（含 `.disabled` / `.old` 形式） */
function isModFileName(fileName: string): boolean {
  const lower = splitDisabledSuffix(fileName).base.toLowerCase();
  return MOD_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** 由真实文件名得到「展示用默认名」：去掉禁用后缀与 `.jar/.zip/.litemod` 扩展名 */
function fallbackDisplayName(fileName: string): string {
  const { base } = splitDisabledSuffix(fileName);
  const lower = base.toLowerCase();
  for (const ext of MOD_EXTENSIONS) {
    if (lower.endsWith(ext)) return base.slice(0, base.length - ext.length) || base;
  }
  return base;
}

/**
 * 入参文件名安全校验：只允许 mods/ 下的直接文件名。
 * @returns 规范化后的文件名；不合法返回 null（调用方按「跳过」处理）
 */
function sanitizeModFileName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim();
  if (!name) return null;
  // 只允许 basename：`path.basename` 会吃掉目录部分，与原文不同即视为路径穿越
  if (path.basename(name) !== name) return null;
  if (name === '.' || name === '..' || name.startsWith('.')) return null;
  // Windows 非法字符 + 跨平台统一拒绝的路径分隔符
  if (/[\\/:*?"<>|\u0000-\u001f]/.test(name)) return null;
  if (!isModFileName(name)) return null;
  return name;
}

// ==================== zip 最小读取器（内置能力，无依赖） ====================

const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_SIGNATURE = 0x04034b50;
/** 中央目录最大读取量（防伪造超大的 cdSize 撑爆内存） */
const MAX_CENTRAL_DIRECTORY_BYTES = 16 * 1024 * 1024;
/** 元数据条目解压上限 */
const MAX_METADATA_BYTES = 2 * 1024 * 1024;
/** 图标条目解压上限 */
const MAX_ICON_BYTES = 4 * 1024 * 1024;
/** 图标缩略图边长 */
const ICON_SIZE = 64;

interface ZipEntry {
  /** 条目在 zip 内的原始路径（统一用 `/`） */
  name: string;
  /** 0 = 存储，8 = deflate */
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

interface ZipArchive {
  fd: number;
  size: number;
  /** key = 小写条目名，便于大小写不敏感查找 */
  entries: Map<string, ZipEntry>;
}

/** 从 fd 读取指定区间；读不满视为失败 */
function readRange(fd: number, position: number, length: number): Buffer | null {
  if (length <= 0 || position < 0) return null;
  const buffer = Buffer.allocUnsafe(length);
  let read = 0;
  try {
    while (read < length) {
      const n = fs.readSync(fd, buffer, read, length - read, position + read);
      if (n <= 0) break;
      read += n;
    }
  } catch {
    return null;
  }
  return read === length ? buffer : null;
}

/**
 * 打开 zip 并解析中央目录（只读索引，不解压）。
 * 非 zip / 损坏 / zip64 时返回 null。
 */
function openZipArchive(filePath: string): ZipArchive | null {
  let fd: number | null = null;
  try {
    fd = fs.openSync(filePath, 'r');
    const size = fs.fstatSync(fd).size;
    if (size < 22) return null;

    // EOCD 结构最小 22 字节，注释最长 65535 字节，因此只需要看文件尾 64KB
    const tailLength = Math.min(size, 22 + 0xffff);
    const tail = readRange(fd, size - tailLength, tailLength);
    if (!tail) return null;

    let eocd = -1;
    for (let i = tail.length - 22; i >= 0; i -= 1) {
      if (tail.readUInt32LE(i) === ZIP_EOCD_SIGNATURE) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) return null;

    const entryCount = tail.readUInt16LE(eocd + 10);
    const centralDirectorySize = tail.readUInt32LE(eocd + 12);
    const centralDirectoryOffset = tail.readUInt32LE(eocd + 16);
    // zip64 占位值（0xFFFF/0xFFFFFFFF）不支持：回退文件名即可
    if (
      entryCount === 0xffff ||
      centralDirectorySize === 0xffffffff ||
      centralDirectoryOffset === 0xffffffff
    ) {
      return null;
    }
    if (centralDirectorySize > MAX_CENTRAL_DIRECTORY_BYTES) return null;
    if (centralDirectoryOffset + centralDirectorySize > size) return null;

    const centralDirectory = readRange(fd, centralDirectoryOffset, centralDirectorySize);
    if (!centralDirectory) return null;

    const entries = new Map<string, ZipEntry>();
    let offset = 0;
    while (offset + 46 <= centralDirectory.length) {
      if (centralDirectory.readUInt32LE(offset) !== ZIP_CENTRAL_SIGNATURE) break;
      const method = centralDirectory.readUInt16LE(offset + 10);
      const compressedSize = centralDirectory.readUInt32LE(offset + 20);
      const uncompressedSize = centralDirectory.readUInt32LE(offset + 24);
      const nameLength = centralDirectory.readUInt16LE(offset + 28);
      const extraLength = centralDirectory.readUInt16LE(offset + 30);
      const commentLength = centralDirectory.readUInt16LE(offset + 32);
      const localHeaderOffset = centralDirectory.readUInt32LE(offset + 42);
      if (offset + 46 + nameLength > centralDirectory.length) break;

      const name = centralDirectory
        .toString('utf8', offset + 46, offset + 46 + nameLength)
        .replace(/\\/g, '/');
      entries.set(name.toLowerCase(), {
        name,
        method,
        compressedSize,
        uncompressedSize,
        localHeaderOffset,
      });

      offset += 46 + nameLength + extraLength + commentLength;
    }

    if (!entries.size) return null;
    return { fd, size, entries };
  } catch {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {
        // 关闭失败忽略
      }
    }
    return null;
  }
}

function closeZipArchive(archive: ZipArchive): void {
  try {
    fs.closeSync(archive.fd);
  } catch {
    // 关闭失败忽略
  }
}

/** 大小写不敏感地取条目 */
function findZipEntry(archive: ZipArchive, entryName: string): ZipEntry | null {
  const normalized = entryName.replace(/\\/g, '/').replace(/^\/+/, '');
  return archive.entries.get(normalized.toLowerCase()) ?? null;
}

/** 读取并解压单个条目；超过 `maxBytes` 或方法不支持时返回 null */
function readZipEntry(archive: ZipArchive, entry: ZipEntry, maxBytes: number): Buffer | null {
  if (entry.uncompressedSize > maxBytes) return null;
  // 本地文件头长度固定 30 字节；文件名/扩展区长度可能与中央目录不同，必须重读
  const header = readRange(archive.fd, entry.localHeaderOffset, 30);
  if (!header || header.readUInt32LE(0) !== ZIP_LOCAL_SIGNATURE) return null;
  const nameLength = header.readUInt16LE(26);
  const extraLength = header.readUInt16LE(28);
  const dataOffset = entry.localHeaderOffset + 30 + nameLength + extraLength;
  if (entry.compressedSize <= 0 || dataOffset + entry.compressedSize > archive.size) return null;

  const raw = readRange(archive.fd, dataOffset, entry.compressedSize);
  if (!raw) return null;
  try {
    // 方法 0 = 存储，方法 8 = deflate；其他（bzip2/lzma）不支持
    if (entry.method === 0) return raw;
    if (entry.method === 8) return zlib.inflateRawSync(raw, { maxOutputLength: maxBytes });
  } catch {
    return null;
  }
  return null;
}

// ==================== jar 元数据解析 ====================

interface ModMetadata {
  displayName: string;
  version: string;
  modLoader: LocalModLoader;
  description: string;
  /** jar 内图标路径（尚未确认是否存在） */
  iconEntryName?: string;
  /** 是否成功解析出至少一项元数据 */
  parsed: boolean;
}

/** 合并多余空白（TOML 多行描述、JSON 里的换行），便于列表展示 */
function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function readJsonText(archive: ZipArchive, entryName: string): unknown {
  const entry = findZipEntry(archive, entryName);
  if (!entry) return null;
  const buffer = readZipEntry(archive, entry, MAX_METADATA_BYTES);
  if (!buffer) return null;
  try {
    return JSON.parse(buffer.toString('utf8').replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
}

function readTextEntry(archive: ZipArchive, entryName: string): string | null {
  const entry = findZipEntry(archive, entryName);
  if (!entry) return null;
  const buffer = readZipEntry(archive, entry, MAX_METADATA_BYTES);
  return buffer ? buffer.toString('utf8').replace(/^\uFEFF/, '') : null;
}

/** 从 fabric.mod.json 的 `icon` 字段取图标路径（支持字符串与 {尺寸: 路径} 映射） */
function pickFabricIcon(icon: unknown): string | undefined {
  if (typeof icon === 'string') return icon;
  if (icon && typeof icon === 'object') {
    const map = icon as Record<string, unknown>;
    // 优先 128/64 等较大尺寸，取不到就用第一个可用值
    for (const key of ['128', '256', '64', '32']) {
      const value = map[key];
      if (typeof value === 'string' && value) return value;
    }
    for (const value of Object.values(map)) {
      if (typeof value === 'string' && value) return value;
    }
  }
  return undefined;
}

/** 解析 fabric.mod.json / quilt.mod.json（两者都是 JSON） */
function parseFabricLikeJson(archive: ZipArchive, entryName: string, loader: LocalModLoader): ModMetadata | null {
  const json = readJsonText(archive, entryName);
  if (!json || typeof json !== 'object') return null;
  const record = json as Record<string, unknown>;

  if (loader === 'quilt') {
    const quiltLoader = record.quilt_loader as Record<string, unknown> | undefined;
    const metadata = (quiltLoader?.metadata ?? {}) as Record<string, unknown>;
    const parsed: ModMetadata = {
      displayName: cleanText(metadata.name),
      version: cleanText(quiltLoader?.version),
      modLoader: 'quilt',
      description: cleanText(metadata.description),
      iconEntryName: pickFabricIcon(metadata.icon),
      parsed: false,
    };
    parsed.parsed = Boolean(parsed.displayName || parsed.version || parsed.description);
    return parsed;
  }

  const parsed: ModMetadata = {
    displayName: cleanText(record.name) || cleanText(record.id),
    version: cleanText(record.version),
    modLoader: 'fabric',
    description: cleanText(record.description),
    iconEntryName: pickFabricIcon(record.icon),
    parsed: false,
  };
  parsed.parsed = Boolean(parsed.displayName || parsed.version || parsed.description);
  return parsed;
}

/** 宽松解析 TOML 的单个字符串键（支持 "…"、'…' 与 '''…''' 多行） */
function readTomlString(text: string, key: string): string | undefined {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // 多行三引号优先
  const multiline = new RegExp(`^\\s*${escaped}\\s*=\\s*'''([\\s\\S]*?)'''`, 'm').exec(text);
  if (multiline) return cleanText(multiline[1]);
  const single = new RegExp(`^\\s*${escaped}\\s*=\\s*(?:"([^"\\n]*)"|'([^'\\n]*)')`, 'm').exec(text);
  if (single) return cleanText(single[1] ?? single[2]);
  return undefined;
}

/** 解析 META-INF/mods.toml（Forge）与 META-INF/neoforge.mods.toml（NeoForge） */
function parseTomlMetadata(text: string, loader: LocalModLoader): ModMetadata | null {
  // 只看第一个 [[mods]] 块：多 Mod 的 jar 极少见，首个即主 Mod
  const blockStart = text.search(/^\s*\[\[mods\]\]/m);
  const scope = blockStart >= 0 ? text.slice(blockStart) : text;

  const parsed: ModMetadata = {
    displayName: readTomlString(scope, 'displayName') ?? readTomlString(scope, 'modId') ?? '',
    version: readTomlString(scope, 'version') ?? '',
    modLoader: loader,
    description: readTomlString(scope, 'description') ?? '',
    iconEntryName: readTomlString(scope, 'logoFile'),
    parsed: false,
  };
  parsed.parsed = Boolean(parsed.displayName || parsed.version || parsed.description);
  return parsed.parsed ? parsed : null;
}

/** 解析旧版 Forge 的 mcmod.info（数组或 { modList: [] }） */
function parseMcmodInfo(archive: ZipArchive): ModMetadata | null {
  const json = readJsonText(archive, 'mcmod.info');
  if (!json) return null;
  let list: unknown[] = [];
  if (Array.isArray(json)) {
    list = json;
  } else if (json && typeof json === 'object') {
    const modList = (json as Record<string, unknown>).modList;
    if (Array.isArray(modList)) list = modList;
  }
  const first = list.find((item) => item && typeof item === 'object') as Record<string, unknown> | undefined;
  if (!first) return null;

  const parsed: ModMetadata = {
    displayName: cleanText(first.name) || cleanText(first.modid),
    version: cleanText(first.version),
    modLoader: 'forge',
    description: cleanText(first.description),
    iconEntryName: typeof first.logoFile === 'string' && first.logoFile ? first.logoFile : undefined,
    parsed: false,
  };
  parsed.parsed = Boolean(parsed.displayName || parsed.version || parsed.description);
  return parsed.parsed ? parsed : null;
}

/**
 * 依次尝试各加载器的元数据文件（与 PCL 的识别顺序一致的常见优先级）。
 * 注意 Quilt 的 jar 也常带 fabric.mod.json，这里先查 quilt.mod.json 更准确。
 */
function parseModMetadata(archive: ZipArchive): ModMetadata | null {
  const quilt = parseFabricLikeJson(archive, 'quilt.mod.json', 'quilt');
  if (quilt) return quilt;

  const fabric = parseFabricLikeJson(archive, 'fabric.mod.json', 'fabric');
  if (fabric) return fabric;

  const neoForgeText = readTextEntry(archive, 'META-INF/neoforge.mods.toml');
  if (neoForgeText) {
    const parsed = parseTomlMetadata(neoForgeText, 'neoforge');
    if (parsed) return parsed;
  }

  const forgeText = readTextEntry(archive, 'META-INF/mods.toml');
  if (forgeText) {
    const parsed = parseTomlMetadata(forgeText, 'forge');
    if (parsed) return parsed;
  }

  return parseMcmodInfo(archive);
}

// ==================== 图标缩略图 ====================

/**
 * 用 Electron `nativeImage` 把 jar 内图标压成 64px dataURL。
 * 非 Electron 运行时（自测脚本）`nativeImage` 不可用，返回 undefined。
 */
function createModIconDataUrl(buffer: Buffer): string | undefined {
  try {
    const nativeImage = electron?.nativeImage;
    if (!nativeImage || typeof nativeImage.createFromBuffer !== 'function') return undefined;
    let image = nativeImage.createFromBuffer(buffer);
    if (!image || image.isEmpty()) return undefined;
    const size = image.getSize();
    if (size.width > ICON_SIZE || size.height > ICON_SIZE) {
      image = image.resize({ width: ICON_SIZE, height: ICON_SIZE, quality: 'good' });
    }
    const dataUrl = image.toDataURL();
    return dataUrl && dataUrl.startsWith('data:image/') ? dataUrl : undefined;
  } catch {
    // 图标格式不受支持 / 解码失败：不影响清单
    return undefined;
  }
}

// ==================== 单个 Mod 信息 ====================

function buildLocalModInfo(modsDir: string, fileName: string): LocalModInfo {
  const filePath = path.join(modsDir, fileName);
  const stat = fs.statSync(filePath);
  const { disabled } = splitDisabledSuffix(fileName);
  const info: LocalModInfo = {
    fileName,
    filePath,
    enabled: !disabled,
    sizeBytes: stat.size,
    displayName: fallbackDisplayName(fileName),
    version: '',
    modLoader: 'unknown',
    description: '',
    metaParsed: false,
  };

  const archive = openZipArchive(filePath);
  if (!archive) return info;
  try {
    const metadata = parseModMetadata(archive);
    if (metadata) {
      info.displayName = metadata.displayName || info.displayName;
      info.version = metadata.version;
      info.modLoader = metadata.modLoader;
      info.description = metadata.description;
      info.metaParsed = metadata.parsed;
      if (metadata.iconEntryName) {
        const iconEntry = findZipEntry(archive, metadata.iconEntryName);
        if (iconEntry) {
          const iconBuffer = readZipEntry(archive, iconEntry, MAX_ICON_BYTES);
          if (iconBuffer) info.iconDataUrl = createModIconDataUrl(iconBuffer);
        }
      }
    }
  } catch (error) {
    log.debug('解析 jar 元数据失败，回退文件名', fileName, error);
  } finally {
    closeZipArchive(archive);
  }
  return info;
}

// ==================== 对外 API ====================

/** 实例的 mods 目录（不保证存在） */
function getModsDir(instancePath: string): string {
  return path.join(path.resolve(instancePath), 'mods');
}

function isDirectory(target: string): boolean {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function isFile(target: string): boolean {
  try {
    return fs.statSync(target).isFile();
  } catch {
    return false;
  }
}

/**
 * 列出实例内所有本地 Mod：启用放 `mods`，禁用（`.disabled` / `.old`）放 `disabled`。
 * mods 目录不存在时返回空清单（不抛错）。结果按展示名排序。
 */
export function listInstanceMods(instancePath: string): InstanceModsList {
  const result: InstanceModsList = { mods: [], disabled: [] };
  const modsDir = getModsDir(instancePath);
  if (!isDirectory(modsDir)) {
    log.debug('mods 目录不存在，返回空清单', modsDir);
    return result;
  }

  const started = Date.now();
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(modsDir, { withFileTypes: true });
  } catch (error) {
    log.warn('读取 mods 目录失败', modsDir, error);
    return result;
  }

  for (const entry of entries) {
    // PCL 也支持文件夹形式的 Mod，本模块只管理文件
    if (!entry.isFile()) continue;
    if (!isModFileName(entry.name)) continue;
    if (entry.name.startsWith('.')) continue;
    try {
      const info = buildLocalModInfo(modsDir, entry.name);
      (info.enabled ? result.mods : result.disabled).push(info);
    } catch (error) {
      // 单个文件读坏了不影响其它 Mod
      log.warn('读取 Mod 文件失败，已跳过', entry.name, error);
    }
  }

  const byName = (a: LocalModInfo, b: LocalModInfo) => a.displayName.localeCompare(b.displayName);
  result.mods.sort(byName);
  result.disabled.sort(byName);
  log.debug(
    `已扫描 ${modsDir}：启用 ${result.mods.length}，禁用 ${result.disabled.length}（${Date.now() - started}ms）`
  );
  return result;
}

/**
 * 批量启用/禁用。
 * 禁用 = 追加 `.disabled`；启用 = 去掉 `.disabled` / `.old`（PCL 语义）。
 * 文件不存在、状态已符合、目标重名、非法文件名都跳过而不抛错。
 */
export function setInstanceModsEnabled(
  instancePath: string,
  fileNames: string[],
  enabled: boolean
): InstanceModsChangeResult {
  const modsDir = getModsDir(instancePath);
  const result: InstanceModsChangeResult = { changed: [], skipped: [] };
  if (!isDirectory(modsDir)) {
    result.skipped.push(...(Array.isArray(fileNames) ? fileNames.filter((n) => typeof n === 'string') : []));
    return result;
  }

  const names = Array.isArray(fileNames) ? fileNames : [];
  for (const rawName of names) {
    const fileName = sanitizeModFileName(rawName);
    if (!fileName) {
      result.skipped.push(String(rawName));
      log.warn('忽略非法 Mod 文件名（疑似路径穿越）', rawName);
      continue;
    }

    const currentPath = path.join(modsDir, fileName);
    if (!isFile(currentPath)) {
      result.skipped.push(fileName);
      continue;
    }

    const { base, disabled } = splitDisabledSuffix(fileName);
    // 状态已符合要求：无需改名
    if (disabled === !enabled) {
      result.skipped.push(fileName);
      continue;
    }

    const targetName = enabled ? base : `${fileName}.disabled`;
    const targetPath = path.join(modsDir, targetName);
    if (path.dirname(targetPath) !== modsDir || !isModFileName(targetName)) {
      result.skipped.push(fileName);
      continue;
    }
    // PCL 遇到目标名已存在时会提示冲突；这里不覆盖用户文件，直接跳过
    if (isFile(targetPath)) {
      result.skipped.push(fileName);
      log.warn('目标文件名已存在，跳过改名', fileName, '→', targetName);
      continue;
    }

    try {
      fs.renameSync(currentPath, targetPath);
      result.changed.push(targetName);
      log.info(`${enabled ? '启用' : '禁用'} Mod：${fileName} → ${targetName}`);
    } catch (error) {
      result.skipped.push(fileName);
      log.warn('改名失败，已跳过', fileName, error);
    }
  }
  return result;
}

/** 批量删除 Mod 文件；不存在或非法文件名跳过而不抛错 */
export function deleteInstanceMods(instancePath: string, fileNames: string[]): InstanceModsChangeResult {
  const modsDir = getModsDir(instancePath);
  const result: InstanceModsChangeResult = { changed: [], skipped: [] };
  if (!isDirectory(modsDir)) {
    result.skipped.push(...(Array.isArray(fileNames) ? fileNames.filter((n) => typeof n === 'string') : []));
    return result;
  }

  const names = Array.isArray(fileNames) ? fileNames : [];
  for (const rawName of names) {
    const fileName = sanitizeModFileName(rawName);
    if (!fileName) {
      result.skipped.push(String(rawName));
      log.warn('忽略非法 Mod 文件名（疑似路径穿越）', rawName);
      continue;
    }
    const filePath = path.join(modsDir, fileName);
    if (path.dirname(filePath) !== modsDir || !isFile(filePath)) {
      result.skipped.push(fileName);
      continue;
    }
    try {
      fs.rmSync(filePath, { force: true });
      result.changed.push(fileName);
      log.info(`删除 Mod：${fileName}`);
    } catch (error) {
      result.skipped.push(fileName);
      log.warn('删除 Mod 失败，已跳过', fileName, error);
    }
  }
  return result;
}
