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

// ==================== LittleSkin（Yggdrasil 协议）====================

// LittleSkin Yggdrasil 认证端点
const LITTLESKIN_AUTH_URL = 'https://littleskin.cn/api/yggdrasil/authserver/authenticate';

// 将 32 位无横线 UUID 格式化为 36 位带横线形式（已是带横线则原样返回）
function formatUuid(id: string): string {
  const hex = id.replace(/-/g, '');
  if (hex.length !== 32) return id;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface LittleskinProfile {
  username: string;
  uuid: string;
  accessToken: string;
  clientToken: string;
}

/**
 * LittleSkin 登录（Yggdrasil authenticate）。
 * 多个角色时优先 selectedProfile，否则取第一个可用角色。
 */
export async function littleskinLogin(username: string, password: string): Promise<LittleskinProfile> {
  const clientToken = crypto.randomUUID();

  const response = await net.fetch(LITTLESKIN_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      password,
      clientToken,
      agent: { name: 'Minecraft', version: 1 },
      requestUser: false,
    }),
  });

  // 403/401 通常为账号或密码错误
  if (response.status === 403 || response.status === 401) {
    throw new Error('用户名或密码错误');
  }
  if (!response.ok) {
    throw new Error(`LittleSkin 登录失败: ${response.status}`);
  }

  const data = (await response.json()) as {
    accessToken: string;
    clientToken: string;
    availableProfiles?: { id: string; name: string }[];
    selectedProfile?: { id: string; name: string };
  };

  const profiles = data.availableProfiles ?? [];
  const profile = data.selectedProfile ?? profiles[0];
  if (!profile) {
    throw new Error('该账号没有可用的 Minecraft 角色');
  }

  return {
    username: profile.name,
    uuid: formatUuid(profile.id),
    accessToken: data.accessToken,
    clientToken: data.clientToken ?? clientToken,
  };
}
