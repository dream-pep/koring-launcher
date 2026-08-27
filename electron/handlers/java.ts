import electron from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { scanLocalJava, resolveJava } from '@xmcl/installer';

const { ipcMain } = electron;

// 常见 Java 安装目录（Windows），按一层子目录枚举 bin/java.exe
function scanCommonJavaDirs(): string[] {
  const exe = process.platform === 'win32' ? 'java.exe' : 'java';
  const roots = [
    'C:\\Program Files\\Java',
    'C:\\Program Files (x86)\\Java',
    'C:\\Program Files\\Eclipse Adoptium',
    'C:\\Program Files\\Microsoft',
    'C:\\Program Files\\Zulu',
    'C:\\Program Files\\Amazon Corretto',
  ];
  const out: string[] = [];
  for (const root of roots) {
    try {
      const entries = fs.readdirSync(root);
      for (const e of entries) {
        out.push(path.join(root, e, 'bin', exe));
      }
    } catch {
      // 目录不存在则跳过
    }
    out.push(path.join(root, 'bin', exe));
  }
  return out;
}

export function registerJavaHandlers() {
  // 扫描系统已安装的 Java（JAVA_HOME / PATH / 常见安装目录）
  ipcMain.handle('java:scan', async () => {
    try {
      const candidates = scanCommonJavaDirs();
      const list = await scanLocalJava(candidates);
      // 按路径去重（同一安装可能被多个来源发现）
      const seen = new Set<string>();
      const javaList = list.filter((j) => {
        if (seen.has(j.path)) return false;
        seen.add(j.path);
        return true;
      });
      return { success: true, data: { javaList }, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });

  // 校验指定路径是否为可用的 Java 可执行文件
  ipcMain.handle('java:resolve', async (_event, payload: { path: string }) => {
    try {
      const java = await resolveJava(payload.path);
      return { success: true, data: { java: java ?? null }, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: String(e) };
    }
  });
}
