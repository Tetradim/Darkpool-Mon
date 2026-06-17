@echo off
setlocal
title Darkpool Monitor - Local Source
echo.
echo ========================================
echo   Darkpool Monitor - Local Source
echo ========================================
echo.
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Launch-Darkpool-Monitor.ps1" %*
set EXITCODE=%ERRORLEVEL%
if not "%EXITCODE%"=="0" (
  echo.
  echo Darkpool Monitor launcher exited with code %EXITCODE%.
  pause
)
exit /b %EXITCODE%
