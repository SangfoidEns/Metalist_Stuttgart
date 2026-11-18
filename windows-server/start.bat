@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js 18+ is required. Install from https://nodejs.org/
  pause
  exit /b 1
)

if not defined PORT set PORT=8787
if not defined OPEN_UI set OPEN_UI=1

echo.
echo  METALIST STUTTGART — Windows companion server
echo  Port: %PORT%
echo  Panel: http://127.0.0.1:%PORT%/
echo.
node "%~dp0src\main.mjs"
set ERR=%ERRORLEVEL%
if not "%ERR%"=="0" (
  echo.
  echo Server exited with code %ERR%
  pause
)
exit /b %ERR%
