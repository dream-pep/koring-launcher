import * as crypto from 'crypto';
import electron from 'electron';

const { net } = electron;

const MC_SERVICES_API = 'https://api.minecraftservices.com';
const XBOX_AUTH_URL = 'https://user.auth.xboxlive.com/user/authenticate';
const XBOX_XSTS_URL = 'https://xsts.auth.xboxlive.com/xsts/authorize';
const MC_AUTH_URL = 'https://api.minecraftservices.com/authentication/login_with_xbox';
const MC_PROFILE_URL = 'https://api.minecraftservices.com/minecraft/profile';

interface XboxProfile {
  gamertag: string;
  gamerscore: string;
  displayPicRaw: string;
}

interface AuthResult {
  username: string;
  uuid: string;
  accessToken: string;
  expiresAt?: number;
  xboxProfile?: XboxProfile;
}

function generateState(): string {
  return crypto.randomBytes(16).toString('hex');
}

function generateVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export async function microsoftLoginStart(clientId: string, redirectUri?: string) {
  const state = generateState();
  const verifier = generateVerifier();
  const challenge = generateChallenge(verifier);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri || 'http://localhost:3000/callback',
    scope: 'XboxLive.signin offline_access',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  const authUrl = `https://login.live.com/oauth20_authorize.srf?${params.toString()}`;

  return { state, authUrl, verifier };
}

async function exchangeCodeForToken(code: string, clientId: string, redirectUri: string, verifier: string) {
  const response = await net.fetch('https://login.live.com/oauth20_token.srf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }).toString(),
  });

  if (!response.ok) throw new Error(`MS token exchange failed: ${response.status}`);
  return response.json() as Promise<{ access_token: string; refresh_token: string }>;
}

async function authenticateWithXbox(msToken: string) {
  const response = await net.fetch(XBOX_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      Properties: {
        AuthMethod: 'RPS',
        SiteName: 'user.auth.xboxlive.com',
        RpsTicket: msToken,
      },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT',
    }),
  });

  if (!response.ok) throw new Error(`Xbox auth failed: ${response.status}`);
  return response.json() as Promise<{ IssueInstant: string; Token: string; NotAfter: string }>;
}

async function authorizeWithXsts(xboxToken: string) {
  const response = await net.fetch(XBOX_XSTS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      Properties: {
        SandboxId: 'RETAIL',
        UserTokens: [xboxToken],
      },
      RelyingParty: 'rp://api.minecraftservices.com/',
      TokenType: 'JWT',
    }),
  });

  if (!response.ok) throw new Error(`Xbox XSTS failed: ${response.status}`);
  return response.json() as Promise<{ IssueInstant: string; Token: string; NotAfter: string }>;
}

async function authenticateWithMinecraft(xstsToken: string) {
  const response = await net.fetch(MC_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identityToken: `XBL3.0 x=${xstsToken}`,
    }),
  });

  if (!response.ok) throw new Error(`MC auth failed: ${response.status}`);
  return response.json() as Promise<{ username: string; access_token: string; token_type: string; expires_in: number }>;
}

async function getMinecraftProfile(accessToken: string): Promise<{ id: string; name: string; skins: unknown[] }> {
  const response = await net.fetch(MC_PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error(`MC profile failed: ${response.status}`);
  return response.json() as Promise<{ id: string; name: string; skins: unknown[] }>;
}

export async function microsoftLoginCallback(
  code: string,
  clientId: string,
  redirectUri?: string
): Promise<AuthResult> {
  const redirect = redirectUri || 'http://localhost:3000/callback';

  const msToken = await exchangeCodeForToken(code, clientId, redirect, '');
  const xboxAuth = await authenticateWithXbox(msToken.access_token);
  const xstsAuth = await authorizeWithXsts(xboxAuth.Token);
  const mcAuth = await authenticateWithMinecraft(xstsAuth.Token);
  const profile = await getMinecraftProfile(mcAuth.access_token);

  return {
    username: profile.name,
    uuid: profile.id,
    accessToken: mcAuth.access_token,
    expiresAt: Date.now() + mcAuth.expires_in * 1000,
  };
}

export async function offlineLogin(username: string): Promise<AuthResult> {
  const uuid = crypto.createHash('md5').update(`OfflinePlayer:${username}`).digest('hex');
  const formattedUuid = `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;

  return {
    username,
    uuid: formattedUuid,
    accessToken: '',
  };
}

export async function validateMinecraftToken(accessToken: string): Promise<boolean> {
  try {
    const response = await net.fetch(`${MC_SERVICES_API}/minecraft/profile`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}
