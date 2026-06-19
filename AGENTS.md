# koring-launcher

Minecraft launcher built with Tauri 2 + React 19 + TypeScript + Sidecar (Node.js/@xmcl).

## Quick commands

```bash
pnpm tauri dev          # full app dev (frontend + Rust + sidecar skip)
pnpm dev                # frontend only (vite, port 1420)
cd sidecar && pnpm dev  # sidecar dev (tsx)
```

## Architecture

- **Frontend** (`src/`): React 19 + Vite 7 + Tailwind v4 + shadcn/ui + Zustand stores
- **Backend** (`src-tauri/`): Rust/Tauri 2, manages sidecar process via stdin/stdout JSON
- **Sidecar** (`sidecar/`): Node.js/TypeScript, wraps @xmcl/* packages (MC install/launch/auth/mods)
- IPC: Frontend → `invoke()` → Rust commands → sidecar stdin → sidecar stdout → Tauri events → Frontend

## Key gotchas

- **Sidecar binary required**: `src-tauri/binaries/koring-sidecar-<target-triple>.exe` must exist. In debug mode it's skipped automatically (`#[cfg(debug_assertions)]` in `lib.rs:setup`).
- **Sidecar compile**: `cd sidecar && pnpm compile` (requires `bun`). Default target is ARM64 Windows. Use `pnpm compile:x64` for x86_64.
- **@xmcl packages are Node.js only**: `@xmcl/core`, `@xmcl/installer` require `fs`/`child_process`. Only `@xmcl/user`, `@xmcl/modrinth`, `@xmcl/curseforge` work in browser.
- **Path alias**: `@/` maps to `src/` (configured in `vite.config.ts` and `tsconfig.json`).
- **Tauri commands**: All Rust commands are in `src-tauri/src/commands/mod.rs`. They forward to sidecar via `SidecarManager`.
- **State management**: Zustand stores in `src/stores/` (install, auth, launch, mods, instance).

## Build & bundle

```bash
pnpm tauri build         # production build (requires sidecar binary in binaries/)
cd sidecar && pnpm compile  # compile sidecar to exe first
```

The `externalBin` in `tauri.conf.json` expects `binaries/koring-sidecar-<target-triple>.exe`.

## Rust notes

- `src-tauri/src/lib.rs`: app entry, registers plugins and commands
- `src-tauri/src/sidecar.rs`: `SidecarManager` — spawns sidecar, reads stdout, emits Tauri events
- `src-tauri/src/commands/mod.rs`: all `#[tauri::command]` handlers
- `uuid` crate used for request IDs
