@echo off
setlocal
title Darkpool Monitor
cd /d "%~dp0"

if not exist "%~dp0Launch-Darkpool-Monitor.ps1" (
  echo.
  echo Darkpool Monitor could not find Launch-Darkpool-Monitor.ps1.
  echo Please extract the full Darkpool Monitor folder, or reinstall with DarkpoolMonitor-Setup.
  echo Send this screenshot to Darkpool Monitor support if the problem continues.
  pause
  exit /b 2
)

set "POWERSHELL=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%POWERSHELL%" (
  where powershell.exe >nul 2>nul
  if errorlevel 1 (
    echo.
    echo PowerShell was not found. Darkpool Monitor needs Windows PowerShell to start and repair missing dependencies.
    echo Please send this screenshot to Darkpool Monitor support.
    pause
    exit /b 9009
  )
  set "POWERSHELL=powershell.exe"
)

"%POWERSHELL%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0Launch-Darkpool-Monitor.ps1" %*
set EXIT_CODE=%ERRORLEVEL%
if not "%EXIT_CODE%"=="0" (
  echo.
  echo Darkpool Monitor launcher exited with code %EXIT_CODE%.
  pause
)
exit /b %EXIT_CODE%
