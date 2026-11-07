import { create } from "zustand";
import { useConfigStore } from "./configStore";
import type { BackgroundMode } from "@/api/config";
import { DEFAULT_BG } from "@/lib/mode";

type BackgroundType = BackgroundMode;

/** 轮播间隔的合法范围（秒）——与主进程 config.migrate 的兜底保持一致 */
export const SLIDESHOW_MIN_SEC = 5;
export const SLIDESHOW_MAX_SEC = 120;
export const SLIDESHOW_DEFAULT_SEC = 30;

function clampInterval(value: number): number {
  if (!Number.isFinite(value)) return SLIDESHOW_DEFAULT_SEC;
  return Math.min(SLIDESHOW_MAX_SEC, Math.max(SLIDESHOW_MIN_SEC, Math.round(value)));
}

interface BackgroundState {
  type: BackgroundType;
  image: string;
  /** 多图轮播的图片列表（受管文件路径或可直接显示的 URL） */
  images: string[];
  /** 视频文件路径（受管文件路径或可直接显示的 URL） */
  video: string;
  /** 多图轮播间隔（秒） */
  intervalSec: number;
  blur: number;
  opacity: number;

  setMode: (mode: BackgroundType) => void;
  setImage: (url: string) => void;
  setColor: (color: string) => void;
  setImages: (images: string[]) => void;
  addImage: (url: string) => void;
  removeImage: (url: string) => void;
  setVideo: (url: string) => void;
  setIntervalSec: (sec: number) => void;
  setBlur: (blur: number) => void;
  setOpacity: (opacity: number) => void;
  reset: () => void;
}

const DEFAULT: {
  type: BackgroundType;
  image: string;
  images: string[];
  video: string;
  intervalSec: number;
  blur: number;
  opacity: number;
} = {
  type: "image",
  image: DEFAULT_BG,
  images: [],
  video: "",
  intervalSec: SLIDESHOW_DEFAULT_SEC,
  blur: 0,
  opacity: 1,
};

/** 旧版主进程默认值用的绝对路径 /background.png（dev 可显示，打包 file:// 下指向文件系统根→黑屏）。
 *  统一归一化为渲染端 DEFAULT_BG（BASE_URL 相对路径，dev/打包均正确）。 */
const normalizeDefaultBg = (url: string): string => (url === "/background.png" ? DEFAULT_BG : url);

const uniquePaths = (list: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
};

export const useBackgroundStore = create<BackgroundState>((set, get) => ({
  ...DEFAULT,

  setMode: (mode) => {
    set({ type: mode });
    useConfigStore.getState().setBackground({ bgType: mode });
  },

  setImage: (url) => {
    set({ type: "image", image: url, blur: 0, opacity: 1 });
    useConfigStore.getState().setBackground({ bgType: "image", image: url, blur: 0, opacity: 100 });
  },

  setColor: (color) => {
    set({ type: "color", image: color, blur: 0, opacity: 1 });
    useConfigStore.getState().setBackground({ bgType: "color", image: color, blur: 0, opacity: 100 });
  },

  setImages: (images) => {
    const next = uniquePaths(images);
    set({ images: next });
    useConfigStore.getState().setBackground({ images: next });
  },

  addImage: (url) => {
    if (!url) return;
    const next = uniquePaths([...get().images, url]);
    set({ images: next, type: "slideshow" });
    useConfigStore.getState().setBackground({ bgType: "slideshow", images: next });
  },

  removeImage: (url) => {
    const next = get().images.filter((item) => item !== url);
    set({ images: next });
    useConfigStore.getState().setBackground({ images: next });
  },

  setVideo: (url) => {
    set({ type: "video", video: url, blur: 0, opacity: 1 });
    useConfigStore.getState().setBackground({ bgType: "video", video: url, blur: 0, opacity: 100 });
  },

  setIntervalSec: (sec) => {
    const intervalSec = clampInterval(sec);
    set({ intervalSec });
    useConfigStore.getState().setBackground({ intervalSec });
  },

  setBlur: (blur) => {
    set({ blur });
    useConfigStore.getState().setBackground({ blur });
  },

  setOpacity: (opacity) => {
    set({ opacity });
    useConfigStore.getState().setBackground({ opacity: Math.round(opacity * 100) });
  },

  reset: () => {
    set({ ...DEFAULT });
    useConfigStore.getState().setBackground({
      bgType: "image",
      image: DEFAULT_BG,
      images: [],
      video: "",
      intervalSec: SLIDESHOW_DEFAULT_SEC,
      blur: 0,
      opacity: 100,
    });
  },
}));

export function syncBackgroundFromConfig() {
  const bg = useConfigStore.getState().config.background;
  useBackgroundStore.setState({
    type: bg.bgType as BackgroundType,
    image: normalizeDefaultBg(bg.image),
    images: Array.isArray(bg.images) ? bg.images : [],
    video: typeof bg.video === "string" ? bg.video : "",
    intervalSec: clampInterval(bg.intervalSec),
    blur: bg.blur,
    opacity: bg.opacity / 100,
  });
}
