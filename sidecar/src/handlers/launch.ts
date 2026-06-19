import { sendResult, sendError } from "../protocol/transport.js";
import type { LaunchRequest, DiagnoseRequest } from "../protocol/types.js";
import * as launcher from "../core/launcher.js";

export async function handleLaunch(id: string, payload: LaunchRequest) {
  try {
    const result = await launcher.launchMinecraft(id, payload);
    sendResult(id, result);
  } catch (e: any) {
    sendError(id, e.message);
  }
}

export async function handleDiagnose(id: string, payload: DiagnoseRequest) {
  try {
    const result = await launcher.diagnoseVersion(payload.gamePath, payload.version);
    sendResult(id, result);
  } catch (e: any) {
    sendError(id, e.message);
  }
}
