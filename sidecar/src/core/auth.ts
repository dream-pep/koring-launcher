import { MicrosoftAuthenticator, offline } from "@xmcl/user";

export interface AuthResult {
  username: string;
  uuid: string;
  accessToken: string;
  expiresAt?: number;
  xboxProfile?: {
    gamertag: string;
    displayPicRaw: string;
  };
}

export async function microsoftLoginStart(clientId: string, redirectUri?: string) {
  const state = Math.random().toString(36).substring(2, 15);
  const scope = "XboxLive.signin offline_access";
  const redirect = redirectUri || "https://login.live.com/oauth20_desktop.srf";

  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
    `client_id=${clientId}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scope)}` +
    `&state=${state}` +
    `&redirect_uri=${encodeURIComponent(redirect)}`;

  return { state, authUrl };
}

export async function microsoftLoginCallback(
  code: string,
  clientId: string,
  redirectUri?: string
): Promise<AuthResult> {
  const redirect = redirectUri || "https://login.live.com/oauth20_desktop.srf";

  // Step 1: Exchange code for MS access token
  const tokenResponse = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirect,
      }),
    }
  );

  if (!tokenResponse.ok) {
    const err = await tokenResponse.text();
    throw new Error(`MS token exchange failed: ${err}`);
  }

  const tokenData = await tokenResponse.json() as { access_token: string };
  const msAccessToken = tokenData.access_token;

  // Step 2+3: Xbox + Minecraft auth
  const authenticator = new MicrosoftAuthenticator({ fetch });
  const { liveXstsResponse, minecraftXstsResponse } =
    await authenticator.acquireXBoxToken(msAccessToken);

  const mcResponse = await authenticator.loginMinecraftWithXBox(
    minecraftXstsResponse.DisplayClaims.xui[0].uhs,
    minecraftXstsResponse.Token
  );

  // Get Xbox profile
  let xboxProfile;
  try {
    const profile = await authenticator.getXboxGameProfile(
      liveXstsResponse.DisplayClaims.xui[0].xid,
      liveXstsResponse.DisplayClaims.xui[0].uhs,
      liveXstsResponse.Token
    );
    const settings = profile.profileUsers[0]?.settings;
    if (settings) {
      xboxProfile = {
        gamertag: settings.find(s => s.id === "Gamertag")?.value || "",
        displayPicRaw: settings.find(s => s.id === "PublicGamerpic")?.value || "",
      };
    }
  } catch {
    // Xbox profile is optional
  }

  return {
    username: mcResponse.username,
    uuid: mcResponse.username,
    accessToken: mcResponse.access_token,
    expiresAt: mcResponse.expires_in
      ? Date.now() + mcResponse.expires_in * 1000
      : undefined,
    xboxProfile,
  };
}

export function offlineLogin(username: string, uuid?: string): AuthResult {
  const user = offline(username, uuid);
  return {
    username: user.selectedProfile.name,
    uuid: user.selectedProfile.id,
    accessToken: user.accessToken,
  };
}

export async function validateMinecraftToken(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch(
      "https://api.minecraftservices.com/minecraft/profile",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}

export async function refreshMicrosoftToken(
  refreshToken: string,
  clientId: string
) {
  const response = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to refresh MS token");
  }

  return response.json();
}
