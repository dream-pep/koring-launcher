import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface SidecarResponse<T = unknown> {
  id: string;
  type: "result" | "error" | "progress" | "event";
  payload: T;
}

export interface CommandResult {
  success: boolean;
  data?: { requestId: string };
  error?: string;
}

export interface ResultPayload<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ProgressPayload {
  stage: string;
  current: number;
  total: number;
  message?: string;
}

// Generic request function
export async function sidecarRequest<T = unknown>(
  type: string,
  payload: unknown
): Promise<T> {
  const result = await invoke<CommandResult>("sidecar_request", {
    msgType: type,
    payload,
  });

  if (!result.success) {
    throw new Error(result.error || "Request failed");
  }

  // Wait for the response via event
  const requestId = result.data?.requestId;
  if (!requestId) {
    throw new Error("No request ID returned");
  }

  return waitForResponse<T>(requestId);
}

// Wait for a specific response by request ID
function waitForResponse<T>(requestId: string, timeout = 60000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unlisten();
      reject(new Error("Request timed out"));
    }, timeout);

    let unlisten: UnlistenFn;

    listen<SidecarResponse>("sidecar-response", (event) => {
      const response = event.payload;
      if (response.id !== requestId) return;

      if (response.type === "result") {
        clearTimeout(timer);
        unlisten();
        const payload = response.payload as ResultPayload<T>;
        if (payload.success) {
          resolve(payload.data as T);
        } else {
          reject(new Error(payload.error || "Request failed"));
        }
      } else if (response.type === "error") {
        clearTimeout(timer);
        unlisten();
        reject(new Error(String(response.payload)));
      }
    }).then((fn) => {
      unlisten = fn;
    });
  });
}

// Listen for progress events
export function onProgress(
  requestId: string,
  callback: (progress: ProgressPayload) => void
): Promise<UnlistenFn> {
  return listen<SidecarResponse>("sidecar-response", (event) => {
    const response = event.payload;
    if (response.id === requestId && response.type === "progress") {
      callback(response.payload as ProgressPayload);
    }
  });
}

// Listen for events (game lifecycle, etc.)
export function onEvent(
  requestId: string,
  callback: (event: Record<string, unknown>) => void
): Promise<UnlistenFn> {
  return listen<SidecarResponse>("sidecar-response", (event) => {
    const response = event.payload;
    if (response.id === requestId && response.type === "event") {
      callback(response.payload as Record<string, unknown>);
    }
  });
}
