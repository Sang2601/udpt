<#
.SYNOPSIS
    Distributed Hotel Booking Scheduled Automated Backup Agent
    Runs periodic database snapshots with automated retention cleanup.
#>

param(
    [int]$IntervalMinutes = 60,
    [int]$IntervalSeconds = 0,
    [int]$RetentionDays = 7
)

$sleepSeconds = if ($IntervalSeconds -gt 0) { $IntervalSeconds } else { $IntervalMinutes * 60 }
$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Join-Path (Get-Location).Path "scripts" }
$backupScript = Join-Path $scriptDir "backup-db.ps1"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " [AUTO-BACKUP AGENT] Scheduled Database Backup Started    " -ForegroundColor Cyan
Write-Host " Interval: $sleepSeconds seconds | Retention: $RetentionDays days       " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

while ($true) {
    $now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "`n[$now] Triggering scheduled database backup..." -ForegroundColor Green
    try {
        & powershell.exe -ExecutionPolicy Bypass -File $backupScript -RetentionDays $RetentionDays
    } catch {
        Write-Host "Error during scheduled backup: $($_.Exception.Message)" -ForegroundColor Red
    }

    $nextRun = (Get-Date).AddSeconds($sleepSeconds).ToString("yyyy-MM-dd HH:mm:ss")
    Write-Host "[$now] Backup cycle finished. Next run scheduled at: $nextRun" -ForegroundColor Gray
    Start-Sleep -Seconds $sleepSeconds
}
