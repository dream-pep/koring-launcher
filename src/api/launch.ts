import { sidecarRequest, onEvent } from "./sidecar";
import type { UnlistenFn } from "@tauri-apps/api/event";

export interface LaunchOptions {
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
}

export interface LaunchResult {
  pid: number;
  version: string;
  username: string;
  requestId: string;
}

export async function launchGame(options: LaunchOptions): Promise<LaunchResult> {
  return sidecarRequest<LaunchResult>("launch:launch", options);
}

export async function diagnoseVersion(
  gamePath: string,
  version: string
) {
  return sidecarRequest("launch:diagnose", { gamePath, version });
}

export function onGameEvent(
  requestId: string,
  callback: (event: { event: string; [key: string]: unknown }) => void
): Promise<UnlistenFn> {
  return onEvent(requestId, callback as (e: Record<string, unknown>) => void);
}
