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

const authFile = (): string => {
  if (app.isPackaged) {
    return path.join(path.dirname(app.getPath('exe')), 'koring-auth.json');
  }
  return path.join(__dirname, '..', 'koring-auth.json');
};

export function readAuth(): AuthData {
  const filePath = authFile();
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
  const filePath = authFile();
  fs.writeFileSync(filePath, JSON.stringify(auth, null, 2), 'utf-8');
}

export function deleteAuth(): void {
  const filePath = authFile();
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
