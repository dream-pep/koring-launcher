//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import {
  ShieldQuestion,
  Palette,
  Wifi,
  AlertCircle,
  Loader2,
  ChevronLeft,
  X,
  Check,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { SettingBadge } from "@/components/setting";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/lib/toast";

// 账号类型：microsoft 暂不可用；littleskin / offline 可完整添加
type AccountType = "microsoft" | "littleskin" | "offline";

interface AddAccountDialogProps {
  open: boolean;
  onClose: () => void;
}

// 类型选择项配置
const TYPE_OPTIONS: {
  key: AccountType;
  label: string;
  desc: string;
  icon: typeof ShieldQuestion;
  disabled: boolean;
}[] = [
  {
    key: "microsoft",
    label: "微软账号",
    desc: "正版验证登录，支持皮肤与存档同步",
    icon: ShieldQuestion,
    disabled: true,
  },
  {
    key: "littleskin",
    label: "LittleSkin",
    desc: "皮肤站账号，使用 LittleSkin 用户名与密码登录",
    icon: Palette,
    disabled: false,
  },
  {
    key: "offline",
    label: "离线账户",
    desc: "无需正版验证，输入用户名即可启动游戏",
    icon: Wifi,
    disabled: false,
  },
];

export function AddAccountDialog({ open, onClose }: AddAccountDialogProps) {
  // 步骤：0 选择类型 / 1 填写表单
  const [step, setStep] = useState(0);
  const [type, setType] = useState<AccountType | null>(null);

  // 表单字段
  const [offlineName, setOfflineName] = useState("");
  const [lsUsername, setLsUsername] = useState("");
  const [lsPassword, setLsPassword] = useState("");

  // 本地错误（提交失败时展示）
  const [error, setError] = useState("");

  const loading = useAuthStore((s) => s.loading);
  const addOfflineAccount = useAuthStore((s) => s.addOfflineAccount);
  const addLittleskinAccount = useAuthStore((s) => s.addLittleskinAccount);
  const clearError = useAuthStore((s) => s.clearError);

  // 打开/关闭时重置全部状态
  useEffect(() => {
    if (open) {
      setStep(0);
      setType(null);
      setOfflineName("");
      setLsUsername("");
      setLsPassword("");
      setError("");
      clearError();
    }
  }, [open, clearError]);

  // 选择类型 → 进入下一步
  const handlePickType = (next: AccountType) => {
    setType(next);
    setError("");
    setStep(1);
  };

  // 返回类型选择
  const handleBack = () => {
    setStep(0);
    setError("");
  };

  // 提交添加
  const handleSubmit = async () => {
    setError("");
    clearError();

    if (type === "offline") {
      const name = offlineName.trim();
      if (!name) {
        setError("请输入离线用户名");
        return;
      }
      if (name.length > 16) {
        setError("离线用户名不能超过 16 个字符");
        return;
      }
      const ok = await addOfflineAccount(name);
      if (ok) {
        toast.success(`已添加离线账号：${name}`);
        onClose();
      } else {
        setError(useAuthStore.getState().error || "添加失败");
      }
      return;
    }

    if (type === "littleskin") {
      const name = lsUsername.trim();
      if (!name) {
        setError("请输入 LittleSkin 用户名");
        return;
      }
      if (!lsPassword) {
        setError("请输入 LittleSkin 密码");
        return;
      }
      const ok = await addLittleskinAccount(name, lsPassword);
      if (ok) {
        toast.success("已添加 LittleSkin 账号");
        onClose();
      } else {
        setError(useAuthStore.getState().error || "添加失败");
      }
      return;
    }
  };

  const typeLabel = TYPE_OPTIONS.find((t) => t.key === type)?.label ?? "";
  const canSubmit =
    !loading &&
    ((type === "offline" && offlineName.trim().length > 0) ||
      (type === "littleskin" && lsUsername.trim().length > 0 && lsPassword.length > 0));

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="add-account-title"
      className="max-w-md"
      closeOnBackdrop={!loading}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/30 dark:border-white/[0.04]">
        <div className="flex items-center gap-2.5 min-w-0">
          {step === 1 && (
            <button
              onClick={handleBack}
              className="p-1 rounded-md hover:bg-foreground/[0.06] transition-colors shrink-0"
              disabled={loading}
            >
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          <h2 id="add-account-title" className="text-base font-semibold text-foreground truncate">
            {step === 0 ? "添加账号" : `添加${typeLabel}`}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-foreground/[0.06] transition-colors shrink-0"
          disabled={loading}
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* 内容 */}
      <div className="px-6 py-5">
        {step === 0 ? (
          <div className="space-y-2">
            <p className="text-[13px] text-muted-foreground mb-3">选择要添加的账号类型</p>
            {TYPE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.key}
                  disabled={opt.disabled}
                  onClick={() => !opt.disabled && handlePickType(opt.key)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                    opt.disabled
                      ? "border-border/30 dark:border-white/[0.05] opacity-60 cursor-not-allowed"
                      : "border-border/40 dark:border-white/[0.06] hover:border-primary/40 hover:bg-primary/[0.03] active:scale-[0.99]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-foreground/[0.05] dark:bg-white/[0.05] flex items-center justify-center shrink-0">
                      <Icon className="w-4.5 h-4.5 text-muted-foreground/70" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13.5px] font-semibold text-foreground">{opt.label}</p>
                        {opt.disabled && <SettingBadge variant="warning">暂时无法提供</SettingBadge>}
                      </div>
                      <p className="text-[11.5px] text-muted-foreground/70 mt-0.5">{opt.desc}</p>
                    </div>
                    {!opt.disabled && (
                      <Check className="w-4 h-4 text-transparent shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : type === "offline" ? (
          <div className="space-y-3">
            <label className="block">
              <span className="text-[13px] font-medium text-foreground">用户名</span>
              <input
                type="text"
                value={offlineName}
                onChange={(e) => setOfflineName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canSubmit && handleSubmit()}
                placeholder="输入离线用户名（不超过 16 字符）"
                maxLength={16}
                autoFocus
                disabled={loading}
                className="mt-1.5 w-full rounded-lg border border-border/50 dark:border-white/[0.08] bg-white/60 dark:bg-black/30 px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 transition-colors"
              />
            </label>
            <p className="text-[11.5px] text-muted-foreground/60">
              离线 UUID 由 MD5(OfflinePlayer:用户名) 推导，同一用户名始终对应同一 UUID。
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block">
              <span className="text-[13px] font-medium text-foreground">LittleSkin 用户名</span>
              <input
                type="text"
                value={lsUsername}
                onChange={(e) => setLsUsername(e.target.value)}
                placeholder="邮箱或用户名"
                autoFocus
                disabled={loading}
                className="mt-1.5 w-full rounded-lg border border-border/50 dark:border-white/[0.08] bg-white/60 dark:bg-black/30 px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 transition-colors"
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-medium text-foreground">密码</span>
              <input
                type="password"
                value={lsPassword}
                onChange={(e) => setLsPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canSubmit && handleSubmit()}
                placeholder="输入 LittleSkin 密码"
                disabled={loading}
                className="mt-1.5 w-full rounded-lg border border-border/50 dark:border-white/[0.08] bg-white/60 dark:bg-black/30 px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 transition-colors"
              />
            </label>
            <p className="text-[11.5px] text-muted-foreground/60">
              将通过 LittleSkin Yggdrasil 服务验证并拉取你的 Minecraft 角色。
            </p>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <p className="mt-3 text-[12px] text-red-500/80 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </p>
        )}
      </div>

      {/* 底部操作（仅表单步骤显示） */}
      {step === 1 && (
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border/30 dark:border-white/[0.04]">
          <Button
            size="sm"
            variant="ghost"
            onPress={onClose}
            isDisabled={loading}
          >
            取消
          </Button>
          <Button
            size="sm"
            variant="primary"
            onPress={handleSubmit}
            isDisabled={!canSubmit}
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            添加
          </Button>
        </div>
      )}
    </Modal>
  );
}
