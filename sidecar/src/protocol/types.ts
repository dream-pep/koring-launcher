export interface Request<T = unknown> {
  id: string;
  type: string;
  payload: T;
}

export interface Response<T = unknown> {
  id: string;
  type: "result" | "error" | "progress" | "event";
  payload: T;
}

export interface ProgressPayload {
  stage: string;
  current: number;
  total: number;
  message?: string;
}

export interface ResultPayload<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// === Install ===

export interface InstallMinecraftRequest {
  version: string;
  gamePath: string;
  javaPath?: string;
  downloadThreads?: number;
}

export interface InstallModLoaderRequest {
  gamePath: string;
  javaPath?: string;
  mcVersion: string;
  loaderType: "forge" | "fabric" | "quilt" | "neoforge";
  loaderVersion?: string;
}

export interface GetVersionListRequest {
  type?: "release" | "snapshot" | "all";
}

export interface GetForgeVersionListRequest {
  mcVersion?: string;
}

export interface GetFabricVersionListRequest {
  mcVersion?: string;
}

// === Launch ===

export interface LaunchRequest {
  gamePath: string;
  javaPath: string;
  version: string;
  username: string;
  uuid: string;
  accessToken?: string;
  memory?: { min?: string; max?: string };
  jvmArgs?: string[];
  gameArgs?: string[];
  server?: { ip: string; port?: number };
  detached?: boolean;
}

export interface DiagnoseRequest {
  gamePath: string;
  version: string;
}

// === Auth ===

export interface MicrosoftLoginStartRequest {
  client_id: string;
  redirect_uri?: string;
}

export interface MicrosoftLoginCallbackRequest {
  state: string;
  code: string;
  client_id: string;
}

export interface OfflineLoginRequest {
  username: string;
}

export interface ValidateTokenRequest {
  accessToken: string;
  clientToken?: string;
}

// === Mods ===

export interface SearchModsRequest {
  query?: string;
  gameVersion?: string;
  loader?: string;
  limit?: number;
  offset?: number;
  source: "modrinth" | "curseforge";
}

export interface GetModDetailRequest {
  projectId: string;
  source: "modrinth" | "curseforge";
}

export interface GetModVersionsRequest {
  projectId: string;
  gameVersion?: string;
  loader?: string;
  source: "modrinth" | "curseforge";
}

export interface InstallModRequest {
  projectId: string;
  versionId?: string;
  gamePath: string;
  source: "modrinth" | "curseforge";
}

// === Instance ===

export interface CreateInstanceRequest {
  name: string;
  instancesPath: string;
  gamePath: string;
  mcVersion: string;
  loaderType?: string;
  loaderVersion?: string;
  javaPath?: string;
  memory?: { min?: string; max?: string };
}

export interface ListInstancesRequest {
  instancesPath: string;
}

export interface DeleteInstanceRequest {
  name: string;
  instancesPath: string;
}

export interface GetInstanceInfoRequest {
  name: string;
  instancesPath: string;
}

// === Background ===

export type AnimationType = "none" | "gradient" | "particles";
export type Theme = "light" | "dark" | "system";

export interface BackgroundConfig {
  type: "image" | "color" | "gradient" | "particles";
  image?: string;
  color?: string;
  blur: number;
  opacity: number;
  animation: AnimationType;
  animationSpeed: number;
  theme: Theme;
}

export interface SetBackgroundImageRequest {
  url: string;
  blur?: number;
  opacity?: number;
}

export interface SetBackgroundColorRequest {
  color: string;
}

export interface SetBackgroundBlurRequest {
  blur: number;
}

export interface SetBackgroundOpacityRequest {
  opacity: number;
}

export interface SetBackgroundAnimationRequest {
  type: AnimationType;
  speed?: number;
}

export interface SetBackgroundThemeRequest {
  theme: Theme;
}

// === Handler Map ===

export type HandlerMap = {
  // Install
  "install:minecraft": InstallMinecraftRequest;
  "install:mod-loader": InstallModLoaderRequest;
  "install:version-list": GetVersionListRequest;
  "install:forge-version-list": GetForgeVersionListRequest;
  "install:fabric-version-list": GetFabricVersionListRequest;

  // Launch
  "launch:launch": LaunchRequest;
  "launch:diagnose": DiagnoseRequest;

  // Auth
  "auth:microsoft-login-start": MicrosoftLoginStartRequest;
  "auth:microsoft-login-callback": MicrosoftLoginCallbackRequest;
  "auth:offline-login": OfflineLoginRequest;
  "auth:validate-token": ValidateTokenRequest;

  // Mods
  "mods:search": SearchModsRequest;
  "mods:detail": GetModDetailRequest;
  "mods:versions": GetModVersionsRequest;
  "mods:install": InstallModRequest;

  // Instance
  "instance:create": CreateInstanceRequest;
  "instance:list": ListInstancesRequest;
  "instance:delete": DeleteInstanceRequest;
  "instance:info": GetInstanceInfoRequest;

  // Background
  "background:set-image": SetBackgroundImageRequest;
  "background:set-color": SetBackgroundColorRequest;
  "background:set-blur": SetBackgroundBlurRequest;
  "background:set-opacity": SetBackgroundOpacityRequest;
  "background:set-animation": SetBackgroundAnimationRequest;
  "background:get": never;
  "background:set-theme": SetBackgroundThemeRequest;
  "background:reset": never;
};
