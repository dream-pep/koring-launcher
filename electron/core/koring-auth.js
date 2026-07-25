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
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestDeviceCode = requestDeviceCode;
exports.pollForTokenOnce = pollForTokenOnce;
exports.refreshAccessToken = refreshAccessToken;
exports.decodeIdToken = decodeIdToken;
exports.saveKoringAuth = saveKoringAuth;
exports.readKoringAuth = readKoringAuth;
exports.deleteKoringAuth = deleteKoringAuth;
const https = __importStar(require("https"));
const auth_1 = require("../auth");
const CLIENT_ID = '547qe8ky1pr69f08b71kj';
const DEVICE_AUTH_URL = 'https://oac.lingke.ink/oidc/device/auth';
const TOKEN_URL = 'https://oac.lingke.ink/oidc/token';
const SCOPE = 'openid offline_access profile';
function postForm(url, data) {
    return new Promise((resolve, reject) => {
        const params = new URLSearchParams(data);
        const body = params.toString().replace(/\+/g, '%20');
        const urlObj = new URL(url);
        console.log(`[koring-auth] POST ${url}`);
        console.log(`[koring-auth] body: ${body}`);
        const req = https.request({
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(body),
            },
        }, (res) => {
            let raw = '';
            res.on('data', (chunk) => (raw += chunk));
            res.on('end', () => {
                console.log(`[koring-auth] response (${res.statusCode}): ${raw}`);
                try {
                    resolve(JSON.parse(raw));
                }
                catch {
                    reject(new Error(`Invalid response: ${raw}`));
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}
function parseJwt(token) {
    try {
        const payload = token.split('.')[1];
        const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
        return JSON.parse(decoded);
    }
    catch {
        return {};
    }
}
async function requestDeviceCode() {
    const res = await postForm(DEVICE_AUTH_URL, {
        client_id: CLIENT_ID,
        scope: SCOPE,
    });
    if (res.error)
        throw new Error(res.error_description || res.error);
    return res;
}
async function pollForTokenOnce(device_code) {
    const res = await postForm(TOKEN_URL, {
        client_id: CLIENT_ID,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code,
    });
    if (res.access_token) {
        return res;
    }
    if (res.error === 'expired_token' || res.error === 'access_denied') {
        throw new Error(res.error);
    }
    // authorization_pending or slow_down — throw so caller can retry
    throw new Error(res.error || 'authorization_pending');
}
async function refreshAccessToken(refresh_token) {
    const res = await postForm(TOKEN_URL, {
        client_id: CLIENT_ID,
        grant_type: 'refresh_token',
        refresh_token,
    });
    if (res.error)
        throw new Error(res.error_description || res.error);
    return res;
}
function decodeIdToken(id_token) {
    const payload = parseJwt(id_token);
    return {
        sub: payload.sub || '',
        name: payload.name || '',
        username: payload.username || payload.name || '',
        email: payload.email || '',
        picture: payload.picture || '',
    };
}
function saveKoringAuth(tokenRes) {
    const user = decodeIdToken(tokenRes.id_token);
    const auth = {
        user,
        access_token: tokenRes.access_token,
        refresh_token: tokenRes.refresh_token,
        id_token: tokenRes.id_token,
        expires_at: Date.now() + tokenRes.expires_in * 1000,
    };
    // Reuse existing auth file for storage
    (0, auth_1.writeAuth)({
        username: user.username,
        uuid: user.sub,
        accessToken: auth.access_token,
        refreshToken: auth.refresh_token,
        xboxProfile: JSON.stringify(user),
    });
    return user;
}
function readKoringAuth() {
    const auth = (0, auth_1.readAuth)();
    if (!auth.username || !auth.refreshToken)
        return null;
    let user = { sub: '', name: '', username: '', email: '', picture: '' };
    try {
        user = JSON.parse(auth.xboxProfile || '{}');
    }
    catch { }
    return {
        user,
        access_token: auth.accessToken,
        refresh_token: auth.refreshToken,
        id_token: '',
        expires_at: 0,
    };
}
function deleteKoringAuth() {
    (0, auth_1.writeAuth)({ username: '', uuid: '', accessToken: '', refreshToken: '', xboxProfile: '' });
}
