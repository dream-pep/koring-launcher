# Koring Launcher

Minecraft launcher built with Electron + React 19 + TypeScript + Node.js (@xmcl).

## Quick Start

```bash
pnpm install
pnpm dev                # full app (frontend + electron)
pnpm dev:renderer       # frontend only (vite, port 1420)
pnpm dev:main           # electron main process only
```

## Build

```bash
pnpm build              # production build (vite + tsc)
pnpm dist:win           # build Windows installer
pnpm dist:mac           # build macOS DMG
pnpm dist:linux         # build Linux AppImage
```

## Architecture

```
src/                     Frontend (React 19 + Vite 7 + Tailwind v4 + shadcn/ui + Zustand)
electron/                Main process (Node.js/TypeScript, @xmcl/* packages)
public/                  Static assets (icons, fonts, images)
```

**IPC Flow:**
Frontend → `ipcRenderer.invoke()` → `ipcMain.handle()` → main process → `webContents.send()` → Frontend

## Project Structure

```
src/
├── api/                  # Frontend API layer (IPC wrappers)
│   ├── ipc.ts            # Core IPC utilities
│   ├── background.ts     # Background control
│   ├── install.ts        # Minecraft install
│   ├── launch.ts         # Game launch
│   ├── auth.ts           # Microsoft/offline auth
│   ├── mods.ts           # Modrinth/CurseForge
│   └── instance.ts       # Instance management
├── stores/               # Zustand state stores
├── components/
│   ├── background/       # Background layer (z-0)
│   ├── system/           # Title bar + window controls (z-100)
│   └── ui/               # shadcn/ui components
├── layouts/
│   └── RootLayout.tsx    # Three-layer page structure
├── pages/
│   ├── Home.tsx          # Main page
│   └── Debug.tsx         # Debug tools
├── lib/
│   ├── mode.ts           # Build mode detection (dev/beta/run)
│   └── utils.ts          # cn() helper
└── App.tsx               # Root component with state router

electron/
├── main.ts               # Electron entry, window management
├── preload.ts            # Context bridge (window.electronAPI)
├── config.ts             # YAML config management
├── auth.ts               # Auth data persistence
├── core/                 # @xmcl/* integrations
│   ├── auth.ts           # Microsoft OAuth, Xbox Live, MC auth
│   ├── installer.ts      # @xmcl/installer
│   ├── launcher.ts       # @xmcl/core game launcher
│   ├── modrinth.ts       # Modrinth/CurseForge API
│   └── instance.ts       # Instance management
├── handlers/             # IPC handlers
│   ├── config.ts         # Config load/save
│   ├── auth.ts           # Auth operations
│   ├── install.ts        # Install operations
│   ├── launch.ts         # Game launch
│   ├── mods.ts           # Mod operations
│   ├── instance.ts       # Instance operations
│   ├── background.ts     # Background operations
│   ├── task.ts           # Task system
│   ├── system.ts         # System info
│   └── window.ts         # Window controls
└── types/
    └── electron.d.ts     # TypeScript declarations
```

## Three-Layer Page Structure

```
┌──────────────────────────────────────┐
│  z-index: 100  System Layer          │  pointer-events: none
│  ┌──────────────────────────────┐    │
│  │ TitleBar (frosted glass)     │    │  pointer-events: auto
│  │ WindowControls (25px btns)   │    │
│  └──────────────────────────────┘    │
├──────────────────────────────────────┤
│  z-index: 1   Content Layer          │  pointer-events: auto
│  All page content                    │
├──────────────────────────────────────┤
│  z-index: 0   Background Layer       │  pointer-events: none
│  Image / color / gradient / blur     │
└──────────────────────────────────────┘
```

## Splash Screen

- Standalone HTML/CSS (`splash.html`), no React/Vite dependency
- Loads instantly while Vite dev server starts
- Window: 480×320, no decorations, transparent, locked size
- Auto-adapts to system dark mode (`prefers-color-scheme`)
- Logo: `filter: invert(1)` in dark mode

## Icon System

Three icon variants in `public/`:

| Mode | File | Use Case |
|------|------|----------|
| dev | `dev.png` / `dev.ico` | Development |
| beta | `beta.png` / `beta.ico` | Testing |
| run | `run.png` / `run.ico` | Production release |

**Frontend usage:**
```tsx
import { APP_ICON, BUILD_MODE, isDev } from "@/lib/mode";

<img src={APP_ICON} />
{isDev && <span>Dev Mode</span>}
```

## IPC Handlers

- `config:*` — Config load/save
- `auth:*` — Microsoft OAuth, offline login
- `install:*` — Minecraft install, mod loader, version lists
- `launch:*` — Game launch, diagnose
- `mods:*` — Modrinth/CurseForge search, install
- `instance:*` — Instance CRUD
- `background:*` — Background image/color/blur/animation/theme
- `task:*` — Task system progress
- `system:*` — System info
- `window:*` — Minimize/maximize/close

## Key Gotchas

- **@xmcl packages run in main process**: `@xmcl/core`, `@xmcl/installer` require `fs`/`child_process`. All run in Electron main process.
- **Path alias**: `@/` maps to `src/`.
- **Window dragging**: Use CSS `-webkit-app-region: drag` on titlebar.
- **Transparent windows**: `transparent: true` + `frame: false` in BrowserWindow options.
- **Auth storage**: JSON file (`koring-auth.json`) stored next to executable.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, Tailwind CSS v4, shadcn/ui, Zustand |
| Main Process | Node.js, TypeScript, @xmcl/* packages |
| Build | pnpm, Vite, electron-builder |
