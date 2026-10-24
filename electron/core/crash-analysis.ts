/**
 * 实例崩溃分析（纯逻辑，可脱离 UI 使用）
 *
 * 目标：对齐 PCL-CE 的「崩溃分析」能力——读取实例的 crash-reports 与 logs，
 * 用规则库匹配已知崩溃特征，给出「一句结论 + 证据 + 处理建议」。
 *
 * 设计原则：
 * - 纯本地正则/字符串匹配，不联网、不引依赖；
 * - 规则命中多条时按严重度与置信度排序，全部展示（PCL 也是多结果）；
 * - 读不到文件、文件损坏都返回空结果而不是抛错，UI 只需展示。
 */

import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from './logger';

const log = createLogger('crash-analysis');

/** 单文件最多读取的字节数（崩溃日志动辄几十 MB，只取头部 + 尾部） */
const MAX_READ_BYTES = 4 * 1024 * 1024;
/** 尾部日志展示行数 */
const TAIL_LINES = 80;

export type CrashSeverity = 'fatal' | 'error' | 'warning';
export type CrashConfidence = 'high' | 'medium' | 'low';

export type CrashLogKind = 'crash-report' | 'latest-log' | 'debug-log';

/** 可分析的日志文件 */
export interface CrashLogFile {
  fileName: string;
  kind: CrashLogKind;
  filePath: string;
  sizeBytes: number;
  /** 最后修改时间（毫秒） */
  mtime: number;
}

/** 一条崩溃结论 */
export interface CrashFinding {
  /** 稳定 id（前端可用于图标/配色） */
  id: string;
  title: string;
  severity: CrashSeverity;
  confidence: CrashConfidence;
  /** 命中的原文片段（最多 3 条，已裁剪长度） */
  evidence: string[];
  suggestion: string;
}

/** 崩溃报告头部提取出的环境信息 */
export interface CrashMeta {
  minecraftVersion?: string;
  javaVersion?: string;
  memory?: string;
  loader?: string;
  /** 崩溃报告 // Description: 行 */
  description?: string;
  /** 崩溃报告 // Caused by: 行 */
  causedBy?: string;
  exitCode?: string;
}

export interface CrashAnalysisResult {
  /** 找到的日志文件（新 → 旧） */
  files: CrashLogFile[];
  /** 本次分析的文件名；没有可分析文件时为 null */
  source: string | null;
  /** 一句话结论（给 UI 顶部展示） */
  summary: string;
  findings: CrashFinding[];
  meta: CrashMeta;
  /** 日志尾部（最新在最后） */
  tail: string[];
  /** 分析耗时（ms） */
  elapsedMs: number;
}

interface Rule {
  id: string;
  title: string;
  severity: CrashSeverity;
  confidence: CrashConfidence;
  /** 命中判定：返回证据行；不命中返回 null */
  match: (text: string, lines: string[]) => string[] | null;
  suggestion: string;
}

/** 截断过长的证据行 */
function clip(line: string, max = 180): string {
  const trimmed = line.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

/** 收集匹配到的证据行（最多 count 条） */
function pick(lines: string[], pattern: RegExp, count = 3): string[] {
  const result: string[] = [];
  for (const line of lines) {
    if (pattern.test(line)) {
      result.push(clip(line));
      if (result.length >= count) break;
    }
  }
  return result;
}

function has(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

/**
 * 规则库：命中即为一条 finding。
 * 规则按「特异性高 → 低」排列，最终结果会按严重度/置信度再排序。
 */
const RULES: Rule[] = [
  {
    id: 'out-of-memory',
    title: '内存不足（OutOfMemoryError）',
    severity: 'fatal',
    confidence: 'high',
    match: (_text, lines) =>
      pick(lines, /java\.lang\.OutOfMemoryError|Java heap space|GC overhead limit exceeded|native memory allocation/i),
    suggestion: '把实例最大内存调大（建议 4–8 GB），并确认没有同时开太多程序；若已很大仍报错，检查是否用了 32 位 Java。',
  },
  {
    id: 'x86-java-memory-limit',
    title: '32 位 Java 无法分配这么大内存',
    severity: 'fatal',
    confidence: 'high',
    match: (_text, lines) =>
      pick(lines, /Could not reserve enough space for|Invalid maximum heap size|Error occurred during initialization of VM/i),
    suggestion: '换成 64 位 Java（设置 → 游戏 → Java 自动选择），或把最大内存调到 1.5 GB 以下。',
  },
  {
    id: 'java-too-old',
    title: 'Java 版本过低',
    severity: 'fatal',
    confidence: 'high',
    match: (_text, lines) => pick(lines, /UnsupportedClassVersionError|has been compiled by a more recent version of the Java Runtime/i),
    suggestion: '给这个实例换更高版本的 Java（1.17+ 需要 Java 17，1.20.5+ 需要 Java 21），可在实例设置里单独指定。',
  },
  {
    id: 'java-too-new',
    title: 'Java 版本过高（类文件版本不兼容）',
    severity: 'fatal',
    confidence: 'medium',
    match: (text, lines) => {
      // 已经明确是「Java 过低」时不要同时报「过高」，避免自相矛盾的结论
      if (has(text, /UnsupportedClassVersionError|compiled by a more recent version/i)) return null;
      return pick(lines, /Unsupported class file major version|class file version \d+/i);
    },
    suggestion: '换回该 Minecraft 版本匹配的 Java（1.16.5 及以下通常用 Java 8，1.17–1.20.4 用 Java 17，1.20.5+ 用 Java 21）。',
  },
  {
    id: 'mixin-failed',
    title: '模组 Mixin 注入失败',
    severity: 'error',
    confidence: 'high',
    match: (_text, lines) =>
      pick(
        lines,
        /Mixin apply failed|MixinTransformerError|Critical injection failure|InvalidInjectionException|mixin\.transformer\.throwables/i
      ),
    suggestion: '通常是模组之间不兼容或模组版本不匹配。把最近新加的模组逐个移除排查；确认所有模组适配当前 MC 版本与加载器版本。',
  },
  {
    id: 'missing-mixin-bootstrap',
    title: '缺少 Mixin 引导（环境安装不完整）',
    severity: 'error',
    confidence: 'medium',
    match: (_text, lines) => pick(lines, /MixinBootstrap|mixin\.env\.MixinEnvironment|NoClassDefFoundError.*spongepowered/i),
    suggestion: '实例的加载器文件可能不完整，点「修复」补全 Forge/Fabric 依赖后再启动。',
  },
  {
    id: 'duplicate-mods',
    title: '存在重复模组',
    severity: 'error',
    confidence: 'high',
    match: (_text, lines) => pick(lines, /Duplicate mods? found|DuplicateModsFoundException|duplicate mod id|already registered/i),
    suggestion: '同一模组装了多个版本，去「模组」页删掉旧版本，只保留一个。',
  },
  {
    id: 'missing-dependency',
    title: '缺少前置模组或版本不匹配',
    severity: 'error',
    confidence: 'high',
    match: (_text, lines) =>
      pick(
        lines,
        /Missing or unsupported mandatory dependencies|Mod File:|requires .* version|Incompatible mod set|Missing dependency/i
      ),
    suggestion: '按日志里提示的模组名补齐前置（如 Fabric API / Kotlin / GeckoLib），并确认前置版本与 MC 版本匹配。',
  },
  {
    id: 'mod-not-found',
    title: '模组类找不到（缺少前置或模组损坏）',
    severity: 'error',
    confidence: 'medium',
    match: (_text, lines) => pick(lines, /java\.lang\.(NoClassDefFoundError|ClassNotFoundException)/i),
    suggestion: '先确认前置模组齐全；仍报错则可能是模组文件损坏，重新下载该模组。',
  },
  {
    id: 'mod-init-failed',
    title: '模组初始化失败',
    severity: 'error',
    confidence: 'medium',
    match: (_text, lines) =>
      pick(lines, /Failed to (load|initialize) mod|ModInitializationException|Exception during mod initialization|Loading errors encountered/i),
    suggestion: '看报错里点名的模组：优先更新它，或临时移除；也可以查看该模组的配置文件是否损坏。',
  },
  {
    id: 'fabric-error',
    title: 'Fabric 加载器报错',
    severity: 'error',
    confidence: 'medium',
    match: (_text, lines) =>
      pick(lines, /net\.fabricmc\.loader\.impl\.(FormattedException|discovery\.ModResolutionException)|Incompatible mods found/i),
    suggestion: 'Fabric 侧多为模组/前置版本冲突：更新 Fabric API 与加载器版本，移除不兼容模组。',
  },
  {
    id: 'forge-error',
    title: 'Forge/NeoForge 加载报错',
    severity: 'error',
    confidence: 'low',
    match: (_text, lines) => pick(lines, /net\.minecraftforge\.fml|net\.neoforged\.fml|ModLoadingException|ModLoaderException/i),
    suggestion: 'Forge 侧常见于模组版本不匹配：确认所有模组都是同一 MC 版本、同一加载器构建；必要时点「修复」重建加载器。',
  },
  {
    id: 'opengl-unsupported',
    title: 'OpenGL 不可用或版本过低',
    severity: 'fatal',
    confidence: 'medium',
    match: (_text, lines) => pick(lines, /Unsupported OpenGL|OpenGL 3\.2|OpenGL context|Failed to create (window|context)|GLFW error/i),
    suggestion: '更新显卡驱动；确认不是用远程桌面/虚拟机运行；必要时在游戏里改用低版本光影或关闭部分渲染模组。',
  },
  {
    id: 'pixel-format',
    title: '显卡不支持像素格式（Pixel format not accelerated）',
    severity: 'fatal',
    confidence: 'high',
    match: (_text, lines) => pick(lines, /Pixel format not accelerated|WGL pixel format/i),
    suggestion: '更新显卡驱动或在游戏 JVM 参数里加 `-Dfml.earlyprogresswindow=false` 之类的规避参数（视加载器而定）。',
  },
  {
    id: 'graphics-driver-crash',
    title: '显卡驱动层崩溃（访问冲突）',
    severity: 'fatal',
    confidence: 'medium',
    match: (_text, lines) =>
      pick(lines, /EXCEPTION_ACCESS_VIOLATION|0xc0000005|ig[0-9a-z]+\.dll|nvoglv|atio6axx|amdvlk/i),
    suggestion: '更新/回滚显卡驱动，关闭超频；如果只在特定光影或模组下复现，优先怀疑渲染类模组。',
  },
  {
    id: 'file-validation-failed',
    title: '游戏文件校验失败',
    severity: 'error',
    confidence: 'medium',
    match: (_text, lines) => pick(lines, /failed validation|hash mismatch|SHA-1|checksum (failed|mismatch)/i),
    suggestion: '点实例详情里的「修复」重新下载缺失/损坏文件；若反复失败，换一个下载源试试。',
  },
  {
    id: 'permission-denied',
    title: '文件读写被拒绝（权限/杀毒软件）',
    severity: 'error',
    confidence: 'medium',
    match: (_text, lines) => pick(lines, /AccessDeniedException|拒绝访问|Permission denied|EPERM|EACCES/),
    suggestion: '把游戏目录换成用户目录下的路径（避免 C:\\Program Files），并把该目录加入杀毒软件白名单。',
  },
  {
    id: 'resourcepack-too-large',
    title: '资源包/光影过大导致内存不足',
    severity: 'warning',
    confidence: 'low',
    match: (_text, lines) => pick(lines, /resource ?pack|shader ?pack/i),
    suggestion: '换用分辨率更低的资源包或光影，并适当调大内存。',
  },
  {
    id: 'optifine-forge-conflict',
    title: 'OptiFine 与 Forge 环境冲突',
    severity: 'warning',
    confidence: 'low',
    match: (_text, lines) => pick(lines, /OptiFine.*Forge|optifine.*mixin|OptifineClassTransformer/i),
    suggestion: '1.16+ 建议改用 Embeddium/Rubidium 等替代品；如果必须用 OptiFine，确认版本与 Forge 匹配。',
  },
  {
    id: 'shaders-optifine',
    title: 'ShadersMod 与 OptiFine 冲突',
    severity: 'warning',
    confidence: 'low',
    match: (_text, lines) => pick(lines, /ShadersMod|shadersmod/i),
    suggestion: '二选一：要么用 OptiFine 自带光影，要么用 ShadersMod，不要同时装。',
  },
];

/** 通用兜底：没有任何规则命中时给一条方向性结论 */
function fallbackFinding(text: string, lines: string[]): CrashFinding {
  const generic = pick(lines, /Exception in thread|Caused by:|The game crashed whilst/i, 3);
  return {
    id: 'unknown',
    title: '未匹配到已知崩溃特征',
    severity: 'error',
    confidence: 'low',
    evidence: generic.length > 0 ? generic : [clip(lines.find((line) => line.trim().length > 0) ?? text.slice(0, 120))],
    suggestion:
      '把日志尾部（尤其是第一个 Caused by 与堆栈顶部）发到社区求助；也可以先移除最近新增的模组/光影，或在实例设置里换一个 Java 版本再试。',
  };
}

const SEVERITY_WEIGHT: Record<CrashSeverity, number> = { fatal: 0, error: 1, warning: 2 };
const CONFIDENCE_WEIGHT: Record<CrashConfidence, number> = { high: 0, medium: 1, low: 2 };

/** 列出实例下所有可分析的日志文件（新 → 旧） */
export function listCrashLogFiles(instancePath: string): CrashLogFile[] {
  const files: CrashLogFile[] = [];

  const crashDir = path.join(instancePath, 'crash-reports');
  try {
    for (const entry of fs.readdirSync(crashDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.txt')) continue;
      const filePath = path.join(crashDir, entry.name);
      try {
        const stat = fs.statSync(filePath);
        files.push({
          fileName: entry.name,
          kind: 'crash-report',
          filePath,
          sizeBytes: stat.size,
          mtime: stat.mtimeMs,
        });
      } catch {
        // 单文件失败忽略
      }
    }
  } catch {
    // 没有崩溃报告目录
  }

  const logCandidates: { name: string; kind: CrashLogKind }[] = [
    { name: 'latest.log', kind: 'latest-log' },
    { name: 'debug.log', kind: 'debug-log' },
  ];
  const logsDir = path.join(instancePath, 'logs');
  for (const candidate of logCandidates) {
    const filePath = path.join(logsDir, candidate.name);
    try {
      const stat = fs.statSync(filePath);
      files.push({
        fileName: candidate.name,
        kind: candidate.kind,
        filePath,
        sizeBytes: stat.size,
        mtime: stat.mtimeMs,
      });
    } catch {
      // 文件不存在
    }
  }

  return files.sort((a, b) => b.mtime - a.mtime);
}

/** 读文件：只取开头 + 结尾，避免几十 MB 日志把主进程拖死 */
function readSafely(filePath: string): string {
  const stat = fs.statSync(filePath);
  const fd = fs.openSync(filePath, 'r');
  try {
    if (stat.size <= MAX_READ_BYTES) {
      const buffer = Buffer.alloc(Number(stat.size));
      const read = fs.readSync(fd, buffer, 0, buffer.length, 0);
      return buffer.subarray(0, read).toString('utf8');
    }
    // 大文件：前半 + 后半各取一半，用省略号衔接
    const half = Math.floor(MAX_READ_BYTES / 2);
    const head = Buffer.alloc(half);
    const headRead = fs.readSync(fd, head, 0, half, 0);
    const tail = Buffer.alloc(half);
    const tailRead = fs.readSync(fd, tail, 0, half, stat.size - half);
    return `${head.subarray(0, headRead).toString('utf8')}\n…（日志过大，中间内容已省略）…\n${tail
      .subarray(0, tailRead)
      .toString('utf8')}`;
  } finally {
    fs.closeSync(fd);
  }
}

/** 从崩溃报告头部提取环境信息 */
function extractMeta(text: string, lines: string[]): CrashMeta {
  const find = (pattern: RegExp): string | undefined => {
    for (const line of lines) {
      const match = line.match(pattern);
      if (match) return match[1]?.trim();
    }
    return undefined;
  };

  const minecraftVersion = find(/Minecraft Version:\s*([^\s,)]+)/i) ?? find(/-{5,}\s*Minecraft Version[^:]*:\s*([^\s]+)/i);
  const javaVersion = find(/Java Version:\s*([^\n,)]+)/i) ?? find(/Java version:\s*([^\s]+)/i);
  const memory = find(/Memory:\s*([0-9]+\s*MB)/i);
  const description = find(/\/\/ Description:\s*(.+)$/m);
  const causedBy = find(/\/\/ Caused by:\s*(.+)$/m);
  const exitCode = find(/Process exited with (?:exit code )?(-?\d+)/i) ?? find(/Exit code:?\s*(-?\d+)/i);

  let loader: string | undefined;
  const loaderPatterns: [RegExp, string][] = [
    [/NeoForge(?:d)?[\s/]*(?:version)?\s*[:=]?\s*([0-9][\w.\-+]*)/i, 'NeoForge'],
    [/Forge[\s/]*(?:version)?\s*[:=]?\s*([0-9][\w.\-+]*)/i, 'Forge'],
    [/fabric[- ]loader[\s/]*(?:version)?\s*[:=]?\s*([0-9][\w.\-+]*)/i, 'Fabric Loader'],
    [/Quilt[\s/]*(?:Loader)?\s*[:=]?\s*([0-9][\w.\-+]*)/i, 'Quilt Loader'],
  ];
  for (const [pattern, name] of loaderPatterns) {
    const match = text.match(pattern);
    if (match) {
      loader = `${name} ${match[1]}`;
      break;
    }
  }

  return { minecraftVersion, javaVersion, memory, loader, description, causedBy, exitCode };
}

/** 日志尾部：跳过明显的空行与下载噪音，给 UI 一个可读的收尾 */
function extractTail(text: string, count = TAIL_LINES): string[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const filtered = lines.filter(
    (line) =>
      !/^\[\d{2}:\d{2}:\d{2}\]\s*\[[^\]]*\/INFO\]/.test(line) ||
      /Exception|Error|Caused by|at [\w.$]+\(/.test(line)
  );
  const source = filtered.length >= 10 ? filtered : lines;
  return source.slice(-count).map((line) => clip(line, 240));
}

/**
 * 分析实例最近一次崩溃。
 * @param instancePath 实例目录（含 crash-reports / logs）
 * @param preferFileName 指定分析哪个文件（不传 = 自动挑最新的崩溃报告，否则 latest.log）
 */
export function analyzeInstanceCrash(instancePath: string, preferFileName?: string): CrashAnalysisResult {
  const startedAt = Date.now();
  const files = listCrashLogFiles(instancePath);
  const fallback: CrashAnalysisResult = {
    files,
    source: null,
    summary: '这个实例还没有崩溃报告或日志，暂时无法分析',
    findings: [],
    meta: {},
    tail: [],
    elapsedMs: 0,
  };
  if (files.length === 0) return fallback;

  const target =
    (preferFileName ? files.find((file) => file.fileName === preferFileName) : undefined) ??
    files.find((file) => file.kind === 'crash-report') ??
    files.find((file) => file.kind === 'latest-log') ??
    files[0];

  let text = '';
  try {
    text = readSafely(target.filePath);
  } catch (error) {
    log.warn(`读取崩溃日志失败：${target.filePath} ${error instanceof Error ? error.message : String(error)}`);
    return { ...fallback, source: target.fileName, summary: '读取日志失败，可能是文件被占用或权限不足' };
  }

  const lines = text.split(/\r?\n/);
  const findings: CrashFinding[] = [];
  for (const rule of RULES) {
    const evidence = rule.match(text, lines);
    if (evidence && evidence.length > 0) {
      findings.push({
        id: rule.id,
        title: rule.title,
        severity: rule.severity,
        confidence: rule.confidence,
        evidence,
        suggestion: rule.suggestion,
      });
    }
  }

  findings.sort(
    (a, b) =>
      SEVERITY_WEIGHT[a.severity] - SEVERITY_WEIGHT[b.severity] ||
      CONFIDENCE_WEIGHT[a.confidence] - CONFIDENCE_WEIGHT[b.confidence]
  );

  if (findings.length === 0) findings.push(fallbackFinding(text, lines));

  const meta = extractMeta(text, lines);
  const top = findings[0];
  const summary =
    top.id === 'unknown'
      ? '没能匹配到已知特征，请看下面的日志尾部'
      : `最可能的原因：${top.title}（${top.confidence === 'high' ? '高' : top.confidence === 'medium' ? '中' : '低'}置信度）`;

  log.info(`崩溃分析完成：${target.fileName}，命中 ${findings.length} 条规则，耗时 ${Date.now() - startedAt}ms`);

  return {
    files,
    source: target.fileName,
    summary,
    findings,
    meta,
    tail: extractTail(text),
    elapsedMs: Date.now() - startedAt,
  };
}
