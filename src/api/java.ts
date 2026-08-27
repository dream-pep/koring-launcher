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
