import { create } from "zustand";
import { useConfigStore } from "./configStore";
import { DEFAULT_BG } from "@/lib/mode";
import { ipcInvoke } from "@/api/ipc";
import { toast } from "@/lib/toast";
import { createRendererLogger } from "@/lib/logger";

const log = createRendererLogger("backgroundStore");

export type BackgroundMode = "mica" | "color" | "image" | "video" | "gif";

/** 主进程 `background:*` 返回的背景配置（与 electron/config.ts 一致） */
interface RawBackground {
  bgType: BackgroundMode;
  image: string;
  images: string[];
  imageRotateSeconds: number;
  video: string;
  color: string;
  blur: number;
  opacity: number;
}

interface BackgroundState {
  mode: BackgroundMode;
  /** 图片模式的轮换列表（配置存文件路径；空 = 使用默认壁纸） */
  images: string[];
  /** 图片轮换间隔（秒）；0 = 不轮换 */
  imageRotateSeconds: number;
  /** 视频背景文件路径 */
  video: string;
  /** GIF 背景文件路径 */
  gif: string;
  /** 纯色模式的颜色 */
  color: string;
  blur: number;
  opacity: number;

  setMode: (mode: BackgroundMode) => Promise<void>;
  setColor: (color: string) => Promise<void>;
  /** 打开系统选择器批量添加轮换图片 */
  addImages: () => Promise<void>;
  removeImage: (path: string) => Promise<void>;
  setRotateSeconds: (seconds: number) => Promise<void>;
  /** 打开系统选择器选择视频（始终静音播放） */
  pickVideo: () => Promise<void>;
  /** 打开系统选择器选择 GIF */
  pickGif: () => Promise<void>;
  setBlur: (blur: number) => void;
  setOpacity: (opacity: number) => void;
  reset: () => Promise<void>;
}

const DEFAULT: Pick<
  BackgroundState,
  "mode" | "images" | "imageRotateSeconds" | "video" | "gif" | "color" | "blur" | "opacity"
> = {
  mode: "image",
  images: [],
  imageRotateSeconds: 30,
  video: "",
  gif: "",
  color: "#1c1c1e",
  blur: 0,
  opacity: 1,
};

/** 旧版主进程默认值用的绝对路径 /background.png（dev 可显示，打包 file:// 下指向文件系统根→黑屏）。
 *  统一归一化为渲染端 DEFAULT_BG（BASE_URL 相对路径，dev/打包均正确）。 */
const normalizeDefaultBg = (url: string): string => (url === "/background.png" ? DEFAULT_BG : url);

/** 把主进程返回的原始配置映射为 Store 状态 */
function toState(raw: RawBackground) {
  const images = (Array.isArray(raw.images) ? raw.images : []).map(normalizeDefaultBg).filter(Boolean);
  const legacyImage = normalizeDefaultBg(raw.image || "");
  const isMedia = raw.bgType === "video" || raw.bgType === "gif";
  return {
    mode: (raw.bgType || "image") as BackgroundMode,
    // 旧配置只有单张 image：视为轮换列表第一张
    images: images.length > 0 ? images : raw.bgType === "image" && legacyImage && legacyImage !== DEFAULT_BG ? [legacyImage] : [],
    imageRotateSeconds: Number.isFinite(raw.imageRotateSeconds) ? raw.imageRotateSeconds : 30,
    video: raw.bgType === "video" ? legacyImage : raw.video || "",
    gif: raw.bgType === "gif" ? legacyImage : "",
    color: raw.color || (raw.bgType === "color" && legacyImage ? legacyImage : "#1c1c1e"),
    blur: raw.blur ?? 0,
    opacity: typeof raw.opacity === "number" ? Math.min(1, Math.max(0, raw.opacity / 100)) : 1,
  };
}

export const useBackgroundStore = create<BackgroundState>((set, get) => {
  /** 调用主进程后把返回配置写回 Store */
  const apply = (raw?: RawBackground | null) => {
    if (!raw) return;
    set(toState(raw));
  };

  const run = async <T>(channel: string, payload?: unknown): Promise<T | null> => {
    try {
      return (await ipcInvoke<T>(channel, payload)) ?? null;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      log.warn(`${channel} 失败: ${message}`);
      toast.error("背景设置失败", message);
      return null;
    }
  };

  return {
    ...DEFAULT,

    setMode: async (mode) => {
      set({ mode });
      const res = await run<{ background: RawBackground; requiresRestart?: boolean }>("background:set-mode", { mode });
      apply(res?.background);
      if (res?.requiresRestart) {
        toast.info("Mica 材质需要重启启动器后生效", "透明窗口只能在启动时创建");
      }
    },

    setColor: async (color) => {
      set({ mode: "color", color });
      const res = await run<RawBackground>("background:set-color", { color });
      apply(res);
    },

    addImages: async () => {
      const images = await window.electronAPI?.pickBackgroundImages?.();
      if (!images || images.length === 0) return;
      log.info(`添加轮换图片 ${images.length} 张`);
      const res = await run<{ background: RawBackground; added: number }>("background:get", {});
      const bg = res as unknown as RawBackground | null;
      if (bg) apply(bg);
    },

    removeImage: async (path) => {
      const state = get();
      const next = state.images.filter((p) => p !== path);
      set({ images: next });
      const res = await run<RawBackground>("background:remove-image", { path });
      apply(res);
    },

    setRotateSeconds: async (seconds) => {
      set({ imageRotateSeconds: seconds });
      const res = await run<RawBackground>("background:set-rotate", { seconds });
      apply(res);
    },

    pickVideo: async () => {
      const video = await window.electronAPI?.pickBackgroundVideo?.();
      if (!video) return;
      set({ mode: "video", video });
      const res = await run<RawBackground>("background:get", {});
      if (res) apply(res);
    },

    pickGif: async () => {
      const gif = await window.electronAPI?.pickBackgroundGif?.();
      if (!gif) return;
      set({ mode: "gif", gif });
      const res = await run<RawBackground>("background:get", {});
      if (res) apply(res);
    },

    setBlur: (blur) => {
      set({ blur });
      useConfigStore.getState().setBackground({ blur });
    },

    setOpacity: (opacity) => {
      set({ opacity });
      useConfigStore.getState().setBackground({ opacity: Math.round(opacity * 100) });
    },

    reset: async () => {
      const res = await run<{ background: RawBackground }>("background:reset", {});
      set({ ...DEFAULT });
      if (res?.background) apply(res.background);
      toast.success("已恢复默认背景");
    },
  };
});

/** 从配置同步背景（启动加载 / 配置变更时调用） */
export function syncBackgroundFromConfig() {
  const bg = useConfigStore.getState().config.background;
  if (!bg) return;
  useBackgroundStore.setState(toState(bg as unknown as RawBackground));
}
