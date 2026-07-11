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
exports.createInstance = createInstance;
exports.listInstances = listInstances;
exports.getInstanceInfo = getInstanceInfo;
exports.deleteInstance = deleteInstance;
exports.updateInstance = updateInstance;
exports.installInstanceGame = installInstanceGame;
exports.launchInstance = launchInstance;
exports.diagnoseInstance = diagnoseInstance;
exports.getMinecraftVersionList = getMinecraftVersionList;
exports.getForgeVersionList = getForgeVersionList;
exports.getFabricVersionList = getFabricVersionList;
exports.getQuiltVersionList = getQuiltVersionList;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const core_1 = require("@xmcl/core");
const installer_1 = require("@xmcl/installer");
const INSTANCE_CONFIG_FILE = 'instance.json';
function getInstanceConfigPath(instancePath) {
    return path.join(instancePath, INSTANCE_CONFIG_FILE);
}
function countFiles(dir, ext) {
    if (!fs.existsSync(dir))
        return 0;
    return fs.readdirSync(dir).filter((f) => {
        if (ext)
            return f.endsWith(ext);
        return fs.statSync(path.join(dir, f)).isFile();
    }).length;
}
function getInstanceIssues(instancePath, runtime) {
    const issues = [];
    if (!fs.existsSync(path.join(instancePath, 'versions', runtime.minecraft, `${runtime.minecraft}.json`))) {
        issues.push(`Version JSON not found for ${runtime.minecraft}`);
    }
    if (!fs.existsSync(path.join(instancePath, 'versions', runtime.minecraft, `${runtime.minecraft}.jar`))) {
        issues.push(`Client JAR not found for ${runtime.minecraft}`);
    }
    return issues;
}
async function createInstance(name, gamePath, runtime, options) {
    const instancePath = path.join(gamePath, 'instances', name);
    if (fs.existsSync(instancePath)) {
        throw new Error(`Instance already exists: ${name}`);
    }
    fs.mkdirSync(instancePath, { recursive: true });
    const now = Date.now();
    const config = {
        name,
        author: options?.author || '',
        description: options?.description || '',
        runtime,
        java: options?.java,
        minMemory: options?.minMemory,
        maxMemory: options?.maxMemory,
        vmOptions: options?.vmOptions,
        mcOptions: options?.mcOptions,
        creationDate: now,
        lastAccessDate: now,
        lastPlayedDate: 0,
        playtime: 0,
    };
    fs.writeFileSync(getInstanceConfigPath(instancePath), JSON.stringify(config, null, 2), 'utf-8');
    // Create standard directories
    for (const dir of ['mods', 'config', 'resourcepacks', 'shaderpacks', 'saves', 'screenshots', 'logs']) {
        fs.mkdirSync(path.join(instancePath, dir), { recursive: true });
    }
    return getInstanceInfo(name, gamePath);
}
async function listInstances(gamePath) {
    const instancesPath = path.join(gamePath, 'instances');
    const instances = [];
    if (!fs.existsSync(instancesPath)) {
        return instances;
    }
    const entries = fs.readdirSync(instancesPath, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory())
            continue;
        try {
            instances.push(await getInstanceInfo(entry.name, gamePath));
        }
        catch {
            // Skip invalid instances
        }
    }
    return instances;
}
async function getInstanceInfo(name, gamePath) {
    const instancePath = path.join(gamePath, 'instances', name);
    const configPath = getInstanceConfigPath(instancePath);
    if (!fs.existsSync(configPath)) {
        throw new Error(`Instance not found: ${name}`);
    }
    const configRaw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configRaw);
    const issues = getInstanceIssues(instancePath, config.runtime);
    return {
        name,
        path: instancePath,
        config,
        modCount: countFiles(path.join(instancePath, 'mods'), '.jar'),
        resourcePackCount: countFiles(path.join(instancePath, 'resourcepacks'), '.zip'),
        screenshotCount: countFiles(path.join(instancePath, 'screenshots')),
        saveCount: countFiles(path.join(instancePath, 'saves')),
        healthy: issues.length === 0,
        issues,
    };
}
async function deleteInstance(name, gamePath) {
    const instancePath = path.join(gamePath, 'instances', name);
    if (!fs.existsSync(instancePath)) {
        throw new Error(`Instance not found: ${name}`);
    }
    fs.rmSync(instancePath, { recursive: true, force: true });
    return { deleted: name };
}
async function updateInstance(name, gamePath, patch) {
    const instancePath = path.join(gamePath, 'instances', name);
    const configPath = getInstanceConfigPath(instancePath);
    if (!fs.existsSync(configPath)) {
        throw new Error(`Instance not found: ${name}`);
    }
    const configRaw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configRaw);
    const updated = { ...config, ...patch };
    fs.writeFileSync(configPath, JSON.stringify(updated, null, 2), 'utf-8');
    return getInstanceInfo(name, gamePath);
}
async function installInstanceGame(name, gamePath, callbacks) {
    const instance = await getInstanceInfo(name, gamePath);
    const { runtime } = instance.config;
    const instancePath = instance.path;
    callbacks?.onProgress?.({ stage: 'installing-minecraft', current: 0, total: 100, message: `Installing Minecraft ${runtime.minecraft}...` });
    // Install Minecraft
    // First get version list to find the version info
    const versionList = await (0, installer_1.getVersionList)();
    const versionInfo = versionList.versions.find((v) => v.id === runtime.minecraft);
    if (!versionInfo) {
        throw new Error(`Minecraft version ${runtime.minecraft} not found`);
    }
    await (0, installer_1.install)({ id: versionInfo.id, url: versionInfo.url }, instancePath);
    // Install mod loaders
    if (runtime.forge) {
        callbacks?.onProgress?.({ stage: 'installing-forge', current: 0, total: 100, message: `Installing Forge ${runtime.forge}...` });
        await (0, installer_1.installForge)({ version: runtime.forge, mcversion: runtime.minecraft }, instancePath);
    }
    if (runtime.fabricLoader) {
        callbacks?.onProgress?.({ stage: 'installing-fabric', current: 0, total: 100, message: `Installing Fabric ${runtime.fabricLoader}...` });
        await (0, installer_1.installFabric)({
            minecraftVersion: runtime.minecraft,
            version: runtime.fabricLoader,
            minecraft: instancePath,
        });
    }
    if (runtime.quiltLoader) {
        callbacks?.onProgress?.({ stage: 'installing-quilt', current: 0, total: 100, message: `Installing Quilt ${runtime.quiltLoader}...` });
        await (0, installer_1.installQuiltVersion)({
            minecraftVersion: runtime.minecraft,
            version: runtime.quiltLoader,
            minecraft: instancePath,
        });
    }
    if (runtime.neoForged) {
        callbacks?.onProgress?.({ stage: 'installing-neoforge', current: 0, total: 100, message: `Installing NeoForge ${runtime.neoForged}...` });
        await (0, installer_1.installNeoForged)('neoforge', runtime.neoForged, instancePath, {});
    }
    // Note: OptiFine requires downloading the installer JAR first
    // if (runtime.optifine) {
    //   callbacks?.onProgress?.({ stage: 'installing-optifine', current: 0, total: 100, message: `Installing OptiFine ${runtime.optifine}...` });
    //   await installOptifine(runtime.optifine, instancePath);
    // }
    callbacks?.onProgress?.({ stage: 'installing-dependencies', current: 0, total: 100, message: 'Installing dependencies...' });
    // Install all dependencies (libraries + assets)
    const resolved = await core_1.Version.parse(instancePath, runtime.minecraft);
    await (0, installer_1.installDependencies)(resolved);
    callbacks?.onProgress?.({ stage: 'done', current: 100, total: 100, message: 'Installation complete' });
    // Update last access date
    await updateInstance(name, gamePath, { lastAccessDate: Date.now() });
    return getInstanceInfo(name, gamePath);
}
async function launchInstance(name, gamePath, options) {
    const instance = await getInstanceInfo(name, gamePath);
    const { runtime } = instance.config;
    const resolved = await core_1.Version.parse(instance.path, runtime.minecraft);
    const javaPath = options.javaPath || instance.config.java || 'java';
    const mcProcess = await (0, core_1.launch)({
        gameProfile: {
            id: options.uuid,
            name: options.username,
        },
        javaPath,
        version: resolved,
        gamePath: instance.path,
        minMemory: instance.config.minMemory || 1024,
        maxMemory: instance.config.maxMemory || 4096,
        extraExecOption: { detached: true, stdio: 'ignore' },
        server: options.server ? { ip: options.server.host, port: options.server.port } : undefined,
    });
    const watcher = (0, core_1.createMinecraftProcessWatcher)(mcProcess);
    watcher.on('minecraft-window-ready', () => {
        options.onEvent?.({ event: 'window-ready' });
    });
    watcher.on('minecraft-exit', ({ code }) => {
        options.onEvent?.({ event: 'exit', code });
    });
    // Update playtime tracking
    const startTime = Date.now();
    mcProcess.on('exit', async () => {
        const elapsed = Date.now() - startTime;
        try {
            const info = await getInstanceInfo(name, gamePath);
            await updateInstance(name, gamePath, {
                lastPlayedDate: Date.now(),
                playtime: (info.config.playtime || 0) + elapsed,
            });
        }
        catch {
            // Ignore errors during playtime update
        }
    });
    // Update last access date
    await updateInstance(name, gamePath, { lastAccessDate: Date.now() });
    return {
        pid: mcProcess.pid || 0,
        version: runtime.minecraft,
        username: options.username,
    };
}
async function diagnoseInstance(name, gamePath) {
    const instance = await getInstanceInfo(name, gamePath);
    return {
        healthy: instance.healthy,
        issues: instance.issues,
    };
}
// Version list APIs
async function getMinecraftVersionList(type) {
    const manifest = await (0, installer_1.getVersionList)();
    let versions = manifest.versions;
    if (type && type !== 'all') {
        versions = versions.filter((v) => v.type === type);
    }
    return { versions };
}
async function getForgeVersionList(mcVersion) {
    const list = await (0, installer_1.getForgeVersionList)({ minecraft: mcVersion });
    return { versions: list.versions };
}
async function getFabricVersionList(mcVersion) {
    if (mcVersion) {
        const loaders = await (0, installer_1.getFabricLoaders)();
        return { versions: loaders.map((l) => l.version) };
    }
    const loaders = await (0, installer_1.getFabricLoaders)();
    return { versions: loaders.map((l) => l.version) };
}
async function getQuiltVersionList(mcVersion) {
    const loaders = await (0, installer_1.getQuiltLoaderVersionsByMinecraft)({ minecraftVersion: mcVersion || '*' });
    return { versions: loaders.map((l) => l.loader.version) };
}
