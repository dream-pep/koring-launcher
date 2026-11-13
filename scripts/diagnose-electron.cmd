@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0.."
set ELECTRON_RUN_AS_NODE=

set EXE=node_modules\electron\dist\electron.exe
set LOG=scripts\electron-diagnose.log
if exist "%LOG%" del "%LOG%"

echo ==== 环境 ==== >> "%LOG%"
echo ELECTRON_RUN_AS_NODE=[%ELECTRON_RUN_AS_NODE%] >> "%LOG%"
echo ELECTRON_ENABLE_LOGGING=[%ELECTRON_ENABLE_LOGGING%] >> "%LOG%"
where node >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo ==== 0) electron --version（不加载任何应用） ==== >> "%LOG%"
"%EXE%" --version > "%TEMP%\el0.log" 2>&1
echo EXIT0=%ERRORLEVEL% >> "%LOG%"
type "%TEMP%\el0.log" >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo ==== 0b) node 版本 / 当前用户 / 环境变量 ==== >> "%LOG%"
whoami >> "%LOG%" 2>&1
echo TEMP=[%TEMP%] APPDATA=[%APPDATA%] >> "%LOG%"

echo. >> "%LOG%"
echo ==== 1) 原样启动（无参数） ==== >> "%LOG%"
"%EXE%" . --enable-logging > "%TEMP%\el1.log" 2>&1
set EXIT1=%ERRORLEVEL%
echo EXIT1=%EXIT1% (hex=0x80000003 时即 STATUS_BREAKPOINT) >> "%LOG%"
type "%TEMP%\el1.log" >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo ==== 2) 加 --no-sandbox ==== >> "%LOG%"
"%EXE%" . --no-sandbox --enable-logging > "%TEMP%\el2.log" 2>&1
set EXIT2=%ERRORLEVEL%
echo EXIT2=%EXIT2% >> "%LOG%"
type "%TEMP%\el2.log" >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo ==== 3) --no-sandbox + 全新 user-data-dir（项目目录内，排除配置文件损坏） ==== >> "%LOG%"
set FRESH=%CD%\tmp-koring-profile
if exist "%FRESH%" rd /s /q "%FRESH%"
"%EXE%" . --no-sandbox --enable-logging --user-data-dir="%FRESH%" > "%TEMP%\el3.log" 2>&1
set EXIT3=%ERRORLEVEL%
echo EXIT3=%EXIT3% >> "%LOG%"
type "%TEMP%\el3.log" >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo ==== 3b) --no-sandbox + 全新 user-data-dir（%TEMP% 内） ==== >> "%LOG%"
set FRESH2=%TEMP%\koring-test-profile
if exist "%FRESH2%" rd /s /q "%FRESH2%"
"%EXE%" . --no-sandbox --enable-logging --user-data-dir="%FRESH2%" > "%TEMP%\el3b.log" 2>&1
echo EXIT3b=%ERRORLEVEL% >> "%LOG%"
type "%TEMP%\el3b.log" >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo ==== 4) 最小空应用（排除项目代码） ==== >> "%LOG%"
> "%TEMP%\min-electron.js" echo const { app } = require("electron"); console.log("MIN_OK", process.versions.electron); app.whenReady().then(() =^> { console.log("MIN_READY"); app.quit() });
"%EXE%" "%TEMP%\min-electron.js" --no-sandbox > "%TEMP%\el4.log" 2>&1
set EXIT4=%ERRORLEVEL%
echo EXIT4=%EXIT4% >> "%LOG%"
type "%TEMP%\el4.log" >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo ==== 5) Windows 事件日志中 electron 相关错误（最近 200 条） ==== >> "%LOG%"
powershell -NoProfile -Command "Get-WinEvent -LogName Application -MaxEvents 200 -ErrorAction SilentlyContinue | Where-Object { $_.Message -match 'electron' } | Select-Object -First 5 TimeCreated,Id,ProviderName,Message | Format-List" >> "%LOG%" 2>&1

echo.
echo ================= 诊断完成 =================
type "%LOG%"
echo.
echo 完整日志已写入: %CD%\%LOG%
echo 请把这个文件的内容发给我。
pause
