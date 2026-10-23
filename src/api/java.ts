import { ipcInvoke } from './ipc';

export interface JavaInfo {
  path: string;
  version: string;
  majorVersion: number;
}

/** 扫描系统已安装的 Java（JAVA_HOME / PATH / 常见安装目录） */
export async function scanJava(): Promise<JavaInfo[]> {
  const data = await ipcInvoke<{ javaList: JavaInfo[] }>('java:scan');
  return data?.javaList ?? [];
}

/** 校验指定路径是否为可用的 Java 可执行文件 */
export async function resolveJava(path: string): Promise<JavaInfo | null> {
  const data = await ipcInvoke<{ java: JavaInfo | null }>('java:resolve', { path });
  return data?.java ?? null;
}

export interface JavaCandidate {
  path: string;
  version?: string;
  majorVersion?: number;
  vendor?: string;
}

export interface JavaPlan {
  /** 该 MC 版本要求的 Java 主版本 */
  requiredMajor: number;
  /** 自动匹配到的 Java 路径（本机没有可用 Java 时为 undefined） */
  pickedPath?: string;
  candidates: JavaCandidate[];
}

/** Java 自动匹配方案：该版本要求的主版本 + 本机候选 + 自动选中的路径 */
export async function getJavaPlan(minecraftVersion: string): Promise<JavaPlan> {
  return ipcInvoke<JavaPlan>('java:plan', { minecraftVersion });
}
