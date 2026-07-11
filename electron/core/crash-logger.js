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
exports.writeCrashLog = writeCrashLog;
exports.readCrashLog = readCrashLog;
exports.clearCrashLog = clearCrashLog;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const electron_1 = __importDefault(require("electron"));
const { app } = electron_1.default;
const LOG_FILE = 'koring-crash.log';
const MAX_LINES = 1000;
function logPath() {
    if (app.isPackaged) {
        return path.join(path.dirname(app.getPath('exe')), LOG_FILE);
    }
    return path.join(__dirname, '..', LOG_FILE);
}
function trimFile(filePath) {
    try {
        if (!fs.existsSync(filePath))
            return;
        const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
        if (lines.length > MAX_LINES) {
            fs.writeFileSync(filePath, lines.slice(-MAX_LINES).join('\n') + '\n', 'utf-8');
        }
    }
    catch { }
}
function writeCrashLog(entry) {
    const filePath = logPath();
    try {
        const line = JSON.stringify(entry) + '\n';
        fs.appendFileSync(filePath, line, 'utf-8');
        trimFile(filePath);
    }
    catch { }
}
function readCrashLog() {
    const filePath = logPath();
    try {
        if (!fs.existsSync(filePath))
            return '';
        return fs.readFileSync(filePath, 'utf-8');
    }
    catch {
        return '';
    }
}
function clearCrashLog() {
    const filePath = logPath();
    try {
        if (fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, '', 'utf-8');
        }
    }
    catch { }
}
