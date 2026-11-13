import type { AccountType, AuthAccount } from "@/api/auth-registry";

/** 游戏账户类型 → 展示名（首页账户卡 / 设置-游戏账户页共用） */
export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  offline: "离线账户",
  littleskin: "LittleSkin",
  microsoft: "微软账户",
};

/**
 * 离线账户的默认头像皮肤：内置默认皮肤 Steve（`public/Skins/Steve.png`）。
 * 由 AccountAvatar 按贴图的头部区域裁切显示，不依赖网络。
 */
export const OFFLINE_DEFAULT_SKIN = `${import.meta.env.BASE_URL}Skins/Steve.png`;

/**
 * 计算游戏账户头像地址（整张头像图）：
 * - 账号自带 avatarUrl（LittleSkin / 微软）优先
 * - LittleSkin 没有头像时，用 mc-heads 按 UUID 渲染皮肤头像
 * - 离线账户不走网络，改用内置 Steve 皮肤头部（见 minecraftAccountSkin）
 * - 微软账户无头像时返回 null，由 AccountAvatar 用首字符兜底
 */
export function minecraftAccountAvatar(account: AuthAccount): string | null {
  if (account.avatarUrl) return account.avatarUrl;
  if (account.type === "littleskin") {
    return `https://mc-heads.net/avatar/${account.uuid.replace(/-/g, "")}/64`;
  }
  return null;
}

/**
 * 计算游戏账户的「皮肤贴图」地址（用于按头部区域裁切出像素头像）：
 * - 目前只有离线账户使用：默认 Steve 皮肤，保证每个离线账户头像一致
 * - 其余类型返回 null，交给头像图 / 首字符兜底
 */
export function minecraftAccountSkin(account: AuthAccount): string | null {
  if (account.avatarUrl) return null;
  if (account.type === "offline") return OFFLINE_DEFAULT_SKIN;
  return null;
}
