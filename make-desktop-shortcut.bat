@echo off
setlocal EnableExtensions DisableDelayedExpansion
set "SCRIPT_DIR=%~dp0"
set "LAUNCHER=%SCRIPT_DIR%Launch ConkerNFTZ.bat"

if not exist "%LAUNCHER%" (
  echo ERROR: The launcher is missing:
  echo        "%LAUNCHER%"
  pause
  exit /b 1
)

echo Creating a Desktop shortcut for ConkerNFTZ...
set "CONKERNFTZ_SHORTCUT_ROOT=%SCRIPT_DIR%"
powershell -NoProfile -Command "$ErrorActionPreference = 'Stop'; $root = $env:CONKERNFTZ_SHORTCUT_ROOT; $target = Join-Path $root 'Launch ConkerNFTZ.bat'; if (-not (Test-Path -LiteralPath $target -PathType Leaf)) { throw 'Launcher not found: ' + $target }; $desktop = [Environment]::GetFolderPath('Desktop'); if ([string]::IsNullOrWhiteSpace($desktop)) { throw 'Desktop folder is unavailable.' }; $ws = New-Object -ComObject WScript.Shell; $lnk = $ws.CreateShortcut((Join-Path $desktop 'ConkerNFTZ.lnk')); $lnk.TargetPath = $target; $lnk.WorkingDirectory = $root; $lnk.Description = 'Launch ConkerNFTZ Studio'; $electron = Join-Path $root 'node_modules\electron\dist\electron.exe'; if (-not (Test-Path -LiteralPath $electron -PathType Leaf)) { $electron = Get-ChildItem -LiteralPath (Join-Path $root 'node_modules\.pnpm') -Directory -Filter 'electron@*' -ErrorAction SilentlyContinue | ForEach-Object { Join-Path $_.FullName 'node_modules\electron\dist\electron.exe' } | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1 }; if ($electron) { $lnk.IconLocation = $electron + ',0' }; $lnk.Save()"
if errorlevel 1 (
  echo.
  echo Could not create the shortcut.
  pause
  exit /b 1
)
echo Done. A "ConkerNFTZ" shortcut is now on your Desktop - double-click it to open the app.
pause
exit /b 0
