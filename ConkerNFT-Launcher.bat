@echo off
REM ConkerNFT Launcher - Starts the Electron GUI
echo Starting ConkerNFT...
cd /d "%~dp0"
call pnpm -C packages/ui start
pause


