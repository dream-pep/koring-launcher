/**
 * Minecraft 版本类型判定（正式版 / 测试版 / 愚人节版）。
 * 版本清单接口给出的是 release / snapshot / old_alpha / old_beta，
 * 愚人节版在清单里同样是 snapshot，需要按版本号特征额外识别。
 */

/** 已知愚人节版本（3D Shareware、Love and Hugs、One Block、20w14∞ 等） */
const APRIL_FOOL_IDS = [
  "3D Shareware v1.34",
  "Love and Hugs Update",
  "One Block at a Time Update",
  "1.RV-Pre1",
  "15w14a",
  "2.0",
  "Java Edition 2.0",
  "20w14∞",
  "20w14infinite",
  "23w13a_or_b",
];

/** 空岛/负更新三叉戟版等以版本号前缀识别 */
const APRIL_FOOL_PREFIX = /^(?:1\.rv|2\.0|20w14|23w13a)/i;

/** 是不是愚人节版（按版本号判断，不需要网络） */
export function isAprilFoolId(id: string): boolean {
  if (!id) return false;
  const lower = id.toLowerCase();
  if (APRIL_FOOL_IDS.some((known) => lower === known.toLowerCase() || lower.includes(known.toLowerCase()))) {
    return true;
  }
  return APRIL_FOOL_PREFIX.test(id);
}

/** 快照 / 预发布 / 候选版本的形态（清单没命中时用来兜底） */
const SNAPSHOT_SHAPE = /\d{2}w\d{2}[a-z]|\d+(?:\.\d+)*-pre\d+|\d+(?:\.\d+)*-rc\d+/i;

/** 版本类型的中文标签：正式版 / 测试版 / 愚人节版 / 旧版 */
export function versionTypeLabel(type: string | undefined, id: string): string {
  if (isAprilFoolId(id)) return "愚人节版";
  switch (type) {
    case "release":
      return "正式版";
    case "snapshot":
      return "测试版";
    case "old_alpha":
    case "old_beta":
      return "旧版";
    default:
      break;
  }
  return SNAPSHOT_SHAPE.test(id) ? "测试版" : "正式版";
}
