@echo off
cd /d "%~dp0"
echo Creating a Desktop shortcut for conkernftz...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $lnk = $ws.CreateShortcut([IO.Path]::Combine([Environment]::GetFolderPath('Desktop'),'conkernftz.lnk')); $lnk.TargetPath = (Join-Path '%~dp0' 'conkernftz.bat'); $lnk.WorkingDirectory = '%~dp0'; $lnk.Description = 'Launch conkernftz Studio'; $lnk.Save()"
if errorlevel 1 (
  echo.
  echo Could not create the shortcut.
  pause
  exit /b 1
)
echo Done. A "conkernftz" shortcut is now on your Desktop - double-click it to open the app.
pause
exit /b 0
