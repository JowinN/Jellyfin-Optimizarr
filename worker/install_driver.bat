@echo off
title NVIDIA Quadro K620 Driver Update (474.14 WHQL)
color 0a

echo ====================================================================
echo       UPGRADE NVIDIA QUADRO K620 DRIVER TO 474.14 WHQL
echo ====================================================================
echo.
echo This will update your NVIDIA Quadro K620 driver from 436.30 (2019)
echo to 474.14 (NVIDIA's latest certified release with CUDA 11.4 support).
echo.
echo Once updated, NVENC hardware encoding on the Quadro K620 GPU
echo will be fully unlocked for FFmpeg.
echo.

set DRIVER_FILE=%USERPROFILE%\Downloads\NVIDIA-Quadro-474.14-Driver.exe

if not exist "%DRIVER_FILE%" (
    echo [ERROR] Driver installer not found at:
    echo "%DRIVER_FILE%"
    echo.
    echo Please wait for the download to finish.
    pause
    exit /b 1
)

echo Launching NVIDIA installer with Administrator privileges...
echo When the Windows UAC prompt appears, please click "YES".
echo.

powershell -Command "Start-Process -FilePath '%DRIVER_FILE%' -Verb RunAs"

echo.
echo Installer has been launched on your desktop!
echo Please complete the NVIDIA setup wizard (Express recommended).
echo After installation finishes, restart start_worker.bat.
pause
