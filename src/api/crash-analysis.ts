/**
 * 实例崩溃分析（渲染端 API）。
 *
 * 主进程侧实现见 `electron/core/crash-analysis.ts`：纯本地正则规则匹配，
 * 返回「一句结论 + 多条 finding（标题/证据/建议）+ 环境信息 + 日志尾部」。
 */

import { ipcInvoke } from './ipc';

export type CrashSeverity = 'fatal' | 'error' | 'warning';
export type CrashConfidence = 'high' | 'medium' | 'low';
export type CrashLogKind = 'crash-report' | 'latest-log' | 'debug-log';

export interface CrashLogFile {
  fileName: string;
  kind: CrashLogKind;
  filePath: string;
  sizeBytes: number;
  mtime: number;
}

export interface CrashFinding {
  id: string;
  title: string;
  severity: CrashSeverity;
  confidence: CrashConfidence;
  /** 命中的原文片段 */
  evidence: string[];
  suggestion: string;
}

export interface CrashMeta {
  minecraftVersion?: string;
  javaVersion?: string;
  memory?: string;
  loader?: string;
  description?: string;
  causedBy?: string;
  exitCode?: string;
}

export interface CrashAnalysisResult {
  files: CrashLogFile[];
  source: string | null;
  summary: string;
  findings: CrashFinding[];
  meta: CrashMeta;
  tail: string[];
  elapsedMs: number;
}

/** 分析实例最近一次崩溃（fileName 可指定具体日志） */
export async function analyzeInstanceCrash(
  instancePath: string,
  fileName?: string
): Promise<CrashAnalysisResult> {
  return ipcInvoke<CrashAnalysisResult>('instance:crash-analysis', { instancePath, fileName });
}
