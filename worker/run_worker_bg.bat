@echo off
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
        )
    )
)

if "%PYTHON_EXE%"=="" (
    echo [%DATE% %TIME%] [ERROR] Python 3.11 executable not found! >> "%~dp0worker.log" 2>&1
    exit /b 1
)

"%PYTHON_EXE%" -u "%~dp0windows_worker.py" --server http://192.168.1.7:8097 --prefer-gpu >> "%~dp0worker.log" 2>&1
