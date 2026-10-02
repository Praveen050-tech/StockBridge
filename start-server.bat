@echo off
set "PATH=%~dp0.tools\node;%PATH%"
cd /d "%~dp0server"
echo ========================================================
echo   Starting StockBridge B2B Logistics Backend Server
echo   Running on http://localhost:5000
echo   Socket.io active on ws://localhost:5000
echo ========================================================
node src/index.js
pause
