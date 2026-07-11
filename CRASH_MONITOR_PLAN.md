# Crash Monitor Implementation Plan

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Main Process                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Crash Logger (file-based, survives crashes)       │  │
│  │ - ipcMain.on('renderer-error') → write to file    │  │
│  │ - process.on('uncaughtException') → write to file │  │
│  │ - app.on('render-process-gone') → write to file   │  │
│  │ - app.on('child-process-gone') → write to file    │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────┐                      │
│  │ UtilityProcess (monitor)     │  ← isolated process  │
│  │ - Watches crash log file     │    survives window    │
│  │ - Sends crash events via     │    crashes           │
│  │   MessagePort to main        │                      │
│  └──────────────────────────────┘                      │
│  ┌──────────────────────────────┐                      │
│  │ Crash Monitor Window         │  ← separate window   │
│  │ - Shows crash dialogs        │    custom UI          │
│  │ - Log viewer window          │                      │
│  └──────────────────────────────┘                      │
└─────────────────────────────────────────────────────────┘
         ↕ IPC (contextBridge)
┌─────────────────────────────────────────────────────────┐
│  Renderer (Main Window)                                 │
│  - window.onerror → ipcRenderer.send('renderer-error')  │
│  - unhandledrejection → ipcRenderer.send(...)           │
│  - webContents 'render-process-gone' → recover          │
└─────────────────────────────────────────────────────────┘
```

## 2. Implementation Steps

### Step 1: Create Crash Logger Module
**File:** `electron/core/crash-logger.ts`
- Initialize crash log path (`koring-crash.log` next to executable)
- Write crash events synchronously to survive crashes
- Buffer recent events for breadcrumb trail
- Log rotation (keep last 1000 lines)

### Step 2: Create Crash Monitor Window
**File:** `electron/handlers/crash-monitor.ts`
- Separate BrowserWindow (hidden by default)
- Listens for crash events from main process
- Shows custom crash dialog UI
- Can be opened from developer tools

### Step 3: Create Log Viewer Window
**File:** `electron/handlers/log-viewer.ts`
- Separate BrowserWindow for viewing logs
- Real-time log streaming via IPC
- Filter by log level (error, warn, info)
- Export logs functionality

### Step 4: Create Crash Dialog UI
**File:** `src/components/crash/CrashDialog.tsx`
- Custom styled crash dialog
- Shows error details, stack trace
- Options: Restart, View Logs, Close
- Uses existing UI components (shadcn/ui)

### Step 5: Create Log Viewer UI
**File:** `src/components/crash/LogViewer.tsx`
- Log list with syntax highlighting
- Search/filter functionality
- Real-time updates

### Step 6: Update Main Process
**File:** `electron/main.ts`
- Initialize crash logger early
- Set up crash event handlers
- Create crash monitor window

### Step 7: Update Preload Script
**File:** `electron/preload.ts`
- Add renderer error capture
- Expose crash-related IPC methods

## 3. Key Features

1. **Crash Detection:**
   - Renderer crashes (`render-process-gone`)
   - Main process errors (`uncaughtException`, `unhandledRejection`)
   - GPU/utility crashes (`child-process-gone`)
   - Unresponsive detection (`unresponsive` event)

2. **Crash Dialog:**
   - Custom styled UI matching launcher theme
   - Error message and stack trace display
   - One-click restart option
   - View logs option

3. **Log Viewer:**
   - Can be opened from developer tools
   - Real-time log streaming
   - Search and filter capabilities
   - Export functionality

4. **Process Isolation:**
   - Crash monitor runs in separate window
   - Main window crashes don't affect monitor
   - Monitor can restart main window

## 4. Files to Create/Modify

**New Files:**
- `electron/core/crash-logger.ts`
- `electron/handlers/crash-monitor.ts`
- `electron/handlers/log-viewer.ts`
- `src/components/crash/CrashDialog.tsx`
- `src/components/crash/LogViewer.tsx`
- `src/pages/crash/index.tsx`

**Modified Files:**
- `electron/main.ts` - Add crash monitoring initialization
- `electron/preload.ts` - Add error capture and IPC methods
- `src/types/electron.d.ts` - Add new IPC method types

## 5. UI Design

The crash dialog and log viewer will use the existing design system:
- Glass effects with backdrop-filter
- Dark theme compatible
- Consistent spacing and typography
- Uses shadcn/ui components where appropriate

## 6. Testing Plan

1. Test crash detection by triggering intentional errors
2. Verify crash dialog appears correctly
3. Test log viewer functionality
4. Verify main window can be restarted from crash dialog
5. Test log export functionality

## 7. Questions for User

1. What specific crash scenarios should we prioritize?
2. Do you want the log viewer always accessible or only in dev mode?
3. Should crash reports be sent to a server or just stored locally?
4. Any specific UI preferences for the crash dialog beyond the existing design system?
