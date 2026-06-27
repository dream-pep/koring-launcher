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
exports.searchMods = searchMods;
exports.getModDetail = getModDetail;
exports.getModVersions = getModVersions;
exports.installMod = installMod;
const electron_1 = __importDefault(require("electron"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const { net } = electron_1.default;
const MODRINTH_API = 'https://api.modrinth.com/v2';
const CURSEFORGE_API = 'https://api.curseforge.com/v1';
async function searchModrinth(query, gameVersion, loader, limit = 20, offset = 0) {
    const facets = [];
    if (gameVersion)
        facets.push([`versions:${gameVersion}`]);
    if (loader)
        facets.push([`categories:${loader}`]);
    const params = new URLSearchParams({
        query: query || '',
        limit: String(limit),
        offset: String(offset),
    });
    if (facets.length > 0) {
        params.set('facets', JSON.stringify(facets));
    }
    const response = await net.fetch(`${MODRINTH_API}/search?${params.toString()}`);
    if (!response.ok)
        throw new Error(`Modrinth search failed: ${response.status}`);
    const data = await response.json();
    return data.hits.map((hit) => ({
        id: hit.project_id,
        slug: hit.slug,
        name: hit.title,
        description: hit.description,
        downloads: hit.downloads,
        iconUrl: hit.icon_url,
        categories: hit.categories,
        versions: hit.versions,
        source: 'modrinth',
    }));
}
async function searchCurseForge(query, gameVersion, loader, limit = 20, offset = 0) {
    // CurseForge requires API key - return empty for now
    return [];
}
async function searchMods(query, gameVersion, loader, limit, offset, source = 'modrinth') {
    if (source === 'modrinth') {
        return searchModrinth(query, gameVersion, loader, limit, offset);
    }
    return searchCurseForge(query, gameVersion, loader, limit, offset);
}
async function getModDetail(projectId, source = 'modrinth') {
    if (source === 'modrinth') {
        const response = await net.fetch(`${MODRINTH_API}/project/${projectId}`);
        if (!response.ok)
            throw new Error(`Modrinth detail failed: ${response.status}`);
        const data = await response.json();
        return {
            id: data.id,
            slug: data.slug,
            name: data.title,
            description: data.description,
            downloads: data.downloads,
            iconUrl: data.icon_url,
            categories: data.categories,
            versions: data.versions,
            source: 'modrinth',
        };
    }
    throw new Error(`CurseForge detail not implemented`);
}
async function getModVersions(projectId, gameVersion, loader, source = 'modrinth') {
    if (source === 'modrinth') {
        const params = new URLSearchParams();
        if (gameVersion)
            params.set('game_versions', JSON.stringify([gameVersion]));
        if (loader)
            params.set('loaders', JSON.stringify([loader]));
        const response = await net.fetch(`${MODRINTH_API}/project/${projectId}/version?${params.toString()}`);
        if (!response.ok)
            throw new Error(`Modrinth versions failed: ${response.status}`);
        const data = await response.json();
        return data.map((v) => ({
            id: v.id,
            name: v.name,
            versionNumber: v.version_number,
            gameVersions: v.game_versions,
            loaders: v.loaders,
            files: v.files.map((f) => ({
                filename: f.filename,
                url: f.url,
                size: f.size,
                primary: f.primary,
            })),
        }));
    }
    throw new Error(`CurseForge versions not implemented`);
}
async function installMod(projectId, versionId, gamePath, source = 'modrinth') {
    const versions = await getModVersions(projectId, undefined, undefined, source);
    const targetVersion = versionId
        ? versions.find((v) => v.id === versionId)
        : versions[0];
    if (!targetVersion)
        throw new Error('No version found');
    const primaryFile = targetVersion.files.find((f) => f.primary) || targetVersion.files[0];
    if (!primaryFile)
        throw new Error('No file found');
    // Download the mod file
    const modsDir = path.join(gamePath, 'mods');
    if (!fs.existsSync(modsDir)) {
        fs.mkdirSync(modsDir, { recursive: true });
    }
    const filePath = path.join(modsDir, primaryFile.filename);
    const response = await net.fetch(primaryFile.url);
    if (!response.ok)
        throw new Error(`Download failed: ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filePath, buffer);
    return {
        projectId,
        versionId: targetVersion.id,
        filename: primaryFile.filename,
        path: filePath,
    };
}
