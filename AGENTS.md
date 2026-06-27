# koring-launcher

Minecraft launcher built with Electron + React 19 + TypeScript + Node.js (@xmcl).

## Quick commands

```bash
pnpm dev                # full app dev (renderer + main process)
pnpm dev:renderer       # frontend only (vite, port 1420)
pnpm dev:main           # electron main process only
pnpm build              # production build (vite + tsc)
pnpm dist:win           # build Windows installer
```

## Architecture

- **Frontend** (`src/`): React 19 + Vite 7 + Tailwind v4 + shadcn/ui + Zustand stores
- **Main Process** (`electron/`): Node.js/TypeScript, manages windows, IPC handlers, @xmcl/* packages
- IPC: Frontend → `ipcRenderer.invoke()` → `ipcMain.handle()` → main process → `webContents.send()` → Frontend

## Key gotchas

- **Electron main process**: `electron/main.ts` is the entry point. All @xmcl/* packages run here.
- **Preload script**: `electron/preload.ts` exposes `window.electronAPI` via context bridge.
- **IPC handlers**: All handlers are in `electron/handlers/` directory.
- **Config**: YAML format (`Koring.yml`) stored next to executable. Sparse save (only non-default values).
- **Auth**: JSON file (`koring-auth.json`) stored next to executable.
- **Path alias**: `@/` maps to `src/` (configured in `vite.config.ts` and `tsconfig.json`).
- **Dev mode**: Vite runs on port 1420, Electron loads from localhost.

## Build & bundle

```bash
pnpm build              # Vite build + TypeScript compile
pnpm dist:win           # electron-builder Windows installer
pnpm dist:mac           # electron-builder macOS DMG
pnpm dist:linux         # electron-builder Linux AppImage
```

## Electron notes

- `electron/main.ts`: App entry, window management, IPC handler registration
- `electron/preload.ts`: Context bridge for secure IPC
- `electron/config.ts`: YAML config management (sparse save)
- `electron/auth.ts`: Auth data persistence (JSON file)
- `electron/core/`: @xmcl/* integrations (auth, installer, launcher, modrinth, instance)
- `electron/handlers/`: IPC handlers (config, auth, install, launch, mods, instance, background, task, system, window)

## Frontend notes

- `src/api/ipc.ts`: Core IPC utilities (invoke, onIpcEvent)
- `src/api/*.ts`: API modules wrapping IPC calls
- `src/stores/`: Zustand state management
- `src/hooks/useTheme.ts`: Dark mode sync with Electron theme
- `src/components/system/WindowControls.tsx`: Custom window controls (min/max/close)
- `src/components/system/TitleBar.tsx`: Custom title bar with navigation
