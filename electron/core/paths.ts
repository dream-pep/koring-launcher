// 路径归一化：相对 gameDir（默认 `.minecraft`）在打包后依赖进程 cwd，不可靠。
// 统一按与 runStartupChecks 一致的基准解析（见 dataBasePath）。
import * as path from 'path';
import electron from 'electron';
const { app } = electron;

/**
 * 数据基准目录（游戏数据 `.minecraft` 等相对路径的解析根）：
 * - 开发模式 → 项目根
 * - Linux / AppImage → userData：exe 目录是只读挂载（/tmp/.mount_*），无法写入
 * - Windows 打包 → exe 目录（沿用历史行为）
 */
export function dataBasePath(): string {
  if (!app.isPackaged) {
    return path.join(__dirname, '..', '..');
  }
  if (process.platform === 'linux') {
    return app.getPath('userData');
  }
  return path.dirname(app.getPath('exe'));
}

function baseDataPath(): string {
  return dataBasePath();
}

/** 相对路径 → 绝对（基准 = dataBasePath）；绝对路径原样返回 */
export function resolveGamePath(gamePath: string): string {
  if (!gamePath || path.isAbsolute(gamePath)) {
    return gamePath;
  }
  return path.join(baseDataPath(), gamePath);
}
