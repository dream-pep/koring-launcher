/**
 * 启动器程序本体「资源管理」子系统入口。
 * 管理对象：运行时渲染资源（背景图、缩略图、Blob、文本缓存等），
 * 与 Minecraft 游戏内容无关。
 */

export * from "./types";
export * from "./registry";
export * from "./store";
export * from "./image";
export * from "./hooks";
export * from "./ManagedImage";
