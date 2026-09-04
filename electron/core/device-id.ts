// 设备唯一标识（组合指纹 + 回退 MachineGuid）
//
// 用途：为“设备识别码”提供尽量唯一且稳定的标识（授权/激活/统计）。
// 来源优先级（均为硬件级，重装系统不变）：
//   1. board  — 主板 UUID（Win32_ComputerSystemProduct.UUID）
//   2. disk   — 硬盘序列号（Win32_DiskDrive 首个物理盘）
//   3. bios   — BIOS 序列号（Win32_BIOS；存在大量 OEM 默认值，故置后）
//   4. machine— 注册表 MachineGuid（系统安装级，作为最终回退）
// 取第一个有效值 → SHA-256 → 前 32 位十六进制 → UUID 样式分段展示。
import { execSync } from 'child_process';
import { createHash } from 'crypto';

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

/** 读取四类候选标识（Windows 一条 PowerShell 完成，逐项容错） */
function probeSources(): { board: string; disk: string; bios: string; machine: string } {
  const empty = { board: '', disk: '', bios: '', machine: '' };
  if (process.platform !== 'win32') return empty;
  const ps = [
    '-NoProfile -Command',
    "$ErrorActionPreference='SilentlyContinue';",
    '$b=(Get-CimInstance Win32_ComputerSystemProduct).UUID;',
    '$d=(Get-CimInstance Win32_DiskDrive|Select-Object -First 1).SerialNumber;',
    '$i=(Get-CimInstance Win32_BIOS).SerialNumber;',
    "$g=(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Cryptography').MachineGuid;",
    '[pscustomobject]@{board=[string]$b;disk=[string]$d;bios=[string]$i;machine=[string]$g}|ConvertTo-Json -Compress',
  ].join(' ');
  try {
    const output = execSync(`powershell ${ps}`, { encoding: 'utf-8', timeout: 8000, windowsHide: true });
    const parsed = JSON.parse(output.trim() || '{}');
    return {
      board: String(parsed.board ?? ''),
      disk: String(parsed.disk ?? ''),
      bios: String(parsed.bios ?? ''),
      machine: String(parsed.machine ?? ''),
    };
  } catch {
    return empty;
  }
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

  const { board, disk, bios, machine } = probeSources();

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

/** 调试用：清空缓存（下次调用重新探测） */
export function resetDeviceIdCache(): void {
  cached = null;
}
