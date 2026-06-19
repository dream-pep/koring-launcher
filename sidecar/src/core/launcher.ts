import {
  launch as xmclLaunch,
  diagnose as xmclDiagnose,
  createMinecraftProcessWatcher,
  Version,
  type LaunchOption,
} from "@xmcl/core";
import { sendEvent } from "../protocol/transport.js";

export async function launchMinecraft(requestId: string, options: {
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
}) {
  const launchOption: LaunchOption = {
    gamePath: options.gamePath,
    javaPath: options.javaPath,
    version: options.version,
    gameProfile: {
      name: options.username,
      id: options.uuid,
    },
    accessToken: options.accessToken || "",
    extraExecOption: options.detached ? { detached: true } : undefined,
    minMemory: options.memory?.min ? parseInt(options.memory.min) : undefined,
    maxMemory: options.memory?.max ? parseInt(options.memory.max) : undefined,
    extraJVMArgs: options.jvmArgs,
    extraMCArgs: options.gameArgs,
    server: options.server,
  };

  const proc = await xmclLaunch(launchOption);

  const watcher = createMinecraftProcessWatcher(proc);

  watcher.on("error", (error: any) => {
    sendEvent(requestId, { event: "error", message: error.message || String(error) });
  });

  watcher.on("minecraft-exit", (event) => {
    sendEvent(requestId, { event: "exit", code: event.code, signal: event.signal });
  });

  watcher.on("minecraft-window-ready", () => {
    sendEvent(requestId, { event: "window-ready" });
  });

  proc.on("error", (err) => {
    sendEvent(requestId, { event: "process-error", message: err.message });
  });

  return {
    pid: proc.pid,
    version: options.version,
    username: options.username,
  };
}

export async function diagnoseVersion(gamePath: string, versionId: string) {
  const report = await xmclDiagnose(versionId, gamePath);
  return report;
}

export async function parseVersion(gamePath: string, versionId: string) {
  const resolved = await Version.parse(gamePath, versionId);
  return {
    id: resolved.id,
    type: resolved.type,
    mainClass: resolved.mainClass,
  };
}
