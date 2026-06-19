import { sidecarRequest } from "./sidecar";

export interface AuthResult {
  username: string;
  uuid: string;
  accessToken: string;
  expiresAt?: number;
  xboxProfile?: {
    gamertag: string;
    gamerscore: string;
    displayPicRaw: string;
  };
}

export async function offlineLogin(username: string): Promise<AuthResult> {
  return sidecarRequest<AuthResult>("auth:offline-login", { username });
}

export async function microsoftLoginStart(clientId: string, redirectUri?: string) {
  return sidecarRequest<{ state: string; authUrl: string }>(
    "auth:microsoft-login-start",
    { client_id: clientId, redirect_uri: redirectUri }
  );
}

export async function microsoftLoginCallback(
  code: string,
  clientId: string,
  redirectUri?: string
): Promise<AuthResult> {
  return sidecarRequest<AuthResult>("auth:microsoft-login-callback", {
    code,
    client_id: clientId,
    redirect_uri: redirectUri,
  });
}

export async function validateToken(accessToken: string): Promise<boolean> {
  const result = await sidecarRequest<{ valid: boolean }>("auth:validate-token", {
    accessToken,
  });
  return result.valid;
}
