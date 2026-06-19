import { sendResult, sendError } from "../protocol/transport.js";
import type {
  SearchModsRequest,
  GetModDetailRequest,
  GetModVersionsRequest,
  InstallModRequest,
} from "../protocol/types.js";
import * as modrinth from "../core/modrinth.js";

export async function handleSearchMods(id: string, payload: SearchModsRequest) {
  try {
    const result = await modrinth.searchMods(
      payload.query,
      payload.gameVersion,
      payload.loader,
      payload.limit,
      payload.offset,
      payload.source
    );
    sendResult(id, result);
  } catch (e: any) {
    sendError(id, e.message);
  }
}

export async function handleGetModDetail(id: string, payload: GetModDetailRequest) {
  try {
    const result = await modrinth.getModDetail(payload.projectId, payload.source);
    sendResult(id, result);
  } catch (e: any) {
    sendError(id, e.message);
  }
}

export async function handleGetModVersions(id: string, payload: GetModVersionsRequest) {
  try {
    const result = await modrinth.getModVersions(
      payload.projectId,
      payload.gameVersion,
      payload.loader,
      payload.source
    );
    sendResult(id, result);
  } catch (e: any) {
    sendError(id, e.message);
  }
}

export async function handleInstallMod(id: string, payload: InstallModRequest) {
  try {
    const result = await modrinth.installMod(
      id,
      payload.projectId,
      payload.versionId,
      payload.gamePath,
      payload.source
    );
    sendResult(id, result);
  } catch (e: any) {
    sendError(id, e.message);
  }
}
