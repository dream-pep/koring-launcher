//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/stores/authStore";
import { GlassCard, SettingRow, PageHeader } from "./components";
import { LogIn, Trash2, Check } from "lucide-react";

// 账号类型文案
const TYPE_LABEL: Record<string, string> = {
  offline: "离线",
  littleskin: "LittleSkin",
  microsoft: "微软",
};

// 分组小标题
function GroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
      {children}
    </h3>
  );
}

export function AuthDebug() {
  const accounts = useAuthStore((s) => s.accounts);
  const activeAccountId = useAuthStore((s) => s.activeAccountId);
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const addOfflineAccount = useAuthStore((s) => s.addOfflineAccount);
  const addLittleskinAccount = useAuthStore((s) => s.addLittleskinAccount);
  const setActiveAccount = useAuthStore((s) => s.setActiveAccount);
  const removeAccount = useAuthStore((s) => s.removeAccount);

  const [offlineName, setOfflineName] = useState("");
  const [lsUsername, setLsUsername] = useState("");
  const [lsPassword, setLsPassword] = useState("");

  // 添加离线账号
  const handleAddOffline = async () => {
    const name = offlineName.trim();
    if (!name) {
      toast.warning("请输入离线用户名");
      return;
    }
    if (name.length > 16) {
      toast.warning("离线用户名不能超过 16 个字符");
      return;
    }
    const ok = await addOfflineAccount(name);
    if (ok) {
      toast.success(`已添加离线账号：${name}`);
      setOfflineName("");
    } else {
      toast.error(useAuthStore.getState().error || "添加失败");
    }
  };

  // LittleSkin 登录测试
  const handleLittleskin = async () => {
    const name = lsUsername.trim();
    if (!name || !lsPassword) {
      toast.warning("请输入 LittleSkin 用户名与密码");
      return;
    }
    const ok = await addLittleskinAccount(name, lsPassword);
    if (ok) {
      toast.success("LittleSkin 登录成功");
      setLsUsername("");
      setLsPassword("");
    } else {
      toast.error(useAuthStore.getState().error || "登录失败");
    }
  };

  // 切换当前账号
  const handleActivate = async (id: string) => {
    const ok = await setActiveAccount(id);
    if (!ok) toast.error(useAuthStore.getState().error || "切换失败");
  };

  // 移除账号
  const handleRemove = async (id: string, name: string) => {
    const ok = await removeAccount(id);
    if (ok) toast.success(`已移除账号：${name}`);
    else toast.error(useAuthStore.getState().error || "移除失败");
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <PageHeader title="账号认证调试" desc="测试多账号列表、离线登录、LittleSkin 登录与账号切换" />

      <div className="space-y-6">
        {/* 当前档案 */}
        <div>
          <GroupTitle>当前账号档案</GroupTitle>
          <div className="space-y-3">
            <GlassCard>
              {user ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{user.username}</p>
                    <Badge variant="outline">已激活</Badge>
                  </div>
                  <p className="text-[12px] text-muted-foreground/70 font-mono break-all">
                    UUID: {user.uuid}
                  </p>
                  <p className="text-[12px] text-muted-foreground/70">
                    访问令牌: {user.accessToken ? "有（正版/LittleSkin）" : "无（离线）"}
                  </p>
                </div>
              ) : (
                <p className="text-[13px] text-muted-foreground py-1">尚无激活账号（启动游戏前需要添加账号）</p>
              )}
            </GlassCard>
          </div>
        </div>

        {/* 添加离线账号 */}
        <div>
          <GroupTitle>添加离线账号</GroupTitle>
          <div className="space-y-3">
            <GlassCard>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={offlineName}
                  onChange={(e) => setOfflineName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddOffline()}
                  placeholder="离线用户名（不超过 16 字符）"
                  maxLength={16}
                  disabled={loading}
                  className="flex-1 min-w-0 rounded-lg border border-border/50 dark:border-white/[0.08] bg-white/60 dark:bg-black/30 px-3 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 transition-colors"
                />
                <Button size="sm" variant="default" onClick={handleAddOffline} disabled={loading}>
                  <LogIn className="w-3.5 h-3.5" />
                  添加
                </Button>
              </div>
              <p className="text-[11.5px] text-muted-foreground/60 mt-2">
                UUID 由 MD5(OfflinePlayer:用户名) 推导；同一用户名重复添加会复用原账号。
              </p>
            </GlassCard>
          </div>
        </div>

        {/* LittleSkin 登录 */}
        <div>
          <GroupTitle>LittleSkin 登录测试</GroupTitle>
          <div className="space-y-3">
            <GlassCard>
              <div className="space-y-2">
                <input
                  type="text"
                  value={lsUsername}
                  onChange={(e) => setLsUsername(e.target.value)}
                  placeholder="LittleSkin 用户名 / 邮箱"
                  disabled={loading}
                  className="w-full rounded-lg border border-border/50 dark:border-white/[0.08] bg-white/60 dark:bg-black/30 px-3 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 transition-colors"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={lsPassword}
                    onChange={(e) => setLsPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLittleskin()}
                    placeholder="密码"
                    disabled={loading}
                    className="flex-1 min-w-0 rounded-lg border border-border/50 dark:border-white/[0.08] bg-white/60 dark:bg-black/30 px-3 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 transition-colors"
                  />
                  <Button size="sm" variant="default" onClick={handleLittleskin} disabled={loading}>
                    <LogIn className="w-3.5 h-3.5" />
                    登录
                  </Button>
                </div>
                <p className="text-[11.5px] text-muted-foreground/60">
                  走 LittleSkin Yggdrasil（authserver）验证，成功后自动拉取角色 UUID 与头像。
                </p>
              </div>
            </GlassCard>
          </div>
        </div>

        {/* 账号列表 */}
        <div>
          <GroupTitle>账号列表（{accounts.length}）</GroupTitle>
          <div className="space-y-3">
            {accounts.length === 0 ? (
              <GlassCard>
                <p className="text-[13px] text-muted-foreground py-1">暂无账号</p>
              </GlassCard>
            ) : (
              accounts.map((a) => {
                const isActive = a.id === activeAccountId;
                return (
                  <GlassCard key={a.id}>
                    <SettingRow
                      label={a.username}
                      desc={`${TYPE_LABEL[a.type] ?? a.type} · ${a.uuid.slice(0, 8)}…`}
                    >
                      <div className="flex items-center gap-2">
                        {isActive ? (
                          <Badge variant="outline" className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25">
                            <Check className="w-3 h-3" />
                            当前
                          </Badge>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => handleActivate(a.id)} disabled={loading}>
                            设为当前
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-red-500"
                          onClick={() => handleRemove(a.id, a.username)}
                          disabled={loading}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </SettingRow>
                  </GlassCard>
                );
              })
            )}
          </div>
        </div>

        {/* 错误信息 */}
        {error && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] text-red-500/80">{error}</p>
            <Button size="sm" variant="ghost" onClick={clearError}>
              清除
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
