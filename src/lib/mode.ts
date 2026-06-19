export type BuildMode = "dev" | "beta" | "run";

export const BUILD_MODE: BuildMode = (import.meta.env.VITE_BUILD_MODE as BuildMode) || "dev";
export const APP_ICON: string = import.meta.env.VITE_APP_ICON || "/dev.png";

export const isDev = BUILD_MODE === "dev";
export const isBeta = BUILD_MODE === "beta";
export const isRun = BUILD_MODE === "run";
