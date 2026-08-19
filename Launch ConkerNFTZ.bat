@echo off
setlocal EnableExtensions DisableDelayedExpansion

rem This is the friendly Windows entry point. It deliberately resolves its own
rem directory so it is safe to double-click or launch from any working folder.
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%" || (
  echo ERROR: Could not open the ConkerNFTZ folder:
  echo        "%SCRIPT_DIR%"
  pause
  exit /b 1
)

if /I "%~1"=="--check" goto :check
if not "%~1"=="" goto :usage

title ConkerNFTZ Studio
echo ==========================================
echo    ConkerNFTZ Studio - starting up
echo ==========================================
echo.

call :check
if errorlevel 1 goto :launchFailure

call :ensurePnpm
if errorlevel 1 goto :launchFailure

if not exist "node_modules\" (
  echo First run: installing dependencies. This can take a few minutes...
  call :runPackageManager install
  if errorlevel 1 (
    echo.
    echo ERROR: Dependency installation failed. Check your internet connection,
    echo        then run this launcher again.
    goto :launchFailure
  )
)

echo Building ^(fast after the first run^)...
call :runPackageManager -w build
if errorlevel 1 (
  echo.
  echo ERROR: The build failed. See the messages above for the first error.
  goto :launchFailure
)

echo.
echo Launching ConkerNFTZ Studio. Keep this window open while you use the app.
set "CONKERNFTZ_SKIP_UI_BUILD=1"
call :runPackageManager -C packages/ui start
set "LAUNCH_RESULT=%ERRORLEVEL%"

if not "%LAUNCH_RESULT%"=="0" (
  echo.
  echo ERROR: ConkerNFTZ closed with exit code %LAUNCH_RESULT%.
  echo        See the messages above for details.
  pause
)
exit /b %LAUNCH_RESULT%

:check
set "CHECK_FAILED="

if not exist "%SCRIPT_DIR%package.json" (
  echo ERROR: This launcher must stay in the ConkerNFTZ repository folder.
  echo        Missing: "%SCRIPT_DIR%package.json"
  set "CHECK_FAILED=1"
)
if not exist "%SCRIPT_DIR%pnpm-lock.yaml" (
  echo ERROR: The workspace lockfile is missing: "%SCRIPT_DIR%pnpm-lock.yaml"
  set "CHECK_FAILED=1"
)
if not exist "%SCRIPT_DIR%packages\ui\package.json" (
  echo ERROR: The desktop app package is missing: "packages\ui\package.json"
  set "CHECK_FAILED=1"
)
if not exist "%SCRIPT_DIR%packages\ui\scripts\start.cjs" (
  echo ERROR: The desktop app start script is missing: "packages\ui\scripts\start.cjs"
  set "CHECK_FAILED=1"
)

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js 22.14 or newer ^(before 25^) is required. Install it from https://nodejs.org
  echo        and run this launcher again.
  set "CHECK_FAILED=1"
) else (
  node -e "const [major,minor]=process.versions.node.split('.').map(Number); const supported=major === 22 ? minor >= 14 : major >= 23 && !(major >= 25); process.exit(supported ? 0 : 1)" >nul 2>nul
  if errorlevel 1 (
    echo ERROR: ConkerNFTZ needs Node.js 22.14 or newer ^(before 25^). Your current Node version is:
    node --version
    set "CHECK_FAILED=1"
  )
)

where corepack >nul 2>nul
if not errorlevel 1 goto :checkResult

call :findPnpm9
if errorlevel 1 (
  where corepack >nul 2>nul
  if errorlevel 1 (
    echo ERROR: pnpm 9.x or Corepack is required to prepare the app.
    echo        Reinstall Node.js 22.14 or newer ^(before 25^) from https://nodejs.org, then run this launcher again.
    set "CHECK_FAILED=1"
  )
)

:checkResult
if defined CHECK_FAILED (
  echo.
  echo Check failed. Fix the item above, then run the launcher again.
  exit /b 1
)

echo Check passed: workspace, Node.js, and package-manager prerequisites are available.
exit /b 0

:ensurePnpm
where corepack >nul 2>nul
if not errorlevel 1 goto :prepareCorepackPnpm

call :findPnpm9
if not errorlevel 1 goto :usePathPnpm

echo.
echo ERROR: pnpm 9.x is unavailable and Corepack was not found.
echo        Reinstall Node.js 22.14 or newer ^(before 25^) from https://nodejs.org, then run this launcher again.
exit /b 1

:prepareCorepackPnpm
echo Preparing pinned pnpm 9.1.0 through Corepack...
call corepack pnpm@9.1.0 --version >nul 2>nul
if not errorlevel 1 goto :useCorepackPnpm
call :findPnpm9
if not errorlevel 1 goto :usePathPnpm
echo.
echo ERROR: Corepack could not prepare pinned pnpm 9.1.0 and no verified pnpm 9.x is available.
echo        Check your internet connection, then run this launcher again.
exit /b 1

:useCorepackPnpm
set "PACKAGE_RUNNER=corepack"
exit /b 0

:usePathPnpm
echo Using the verified pnpm 9.x already available on PATH.
set "PACKAGE_RUNNER=pnpm"
exit /b 0

:findPnpm9
set "PNPM_MAJOR="
where pnpm >nul 2>nul
if errorlevel 1 exit /b 1
for /f "tokens=1 delims=." %%V in ('pnpm --version 2^>nul') do set "PNPM_MAJOR=%%V"
if "%PNPM_MAJOR%"=="9" exit /b 0
exit /b 1

:runPackageManager
if /I "%PACKAGE_RUNNER%"=="corepack" goto :runCorepackPnpm
if /I "%PACKAGE_RUNNER%"=="pnpm" goto :runPathPnpm

echo ERROR: No verified package runner is available.
exit /b 1

:runCorepackPnpm
call corepack pnpm@9.1.0 %*
exit /b %ERRORLEVEL%

:runPathPnpm
call pnpm %*
exit /b %ERRORLEVEL%

:usage
echo Usage: "%~nx0" [--check]
echo.
echo --check verifies the repository and prerequisites without installing, building, or opening the app.
exit /b 2

:launchFailure
echo.
echo ConkerNFTZ did not start. Fix the error above, then double-click this launcher again.
if not defined CONKERNFTZ_NO_PAUSE pause
exit /b 1
