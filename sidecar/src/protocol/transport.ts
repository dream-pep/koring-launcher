import { Request, Response, ProgressPayload, ResultPayload } from "./types.js";
import { randomUUID } from "crypto";

type MessageHandler = (msg: Request) => void;

let buffer = "";

function sendResponse<T>(id: string, type: Response["type"], payload: T) {
  const msg: Response<T> = { id, type, payload };
  process.stdout.write(JSON.stringify(msg) + "\n");
}

export function sendProgress(id: string, progress: ProgressPayload) {
  sendResponse(id, "progress", progress);
}

export function sendResult<T>(id: string, data: T) {
  sendResponse<ResultPayload<T>>(id, "result", { success: true, data });
}

export function sendError(id: string, error: string) {
  sendResponse<ResultPayload>(id, "result", { success: false, error });
}

export function sendEvent<T>(id: string, event: T) {
  sendResponse(id, "event", event);
}

export function startTransport(onMessage: MessageHandler) {
  process.stdin.setEncoding("utf-8");

  process.stdin.on("data", (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg: Request = JSON.parse(trimmed);
        onMessage(msg);
      } catch (e) {
        process.stderr.write(`[transport] parse error: ${e}\n`);
      }
    }
  });

  process.stdin.on("end", () => {
    process.exit(0);
  });

  process.stderr.write("[transport] ready\n");
}

export function createRequestId(): string {
  return randomUUID();
}
