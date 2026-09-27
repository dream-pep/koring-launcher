import * as https from 'https';
import { readAuth, writeAuth } from '../auth';
import { createLogger } from './logger';
import { getEnv, getEnvBase } from './env';

const log = createLogger('core/koring-auth');

const CLIENT_ID = '547qe8ky1pr69f08b71kj';
const SCOPE = 'openid offline_access profile';

/**
 * OIDC 设备码端点基址（来自环境变量，不写死在代码里）：
 *   KORING_API_BASE   服务地址，如 https://account.koring.space
 *   KORING_OIDC_BASE  可选：直接指定 OIDC 基址；默认 `${KORING_API_BASE}/api/v1/oidc`
 *
 * ⚠️ 实测（2026-09-26）：新 API 域名上 **不带版本号** 的 `/oidc/*` 会 308 重定向到
 * https://account.koring.space/oidc/*（Node 侧 https.request 不跟随重定向，会直接失败），
 * 可用路径是带版本号的别名 `/api/v1/oidc/*`（与文档 §0 的说明一致）。
 * 需要指回旧服务（只有不带版本号的路径）时用 KORING_OIDC_BASE 覆盖。
 */
function oidcBase(): string {
  const override = getEnvBase('KORING_OIDC_BASE');
  if (override) return override;
  const base = getEnvBase('KORING_API_BASE');
  if (!base) {
    throw new Error('未配置 KORING_API_BASE（Koring Account 服务地址），请检查 .env 文件');
  }
  return `${base}/api/v1/oidc`;
}

export interface DeviceAuthResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
}

export interface TokenResponse {
  access_token: string;
  id_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface KoringUser {
  sub: string;
  name: string;
  username: string;
  email: string;
  picture: string;
}

function postForm(url: string, data: Record<string, string>): Promise<any> {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams(data);
    const body = params.toString().replace(/\+/g, '%20');
    const urlObj = new URL(url);
    log.info(`[koring-auth] POST ${url}`);
    log.info(`[koring-auth] body: ${body}`);
    const req = https.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          log.info(`[koring-auth] response (${res.statusCode}): ${raw}`);
          try {
            const parsed = JSON.parse(raw);
            // 兼容两种响应形状：新 Account 服务的 OIDC 端点在成功时用统一信封
            // （{ok:true,data:{…}}，见 docs/LAUNCHER-API.MD §5.2/§5.3），
            // 旧服务与失败响应是裸 JSON（{device_code…} / {error…}）。
            // 这里统一拆包，调用方逻辑无需区分。
            if (parsed && typeof parsed === 'object' && parsed.ok === true && parsed.data && typeof parsed.data === 'object') {
              resolve(parsed.data);
              return;
            }
            resolve(parsed);
          } catch {
            reject(new Error(`Invalid response: ${raw}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function parseJwt(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1];
    const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    return {};
  }
}

export async function requestDeviceCode(): Promise<DeviceAuthResponse> {
  const res = await postForm(`${oidcBase()}/device/auth`, {
    client_id: CLIENT_ID,
    scope: SCOPE,
  });
  if (res.error) throw new Error(res.error_description || res.error);
  return res as DeviceAuthResponse;
}

export async function pollForTokenOnce(
  device_code: string
): Promise<TokenResponse> {
  const res = await postForm(`${oidcBase()}/token`, {
    client_id: CLIENT_ID,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    device_code,
  });

  if (res.access_token) {
    return res as TokenResponse;
  }

  if (res.error === 'expired_token' || res.error === 'access_denied') {
    throw new Error(res.error);
  }

  // authorization_pending or slow_down — throw so caller can retry
  throw new Error(res.error || 'authorization_pending');
}

export async function refreshAccessToken(refresh_token: string): Promise<TokenResponse> {
  const res = await postForm(`${oidcBase()}/token`, {
    client_id: CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token,
  });
  if (res.error) throw new Error(res.error_description || res.error);
  return res as TokenResponse;
}

export function decodeIdToken(id_token: string): KoringUser {
  const payload = parseJwt(id_token);
  return {
    sub: (payload.sub as string) || '',
    name: (payload.name as string) || '',
    username: (payload.username as string) || (payload.name as string) || '',
    email: (payload.email as string) || '',
    picture: (payload.picture as string) || '',
  };
}

export interface StoredKoringAuth {
  user: KoringUser;
  access_token: string;
  refresh_token: string;
  id_token: string;
  expires_at: number;
}

export function saveKoringAuth(tokenRes: TokenResponse): KoringUser {
  const user = decodeIdToken(tokenRes.id_token);
  const auth: StoredKoringAuth = {
    user,
    access_token: tokenRes.access_token,
    refresh_token: tokenRes.refresh_token,
    id_token: tokenRes.id_token,
    expires_at: Date.now() + tokenRes.expires_in * 1000,
  };
  // Reuse existing auth file for storage
  writeAuth({
    username: user.username,
    uuid: user.sub,
    accessToken: auth.access_token,
    refreshToken: auth.refresh_token,
    xboxProfile: JSON.stringify(user),
  });
  return user;
}

export function readKoringAuth(): StoredKoringAuth | null {
  const auth = readAuth();
  if (!auth.username || !auth.refreshToken) return null;
  let user: KoringUser = { sub: '', name: '', username: '', email: '', picture: '' };
  try {
    user = JSON.parse(auth.xboxProfile || '{}') as KoringUser;
  } catch {}
  return {
    user,
    access_token: auth.accessToken,
    refresh_token: auth.refreshToken,
    id_token: '',
    expires_at: 0,
  };
}

export function deleteKoringAuth(): void {
  writeAuth({ username: '', uuid: '', accessToken: '', refreshToken: '', xboxProfile: '' });
}
