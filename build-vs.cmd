@echo off
call "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvarsall.bat" arm64
set PATH=C:\Users\OseasyVM\scoop\apps\llvm\current\bin;%PATH%
set CC=clang
cd /d "%~dp0"

if "%~1"=="--mode" if "%~2"=="beta" (
    echo [build-vs] Beta mode: building frontend first...
    call pnpm build:beta
    echo [build-vs] Running tauri build with skip beforeBuildCommand...
    call npx tauri build --config src-tauri\tauri.beta.json
) else (
    echo [build-vs] Production mode
    call pnpm tauri build
) else (
    echo [build-vs] Production mode
    call pnpm tauri build
)
