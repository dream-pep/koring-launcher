import * as fs from 'fs';
import * as path from 'path';
import electron from 'electron';
const { app } = electron;

const LOG_FILE = 'koring-crash.log';
const MAX_LINES = 1000;

function logPath(): string {
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), LOG_FILE);
  }
  return path.join(__dirname, '..', LOG_FILE);
}

export interface CrashEntry {
  timestamp: string;
  type: 'renderer-gone' | 'unresponsive' | 'uncaught-exception' | 'unhandled-rejection' | 'child-process-gone' | 'test';
  message: string;
  stack?: string;
  details?: Record<string, unknown>;
}

function trimFile(filePath: string): void {
  try {
    if (!fs.existsSync(filePath)) return;
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
    if (lines.length > MAX_LINES) {
      fs.writeFileSync(filePath, lines.slice(-MAX_LINES).join('\n') + '\n', 'utf-8');
    }
  } catch {}
}

export function writeCrashLog(entry: CrashEntry): void {
  const filePath = logPath();
  try {
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(filePath, line, 'utf-8');
    trimFile(filePath);
  } catch {}
}

export function readCrashLog(): string {
  const filePath = logPath();
  try {
    if (!fs.existsSync(filePath)) return '';
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

export function clearCrashLog(): void {
  const filePath = logPath();
  try {
    if (fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '', 'utf-8');
    }
  } catch {}
}
