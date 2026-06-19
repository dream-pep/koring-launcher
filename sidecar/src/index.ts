import { startTransport, sendError, sendEvent } from "./protocol/transport.js";
import type { Request } from "./protocol/types.js";

import {
  handleInstallMinecraft,
  handleInstallModLoader,
  handleGetVersionList,
  handleGetForgeVersionList,
  handleGetFabricVersionList,
} from "./handlers/install.js";

import {
  handleLaunch,
  handleDiagnose,
} from "./handlers/launch.js";

import {
  handleMicrosoftLoginStart,
  handleMicrosoftLoginCallback,
  handleOfflineLogin,
  handleValidateToken,
} from "./handlers/auth.js";

import {
  handleSearchMods,
  handleGetModDetail,
  handleGetModVersions,
  handleInstallMod,
} from "./handlers/mods.js";

import {
  handleCreateInstance,
  handleListInstances,
  handleDeleteInstance,
  handleGetInstanceInfo,
} from "./handlers/instance.js";

import {
  handleSetBackgroundImage,
  handleSetBackgroundColor,
  handleSetBackgroundBlur,
  handleSetBackgroundOpacity,
  handleSetBackgroundAnimation,
  handleGetBackground,
  handleSetBackgroundTheme,
  handleResetBackground,
} from "./handlers/background.js";

const handlers: Record<string, (id: string, payload: any) => Promise<void>> = {
  // Install
  "install:minecraft": handleInstallMinecraft,
  "install:mod-loader": handleInstallModLoader,
  "install:version-list": handleGetVersionList,
  "install:forge-version-list": handleGetForgeVersionList,
  "install:fabric-version-list": handleGetFabricVersionList,

  // Launch
  "launch:launch": handleLaunch,
  "launch:diagnose": handleDiagnose,

  // Auth
  "auth:microsoft-login-start": handleMicrosoftLoginStart,
  "auth:microsoft-login-callback": handleMicrosoftLoginCallback,
  "auth:offline-login": handleOfflineLogin,
  "auth:validate-token": handleValidateToken,

  // Mods
  "mods:search": handleSearchMods,
  "mods:detail": handleGetModDetail,
  "mods:versions": handleGetModVersions,
  "mods:install": handleInstallMod,

  // Instance
  "instance:create": handleCreateInstance,
  "instance:list": handleListInstances,
  "instance:delete": handleDeleteInstance,
  "instance:info": handleGetInstanceInfo,

  // Background
  "background:set-image": handleSetBackgroundImage,
  "background:set-color": handleSetBackgroundColor,
  "background:set-blur": handleSetBackgroundBlur,
  "background:set-opacity": handleSetBackgroundOpacity,
  "background:set-animation": handleSetBackgroundAnimation,
  "background:get": handleGetBackground,
  "background:set-theme": handleSetBackgroundTheme,
  "background:reset": handleResetBackground,
};

async function onMessage(msg: Request) {
  const handler = handlers[msg.type];
  if (!handler) {
    sendError(msg.id, `Unknown handler: ${msg.type}`);
    return;
  }

  try {
    await handler(msg.id, msg.payload);
  } catch (e: any) {
    sendError(msg.id, e.message || "Internal error");
  }
}

process.stderr.write("[koring-sidecar] starting\n");
startTransport(onMessage);
