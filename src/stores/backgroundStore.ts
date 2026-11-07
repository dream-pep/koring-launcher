import { create } from "zustand";
import { useConfigStore } from "./configStore";
import { DEFAULT_BG } from "@/lib/mode";

type BackgroundType = "image" | "color";

interface BackgroundState {
  type: BackgroundType;
  image: string;
  blur: number;
  opacity: number;
  setImage: (url: string) => void;
  setColor: (color: string) => void;
  setBlur: (blur: number) => void;
  setOpacity: (opacity: number) => void;
  reset: () => void;
}

const DEFAULT: { type: BackgroundType; image: string; blur: number; opacity: number } = {
  type: "image",
  image: DEFAULT_BG,
  blur: 0,
  opacity: 1,
};

/** 旧版主进程默认值用的绝对路径 /background.png（dev 可显示，打包 file:// 下指向文件系统根→黑屏）。
 *  统一归一化为渲染端 DEFAULT_BG（BASE_URL 相对路径，dev/打包均正确）。 */
const normalizeDefaultBg = (url: string): string => (url === "/background.png" ? DEFAULT_BG : url);

export const useBackgroundStore = create<BackgroundState>((set) => ({
  ...DEFAULT,

  setImage: (url) => {
    set({ type: "image", image: url, blur: 0, opacity: 1 });
    useConfigStore.getState().setBackground({ bgType: "image", image: url, blur: 0, opacity: 100 });
  },

  setColor: (color) => {
    set({ type: "color", image: color, blur: 0, opacity: 1 });
    useConfigStore.getState().setBackground({ bgType: "color", image: color, blur: 0, opacity: 100 });
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
    useConfigStore.getState().setBackground({ bgType: "image", image: DEFAULT_BG, blur: 0, opacity: 100 });
  },
}));

export function syncBackgroundFromConfig() {
  const bg = useConfigStore.getState().config.background;
  useBackgroundStore.setState({
    type: bg.bgType as BackgroundType,
    image: normalizeDefaultBg(bg.image),
    blur: bg.blur,
    opacity: bg.opacity / 100,
  });
}
