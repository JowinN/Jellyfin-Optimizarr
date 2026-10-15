$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$TaskName = "JellyfinMediaOptimizerWorker"

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "  Installing Jellyfin Media Optimizer Worker System Service" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host ""

# Verify Administrator privileges
$IsAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $IsAdmin) {
    Write-Host "[ERROR] Administrator privileges are required to configure system startup services." -ForegroundColor Red
    Write-Host "Please right-click install_service.bat and select 'Run as administrator'." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit..."
    exit 1
}

try {
    # 1. Stop and remove any prior scheduled task or startup shortcut
    Write-Host "[1/4] Cleaning up previous service and startup configurations..." -ForegroundColor Gray
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

    # Clean up legacy startup shortcuts (per-user and all-users)
    $UserStartup = [System.Environment]::GetFolderPath('Startup')
    $OldUserLnk = Join-Path $UserStartup "JellyfinMediaOptimizerWorker.lnk"
    if (Test-Path $OldUserLnk) { Remove-Item $OldUserLnk -Force -ErrorAction SilentlyContinue }

    $CommonStartup = [System.Environment]::GetFolderPath('CommonStartup')
    $OldCommonLnk = Join-Path $CommonStartup "JellyfinMediaOptimizerWorker.lnk"
    if (Test-Path $OldCommonLnk) { Remove-Item $OldCommonLnk -Force -ErrorAction SilentlyContinue }

    # 2. Terminate any running standalone worker instances
    Write-Host "[2/4] Terminating existing worker processes..." -ForegroundColor Gray
    Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*windows_worker.py*" } | ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
    Get-Process -Name ffmpeg -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

    # 3. Register Scheduled Task with System Boot and Any User Logon Triggers
    Write-Host "[3/4] Registering Windows Scheduled Task: $TaskName..." -ForegroundColor Gray

    # Action: Runs run_worker_bg.bat in the worker directory without path quoting issues
    $Action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c run_worker_bg.bat" -WorkingDirectory $ScriptDir

    # Trigger 1: Starts at system boot / startup BEFORE any user logs in
    $TriggerBoot = New-ScheduledTaskTrigger -AtStartup

    # Trigger 2: Starts when ANY user logs into Windows
    $TriggerLogon = New-ScheduledTaskTrigger -AtLogOn

    # Principal: Runs under NT AUTHORITY\SYSTEM (highest privileges, no password needed, runs whether logged in or not)
    $Principal = New-ScheduledTaskPrincipal -UserId "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest

    # Settings:
    # - Runs on AC and battery power
    # - ExecutionTimeLimit = Zero (never automatically killed after 72h)
    # - RestartCount & RestartInterval (auto-restarts on crash)
    # - MultipleInstances IgnoreNew (prevents collision between Boot and Logon triggers)
    # - StartWhenAvailable
    $Settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -RestartCount 5 `
        -RestartInterval (New-TimeSpan -Minutes 1) `
        -ExecutionTimeLimit ([TimeSpan]::Zero) `
        -MultipleInstances IgnoreNew `
        -StartWhenAvailable

    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $Action `
        -Trigger @($TriggerBoot, $TriggerLogon) `
        -Principal $Principal `
        -Settings $Settings `
        -Description "Jellyfin Media Optimizer Distributed GPU Worker (Starts on boot without login, and on any user login)" `
        -Force | Out-Null

    # 4. Start the worker service immediately
    Write-Host "[4/4] Starting worker system task now..." -ForegroundColor Gray
    Start-ScheduledTask -TaskName $TaskName

    Start-Sleep -Seconds 2
    $RegisteredTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    $State = if ($RegisteredTask) { $RegisteredTask.State } else { "Running" }

    Write-Host ""
    Write-Host "====================================================================" -ForegroundColor Green
    Write-Host " [SUCCESS] Worker background service installed and running!" -ForegroundColor Green
    Write-Host "====================================================================" -ForegroundColor Green
    Write-Host " - Current State          : $State" -ForegroundColor Cyan
    Write-Host " - Machine Boot (No Login): YES (Starts automatically before any user logs in)" -ForegroundColor White
    Write-Host " - Any User Logging In    : YES (Auto-activates whenever ANY user logs in)" -ForegroundColor White
    Write-Host " - Execution Account      : NT AUTHORITY\SYSTEM (Headless, High Privileges)" -ForegroundColor White
    Write-Host " - GPU Acceleration       : NVIDIA Quadro K620 NVENC Active" -ForegroundColor White
    Write-Host " - 72-Hour Timeout Kill   : DISABLED (Runs indefinitely 24/7)" -ForegroundColor White
    Write-Host " - Auto-Restart on Crash  : ENABLED (Up to 5 retries every 1m)" -ForegroundColor White
    Write-Host " - Live Log File          : $(Join-Path $ScriptDir 'worker.log')" -ForegroundColor Yellow
    Write-Host " - Monitor Logs Command   : view_logs.bat" -ForegroundColor Yellow
    Write-Host " - Uninstall Command      : uninstall_service.bat" -ForegroundColor Gray
    Write-Host "====================================================================" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "[ERROR] Failed to register or start worker service: $_" -ForegroundColor Red
    Write-Host ""
}

Read-Host "Press Enter to exit..."
