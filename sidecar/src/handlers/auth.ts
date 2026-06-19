import { sendResult, sendError } from "../protocol/transport.js";
import type {
  MicrosoftLoginStartRequest,
  MicrosoftLoginCallbackRequest,
  OfflineLoginRequest,
  ValidateTokenRequest,
} from "../protocol/types.js";
import * as auth from "../core/auth.js";

export async function handleMicrosoftLoginStart(
  id: string,
  payload: MicrosoftLoginStartRequest
) {
  try {
    const result = await auth.microsoftLoginStart(
      payload.client_id,
      payload.redirect_uri
    );
    sendResult(id, result);
  } catch (e: any) {
    sendError(id, e.message);
  }
}

export async function handleMicrosoftLoginCallback(
  id: string,
  payload: MicrosoftLoginCallbackRequest
) {
  try {
    const result = await auth.microsoftLoginCallback(
      payload.code,
      payload.client_id
    );
    sendResult(id, result);
  } catch (e: any) {
    sendError(id, e.message);
  }
}

export async function handleOfflineLogin(id: string, payload: OfflineLoginRequest) {
  try {
    const result = auth.offlineLogin(payload.username);
    sendResult(id, result);
  } catch (e: any) {
    sendError(id, e.message);
  }
}

export async function handleValidateToken(id: string, payload: ValidateTokenRequest) {
  try {
    const valid = await auth.validateMinecraftToken(payload.accessToken);
    sendResult(id, { valid });
  } catch (e: any) {
    sendError(id, e.message);
  }
}
