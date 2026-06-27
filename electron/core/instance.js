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
exports.deleteInstance = deleteInstance;
exports.getInstanceInfo = getInstanceInfo;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const INSTANCE_CONFIG_FILE = 'koring-instance.json';
function getInstanceConfigPath(instancePath) {
    return path.join(instancePath, INSTANCE_CONFIG_FILE);
}
async function createInstance(name, gamePath, mcVersion, loaderType, loaderVersion, javaPath, memory) {
    const instancePath = path.join(gamePath, 'instances', name);
    if (!fs.existsSync(instancePath)) {
        fs.mkdirSync(instancePath, { recursive: true });
    }
    const config = {
        name,
        mcVersion,
        loaderType,
        loaderVersion,
        javaPath,
        memory,
        createdAt: new Date().toISOString(),
    };
    const configPath = getInstanceConfigPath(instancePath);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    // Create mods directory
    const modsDir = path.join(instancePath, 'mods');
    if (!fs.existsSync(modsDir)) {
        fs.mkdirSync(modsDir, { recursive: true });
    }
    // Count mods
    const mods = fs.readdirSync(modsDir).filter((f) => f.endsWith('.jar'));
    return {
        name,
        path: instancePath,
        config,
        modCount: mods.length,
    };
}
async function listInstances(instancesPath) {
    const instances = [];
    if (!fs.existsSync(instancesPath)) {
        return instances;
    }
    const entries = fs.readdirSync(instancesPath, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory())
            continue;
        const instancePath = path.join(instancesPath, entry.name);
        const configPath = getInstanceConfigPath(instancePath);
        if (!fs.existsSync(configPath))
            continue;
        try {
            const configRaw = fs.readFileSync(configPath, 'utf-8');
            const config = JSON.parse(configRaw);
            // Count mods
            const modsDir = path.join(instancePath, 'mods');
            let modCount = 0;
            if (fs.existsSync(modsDir)) {
                modCount = fs.readdirSync(modsDir).filter((f) => f.endsWith('.jar')).length;
            }
            instances.push({
                name: entry.name,
                path: instancePath,
                config,
                modCount,
            });
        }
        catch {
            // Skip invalid config
        }
    }
    return instances;
}
async function deleteInstance(name, instancesPath) {
    const instancePath = path.join(instancesPath, name);
    if (fs.existsSync(instancePath)) {
        fs.rmSync(instancePath, { recursive: true, force: true });
    }
    return { deleted: name };
}
async function getInstanceInfo(name, instancesPath) {
    const instancePath = path.join(instancesPath, name);
    const configPath = getInstanceConfigPath(instancePath);
    if (!fs.existsSync(configPath)) {
        throw new Error(`Instance not found: ${name}`);
    }
    const configRaw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configRaw);
    // Count mods
    const modsDir = path.join(instancePath, 'mods');
    let modCount = 0;
    if (fs.existsSync(modsDir)) {
        modCount = fs.readdirSync(modsDir).filter((f) => f.endsWith('.jar')).length;
    }
    return {
        name,
        path: instancePath,
        config,
        modCount,
    };
}
