@echo off
title conkernftz
cd /d "%~dp0"

echo ==========================================
echo    conkernftz - starting up
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is required. Install it from https://nodejs.org and run this again.
  echo.
  pause
  exit /b 1
)

echo Preparing pnpm via Corepack...
call corepack enable >nul 2>nul
call corepack prepare pnpm@9.1.0 --activate >nul 2>nul

if not exist "node_modules" (
  echo First run: installing dependencies. This can take a few minutes...
  call pnpm install
  if errorlevel 1 (
    echo.
    echo ERROR: dependency install failed. See the messages above.
    pause
    exit /b 1
  )
)

echo Building ^(fast after the first run^)...
call pnpm -w build
if errorlevel 1 (
  echo.
  echo ERROR: build failed. See the messages above.
  pause
  exit /b 1
)

echo.
echo Launching conkernftz Studio. Keep this window open while you use the app.
set "CONKERNFTZ_SKIP_UI_BUILD=1"
call pnpm -C packages/ui start

exit /b 0
