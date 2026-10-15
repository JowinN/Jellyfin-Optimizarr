@echo off
setlocal
title Uninstall Jellyfin Optimizer Worker Service
color 0c
cd /d "%~dp0"

echo ====================================================================
echo     JELLYFIN MEDIA OPTIMIZER - WORKER SERVICE UNINSTALLER
echo ====================================================================
echo.

:: Check for Administrative privileges
net session >nul 2>&1
if %ERRORLEVEL% EQU 0 goto :RUN_UNINSTALL

echo [INFO] Administrator privileges are required to remove system startup tasks.
echo Requesting Administrator elevation...
echo Please click 'Yes' on the Windows permission dialog.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell.exe -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"\"%~dp0uninstall_service.ps1\"\"' -Verb RunAs" 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [INFO] Uninstaller launched in elevated window.
    exit /b 0
)

echo.
echo [NOTE] Automatic elevation was not granted.
echo Please right-click 'uninstall_service.bat' and select 'Run as administrator'.
echo.
pause
exit /b 1

:RUN_UNINSTALL
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall_service.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Uninstallation failed. See details above.
    echo.
    pause
)
