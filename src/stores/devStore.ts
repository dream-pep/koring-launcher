import { create } from "zustand";

export type PreviewUpdateState = "latest" | "hasUpdate" | "installed";

/** 版本卡片「版本名称」的可选值：开发版 / 测试版 / 发行版 */
export type PreviewVersionLabel = "开发版" | "测试版" | "发行版";

/**
 * 开发者工具的临时覆盖状态。
 *
 * 刻意只放内存、不写配置（Koring.yml / config.*）：它们只用于本地调试与录屏，
 * 关闭启动器（渲染进程窗口销毁）后全部恢复默认。
 */
interface DevState {
  forceDisableContentBlur: boolean;
  setForceDisableContentBlur: (v: boolean) => void;

  previewMode: string | null;
  setPreviewMode: (v: string | null) => void;

  previewUpdateState: PreviewUpdateState | null;
  setPreviewUpdateState: (v: PreviewUpdateState | null) => void;

  /** 临时覆盖版本卡对外显示的版本号（null = 使用真实版本号） */
  previewVersion: string | null;
  setPreviewVersion: (v: string | null) => void;

  /** 临时覆盖版本卡的模式颜色（#RRGGBB，null = 跟随构建模式配色） */
  previewModeColor: string | null;
  setPreviewModeColor: (v: string | null) => void;

  /** 临时覆盖版本卡的版本名称（null = 跟随构建模式的「开发版/测试版/正式版」） */
  previewVersionLabel: PreviewVersionLabel | null;
  setPreviewVersionLabel: (v: PreviewVersionLabel | null) => void;

  /** 无文字录制模式：除顶栏与开发者工具页面外，界面文字全部用方块替代 */
  textlessMode: boolean;
  setTextlessMode: (v: boolean) => void;
}

export const useDevStore = create<DevState>((set) => ({
  forceDisableContentBlur: false,
  setForceDisableContentBlur: (v) => set({ forceDisableContentBlur: v }),

  previewMode: null,
  setPreviewMode: (v) => set({ previewMode: v }),

  previewUpdateState: null,
  setPreviewUpdateState: (v) => set({ previewUpdateState: v }),

  previewVersion: null,
  setPreviewVersion: (v) => set({ previewVersion: v }),

  previewModeColor: null,
  setPreviewModeColor: (v) => set({ previewModeColor: v }),

  previewVersionLabel: null,
  setPreviewVersionLabel: (v) => set({ previewVersionLabel: v }),

  textlessMode: false,
  setTextlessMode: (v) => set({ textlessMode: v }),
}));
