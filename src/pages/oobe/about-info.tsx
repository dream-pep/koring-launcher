import { useState, useEffect } from "react";
import { getSystemInfo, getLocaleInfo, type SystemInfo, type LocaleInfo } from "@/api/system";
import {
  Package,
  Cpu,
  Monitor,
  Globe,
  Languages,
  Clock,
  Loader2,
} from "lucide-react";

interface InfoItem {
  icon: typeof Package;
  label: string;
  value: string;
  color: string;
  bg: string;
}

export function OobeAboutInfo() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [localeInfo, setLocaleInfo] = useState<LocaleInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [sys, loc] = await Promise.all([getSystemInfo(), Promise.resolve(getLocaleInfo())]);
      setSystemInfo(sys);
      setLocaleInfo(loc);
      setLoading(false);
    }
    load();
  }, []);

  const items: InfoItem[] = systemInfo && localeInfo
    ? [
        { icon: Package, label: "App Version", value: `v${systemInfo.app_version}`, color: "text-primary", bg: "bg-primary/10" },
        { icon: Cpu, label: "BIOS ID", value: systemInfo.bios_id, color: "text-blue-500", bg: "bg-blue-500/10" },
        { icon: Monitor, label: "OS Name", value: `${systemInfo.os_name} (${systemInfo.os_version})`, color: "text-purple-500", bg: "bg-purple-500/10" },
        { icon: Globe, label: "Region", value: localeInfo.region, color: "text-green-500", bg: "bg-green-500/10" },
        { icon: Languages, label: "Language", value: localeInfo.language, color: "text-amber-500", bg: "bg-amber-500/10" },
        { icon: Clock, label: "Timezone", value: localeInfo.timezone, color: "text-cyan-500", bg: "bg-cyan-500/10" },
      ]
    : [];

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-semibold text-foreground">System Debug Information</h1>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Checking system information...</span>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.label} className="glass-card px-5 py-4">
                <div className="flex items-center gap-4">
                  <div className={`p-2.5 rounded-xl ${item.bg}`}>
                    <item.icon className={`w-5 h-5 ${item.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
                    <p className="text-sm font-medium text-foreground mt-0.5 truncate">{item.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
