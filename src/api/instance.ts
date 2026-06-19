import { sidecarRequest } from "./sidecar";

export interface InstanceConfig {
  name: string;
  mcVersion: string;
  loaderType?: string;
  loaderVersion?: string;
  javaPath?: string;
  memory?: { min?: string; max?: string };
  createdAt: string;
}

export interface InstanceInfo {
  name: string;
  path: string;
  config: InstanceConfig;
  modCount?: number;
}

export async function createInstance(
  name: string,
  gamePath: string,
  mcVersion: string,
  loaderType?: string,
  loaderVersion?: string,
  javaPath?: string,
  memory?: { min?: string; max?: string }
): Promise<InstanceInfo> {
  return sidecarRequest<InstanceInfo>("instance:create", {
    name,
    gamePath,
    mcVersion,
    loaderType,
    loaderVersion,
    javaPath,
    memory,
  });
}

export async function listInstances(instancesPath: string): Promise<InstanceInfo[]> {
  return sidecarRequest<InstanceInfo[]>("instance:list", { instancesPath });
}

export async function deleteInstance(
  name: string,
  instancesPath: string
): Promise<{ deleted: string }> {
  return sidecarRequest<{ deleted: string }>("instance:delete", {
    name,
    instancesPath,
  });
}

export async function getInstanceInfo(
  name: string,
  instancesPath: string
): Promise<InstanceInfo> {
  return sidecarRequest<InstanceInfo>("instance:info", { name, instancesPath });
}
