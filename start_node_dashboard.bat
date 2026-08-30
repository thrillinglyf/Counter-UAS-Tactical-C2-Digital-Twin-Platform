@echo off
setlocal

cd /d "%~dp0node_dashboard"

echo =======================================================
echo   Counter-Drone C2 Tactical Command Twin (Node.js)
echo =======================================================
echo.

node -v >nul 2>&1
if errorlevel 1 (
    echo [!] Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [*] Installing dependencies...
    call npm install
)

echo [*] Launching Counter-Drone Server...
start "" "http://localhost:3000"
node server.js

pause
