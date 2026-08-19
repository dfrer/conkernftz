@echo off
rem Backwards-compatible entry point. New shortcuts should use the clearly named launcher.
call "%~dp0Launch ConkerNFTZ.bat" %*
exit /b %ERRORLEVEL%
