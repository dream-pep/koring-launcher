import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import pkg from "./package.json";

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  base: "./",
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        splash: path.resolve(__dirname, "splash.html"),
        crash: path.resolve(__dirname, "crash.html"),
      },
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-motion": ["motion"],
          "vendor-ui": ["lucide-react", "clsx", "tailwind-merge"],
          "vendor-three": ["three", "@react-three/fiber"],
          "vendor-zustand": ["zustand"],
        },
      },
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // 主进程在 dev 下把状态文件写在项目根；Vite 监听到根目录内的文件 change 会向页面发
      // `full-reload`，表现为「切换/添加游戏账户后整个界面闪回首页」。必须显式忽略这些运行时
      // 写入：Koring.yml（启动器配置）、koring-auth.json（旧版单账号）、koring-accounts.json
      // （多账号注册表，切换/添加/删除账户都会重写）、koring-crash.log / koring.log（崩溃与调试日志）、
      // .minecraft（游戏目录，启动后持续写日志）。新增根目录运行时文件时必须同步加到这里。
      ignored: [
        "**/Koring.yml",
        "**/koring-auth.json",
        "**/koring-accounts.json",
        "**/koring-crash.log",
        "**/koring.log",
        "**/.minecraft/**",
      ],
    },
  },
}));
