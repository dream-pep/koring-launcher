import { useEffect, useState } from "react";
import { GlassCard, PageHeader } from "./components";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  cancelUpdate,
  checkForUpdates,
  compareVersions,
  downloadUpdate,
  getReleaseNotes,
  getUpdateState,
  onUpdateStatus,
  pauseUpdate,
  quitAndInstall,
  resumeUpdate,
  setTestVersion,
  type ReleaseNotesResult,
  type UpdateStatusPayload,
  type VersionCompareResult,
} from "@/api/update";

/** 更新功能测试：版本识别 / 检查 / 介绍 / 比对 / 下载 */
export function UpdateDebug() {
  const [status, setStatus] = useState<UpdateStatusPayload | null>(null);
  const [testVersion, setTestVersionInput] = useState("");
  const [versionMsg, setVersionMsg] = useState("");
  const [notesTag, setNotesTag] = useState("");
  const [notes, setNotes] = useState<ReleaseNotesResult | null>(null);
  const [notesMsg, setNotesMsg] = useState("");
  const [cmpA, setCmpA] = useState("");
  const [cmpB, setCmpB] = useState("");
  const [cmpResult, setCmpResult] = useState<VersionCompareResult | null>(null);

  useEffect(() => {
    const unsub = onUpdateStatus(setStatus);
    getUpdateState().then(setStatus).catch(() => {});
    return unsub;
  }, []);

  const s = status;
  const pct = s?.percent ?? 0;

  const run = async (fn: () => Promise<unknown>, setMsg: (m: string) => void) => {
    try {
      setMsg("执行中...");
      const r = await fn();
      setMsg(JSON.stringify(r));
    } catch (e) {
      setMsg(`失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <PageHeader title="更新功能测试" desc="测试更新检查、版本识别、发布说明、版本比对与下载" />

      {/* 1. 版本识别列表 */}
      <div>
        <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
          版本识别列表
        </h3>
        <GlassCard>
          <div className="space-y-1.5 text-[13px] font-mono">
            <p className="flex justify-between"><span className="text-muted-foreground">当前版本</span><span>{s?.currentVersion ?? "-"}</span></p>
            <p className="flex justify-between"><span className="text-muted-foreground">目标/最新版本</span><span>{s?.version ?? "-"}</span></p>
            <p className="flex justify-between"><span className="text-muted-foreground">更新状态</span><span>{s?.state ?? "-"}</span></p>
            <p className="flex justify-between"><span className="text-muted-foreground">更新通道</span><span>{s?.channel ?? "-"}</span></p>
            <p className="flex justify-between"><span className="text-muted-foreground">更新源</span><span className="max-w-[60%] truncate">{s?.source ?? "-"}</span></p>
            {s?.error && <p className="flex justify-between text-red-500"><span className="text-muted-foreground">错误</span><span className="max-w-[60%] truncate">{s.error}</span></p>}
          </div>
        </GlassCard>
      </div>

      {/* 2. 设置版本号 */}
      <div>
        <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
          设置测试版本号
        </h3>
        <GlassCard>
          <div className="flex gap-2">
            <Input
              value={testVersion}
              onChange={(e) => setTestVersionInput(e.target.value)}
              placeholder="如 1.2.1-beta.13"
              className="flex-1"
            />
            <Button size="sm" onClick={() => run(async () => {
              const r = await setTestVersion(testVersion.trim());
              setStatus(r);
              return r;
            }, setVersionMsg)}>
              设置
            </Button>
          </div>
          {versionMsg && <p className="mt-2 text-[12px] text-muted-foreground font-mono break-all">{versionMsg}</p>}
        </GlassCard>
      </div>

      {/* 3. 检查更新 */}
      <div>
        <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
          检查更新
        </h3>
        <GlassCard>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => run(async () => {
              const r = await checkForUpdates(true);
              setStatus(r);
              return r;
            }, setVersionMsg)}>
              检查更新
            </Button>
          </div>
        </GlassCard>
      </div>

      {/* 4. 获取更新介绍 */}
      <div>
        <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
          获取更新介绍
        </h3>
        <GlassCard>
          <div className="flex gap-2">
            <Input
              value={notesTag}
              onChange={(e) => setNotesTag(e.target.value)}
              placeholder="留空=当前版本；或填 tag 如 v1.2.1-beta.13"
              className="flex-1"
            />
            <Button size="sm" onClick={() => run(async () => {
              const r = await getReleaseNotes(notesTag.trim() || undefined);
              setNotes(r);
              return r ? { tag: r.tag, source: r.source, version: r.version, len: r.notes.length } : null;
            }, setNotesMsg)}>
              获取
            </Button>
          </div>
          {notes && (
            <div className="mt-3 text-[12px] text-muted-foreground font-mono break-all">
              <p>tag: {notes.tag} · 来源: {notes.source} · 长度: {notes.notes.length}</p>
              <div className="mt-1 max-h-40 overflow-y-auto border border-border/40 rounded-lg p-2 bg-foreground/[0.03] whitespace-pre-wrap">
                {notes.notes.slice(0, 600)}{notes.notes.length > 600 ? "…" : ""}
              </div>
            </div>
          )}
          {notesMsg && <p className="mt-2 text-[12px] text-muted-foreground font-mono break-all">{notesMsg}</p>}
        </GlassCard>
      </div>

      {/* 5. 版本比对 */}
      <div>
        <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
          版本比对
        </h3>
        <GlassCard>
          <div className="flex gap-2">
            <Input value={cmpA} onChange={(e) => setCmpA(e.target.value)} placeholder="版本 A" className="flex-1" />
            <span className="self-center text-muted-foreground text-[13px]">vs</span>
            <Input value={cmpB} onChange={(e) => setCmpB(e.target.value)} placeholder="版本 B" className="flex-1" />
            <Button size="sm" onClick={() => run(async () => {
              const r = await compareVersions(cmpA.trim(), cmpB.trim());
              setCmpResult(r);
              return r;
            }, setNotesMsg)}>
              比对
            </Button>
          </div>
          {cmpResult && (
            <p className="mt-2 text-[13px] font-mono">
              <span className={cmpResult.result === "a>b" ? "text-emerald-500" : cmpResult.result === "a<b" ? "text-red-500" : "text-foreground"}>
                {cmpResult.detail}
              </span>
            </p>
          )}
        </GlassCard>
      </div>

      {/* 6. 下载版本 */}
      <div>
        <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
          下载版本
        </h3>
        <GlassCard>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => run(downloadUpdate, setNotesMsg)}>下载</Button>
            <Button size="sm" variant="outline" onClick={() => run(pauseUpdate, setNotesMsg)}>暂停</Button>
            <Button size="sm" variant="outline" onClick={() => run(resumeUpdate, setNotesMsg)}>继续</Button>
            <Button size="sm" variant="outline" onClick={() => run(cancelUpdate, setNotesMsg)}>取消</Button>
            <Button size="sm" variant="outline" onClick={() => run(quitAndInstall, setNotesMsg)}>安装</Button>
          </div>
          {(s?.state === "downloading" || s?.state === "paused") && (
            <div className="mt-3">
              <div className="h-1.5 w-full rounded-full bg-foreground/10 overflow-hidden">
                <div className="h-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1.5 text-[12px] text-muted-foreground font-mono">
                {pct.toFixed(1)}% · {s.state}
                {s.transferred != null && s.total ? ` · ${(s.transferred / 1024 / 1024).toFixed(1)} / ${(s.total / 1024 / 1024).toFixed(1)} MB` : ""}
                {s.bytesPerSecond ? ` · ${(s.bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s` : ""}
              </p>
            </div>
          )}
        </GlassCard>
      </div>

      <p className="text-[12px] text-muted-foreground/50 text-center">
        仅用于开发调试；下载/安装会真实执行，请谨慎操作
      </p>
    </div>
  );
}
