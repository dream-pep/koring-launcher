@echo off
call "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvarsall.bat" arm64
set PATH=C:\Users\OseasyVM\scoop\apps\llvm\current\bin;%PATH%
set CC=clang
cd /d "%~dp0"
pnpm dev:t
