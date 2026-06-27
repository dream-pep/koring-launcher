import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface LaunchOptions {
  gamePath: string;
  javaPath: string;
  version: string;
  username: string;
  uuid: string;
  accessToken?: string;
  memory?: { min?: string; max?: string };
  jvmArgs?: string[];
  gameArgs?: string[];
  server?: { ip: string; port?: number };
  detached?: boolean;
  onEvent?: (event: { event: string; [key: string]: unknown }) => void;
}

interface LaunchResult {
  pid: number;
  version: string;
  username: string;
}

const runningProcesses = new Map<string, ChildProcess>();

export async function launchMinecraft(options: LaunchOptions): Promise<LaunchResult> {
  const versionJsonPath = path.join(options.gamePath, 'versions', options.version, `${options.version}.json`);

  if (!fs.existsSync(versionJsonPath)) {
    throw new Error(`Version JSON not found: ${versionJsonPath}`);
  }

  const versionJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'));
  const mainClass = versionJson.mainClass;

  if (!mainClass) {
    throw new Error('Main class not found in version JSON');
  }

  const args: string[] = [];

  // Memory
  const minMem = options.memory?.min || '512M';
  const maxMem = options.memory?.max || '4G';
  args.push(`-Xms${minMem}`);
  args.push(`-Xmx${maxMem}`);

  // JVM args
  if (options.jvmArgs) {
    args.push(...options.jvmArgs);
  }

  // Native libraries path
  const nativesDir = path.join(options.gamePath, 'versions', options.version, `${options.version}-natives`);
  if (fs.existsSync(nativesDir)) {
    args.push(`-Djava.library.path=${nativesDir}`);
  }

  // Classpath
  const libraries = versionJson.libraries || [];
  const classpath = libraries
    .filter((lib: { downloads?: { artifact?: { path: string } } }) => lib.downloads?.artifact?.path)
    .map((lib: { downloads: { artifact: { path: string } } }) => path.join(options.gamePath, 'libraries', lib.downloads.artifact.path));

  const clientJar = path.join(options.gamePath, 'versions', options.version, `${options.version}.jar`);
  if (fs.existsSync(clientJar)) {
    classpath.push(clientJar);
  }

  args.push('-cp');
  args.push(classpath.join(path.delimiter));

  args.push(mainClass);

  // Game args
  args.push(`--username`, options.username);
  args.push(`--version`, options.version);
  args.push(`--gameDir`, options.gamePath);
  args.push(`--assetsDir`, path.join(options.gamePath, 'assets'));
  args.push(`--assetIndex`, versionJson.assetIndex?.id || options.version);
  args.push(`--uuid`, options.uuid);

  if (options.accessToken) {
    args.push(`--accessToken`, options.accessToken);
  }

  if (options.server) {
    args.push(`--server`, options.server.ip);
    if (options.server.port) {
      args.push(`--port`, String(options.server.port));
    }
  }

  if (options.gameArgs) {
    args.push(...options.gameArgs);
  }

  const javaPath = options.javaPath || 'java';

  return new Promise((resolve, reject) => {
    const child = spawn(javaPath, args, {
      cwd: options.gamePath,
      detached: options.detached,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const requestId = `mc-${Date.now()}`;
    runningProcesses.set(requestId, child);

    child.stdout?.on('data', (data) => {
      const line = data.toString().trim();
      if (line) {
        options.onEvent?.({ event: 'stdout', message: line });
      }
    });

    child.stderr?.on('data', (data) => {
      const line = data.toString().trim();
      if (line) {
        options.onEvent?.({ event: 'stderr', message: line });
      }
    });

    child.on('error', (err) => {
      runningProcesses.delete(requestId);
      options.onEvent?.({ event: 'error', error: String(err) });
      reject(err);
    });

    child.on('exit', (code) => {
      runningProcesses.delete(requestId);
      options.onEvent?.({ event: 'exit', code });
    });

    resolve({
      pid: child.pid || 0,
      version: options.version,
      username: options.username,
    });
  });
}

export async function diagnoseVersion(gamePath: string, version: string): Promise<Record<string, unknown>> {
  const issues: string[] = [];
  const versionDir = path.join(gamePath, 'versions', version);
  const versionJsonPath = path.join(versionDir, `${version}.json`);
  const jarPath = path.join(versionDir, `${version}.jar`);

  if (!fs.existsSync(versionJsonPath)) {
    issues.push(`Version JSON not found: ${versionJsonPath}`);
  }

  if (!fs.existsSync(jarPath)) {
    issues.push(`Client JAR not found: ${jarPath}`);
  }

  return {
    version,
    gamePath,
    healthy: issues.length === 0,
    issues,
  };
}
