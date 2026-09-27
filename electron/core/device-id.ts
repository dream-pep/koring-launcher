// 设备唯一标识（组合指纹 + 回退 MachineGuid）
//
// 用途：为“设备识别码”提供尽量唯一且稳定的标识（授权/激活/统计）。
// 来源优先级（均为硬件级，重装系统不变）：
//   1. board  — 主板 UUID（Win32_ComputerSystemProduct.UUID）
//   2. disk   — 硬盘序列号（Win32_DiskDrive 首个物理盘）
//   3. bios   — BIOS 序列号（Win32_BIOS；存在大量 OEM 默认值，故置后）
//   4. machine— 注册表 MachineGuid（系统安装级，作为最终回退）
// 取第一个有效值 → SHA-256 → 前 32 位十六进制 → UUID 样式分段展示。
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import * as os from 'os';

export type DeviceIdSource = 'board' | 'disk' | 'bios' | 'machine' | 'none';

export interface DeviceIdentity {
  deviceId: string | null;
  source: DeviceIdSource;
}

/** OEM/虚拟机常见的占位序列号，视为无效 */
const INVALID_VALUES = [
  'to be filled',
  'o.e.m',
  'default string',
  'system serial number',
  'not specified',
  'not available',
  'none',
  'n/a',
  'unknown',
  'unspecified',
  'innotek',
  'bochs',
  'vmware',
];

function isValid(value?: string | null): value is string {
  if (!value) return false;
  const v = value.trim();
  if (!v) return false;
  if (/^0+$/.test(v)) return false; // 全 0
  if (/^0{8}-0{4}-0{4}-0{4}-0{12}$/i.test(v)) return false; // 00000000-... 全空 UUID
  const low = v.toLowerCase();
  return !INVALID_VALUES.some((bad) => low.includes(bad));
}

interface ProbeResult {
  board: string;
  disk: string;
  bios: string;
  machine: string;
  /** 操作系统名称（Win32_OperatingSystem.Caption） */
  osName: string;
  /** 操作系统版本（Win32_OperatingSystem.Version） */
  osVersion: string;
}

/**
 * 读取候选标识 + 系统信息（Windows 一条 PowerShell 完成，逐项容错）。
 * board 即 SMBIOS UUID（Win32_ComputerSystemProduct.UUID），同时供
 * getSmbiosUuid()（Account API 设备上报用）与 getDeviceId()（哈希指纹）使用。
 *
 * 注意：必须用 execFileSync 直接传参。execSync 走 cmd.exe，脚本里的 `|`（管道）
 * 会被 cmd 当成自己的管道符解析，导致 Get-CimInstance 从未真正执行
 * （历史 bug：getDeviceId() 一直返回 source='none'）。
 */
function probeSources(): ProbeResult {
  const empty: ProbeResult = { board: '', disk: '', bios: '', machine: '', osName: '', osVersion: '' };
  if (process.platform !== 'win32') return empty;
  const ps = [
    // Windows PowerShell 5.1 默认按控制台代码页（简中为 GBK）写 stdout，
    // Node 按 UTF-8 解码会把中文系统名变成乱码 → 强制 UTF-8 输出
    '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;',
    "$ErrorActionPreference='SilentlyContinue';",
    '$b=(Get-CimInstance Win32_ComputerSystemProduct).UUID;',
    '$d=(Get-CimInstance Win32_DiskDrive|Select-Object -First 1).SerialNumber;',
    '$i=(Get-CimInstance Win32_BIOS).SerialNumber;',
    "$g=(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Cryptography').MachineGuid;",
    '$o=Get-CimInstance Win32_OperatingSystem;',
    '[pscustomobject]@{board=[string]$b;disk=[string]$d;bios=[string]$i;machine=[string]$g;osName=[string]$o.Caption;osVersion=[string]$o.Version}|ConvertTo-Json -Compress',
  ].join(' ');
  try {
    const output = execFileSync('powershell', ['-NoProfile', '-Command', ps], {
      encoding: 'utf-8',
      timeout: 8000,
      windowsHide: true,
    });
    const parsed = JSON.parse(output.trim() || '{}');
    return {
      board: String(parsed.board ?? ''),
      disk: String(parsed.disk ?? ''),
      bios: String(parsed.bios ?? ''),
      machine: String(parsed.machine ?? ''),
      osName: String(parsed.osName ?? ''),
      osVersion: String(parsed.osVersion ?? ''),
    };
  } catch {
    return empty;
  }
}

let probed: ProbeResult | null = null;

/** 进程内缓存的原始探测结果（只探测一次） */
function probe(): ProbeResult {
  if (!probed) probed = probeSources();
  return probed;
}

/** 32 位十六进制 → UUID 样式（8-4-4-4-12，小写） */
function toUuidLike(hex32: string): string {
  const h = hex32.toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

function compute(seed: string): string {
  const hex = createHash('sha256').update(`koring-device:${seed}`, 'utf-8').digest('hex');
  return toUuidLike(hex.slice(0, 32));
}

let cached: DeviceIdentity | null = null;

/** 获取设备唯一标识（进程内缓存，只探测一次） */
export function getDeviceId(): DeviceIdentity {
  if (cached) return cached;

  const { board, disk, bios, machine } = probe();

  let seed: string | undefined;
  let source: DeviceIdSource = 'none';
  if (isValid(board)) {
    seed = board;
    source = 'board';
  } else if (isValid(disk)) {
    seed = disk;
    source = 'disk';
  } else if (isValid(bios)) {
    seed = bios;
    source = 'bios';
  } else if (isValid(machine)) {
    seed = machine;
    source = 'machine';
  }

  cached = seed
    ? { deviceId: compute(seed), source }
    : { deviceId: null, source: 'none' };

  return cached;
}

export type SmbiosUuidSource = 'smbios' | 'fingerprint' | 'none';

export interface SmbiosUuidResult {
  /** Account API 设备上报用的 uuid（1..128 字符） */
  uuid: string;
  source: SmbiosUuidSource;
}

/**
 * SMBIOS UUID（Account API /api/v1/device/report 的 uuid 字段）。
 *
 * 与 getDeviceId() 的哈希指纹不同：这里返回**原始** SMBIOS UUID
 * （Win32_ComputerSystemProduct.UUID）。服务端不做严格 UUID 校验
 * （真机上可能是全 F 或异常串），只要求 trim 后 1..128 字符，故这里
 * 不做合法性过滤，仅去除首尾空白并截断超长值。
 *
 * 兜底：SMBIOS UUID 不可用时回退哈希指纹（保证上报流程仍可完成）。
 */
export function getSmbiosUuid(): SmbiosUuidResult {
  const raw = probe().board.trim();
  if (raw) {
    return { uuid: raw.slice(0, 128), source: 'smbios' };
  }
  const fallback = getDeviceId().deviceId;
  if (fallback) {
    return { uuid: fallback.slice(0, 128), source: 'fingerprint' };
  }
  return { uuid: '', source: 'none' };
}

/** 操作系统名称与版本（设备上报用；非 Windows 平台回退 Node os 模块） */
export function getOsInfo(): { name: string; version: string } {
  const { osName, osVersion } = probe();
  if (osName || osVersion) {
    return { name: osName.slice(0, 64), version: osVersion.slice(0, 64) };
  }
  const type =
    process.platform === 'win32'
      ? 'Windows'
      : process.platform === 'darwin'
        ? 'macOS'
        : process.platform === 'linux'
          ? 'Linux'
          : process.platform;
  return { name: type.slice(0, 64), version: os.release().slice(0, 64) };
}

/** 调试用：清空缓存（下次调用重新探测） */
export function resetDeviceIdCache(): void {
  cached = null;
  probed = null;
}
