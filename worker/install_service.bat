@echo off
setlocal
title Install Jellyfin Optimizer Worker Service
color 0b
cd /d "%~dp0"

echo ====================================================================
echo      JELLYFIN MEDIA OPTIMIZER - WORKER SERVICE INSTALLER
echo ====================================================================
echo.

:: Check for Administrative privileges
net session >nul 2>&1
if %ERRORLEVEL% EQU 0 goto :RUN_INSTALL

echo [INFO] Administrator privileges are required to configure system startup tasks.
echo Requesting Administrator elevation...
echo Please click 'Yes' on the Windows permission dialog.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell.exe -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"\"%~dp0install_service.ps1\"\"' -Verb RunAs" 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [INFO] Installer launched in elevated window.
    exit /b 0
)

echo.
echo [NOTE] Automatic elevation was not granted.
echo Please right-click 'install_service.bat' and select 'Run as administrator'.
echo.
pause
exit /b 1

:RUN_INSTALL
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install_service.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Installation failed. See details above.
    echo.
    pause
)
