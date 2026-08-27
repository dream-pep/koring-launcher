import { useConfigStore } from "@/stores/configStore";
import { Slider, RadioGroup, Radio, Input } from "@heroui/react";
import { SettingCard, PageHeader, SectionTitle, fieldCls } from "@/components/setting";

const downloadSources = [
  { value: "mirror", label: "尽量使用镜像源（推荐国内用户）" },
  { value: "official", label: "优先使用官方源" },
  { value: "official-only", label: "仅使用官方源" },
];

export function DownloadSetting() {
  const dl = useConfigStore((s) => s.config.download);
  const setDownload = useConfigStore((s) => s.setDownload);

  return (
    <div>
      <PageHeader title="下载" desc="配置游戏资源下载源、并发数与存储路径" />

      <div className="space-y-6">
        <div>
          <SectionTitle>下载源</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">文件下载源</p>
                <p className="text-[13px] text-muted-foreground">游戏文件（jar、lib）的下载来源</p>
                <RadioGroup
                  value={dl.fileSource}
                  onChange={(v) => setDownload({ fileSource: String(v) })}
                  className="mt-2 space-y-2"
                >
                  {downloadSources.map((opt) => (
                    <Radio key={opt.value} value={opt.value}>
                      <Radio.Content>{opt.label}</Radio.Content>
                    </Radio>
                  ))}
                </RadioGroup>
              </div>
            </SettingCard>

            <SettingCard>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">版本列表源</p>
                <p className="text-[13px] text-muted-foreground">获取可用游戏版本列表的来源</p>
                <RadioGroup
                  value={dl.versionSource}
                  onChange={(v) => setDownload({ versionSource: String(v) })}
                  className="mt-2 space-y-2"
                >
                  {downloadSources.map((opt) => (
                    <Radio key={opt.value} value={opt.value}>
                      <Radio.Content>{opt.label}</Radio.Content>
                    </Radio>
                  ))}
                </RadioGroup>
              </div>
            </SettingCard>
          </div>
        </div>

        <div>
          <SectionTitle>并发控制</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">最大下载线程数</p>
                    <p className="text-[13px] text-muted-foreground mt-0.5">同时下载的文件数量，过高可能导致不稳定</p>
                  </div>
                  <span className="text-[13px] text-muted-foreground tabular-nums shrink-0 ml-4">{dl.threads}</span>
                </div>
                <Slider
                  value={dl.threads}
                  onChange={(v) => setDownload({ threads: typeof v === "number" ? v : v[0] })}
                  minValue={1}
                  maxValue={64}
                  step={1}
                >
                  <Slider.Track>
                    <Slider.Fill />
                    <Slider.Thumb />
                  </Slider.Track>
                </Slider>
                <div className="flex justify-between mt-1">
                  <span className="text-[11px] text-muted-foreground/50">1</span>
                  <span className="text-[11px] text-muted-foreground/50">64</span>
                </div>
              </div>
            </SettingCard>
          </div>
        </div>

        <div>
          <SectionTitle>速度限制</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">下载速度上限</p>
                <p className="text-[13px] text-muted-foreground">单位 KB/s，0 表示不限速</p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={String(dl.speedLimit)}
                    onChange={(e) => setDownload({ speedLimit: Number(e.target.value) })}
                    className={`w-28 ${fieldCls}`}
                  />
                  <span className="text-[13px] text-muted-foreground">KB/s</span>
                </div>
              </div>
            </SettingCard>
          </div>
        </div>
      </div>
    </div>
  );
}
