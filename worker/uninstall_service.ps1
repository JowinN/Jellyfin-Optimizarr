# Requires Administrative privileges to remove system-level startup tasks
$IsAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $IsAdmin) {
    Write-Host "[ERROR] Administrator privileges are required to manage system startup services." -ForegroundColor Red
    Write-Host "Please right-click uninstall_service.bat and select 'Run as administrator'." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit..."
    exit 1
}

$TaskName = "JellyfinMediaOptimizerWorker"

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "  Uninstalling Jellyfin Media Optimizer Worker System Service" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host ""

try {
    # 1. Stop and unregister scheduled task
    Write-Host "[1/3] Removing Windows System Task: $TaskName..." -ForegroundColor Gray
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

    # 2. Clean up legacy startup shortcuts if present
    Write-Host "[2/3] Cleaning up any legacy startup shortcuts..." -ForegroundColor Gray
    $UserStartup = [System.Environment]::GetFolderPath('Startup')
    $OldUserLnk = Join-Path $UserStartup "JellyfinMediaOptimizerWorker.lnk"
    if (Test-Path $OldUserLnk) { Remove-Item $OldUserLnk -Force -ErrorAction SilentlyContinue }

    $CommonStartup = [System.Environment]::GetFolderPath('CommonStartup')
    $OldCommonLnk = Join-Path $CommonStartup "JellyfinMediaOptimizerWorker.lnk"
    if (Test-Path $OldCommonLnk) { Remove-Item $OldCommonLnk -Force -ErrorAction SilentlyContinue }

    # 3. Terminate running background worker processes
    Write-Host "[3/3] Terminating any running background worker processes..." -ForegroundColor Gray
    Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*windows_worker.py*" } | ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
    Get-Process -Name ffmpeg -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

    Write-Host ""
    Write-Host "====================================================================" -ForegroundColor Green
    Write-Host " [SUCCESS] Worker system service has been stopped and uninstalled." -ForegroundColor Green
    Write-Host "====================================================================" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "[ERROR] An error occurred while uninstalling service: $_" -ForegroundColor Red
    Write-Host ""
}

Read-Host "Press Enter to exit..."
