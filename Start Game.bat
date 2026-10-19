@echo off
rem Double-click to play. Keep this window open while you play; close it to stop the game server.
title Malam Pilihan Raya (game server - keep open while playing)
cd /d "%~dp0"
if not exist node_modules (
  echo First run: installing the game's packages, this takes a minute...
  call npm install
)
start "" cmd /c "timeout /t 6 >nul & start http://localhost:3000"
call npm run dev
pause
