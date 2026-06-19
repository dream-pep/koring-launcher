import { sendResult, sendError } from "../protocol/transport.js";
import type {
  SetBackgroundImageRequest,
  SetBackgroundColorRequest,
  SetBackgroundBlurRequest,
  SetBackgroundOpacityRequest,
  SetBackgroundAnimationRequest,
  SetBackgroundThemeRequest,
  BackgroundConfig,
} from "../protocol/types.js";

// In-memory background config (persisted to config file in production)
let config: BackgroundConfig = {
  type: "color",
  color: "#1a1a2e",
  blur: 0,
  opacity: 1,
  animation: "none",
  animationSpeed: 1,
  theme: "dark",
};

export async function handleSetBackgroundImage(id: string, payload: SetBackgroundImageRequest) {
  try {
    config.type = "image";
    config.image = payload.url;
    if (payload.blur !== undefined) config.blur = payload.blur;
    if (payload.opacity !== undefined) config.opacity = payload.opacity;
    sendResult(id, config);
  } catch (e: any) {
    sendError(id, e.message);
  }
}

export async function handleSetBackgroundColor(id: string, payload: SetBackgroundColorRequest) {
  try {
    config.type = "color";
    config.color = payload.color;
    sendResult(id, config);
  } catch (e: any) {
    sendError(id, e.message);
  }
}

export async function handleSetBackgroundBlur(id: string, payload: SetBackgroundBlurRequest) {
  try {
    config.blur = Math.max(0, Math.min(20, payload.blur));
    sendResult(id, config);
  } catch (e: any) {
    sendError(id, e.message);
  }
}

export async function handleSetBackgroundOpacity(id: string, payload: SetBackgroundOpacityRequest) {
  try {
    config.opacity = Math.max(0, Math.min(1, payload.opacity));
    sendResult(id, config);
  } catch (e: any) {
    sendError(id, e.message);
  }
}

export async function handleSetBackgroundAnimation(id: string, payload: SetBackgroundAnimationRequest) {
  try {
    config.animation = payload.type;
    if (payload.speed !== undefined) config.animationSpeed = payload.speed;
    if (payload.type === "gradient" || payload.type === "particles") {
      config.type = payload.type;
    }
    sendResult(id, config);
  } catch (e: any) {
    sendError(id, e.message);
  }
}

export async function handleGetBackground(id: string) {
  try {
    sendResult(id, config);
  } catch (e: any) {
    sendError(id, e.message);
  }
}

export async function handleSetBackgroundTheme(id: string, payload: SetBackgroundThemeRequest) {
  try {
    config.theme = payload.theme;
    sendResult(id, config);
  } catch (e: any) {
    sendError(id, e.message);
  }
}

export async function handleResetBackground(id: string) {
  try {
    config = {
      type: "color",
      color: "#1a1a2e",
      blur: 0,
      opacity: 1,
      animation: "none",
      animationSpeed: 1,
      theme: "dark",
    };
    sendResult(id, config);
  } catch (e: any) {
    sendError(id, e.message);
  }
}
