@echo off
set "PATH=%~dp0.tools\node;%PATH%"
cd /d "%~dp0client"
echo ========================================================
echo   Starting StockBridge React + Tailwind Frontend App
echo   Running on http://localhost:5173
echo ========================================================
npm run dev
pause
