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
pnpm dist:dev           # dev icon + Windows installer
pnpm dist:beta          # beta icon + Windows installer
pnpm dist:run           # production icon + Windows installer
pnpm dist:mac           # build macOS DMG
pnpm dist:linux         # build Linux AppImage
```

## Architecture

```
src/                     Frontend (React 19 + Vite 7 + Tailwind v4 + shadcn/ui + Zustand)
electron/                Main process (Node.js/TypeScript, @xmcl/* packages)
public/                  Static assets (icons, fonts, images)
build/                   Build resources (generated, gitignored)
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
│   ├── mode.ts           # Build mode constants (DEFAULT_BG, LOGO_SVG, APP_ICON)
│   └── utils.ts          # cn() helper
└── App.tsx               # Root component with state router

electron/
├── main.ts               # Electron entry, window management, splash→main transition
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
│   └── window.ts         # Window controls + splash management
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
- Startup: splash shows first → main loads behind → transition after `ready-to-show` + 1.5s minimum

## Icon System

Three icon variants in `public/icons/`:

```
public/icons/
  dev/icon.ico, icon.png    # Development
  beta/icon.ico, icon.png   # Testing
  run/icon.ico, icon.png    # Production release
```

**Build-time switching:**
```bash
pnpm icon:dev    # copies public/icons/dev/ → build/
pnpm icon:beta   # copies public/icons/beta/ → build/
pnpm icon:run    # copies public/icons/run/ → build/
```

`electron-builder.yml` reads icons from `build/` (`buildResources: build`).

**Frontend usage:**
```tsx
import { APP_ICON, DEFAULT_BG, LOGO_SVG, BUILD_MODE, isDev } from "@/lib/mode";

<img src={APP_ICON} />
<img src={LOGO_SVG} />
<img src={DEFAULT_BG} />
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
- `window:*` — Minimize/maximize/close + splash management
- `dialog:*` — File picker

## Key Gotchas

- **@xmcl packages run in main process**: `@xmcl/core`, `@xmcl/installer` require `fs`/`child_process`. All run in Electron main process.
- **Path alias**: `@/` maps to `src/`.
- **Window dragging**: Use CSS `WebkitAppRegion: "drag"` as inline style (Electron only respects CSS property, not HTML attributes).
- **Transparent windows**: `transparent: true` + `frame: false` in BrowserWindow options.
- **Mutable win ref**: `electron/main.ts` uses a mutable `win` object — all handlers read `win.mainWindow` at runtime (not captured at registration time).
- **Asset paths**: Use `import.meta.env.BASE_URL` prefix for public assets (e.g., `${import.meta.env.BASE_URL}background.png`). Absolute paths like `/background.png` break in packaged app.
- **Config**: YAML format (`Koring.yml`) stored next to executable. Sparse save (only non-default values).
- **Auth**: JSON file (`koring-auth.json`) stored next to executable.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, Tailwind CSS v4, shadcn/ui, Zustand |
| Main Process | Node.js, TypeScript, @xmcl/* packages |
| Build | pnpm, Vite, electron-builder |
