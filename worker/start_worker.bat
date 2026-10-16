@echo off
title Jellyfin Media Optimizer - Distributed Windows Worker Node
color 0b

echo ====================================================================
echo        JELLYFIN MEDIA OPTIMIZER - WINDOWS WORKER NODE
echo     Accelerated by NVIDIA Quadro K620 GPU (NVENC Engine)
echo ====================================================================
echo.

cd /d "%~dp0"

set "PYTHON_EXE="
if exist "C:\Users\Jowin\.local\bin\python3.11.exe" (
    set "PYTHON_EXE=C:\Users\Jowin\.local\bin\python3.11.exe"
) else if exist "C:\Users\Jowin\AppData\Roaming\uv\python\cpython-3.11-windows-x86_64-none\python.exe" (
    set "PYTHON_EXE=C:\Users\Jowin\AppData\Roaming\uv\python\cpython-3.11-windows-x86_64-none\python.exe"
) else (
    where python >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        set "PYTHON_EXE=python"
    ) else (
        where py >nul 2>&1
        if %ERRORLEVEL% EQU 0 (
            set "PYTHON_EXE=py -3.11"
        ) else (
            echo [ERROR] Python 3.11 not found at expected paths or in system PATH.
            pause
            exit /b 1
        )
    )
)

echo Using Python: %PYTHON_EXE%
echo Starting Transcoding Worker with Quadro K620 Hardware Acceleration...
echo.

"%PYTHON_EXE%" "%~dp0windows_worker.py" --server http://192.168.1.7:8097 --prefer-gpu

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Worker stopped.
    pause
)
