import { useEffect, useMemo, useState } from "react";
import { useThemeStore, type DarkMode } from "@/stores/themeStore";
import {
  SLIDESHOW_MAX_SEC,
  SLIDESHOW_MIN_SEC,
  useBackgroundStore,
} from "@/stores/backgroundStore";
import { Button, Slider } from "@heroui/react";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_BG } from "@/lib/mode";
import clsx from "clsx";
import { Film, ImagePlus, Plus, X } from "lucide-react";
import {
  SettingCard,
  SettingRow,
  SettingSelect,
  PageHeader,
  SectionTitle,
} from "@/components/setting";
import type { BackgroundMode } from "@/api/config";
import { createRendererLogger } from "@/lib/logger";

const log = createRendererLogger("theme-bg");

/** 可直接用于 CSS/`<img>` 的源（data:/http(s):/file:/相对 URL） */
const isCssSource = (v: string) => /^(data:|https?:|file:|\/|\.\/|\.\.\/)/i.test(v);

const BACKGROUND_MODE_OPTIONS = [
  { value: "image", label: "图片", desc: "单张背景图片" },
  { value: "slideshow", label: "多个图片", desc: "添加多张照片并按间隔自动切换" },
  { value: "video", label: "视频", desc: "无声音循环播放的视频背景" },
];

/** 把配置里的路径解析为可显示的资源引用（koring-res://） */
async function resolvePreview(value: string): Promise<string | null> {
  if (!value) return null;
  if (value === DEFAULT_BG || isCssSource(value)) return value;
  const res = await window.electronAPI?.resolveBackgroundResource?.(value);
  return res?.url ?? null;
}

function ThemePreviewCard({ mode, selected, onClick }: { mode: DarkMode; selected: boolean; onClick: () => void }) {
  const isDark = mode === "dark";
  const isAuto = mode === "auto";

  const label = isAuto ? "跟随系统" : isDark ? "深色模式" : "浅色模式";

  return (
    <Button
      variant="ghost"
      onPress={onClick}
      className={clsx(
        // flex-col：图示在上、文字在下（按钮默认 inline-flex 横排会把文字挤到预览图右侧）
        "relative flex flex-col items-center justify-center rounded-md p-1 transition-all duration-200 h-auto min-w-0",
        "border-2",
        selected
          ? "!border-primary ring-2 ring-primary/20"
          : "!border-transparent hover:!border-muted-foreground/20",
      )}
    >
      <div className="relative w-[140px] h-[96px] rounded overflow-hidden">
        {isAuto ? (
          <div className="flex w-full h-full">
            <div className="w-1/2 h-full bg-white flex flex-col">
              <div className="h-[6px] bg-gray-200 flex items-center px-1 gap-[2px]">
                <div className="w-[3px] h-[3px] rounded-full bg-red-400" />
                <div className="w-[3px] h-[3px] rounded-full bg-yellow-400" />
                <div className="w-[3px] h-[3px] rounded-full bg-green-400" />
              </div>
              <div className="flex-1 px-2 py-1">
                <div className="w-full h-[4px] rounded bg-gray-200 mb-1" />
                <div className="w-3/4 h-[3px] rounded bg-gray-100" />
              </div>
            </div>
            <div className="w-1/2 h-full bg-[#1c1c1e] flex flex-col">
              <div className="h-[6px] bg-[#2c2c2e] flex items-center px-1 gap-[2px]">
                <div className="w-[3px] h-[3px] rounded-full bg-red-400" />
                <div className="w-[3px] h-[3px] rounded-full bg-yellow-400" />
                <div className="w-[3px] h-[3px] rounded-full bg-green-400" />
              </div>
              <div className="flex-1 px-2 py-1">
                <div className="w-full h-[4px] rounded bg-[#3a3a3c] mb-1" />
                <div className="w-3/4 h-[3px] rounded bg-[#2c2c2e]" />
              </div>
            </div>
          </div>
        ) : isDark ? (
          <div className="w-full h-full bg-[#1c1c1e] flex flex-col">
            <div className="h-[6px] bg-[#2c2c2e] flex items-center px-1 gap-[2px]">
              <div className="w-[3px] h-[3px] rounded-full bg-red-400" />
              <div className="w-[3px] h-[3px] rounded-full bg-yellow-400" />
              <div className="w-[3px] h-[3px] rounded-full bg-green-400" />
            </div>
            <div className="flex-1 px-2 py-1">
              <div className="w-full h-[4px] rounded bg-[#3a3a3c] mb-1" />
              <div className="w-3/4 h-[3px] rounded bg-[#2c2c2e] mb-1" />
              <div className="w-1/2 h-[3px] rounded bg-[#2c2c2e]" />
            </div>
          </div>
        ) : (
          <div className="w-full h-full bg-white flex flex-col">
            <div className="h-[6px] bg-gray-200 flex items-center px-1 gap-[2px]">
              <div className="w-[3px] h-[3px] rounded-full bg-red-400" />
              <div className="w-[3px] h-[3px] rounded-full bg-yellow-400" />
              <div className="w-[3px] h-[3px] rounded-full bg-green-400" />
            </div>
            <div className="flex-1 px-2 py-1">
              <div className="w-full h-[4px] rounded bg-gray-200 mb-1" />
              <div className="w-3/4 h-[3px] rounded bg-gray-100 mb-1" />
              <div className="w-1/2 h-[3px] rounded bg-gray-100" />
            </div>
          </div>
        )}
      </div>
      <p className="text-[11px] text-center mt-1.5 text-muted-foreground">{label}</p>
    </Button>
  );
}

export function ThemeBgSetting() {
  const { darkMode, setDarkMode, parallax, setParallax } = useThemeStore();
  const {
    type,
    image,
    images,
    video,
    intervalSec,
    opacity,
    blur,
    setMode,
    setImage,
    setVideo,
    addImage,
    removeImage,
    setIntervalSec,
    setOpacity,
    setBlur,
    reset,
  } = useBackgroundStore();

  /** 当前背景模式（旧版纯色配置按图片模式展示） */
  const mode: "image" | "slideshow" | "video" = type === "slideshow" ? "slideshow" : type === "video" ? "video" : "image";

  // 单图预览：配置文件里存的是文件路径 → 主进程解析为 koring-res:// 引用再显示
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // 轮播缩略图：路径 → 可显示 URL
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  // 视频预览
  const [videoPreview, setVideoPreview] = useState<string | null>(null);

  const imagesKey = images.join("\n");

  useEffect(() => {
    let cancelled = false;
    resolvePreview(image).then((url) => {
      if (!cancelled) setPreviewUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [image]);

  useEffect(() => {
    let cancelled = false;
    for (const path of images) {
      resolvePreview(path).then((url) => {
        if (cancelled || !url) return;
        setThumbs((prev) => (prev[path] === url ? prev : { ...prev, [path]: url }));
      });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imagesKey]);

  useEffect(() => {
    let cancelled = false;
    resolvePreview(video).then((url) => {
      if (!cancelled) setVideoPreview(url);
    });
    return () => {
      cancelled = true;
    };
  }, [video]);

  const modeOptions = useMemo(
    () => BACKGROUND_MODE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label })),
    [],
  );

  const handleModeChange = (value: string) => {
    if (value === "image" || value === "slideshow" || value === "video") {
      log.info(`切换背景模式 → ${value}`);
      setMode(value as BackgroundMode);
    }
  };

  const handlePickImage = async () => {
    // 返回的是 userData 内的文件路径（配置/Store 以路径保存，不使用 BASE64）
    const filePath = await window.electronAPI?.pickBackgroundImage?.();
    if (filePath) {
      log.info(`选择壁纸完成 → ${filePath}`);
      setImage(filePath);
    } else {
      log.warn("选择壁纸未返回路径（取消或导入失败）");
    }
  };

  const handleAddImage = async () => {
    const filePath = await window.electronAPI?.pickBackgroundImage?.();
    if (filePath) {
      log.info(`添加轮播图片 → ${filePath}`);
      addImage(filePath);
    }
  };

  const handleRemoveImage = async (path: string) => {
    removeImage(path);
    setThumbs((prev) => {
      if (!(path in prev)) return prev;
      const next = { ...prev };
      delete next[path];
      return next;
    });
    // 删除受管文件，避免 userData 里堆积不再使用的图片
    await window.electronAPI?.removeBackgroundFile?.(path);
  };

  const handlePickVideo = async () => {
    const filePath = await window.electronAPI?.pickBackgroundVideo?.();
    if (filePath) {
      const previousVideo = video;
      log.info(`选择视频背景 → ${filePath}`);
      setVideo(filePath);
      if (previousVideo && previousVideo !== filePath) {
        await window.electronAPI?.removeBackgroundFile?.(previousVideo);
      }
    } else {
      log.warn("选择视频未返回路径（取消或导入失败）");
    }
  };

  const handleRemoveVideo = async () => {
    const previousVideo = video;
    setVideo("");
    setVideoPreview(null);
    if (previousVideo) await window.electronAPI?.removeBackgroundFile?.(previousVideo);
  };

  const handleReset = async () => {
    await window.electronAPI?.clearBackgroundFiles?.();
    setThumbs({});
    setVideoPreview(null);
    await reset();
  };

  return (
    <div>
      <PageHeader title="主题与背景" desc="切换深色模式、选择背景模式并调整视觉效果" />

      <div className="space-y-6">
        <div>
          <SectionTitle>深色模式</SectionTitle>
          <SettingCard>
            <div className="flex items-center justify-center gap-4 py-2">
              <ThemePreviewCard mode="light" selected={darkMode === "light"} onClick={() => setDarkMode("light")} />
              <ThemePreviewCard mode="auto" selected={darkMode === "auto"} onClick={() => setDarkMode("auto")} />
              <ThemePreviewCard mode="dark" selected={darkMode === "dark"} onClick={() => setDarkMode("dark")} />
            </div>
          </SettingCard>
        </div>

        <div>
          <SectionTitle>背景</SectionTitle>
          <div className="space-y-3">
            {/* 背景模式 */}
            <SettingCard>
              <SettingSelect
                label="背景模式"
                desc="图片：单张背景；多个图片：自动轮播；视频：无声音循环播放"
                value={mode}
                options={modeOptions}
                onChange={handleModeChange}
              />
            </SettingCard>

            {/* 图片模式：单张背景 */}
            {mode === "image" && (
              <SettingCard>
                <SettingRow label="背景图片" desc="更换启动器背景图片">
                  <Button variant="outline" size="sm" onPress={handlePickImage}>
                    选择图片
                  </Button>
                </SettingRow>
                {image && image !== DEFAULT_BG && (
                  <div className="mt-3 rounded-lg overflow-hidden border border-border/50">
                    {previewUrl ? (
                      <img src={previewUrl} alt="背景预览" className="w-full h-[120px] object-cover" />
                    ) : (
                      <div className="w-full h-[120px] grid place-items-center text-[12px] text-muted-foreground/70 bg-foreground/[0.03]">
                        预览加载中…
                      </div>
                    )}
                  </div>
                )}
              </SettingCard>
            )}

            {/* 多个图片：自动轮播 */}
            {mode === "slideshow" && (
              <SettingCard>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">轮播图片</p>
                    <p className="text-[13px] text-muted-foreground mt-0.5">
                      已添加 {images.length} 张，每 {intervalSec} 秒自动切换（开启「减少动画」时暂停切换）
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onPress={handleAddImage} className="shrink-0">
                    <Plus className="w-3.5 h-3.5" />
                    添加图片
                  </Button>
                </div>

                {images.length === 0 ? (
                  <div className="mt-3 rounded-lg border border-dashed border-border/60 bg-foreground/[0.02] py-8 flex flex-col items-center gap-1.5 text-muted-foreground/70">
                    <ImagePlus className="w-5 h-5" />
                    <p className="text-[12px]">还没有添加图片，添加后会自动开始轮播</p>
                  </div>
                ) : (
                  <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
                    {images.map((path) => (
                      <div
                        key={path}
                        className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-border/50 bg-foreground/[0.04]"
                      >
                        {thumbs[path] ? (
                          <img src={thumbs[path]} alt="轮播图片" className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-[11px] text-muted-foreground/60">
                            加载中…
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleRemoveImage(path)}
                          title="移除这张图片"
                          aria-label="移除这张图片"
                          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity hover:bg-black/75 group-hover:opacity-100 focus-visible:opacity-100"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 border-t border-border/40 pt-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[13px] text-foreground">切换间隔</span>
                    <span className="text-[12px] text-muted-foreground tabular-nums">{intervalSec} 秒</span>
                  </div>
                  <Slider
                    className="w-full"
                    value={intervalSec}
                    minValue={SLIDESHOW_MIN_SEC}
                    maxValue={SLIDESHOW_MAX_SEC}
                    step={5}
                    onChange={(v) => setIntervalSec(typeof v === "number" ? v : v[0])}
                  >
                    <Slider.Track>
                      <Slider.Fill />
                      <Slider.Thumb />
                    </Slider.Track>
                  </Slider>
                </div>
              </SettingCard>
            )}

            {/* 视频：静音循环播放 */}
            {mode === "video" && (
              <SettingCard>
                <SettingRow label="背景视频" desc="无声音循环播放，支持 MP4 / WebM / OGG">
                  <Button variant="outline" size="sm" onPress={handlePickVideo}>
                    <Film className="w-3.5 h-3.5" />
                    {video ? "更换视频" : "选择视频"}
                  </Button>
                </SettingRow>
                {video ? (
                  <div className="mt-3 space-y-2">
                    <div className="rounded-lg overflow-hidden border border-border/50 bg-black/80">
                      {videoPreview ? (
                        <video
                          key={videoPreview}
                          src={videoPreview}
                          className="w-full h-[160px] object-cover"
                          muted
                          loop
                          autoPlay
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <div className="w-full h-[160px] grid place-items-center text-[12px] text-muted-foreground/70">
                          预览加载中…
                        </div>
                      )}
                    </div>
                    <Button variant="danger" size="sm" onPress={handleRemoveVideo}>
                      移除视频
                    </Button>
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg border border-dashed border-border/60 bg-foreground/[0.02] py-8 flex flex-col items-center gap-1.5 text-muted-foreground/70">
                    <Film className="w-5 h-5" />
                    <p className="text-[12px]">还没有选择视频，选择后会静音循环播放</p>
                  </div>
                )}
              </SettingCard>
            )}

            <SettingCard>
              <SettingRow label="背景模糊" desc={`对背景施加高斯模糊，当前 ${blur}px`}>
                <Slider
                  className="w-[180px]"
                  value={blur}
                  minValue={0}
                  maxValue={20}
                  step={1}
                  onChange={(v) => setBlur(typeof v === "number" ? v : v[0])}
                >
                  <Slider.Track>
                    <Slider.Fill />
                    <Slider.Thumb />
                  </Slider.Track>
                </Slider>
              </SettingRow>
            </SettingCard>

            <SettingCard>
              <SettingRow label="背景不透明度" desc={`控制背景的可见程度，当前 ${Math.round(opacity * 100)}%`}>
                <Slider
                  className="w-[180px]"
                  value={opacity * 100}
                  minValue={0}
                  maxValue={100}
                  step={1}
                  onChange={(v) => setOpacity((typeof v === "number" ? v : v[0]) / 100)}
                >
                  <Slider.Track>
                    <Slider.Fill />
                    <Slider.Thumb />
                  </Slider.Track>
                </Slider>
              </SettingRow>
            </SettingCard>

            <SettingCard>
              <SettingRow label="背景视差" desc="背景随鼠标移动产生轻微视差位移">
                <Switch aria-label="背景视差" checked={parallax} onCheckedChange={setParallax} />
              </SettingRow>
            </SettingCard>

            <SettingCard>
              <SettingRow label="恢复默认" desc="重置所有背景设置，并清理已导入的图片与视频">
                <Button variant="danger" size="sm" onPress={handleReset}>
                  恢复默认
                </Button>
              </SettingRow>
            </SettingCard>
          </div>
        </div>
      </div>
    </div>
  );
}
