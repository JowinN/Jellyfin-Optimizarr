@echo off
title Jellyfin Optimizer Worker - Live Log Monitor
color 0a

echo ====================================================================
echo      Jellyfin Optimizer Worker - Live Background Log Stream
echo ====================================================================
echo.
echo Press Ctrl+C at any time to exit monitoring.
echo.

if not exist "%~dp0worker.log" (
    echo [INFO] Waiting for worker.log to be created...
    echo.
)

powershell -Command "Get-Content -Path '%~dp0worker.log' -Tail 30 -Wait"
