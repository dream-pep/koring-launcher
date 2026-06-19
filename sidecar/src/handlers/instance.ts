import { existsSync, readdirSync, rmSync } from "fs";
import { join } from "path";
import { sendResult, sendError } from "../protocol/transport.js";
import type {
  CreateInstanceRequest,
  ListInstancesRequest,
  DeleteInstanceRequest,
  GetInstanceInfoRequest,
} from "../protocol/types.js";
import {
  ensureDir,
  getInstancePath,
  readInstanceConfig,
  writeInstanceConfig,
  type InstanceConfig,
} from "../utils/paths.js";

export async function handleCreateInstance(id: string, payload: CreateInstanceRequest) {
  try {
    const instancePath = getInstancePath(payload.instancesPath, payload.name);

    if (existsSync(instancePath)) {
      throw new Error(`Instance "${payload.name}" already exists`);
    }

    ensureDir(instancePath);

    const config: InstanceConfig = {
      name: payload.name,
      mcVersion: payload.mcVersion,
      loaderType: payload.loaderType,
      loaderVersion: payload.loaderVersion,
      javaPath: payload.javaPath,
      memory: payload.memory,
      createdAt: new Date().toISOString(),
    };

    writeInstanceConfig(instancePath, config);

    // Create standard directories
    ensureDir(join(instancePath, "mods"));
    ensureDir(join(instancePath, "resourcepacks"));
    ensureDir(join(instancePath, "saves"));
    ensureDir(join(instancePath, "config"));

    sendResult(id, {
      name: payload.name,
      path: instancePath,
      config,
    });
  } catch (e: any) {
    sendError(id, e.message);
  }
}

export async function handleListInstances(id: string, payload: ListInstancesRequest) {
  try {
    const instancesPath = payload.instancesPath;

    if (!existsSync(instancesPath)) {
      ensureDir(instancesPath);
      sendResult(id, []);
      return;
    }

    const entries = readdirSync(instancesPath, { withFileTypes: true });
    const instances = entries
      .filter((e) => e.isDirectory())
      .map((e) => {
        const config = readInstanceConfig(join(instancesPath, e.name));
        return {
          name: e.name,
          path: join(instancesPath, e.name),
          config,
        };
      })
      .filter((i) => i.config !== null);

    sendResult(id, instances);
  } catch (e: any) {
    sendError(id, e.message);
  }
}

export async function handleDeleteInstance(id: string, payload: DeleteInstanceRequest) {
  try {
    const instancePath = getInstancePath(payload.instancesPath, payload.name);

    if (!existsSync(instancePath)) {
      throw new Error(`Instance "${payload.name}" not found`);
    }

    rmSync(instancePath, { recursive: true, force: true });

    sendResult(id, { deleted: payload.name });
  } catch (e: any) {
    sendError(id, e.message);
  }
}

export async function handleGetInstanceInfo(id: string, payload: GetInstanceInfoRequest) {
  try {
    const instancePath = getInstancePath(payload.instancesPath, payload.name);

    if (!existsSync(instancePath)) {
      throw new Error(`Instance "${payload.name}" not found`);
    }

    const config = readInstanceConfig(instancePath);
    if (!config) {
      throw new Error(`Instance "${payload.name}" has no config`);
    }

    // Count mods
    const modsPath = join(instancePath, "mods");
    let modCount = 0;
    if (existsSync(modsPath)) {
      modCount = readdirSync(modsPath).filter((f) => f.endsWith(".jar")).length;
    }

    sendResult(id, {
      name: payload.name,
      path: instancePath,
      config,
      modCount,
    });
  } catch (e: any) {
    sendError(id, e.message);
  }
}
