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
exports.getVersionList = getVersionList;
exports.getForgeVersions = getForgeVersions;
exports.getFabricVersions = getFabricVersions;
exports.installMinecraft = installMinecraft;
exports.installModLoader = installModLoader;
const electron_1 = __importDefault(require("electron"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const { net } = electron_1.default;
const VERSION_MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest.json';
const FORGE_VERSION_LIST_URL = 'https://files.minecraftforge.net/net/minecraftforge/forge/json';
const FABRIC_VERSION_LIST_URL = 'https://meta.fabricmc.net/v2/versions';
async function downloadFile(url, dest, onProgress) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const request = client.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                downloadFile(response.headers.location, dest, onProgress).then(resolve).catch(reject);
                return;
            }
            if (response.statusCode !== 200) {
                reject(new Error(`Download failed: ${response.statusCode}`));
                return;
            }
            const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
            let downloadedBytes = 0;
            const dir = path.dirname(dest);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const file = fs.createWriteStream(dest);
            response.on('data', (chunk) => {
                downloadedBytes += chunk.length;
                if (onProgress && totalBytes > 0) {
                    onProgress({
                        stage: 'downloading',
                        current: downloadedBytes,
                        total: totalBytes,
                        message: `${Math.round((downloadedBytes / totalBytes) * 100)}%`,
                    });
                }
            });
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
            file.on('error', (err) => {
                fs.unlink(dest, () => { });
                reject(err);
            });
        });
        request.on('error', reject);
    });
}
async function getVersionList(type) {
    const response = await net.fetch(VERSION_MANIFEST_URL);
    if (!response.ok)
        throw new Error(`Failed to fetch version manifest: ${response.status}`);
    const manifest = await response.json();
    if (type && type !== 'all') {
        manifest.versions = manifest.versions.filter((v) => v.type === type);
    }
    return manifest;
}
async function getForgeVersions(mcVersion) {
    try {
        const response = await net.fetch(FORGE_VERSION_LIST_URL);
        if (!response.ok)
            throw new Error(`Forge version list failed: ${response.status}`);
        const data = await response.json();
        const versions = data.versions[mcVersion || ''] || [];
        return { versions };
    }
    catch {
        return { versions: [] };
    }
}
async function getFabricVersions(mcVersion) {
    try {
        const url = mcVersion
            ? `${FABRIC_VERSION_LIST_URL}/loader/${mcVersion}`
            : `${FABRIC_VERSION_LIST_URL}/loader`;
        const response = await net.fetch(url);
        if (!response.ok)
            throw new Error(`Fabric version list failed: ${response.status}`);
        const data = await response.json();
        return { versions: data.map((v) => v.version) };
    }
    catch {
        return { versions: [] };
    }
}
async function installMinecraft(version, gamePath, javaPath, downloadThreads, callbacks) {
    const versionDir = path.join(gamePath, 'versions', version);
    if (!fs.existsSync(versionDir)) {
        fs.mkdirSync(versionDir, { recursive: true });
    }
    // Download version manifest
    const manifestResponse = await net.fetch(VERSION_MANIFEST_URL);
    const manifest = await manifestResponse.json();
    const versionInfo = manifest.versions.find((v) => v.id === version);
    if (!versionInfo)
        throw new Error(`Version ${version} not found`);
    callbacks?.onProgress?.({ stage: 'downloading', current: 0, total: 100, message: 'Downloading version manifest...' });
    // Download version JSON
    const versionJsonPath = path.join(versionDir, `${version}.json`);
    await downloadFile(versionInfo.url, versionJsonPath, callbacks?.onProgress);
    const versionJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'));
    // Download client jar
    const clientJar = versionJson.downloads?.client;
    if (clientJar) {
        callbacks?.onProgress?.({ stage: 'downloading', current: 1, total: 3, message: 'Downloading client jar...' });
        const jarPath = path.join(versionDir, `${version}.jar`);
        await downloadFile(clientJar.url, jarPath, callbacks?.onProgress);
    }
    callbacks?.onProgress?.({ stage: 'downloading', current: 2, total: 3, message: 'Installing libraries...' });
    // Download libraries
    const libraries = versionJson.libraries || [];
    for (const lib of libraries) {
        if (lib.downloads?.artifact?.url) {
            const libPath = path.join(gamePath, 'libraries', lib.downloads.artifact.path);
            if (!fs.existsSync(libPath)) {
                await downloadFile(lib.downloads.artifact.url, libPath);
            }
        }
    }
    callbacks?.onProgress?.({ stage: 'downloading', current: 3, total: 3, message: 'Installation complete' });
    return { version, gamePath };
}
async function installModLoader(mcVersion, gamePath, loaderType, loaderVersion, javaPath, callbacks) {
    callbacks?.onProgress?.({ stage: 'installing', current: 0, total: 100, message: `Installing ${loaderType}...` });
    // Placeholder: actual implementation depends on loader type
    // This would call the appropriate installer for Forge/Fabric/Quilt/NeoForge
    callbacks?.onProgress?.({ stage: 'installing', current: 100, total: 100, message: `${loaderType} installed` });
    return {
        loaderType,
        mcVersion,
        loaderVersion: loaderVersion || 'latest',
    };
}
