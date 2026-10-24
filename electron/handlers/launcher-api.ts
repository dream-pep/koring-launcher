/**
 * Koring Account 启动器 API 的 IPC handler。
 *
 * 渲染端只通过这些通道消费结果，API KEY 与网络请求全部留在主进程
 * （打包后渲染进程 origin 为 file://，直连会被 CORS 拦截）。
 */
import electron from 'electron';
import {
  apiBase,
  deviceCheck,
  deviceNotifications,
  deviceReport,
  deviceStatus,
  heartbeatInfo,
  startupCheck,
  versionPolicy,
} from '../core/launcher-api';
import { getSmbiosUuid } from '../core/device-id';
import { createLogger } from '../core/logger';

const { ipcMain, app } = electron;

const log = createLogger('launcher-api');

function fail(e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  log.warn(`[launcher-api] handler 失败：${message}`);
  return { success: false, data: null, error: message };
}

export function registerLauncherApiHandlers() {
  /**
   * 环境信息（不发起网络请求）：
   * enforced=false 表示开发模式（未打包）——校验服务不可用时允许在 UI 上跳过，
   * 避免后端异常把开发环境锁死在 OOBE（打包产物恒为 true，只有重试）。
   */
  ipcMain.handle('launcher-api:env-info', () => {
    try {
      return { success: true, data: { enforced: app.isPackaged, api_base: apiBase() }, error: null };
    } catch (e: unknown) {
      return fail(e);
    }
  });

  /** 设备校验（未登记则上报一次）：OOBE / UPVP 的「设备状态查询」步骤 */
  ipcMain.handle('launcher-api:device-check', async () => {
    try {
      return { success: true, data: await deviceCheck(), error: null };
    } catch (e: unknown) {
      return fail(e);
    }
  });

  /** 版本策略查询（默认当前程序版本） */
  ipcMain.handle('launcher-api:version-policy', async (_event, payload?: { version?: string }) => {
    try {
      return { success: true, data: await versionPolicy(payload?.version), error: null };
    } catch (e: unknown) {
      return fail(e);
    }
  });

  /** 启动检查（设备 + 版本，用于启动通知与激活门禁） */
  ipcMain.handle('launcher-api:startup-check', async (_event, payload?: { force?: boolean }) => {
    try {
      return { success: true, data: await startupCheck(payload?.force === true), error: null };
    } catch (e: unknown) {
      return fail(e);
    }
  });

  /** 本机设备标识（调试/展示用；uuid 与服务端规范化前的原值） */
  ipcMain.handle('launcher-api:device-uuid', () => {
    try {
      return { success: true, data: getSmbiosUuid(), error: null };
    } catch (e: unknown) {
      return fail(e);
    }
  });

  /** 原始设备状态查询（调试用，不做上报） */
  ipcMain.handle('launcher-api:device-status', async () => {
    try {
      const { uuid } = getSmbiosUuid();
      return { success: true, data: await deviceStatus(uuid), error: null };
    } catch (e: unknown) {
      return fail(e);
    }
  });

  /** 强制上报一次设备信息（调试用） */
  ipcMain.handle('launcher-api:device-report', async () => {
    try {
      const { uuid } = getSmbiosUuid();
      return { success: true, data: await deviceReport(uuid), error: null };
    } catch (e: unknown) {
      return fail(e);
    }
  });

  /** 设备维度通知（调试用） */
  ipcMain.handle('launcher-api:device-notifications', async () => {
    try {
      const { uuid } = getSmbiosUuid();
      return { success: true, data: await deviceNotifications(uuid), error: null };
    } catch (e: unknown) {
      return fail(e);
    }
  });

  /** 设备心跳运行信息（每 2 分钟一次 POST /device/report） */
  ipcMain.handle('launcher-api:heartbeat-info', () => {
    try {
      return { success: true, data: heartbeatInfo(), error: null };
    } catch (e: unknown) {
      return fail(e);
    }
  });
}
