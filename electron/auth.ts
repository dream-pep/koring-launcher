import * as fs from 'fs';
import * as path from 'path';
import electron from 'electron';
const { app } = electron;

export interface AuthData {
  username: string;
  uuid: string;
  accessToken: string;
  refreshToken: string;
  xboxProfile: string;
}

/**
 * 认证文件路径（与配置一致）：
 * - 打包后 → 系统用户数据目录（userData）
 * - 开发模式 → 项目根目录
 */
export function authPath(): string {
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'koring-auth.json');
  }
  return path.join(__dirname, '..', 'koring-auth.json');
}

export function readAuth(): AuthData {
  const filePath = authPath();
  if (!fs.existsSync(filePath)) {
    return { username: '', uuid: '', accessToken: '', refreshToken: '', xboxProfile: '' };
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as AuthData;
  } catch {
    return { username: '', uuid: '', accessToken: '', refreshToken: '', xboxProfile: '' };
  }
}

export function writeAuth(auth: AuthData): void {
  const filePath = authPath();
  fs.writeFileSync(filePath, JSON.stringify(auth, null, 2), 'utf-8');
}

export function deleteAuth(): void {
  const filePath = authPath();
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
