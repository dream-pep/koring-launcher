import { useConfigStore } from "@/stores/configStore";
import {
  SettingCard,
  PageHeader,
  SectionTitle,
  SettingRadioGroup,
  SettingNumberField,
  SettingInput,
  SettingBadge,
} from "@/components/setting";

/**
 * 下载源设置。
 *
 * 与主进程 electron/core/download-options.ts 保持一致：
 * - source：official（官方源）/ bmclapi（BMCLAPI 镜像）/ custom（自定义镜像）
 * - threads：并发下载线程数（1–64），同时作用于 libraries 与 assets
 * - 不再提供「限速」选项：@xmcl/file-transfer 没有带宽限制能力，保留会变成假设置
 */

const SOURCE_OPTIONS = [
  { value: "bmclapi", label: "BMCLAPI 镜像（默认，国内推荐）" },
  { value: "official", label: "Mojang 官方源（海外网络）" },
  { value: "custom", label: "自定义镜像地址" },
];

/** 官方地址（用于展示「实际生效地址」） */
const OFFICIAL = {
  manifest: "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
  maven: "https://libraries.minecraft.net",
  assets: "https://resources.download.minecraft.net",
};

const BMCLAPI = {
  manifest: "https://bmclapi2.bangbang93.com/mc/game/version_manifest.json",
  maven: "https://bmclapi2.bangbang93.com/maven",
  assets: "https://bmclapi2.bangbang93.com/assets",
};

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-[13px] text-muted-foreground shrink-0">{label}</span>
      <span className="text-[12px] font-mono text-foreground/80 truncate" title={value}>
        {value || "—"}
      </span>
    </div>
  );
}

export function DownloadSetting() {
  const dl = useConfigStore((s) => s.config.download);
  const setDownload = useConfigStore((s) => s.setDownload);

  const isCustom = dl.source === "custom";
  const isMirror = dl.source === "bmclapi";

  const manifest = isCustom
    ? dl.customVersionManifest
    : isMirror
      ? BMCLAPI.manifest
      : OFFICIAL.manifest;
  const maven = isCustom ? dl.customMavenHost : isMirror ? BMCLAPI.maven : OFFICIAL.maven;
  const assets = isCustom ? dl.customAssetsHost : isMirror ? BMCLAPI.assets : OFFICIAL.assets;

  return (
    <div>
      <PageHeader title="下载" desc="配置游戏资源下载源与并发数" />

      <div className="space-y-6">
        <div>
          <SectionTitle>下载源</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <SettingRadioGroup
                value={dl.source}
                options={SOURCE_OPTIONS}
                onChange={(v) => setDownload({ source: v })}
              />
            </SettingCard>

            {isCustom && (
              <SettingCard>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">自定义镜像地址</p>
                    <SettingBadge variant="warning">留空则回退到官方地址</SettingBadge>
                  </div>
                  <SettingInput
                    label="版本清单"
                    desc="version_manifest 的完整地址"
                    value={dl.customVersionManifest}
                    onChange={(v) => setDownload({ customVersionManifest: v })}
                    placeholder="https://example.com/mc/game/version_manifest.json"
                    mono
                    width="w-80"
                  />
                  <SettingInput
                    label="Maven 仓库"
                    desc="libraries / 加载器安装包的下载地址"
                    value={dl.customMavenHost}
                    onChange={(v) => setDownload({ customMavenHost: v })}
                    placeholder="https://example.com/maven"
                    mono
                    width="w-80"
                  />
                  <SettingInput
                    label="Assets 地址"
                    desc="资源文件（音效、语言文件、贴图）的下载地址"
                    value={dl.customAssetsHost}
                    onChange={(v) => setDownload({ customAssetsHost: v })}
                    placeholder="https://example.com/assets"
                    mono
                    width="w-80"
                  />
                </div>
              </SettingCard>
            )}
          </div>
        </div>

        <div>
          <SectionTitle>并发与重试</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <SettingNumberField
                label="并发下载线程数"
                desc="同时下载的文件数量，范围 1–64；过高在部分网络下反而更容易失败"
                value={dl.threads}
                min={1}
                max={64}
                suffix="线程"
                onChange={(v) => setDownload({ threads: v })}
              />
            </SettingCard>
          </div>
        </div>

        <div>
          <SectionTitle>当前生效地址</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <div className="divide-y divide-border/30 dark:divide-white/[0.06]">
                <PreviewRow label="版本清单" value={manifest} />
                <PreviewRow label="Maven 仓库" value={maven} />
                <PreviewRow label="Assets 资源" value={assets} />
              </div>
            </SettingCard>
            <SettingCard>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                下载源在每次安装 / 修复实例时生效，无需重启启动器。安装过程中若中途失败，
                可在实例详情页点击「修复」，已下载的文件不会重复下载。
                带宽限速暂不支持（底层下载库无此能力），因此设置里不再提供该选项。
              </p>
            </SettingCard>
          </div>
        </div>
      </div>
    </div>
  );
}
