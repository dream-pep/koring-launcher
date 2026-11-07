import type { AccountType, AuthAccount } from "@/api/auth-registry";

/** 游戏账户类型 → 展示名（首页账户卡 / 设置-游戏账户页共用） */
export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  offline: "离线账户",
  littleskin: "LittleSkin",
  microsoft: "微软账户",
};

/**
 * 计算游戏账户头像地址：
 * - 账号自带 avatarUrl（LittleSkin / 微软）优先
 * - 离线 / LittleSkin 没有头像时，用 mc-heads 按 UUID 渲染皮肤头像
 * - 微软账户无头像时返回 null，由 AccountAvatar 用首字符兜底
 */
export function minecraftAccountAvatar(account: AuthAccount): string | null {
  if (account.avatarUrl) return account.avatarUrl;
  if (account.type === "offline" || account.type === "littleskin") {
    return `https://mc-heads.net/avatar/${account.uuid.replace(/-/g, "")}/64`;
  }
  return null;
}
