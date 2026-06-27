"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.microsoftLoginStart = microsoftLoginStart;
exports.microsoftLoginCallback = microsoftLoginCallback;
exports.offlineLogin = offlineLogin;
exports.validateMinecraftToken = validateMinecraftToken;
const crypto = __importStar(require("crypto"));
const electron_1 = __importDefault(require("electron"));
const { net } = electron_1.default;
const MC_SERVICES_API = 'https://api.minecraftservices.com';
const XBOX_AUTH_URL = 'https://user.auth.xboxlive.com/user/authenticate';
const XBOX_XSTS_URL = 'https://xsts.auth.xboxlive.com/xsts/authorize';
const MC_AUTH_URL = 'https://api.minecraftservices.com/authentication/login_with_xbox';
const MC_PROFILE_URL = 'https://api.minecraftservices.com/minecraft/profile';
function generateState() {
    return crypto.randomBytes(16).toString('hex');
}
function generateVerifier() {
    return crypto.randomBytes(32).toString('base64url');
}
function generateChallenge(verifier) {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
}
async function microsoftLoginStart(clientId, redirectUri) {
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
async function exchangeCodeForToken(code, clientId, redirectUri, verifier) {
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
    if (!response.ok)
        throw new Error(`MS token exchange failed: ${response.status}`);
    return response.json();
}
async function authenticateWithXbox(msToken) {
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
    if (!response.ok)
        throw new Error(`Xbox auth failed: ${response.status}`);
    return response.json();
}
async function authorizeWithXsts(xboxToken) {
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
    if (!response.ok)
        throw new Error(`Xbox XSTS failed: ${response.status}`);
    return response.json();
}
async function authenticateWithMinecraft(xstsToken) {
    const response = await net.fetch(MC_AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            identityToken: `XBL3.0 x=${xstsToken}`,
        }),
    });
    if (!response.ok)
        throw new Error(`MC auth failed: ${response.status}`);
    return response.json();
}
async function getMinecraftProfile(accessToken) {
    const response = await net.fetch(MC_PROFILE_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok)
        throw new Error(`MC profile failed: ${response.status}`);
    return response.json();
}
async function microsoftLoginCallback(code, clientId, redirectUri) {
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
async function offlineLogin(username) {
    const uuid = crypto.createHash('md5').update(`OfflinePlayer:${username}`).digest('hex');
    const formattedUuid = `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;
    return {
        username,
        uuid: formattedUuid,
        accessToken: '',
    };
}
async function validateMinecraftToken(accessToken) {
    try {
        const response = await net.fetch(`${MC_SERVICES_API}/minecraft/profile`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        return response.ok;
    }
    catch {
        return false;
    }
}
