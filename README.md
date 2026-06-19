# Koring Launcher

Minecraft launcher built with Tauri 2 + React 19 + TypeScript + Sidecar (Node.js/@xmcl).

## Quick Start

```bash
pnpm install
pnpm dev:t          # full app (frontend + Rust + sidecar skip in dev)
pnpm dev            # frontend only (vite, port 1420)
cd sidecar && pnpm dev  # sidecar dev (tsx)
```

## Build

```bash
pnpm tauri build         # production (auto-switches to run icon)
pnpm build:beta          # beta build
cd sidecar && pnpm compile  # compile sidecar to exe first
```

## Architecture

```
src/                     Frontend (React 19 + Vite 7 + Tailwind v4 + shadcn/ui + Zustand)
src-tauri/               Backend (Rust/Tauri 2)
sidecar/                 Node.js sidecar (@xmcl/* packages)
public/                  Static assets (icons, fonts, images)
scripts/                 Build scripts
```

**IPC Flow:**
Frontend → `invoke()` → Rust commands → sidecar stdin → sidecar stdout → Tauri events → Frontend

## Project Structure

```
src/
├── api/                  # Frontend API layer (sidecar IPC wrappers)
│   ├── sidecar.ts        # Generic request/response
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

**Auto-switching:** Build scripts automatically copy the correct icon to `src-tauri/icons/` before building.

**Frontend usage:**
```tsx
import { APP_ICON, BUILD_MODE, isDev } from "@/lib/mode";

<img src={APP_ICON} />
{isDev && <span>Dev Mode</span>}
```

**Manual switch:**
```bash
pnpm icon:dev    # switch to dev icon
pnpm icon:beta   # switch to beta icon
pnpm icon:run    # switch to release icon
```

## Sidecar

Node.js process communicating with Rust via stdin/stdout JSON protocol.

**Handlers:**
- `install:*` — Minecraft install, mod loader, version lists
- `launch:*` — Game launch, diagnose
- `auth:*` — Microsoft OAuth, offline login
- `mods:*` — Modrinth/CurseForge search, install
- `instance:*` — Instance CRUD
- `background:*` — Background image/color/blur/animation/theme

**Compile:**
```bash
cd sidecar
pnpm compile        # ARM64 Windows (default)
pnpm compile:x64    # x86_64 Windows
```

## Key Gotchas

- **Sidecar binary required**: `src-tauri/binaries/koring-sidecar-<target-triple>.exe` must exist. Skipped in debug mode (`#[cfg(debug_assertions)]`).
- **@xmcl packages are Node.js only**: `@xmcl/core`, `@xmcl/installer` require `fs`/`child_process`. Only `@xmcl/user`, `@xmcl/modrinth`, `@xmcl/curseforge` work in browser.
- **Path alias**: `@/` maps to `src/`.
- **Window dragging**: Use `appWindow.startDragging()` API, not `data-tauri-drag-region` (unreliable with transparent windows).
- **Transparent windows**: Require `decorations: false` + `transparent: true` in tauri.conf.json.
- **Permissions**: Window creation needs `core:webview:allow-create-webview-window` (not `core:window`).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, Tailwind CSS v4, shadcn/ui, Zustand |
| Backend | Rust, Tauri 2 |
| Sidecar | Node.js, TypeScript, @xmcl/* packages |
| Build | pnpm, Cargo, bun (sidecar compile) |
