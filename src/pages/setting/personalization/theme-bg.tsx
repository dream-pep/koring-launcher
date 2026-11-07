import { useEffect, useState } from "react";
import { useThemeStore, type DarkMode } from "@/stores/themeStore";
import { useBackgroundStore, type BackgroundMode } from "@/stores/backgroundStore";
import { Button, Slider } from "@heroui/react";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_BG } from "@/lib/mode";
import clsx from "clsx";
import { Sparkles, Droplet, Image as ImageIcon, Video, Film, Plus, X, Loader2 } from "lucide-react";
import { SettingCard, SettingRow, PageHeader, SectionTitle } from "@/components/setting";

/** 可直接用于 CSS/img 的源（data:/http(s):/file:/相对 URL） */
const isCssSource = (v: string) => /^(data:|https?:|file:|\/|\.\/|\.\.\/)/i.test(v);

/** 把配置里的文件路径解析成可显示的资源引用（预览用） */
function useResolvedSource(value: string | null): string | null {
  const [url, setUrl] = useState<string | null>(() =>
    value && (value === DEFAULT_BG || isCssSource(value)) ? value : null,
  );
  useEffect(() => {
    let cancelled = false;
    if (!value) {
      setUrl(null);
      return;
    }
    if (value === DEFAULT_BG || isCssSource(value)) {
      setUrl(value);
      return;
    }
    window.electronAPI?.resolveBackgroundResource?.(value).then((res) => {
      if (!cancelled) setUrl(res?.url ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [value]);
  return url;
}

/** 单个缩略图（配置存路径，需要先解析成 koring-res:// 才能显示） */
function ImageThumb({ value, onRemove }: { value: string; onRemove: () => void }) {
  const url = useResolvedSource(value);
  const name = value.split(/[\\/]+/).pop() || value;
  return (
    <div className="group relative overflow-hidden rounded-lg border border-border/50 bg-foreground/[0.03]">
      {url ? (
        <img src={url} alt={name} title={name} className="h-[72px] w-full object-cover" />
      ) : (
        <div className="grid h-[72px] w-full place-items-center text-[11px] text-muted-foreground/60">
          加载中…
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        title="移除这张图片"
        className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

const MODE_OPTIONS: { value: BackgroundMode; label: string; desc: string; Icon: typeof Sparkles }[] = [
  { value: "mica", label: "Mica 材质", desc: "Windows 11 系统材质", Icon: Sparkles },
  { value: "color", label: "纯色", desc: "单色背景", Icon: Droplet },
  { value: "image", label: "图片", desc: "静态壁纸，可轮换", Icon: ImageIcon },
  { value: "video", label: "视频", desc: "循环播放，永远静音", Icon: Video },
  { value: "gif", label: "GIF", desc: "动图背景", Icon: Film },
];

function ThemePreviewCard({ mode, selected, onClick }: { mode: DarkMode; selected: boolean; onClick: () => void }) {
  const isDark = mode === "dark";
  const isAuto = mode === "auto";

  const label = isAuto ? "跟随系统" : isDark ? "深色模式" : "浅色模式";

  return (
    <Button
      variant="ghost"
      onPress={onClick}
      className={clsx(
        "relative rounded-md p-1 transition-all duration-200 h-auto min-w-0",
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
    mode,
    images,
    imageRotateSeconds,
    video,
    gif,
    color,
    opacity,
    blur,
    setMode,
    setColor,
    addImages,
    removeImage,
    setRotateSeconds,
    pickVideo,
    pickGif,
    setOpacity,
    setBlur,
    reset,
  } = useBackgroundStore();

  const [picking, setPicking] = useState(false);
  const videoName = video.split(/[\\/]+/).pop() || "";
  const gifUrl = useResolvedSource(gif);
  const gifName = gif.split(/[\\/]+/).pop() || "";
  const showParallaxRow = mode !== "mica";

  const handleReset = async () => {
    await reset();
  };

  return (
    <div>
      <PageHeader title="主题与背景" desc="切换深色模式、选择背景模式与调整视觉效果" />

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
          <SectionTitle>背景模式</SectionTitle>
          <div className="grid grid-cols-5 gap-2">
            {MODE_OPTIONS.map(({ value, label, desc, Icon }) => {
              const selected = mode === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => void setMode(value)}
                  title={desc}
                  className={clsx(
                    "flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center transition-all duration-200",
                    "border",
                    selected
                      ? "border-primary/60 bg-primary/[0.07] text-foreground shadow-sm"
                      : "border-border/50 bg-foreground/[0.02] text-foreground/60 hover:bg-foreground/[0.05] hover:text-foreground/85",
                  )}
                >
                  <Icon className={clsx("h-5 w-5", selected ? "text-primary" : "text-foreground/45")} />
                  <span className="text-[12.5px] font-medium">{label}</span>
                  <span className="text-[10.5px] leading-tight text-muted-foreground/70">{desc}</span>
                </button>
              );
            })}
          </div>
          {mode === "mica" && (
            <p className="mt-2 text-[11.5px] text-muted-foreground/75">
              Mica 材质需要 Windows 11；从其它模式切换到 Mica 后需重启启动器才能看到系统材质。
            </p>
          )}
        </div>

        <div>
          <SectionTitle>背景内容</SectionTitle>
          <div className="space-y-3">
            {mode === "mica" && (
              <SettingCard>
                <SettingRow label="Mica 材质" desc="窗口透明，由 Windows 11 绘制系统材质">
                  <span className="text-[12px] text-muted-foreground/70">跟随系统</span>
                </SettingRow>
              </SettingCard>
            )}

            {mode === "color" && (
              <SettingCard>
                <SettingRow label="背景颜色" desc="纯色模式下的背景颜色">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12px] text-muted-foreground/80">{color}</span>
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => void setColor(e.target.value)}
                      className="h-8 w-10 cursor-pointer rounded-md border border-border/60 bg-transparent p-0.5"
                      aria-label="选择背景颜色"
                    />
                  </div>
                </SettingRow>
              </SettingCard>
            )}

            {mode === "image" && (
              <>
                <SettingCard>
                  <SettingRow
                    label="轮换图片"
                    desc={
                      images.length > 0
                        ? `已添加 ${images.length} 张，按顺序轮换显示`
                        : "未添加图片时使用默认壁纸"
                    }
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={async () => {
                        setPicking(true);
                        try {
                          await addImages();
                        } finally {
                          setPicking(false);
                        }
                      }}
                      isDisabled={picking}
                    >
                      {picking ? (
                        <span className="flex items-center gap-1.5">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          导入中…
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <Plus className="h-3.5 w-3.5" />
                          添加图片
                        </span>
                      )}
                    </Button>
                  </SettingRow>
                  {images.length > 0 && (
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      {images.map((src) => (
                        <ImageThumb key={src} value={src} onRemove={() => void removeImage(src)} />
                      ))}
                    </div>
                  )}
                </SettingCard>

                <SettingCard>
                  <SettingRow
                    label="轮换间隔"
                    desc={
                      images.length < 2
                        ? "至少添加 2 张图片才会轮换"
                        : imageRotateSeconds <= 0
                          ? "当前不自动轮换"
                          : `每 ${imageRotateSeconds} 秒切换一张`
                    }
                  >
                    <Slider
                      className="w-[180px]"
                      value={imageRotateSeconds}
                      minValue={0}
                      maxValue={120}
                      step={5}
                      onChange={(v) => void setRotateSeconds(typeof v === "number" ? v : v[0])}
                    >
                      <Slider.Track>
                        <Slider.Fill />
                        <Slider.Thumb />
                      </Slider.Track>
                    </Slider>
                  </SettingRow>
                </SettingCard>
              </>
            )}

            {mode === "video" && (
              <SettingCard>
                <SettingRow label="视频背景" desc="循环播放，且始终静音（不会发出任何声音）">
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={async () => {
                      setPicking(true);
                      try {
                        await pickVideo();
                      } finally {
                        setPicking(false);
                      }
                    }}
                    isDisabled={picking}
                  >
                    {picking ? "导入中…" : video ? "更换视频" : "选择视频"}
                  </Button>
                </SettingRow>
                {video && (
                  <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground/70" title={video}>
                    {videoName}
                  </p>
                )}
              </SettingCard>
            )}

            {mode === "gif" && (
              <SettingCard>
                <SettingRow label="GIF 动图" desc="保留动画播放，不发出声音">
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={async () => {
                      setPicking(true);
                      try {
                        await pickGif();
                      } finally {
                        setPicking(false);
                      }
                    }}
                    isDisabled={picking}
                  >
                    {picking ? "导入中…" : gif ? "更换 GIF" : "选择 GIF"}
                  </Button>
                </SettingRow>
                {gif && (
                  <div className="mt-3 overflow-hidden rounded-lg border border-border/50">
                    {gifUrl ? (
                      <img src={gifUrl} alt={gifName} className="h-[120px] w-full object-cover" />
                    ) : (
                      <div className="grid h-[120px] place-items-center text-[12px] text-muted-foreground/70 bg-foreground/[0.03]">
                        预览加载中…
                      </div>
                    )}
                  </div>
                )}
              </SettingCard>
            )}
          </div>
        </div>

        <div>
          <SectionTitle>视觉效果</SectionTitle>
          <div className="space-y-3">
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
              <SettingRow
                label="背景不透明度"
                desc={`控制背景的可见程度，当前 ${Math.round(opacity * 100)}%`}
              >
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

            {showParallaxRow && (
              <SettingCard>
                <SettingRow label="背景视差" desc="背景随鼠标移动产生轻微位移">
                  <Switch aria-label="背景视差" checked={parallax} onCheckedChange={setParallax} />
                </SettingRow>
              </SettingCard>
            )}

            <SettingCard>
              <SettingRow label="恢复默认" desc="重置所有背景设置为初始状态">
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
