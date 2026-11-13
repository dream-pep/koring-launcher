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
import { Button } from "@heroui/react";
import { Gamepad2, Plus, Check } from "lucide-react";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/stores/authStore";
import { useConfirmDialogStore } from "@/stores/confirmDialogStore";
import { SettingCard, SettingRow, type SettingBadgeVariant } from "@/components/setting";
import { AccountAvatar } from "@/components/account/AccountAvatar";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { AccountType, AuthAccount } from "@/api/auth-registry";
import { ACCOUNT_TYPE_LABELS, minecraftAccountAvatar, minecraftAccountSkin } from "@/lib/minecraft-account";
import { AddAccountDialog } from "./AddAccountDialog";

// 账号类型 → 徽标文案与样式
const TYPE_META: Record<AccountType, { label: string; variant: SettingBadgeVariant }> = {
  offline: { label: ACCOUNT_TYPE_LABELS.offline, variant: "neutral" },
  littleskin: { label: ACCOUNT_TYPE_LABELS.littleskin, variant: "info" },
  microsoft: { label: ACCOUNT_TYPE_LABELS.microsoft, variant: "primary" },
};

// 单行账号：右键弹出菜单（删除账号），左键点击整行设为当前
function AccountRow({
  account,
  isActive,
  onActivate,
  onDelete,
}: {
  account: AuthAccount;
  isActive: boolean;
  onActivate: () => void;
  onDelete: () => void;
}) {
  const meta = TYPE_META[account.type];

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <div
            role="button"
            tabIndex={0}
            onClick={onActivate}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onActivate()}
            className={`rounded-xl transition-all cursor-pointer ${
              isActive
                ? "ring-1 ring-primary/40"
                : "hover:ring-1 hover:ring-black/[0.10] dark:hover:ring-white/[0.12]"
            }`}
          >
            <SettingCard>
              <div className="flex items-center gap-3.5">
                {/* 头像 */}
                <AccountAvatar
                  picture={minecraftAccountAvatar(account)}
                  skin={minecraftAccountSkin(account)}
                  name={account.username}
                  size={40}
                  alt={account.username}
                  frameClassName="bg-foreground/[0.06] text-foreground/50"
                />

                {/* 账号信息 + 操作 */}
                <div className="flex-1 min-w-0">
                  <SettingRow label={account.username} desc={`${meta.label} · UUID ${account.uuid}`}>
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {isActive ? (
                        // 当前账号：虚化对勾标记
                        <Check className="w-4 h-4 text-primary/40 shrink-0" aria-label="当前账号" />
                      ) : (
                        <Button size="sm" variant="outline" onPress={onActivate}>
                          设为当前
                        </Button>
                      )}
                    </div>
                  </SettingRow>
                </div>
              </div>
            </SettingCard>
          </div>
        }
      />

      <ContextMenuContent>
        <ContextMenuItem className="text-destructive" onClick={onDelete}>
          删除账号
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function GameAccountSetting() {
  const accounts = useAuthStore((s) => s.accounts);
  const activeAccountId = useAuthStore((s) => s.activeAccountId);
  const setActiveAccount = useAuthStore((s) => s.setActiveAccount);
  const removeAccount = useAuthStore((s) => s.removeAccount);
  const openDialog = useConfirmDialogStore((s) => s.openDialog);

  const [addOpen, setAddOpen] = useState(false);

  // 切换当前账号
  const handleActivate = async (account: AuthAccount) => {
    if (account.id === activeAccountId) return;
    const ok = await setActiveAccount(account.id);
    if (!ok) {
      toast.error(useAuthStore.getState().error || "切换失败");
    }
  };

  // 删除账号（带确认）
  const handleDelete = (account: AuthAccount) => {
    openDialog({
      title: "删除账号",
      description: `确定要删除账号「${account.username}」吗？此操作不可撤销。`,
      confirmLabel: "删除",
      onConfirm: () => {
        void removeAccount(account.id).then((ok) => {
          if (ok) {
            toast.success("已删除账号");
          } else {
            toast.error(useAuthStore.getState().error || "删除失败");
          }
        });
      },
    });
  };

  return (
    <div>
      {/* 标题行：右上角添加账号 */}
      <div className="flex items-center justify-between gap-4 mb-1">
        <h1 className="text-xl font-bold text-foreground">游戏账户</h1>
        <Button size="sm" variant="primary" onPress={() => setAddOpen(true)}>
          <Plus className="w-3.5 h-3.5" />
          添加账号
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        管理 Minecraft 游戏内账户（离线 / LittleSkin）与登录状态
      </p>

      <div className="space-y-3">
        {accounts.length === 0 ? (
          // 空状态
          <SettingCard>
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="w-14 h-14 rounded-full bg-foreground/[0.06] flex items-center justify-center shrink-0">
                <Gamepad2 className="w-8 h-8 text-foreground/30" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">请添加一个账号</p>
                <p className="text-[12px] text-muted-foreground/60 mt-1">
                  点击右上角「添加账号」开始
                </p>
              </div>
            </div>
          </SettingCard>
        ) : (
          // 账号列表：一行一个账号
          accounts.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              isActive={account.id === activeAccountId}
              onActivate={() => void handleActivate(account)}
              onDelete={() => handleDelete(account)}
            />
          ))
        )}
      </div>

      {/* 添加账号弹窗 */}
      <AddAccountDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
