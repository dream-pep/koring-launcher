// 路径归一化：相对 gameDir（默认 `.minecraft`）在打包后依赖进程 cwd，不可靠。
// 统一按与 runStartupChecks 一致的基准解析（打包 → exe 目录；开发 → 项目根）。
import * as path from 'path';
import electron from 'electron';
const { app } = electron;

function baseDataPath(): string {
  if (app.isPackaged) {
    return path.dirname(app.getPath('exe'));
  }
  return path.join(__dirname, '..', '..');
}

/** 相对路径 → 绝对（基准 = exe 目录/项目根）；绝对路径原样返回 */
export function resolveGamePath(gamePath: string): string {
  if (!gamePath || path.isAbsolute(gamePath)) {
    return gamePath;
  }
  return path.join(baseDataPath(), gamePath);
}
