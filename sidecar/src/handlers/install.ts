import { sendProgress, sendResult, sendError } from "../protocol/transport.js";
import type {
  InstallMinecraftRequest,
  InstallModLoaderRequest,
  GetVersionListRequest,
  GetForgeVersionListRequest,
  GetFabricVersionListRequest,
} from "../protocol/types.js";
import * as installer from "../core/installer.js";

export async function handleInstallMinecraft(id: string, payload: InstallMinecraftRequest) {
  try {
    sendProgress(id, { stage: "starting", current: 0, total: 1 });
    const result = await installer.installMinecraft(
      id,
      payload.version,
      payload.gamePath,
      payload.javaPath,
      payload.downloadThreads
    );
    sendResult(id, result);
  } catch (e: any) {
    sendError(id, e.message);
  }
}

export async function handleInstallModLoader(id: string, payload: InstallModLoaderRequest) {
  try {
    sendProgress(id, { stage: "starting", current: 0, total: 1 });
    let result;

    switch (payload.loaderType) {
      case "forge":
        result = await installer.installForgeLoader(
          id,
          payload.mcVersion,
          payload.gamePath,
          payload.javaPath,
          payload.loaderVersion
        );
        break;
      case "fabric":
        result = await installer.installFabricLoader(
          id,
          payload.mcVersion,
          payload.gamePath,
          payload.loaderVersion
        );
        break;
      case "quilt":
        result = await installer.installQuiltLoader(
          id,
          payload.mcVersion,
          payload.gamePath,
          payload.loaderVersion
        );
        break;
      case "neoforge":
        throw new Error("NeoForge not yet supported");
      default:
        throw new Error(`Unknown loader type: ${payload.loaderType}`);
    }

    sendResult(id, result);
  } catch (e: any) {
    sendError(id, e.message);
  }
}

export async function handleGetVersionList(id: string, payload: GetVersionListRequest) {
  try {
    const result = await installer.getVersionListAsync(payload.type || "all");
    sendResult(id, result);
  } catch (e: any) {
    sendError(id, e.message);
  }
}

export async function handleGetForgeVersionList(id: string, payload: GetForgeVersionListRequest) {
  try {
    const result = await installer.getForgeVersions(payload.mcVersion);
    sendResult(id, result);
  } catch (e: any) {
    sendError(id, e.message);
  }
}

export async function handleGetFabricVersionList(id: string, payload: GetFabricVersionListRequest) {
  try {
    const result = await installer.getFabricVersions(payload.mcVersion);
    sendResult(id, result);
  } catch (e: any) {
    sendError(id, e.message);
  }
}
