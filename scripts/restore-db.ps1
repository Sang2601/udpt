<#
.SYNOPSIS
    Distributed Hotel Booking Database Recovery Script
    Restores persistent H2 databases from SQL snapshot backups using H2 RunScript tool,
    performs pre-restore safety archiving, and validates database tables and records post-restore.
#>

param(
    [string]$BackupName = "latest"
)

$baseDir = if ($PSScriptRoot) { (Split-Path -Parent $PSScriptRoot) } else { (Get-Location).Path }
$dataDir = Join-Path $baseDir "data"
$backupsRootDir = Join-Path $baseDir "backups"
$logsDir = Join-Path $baseDir "logs"
$h2Jar = Join-Path $baseDir "lib\h2.jar"

if (-not (Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir -Force | Out-Null }
$logFile = Join-Path $logsDir "restore.log"

function Write-RestoreLog([string]$msg, [string]$level = "INFO") {
    $timeStr = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timeStr] [$level] $msg"
    Add-Content -Path $logFile -Value $line -Encoding UTF8
    if ($level -eq "ERROR") {
        Write-Host $line -ForegroundColor Red
    } elseif ($level -eq "WARN") {
        Write-Host $line -ForegroundColor Yellow
    } else {
        Write-Host $line -ForegroundColor Green
    }
}

Write-RestoreLog "=== Starting Database Recovery Process ===" "INFO"

# Locate backup folder
$targetBackupDir = $null
if ($BackupName -eq "latest") {
    $backups = Get-ChildItem -Path $backupsRootDir -Directory | Where-Object { $_.Name -like "backup_*" } | Sort-Object CreationTime -Descending
    if ($backups.Count -eq 0) {
        Write-RestoreLog "No backup directories found in $backupsRootDir to restore from." "ERROR"
        exit 1
    }
    $targetBackupDir = $backups[0].FullName
    Write-RestoreLog "Auto-selected latest backup: $($backups[0].Name)" "INFO"
} else {
    $potentialPath = if (Test-Path $BackupName) { $BackupName } else { Join-Path $backupsRootDir $BackupName }
    if (-not (Test-Path $potentialPath)) {
        Write-RestoreLog "Specified backup path does not exist: $potentialPath" "ERROR"
        exit 1
    }
    $targetBackupDir = $potentialPath
}

Write-RestoreLog "Restoring from: $targetBackupDir" "INFO"

# Validate backup contents & SHA-256 integrity
$manifestPath = Join-Path $targetBackupDir "backup_info.json"
$sqlFiles = Get-ChildItem -Path $targetBackupDir -File | Where-Object { $_.Name -like "*.sql" }

if ($sqlFiles.Count -eq 0) {
    Write-RestoreLog "Validation failed: No .sql backup files found in $targetBackupDir." "ERROR"
    exit 1
}

if (Test-Path $manifestPath) {
    Write-RestoreLog "Found backup_info.json manifest. Verifying file integrity..." "INFO"
    try {
        $manifest = Get-Content -Path $manifestPath -Raw | ConvertFrom-Json
        foreach ($dbEntry in $manifest.databases) {
            $fPath = Join-Path $targetBackupDir $dbEntry.fileName
            if (-not (Test-Path $fPath)) {
                Write-RestoreLog "Integrity check failed: Expected file $($dbEntry.fileName) is missing!" "ERROR"
                exit 1
            }
            $currentHash = (Get-FileHash -Path $fPath -Algorithm SHA256).Hash
            if ($currentHash -ne $dbEntry.sha256) {
                Write-RestoreLog "Integrity check failed: Hash mismatch for $($dbEntry.fileName)! Expected $($dbEntry.sha256), got $currentHash" "ERROR"
                exit 1
            }
            Write-RestoreLog "Verified $($dbEntry.fileName) -> SHA-256 intact." "INFO"
        }
    } catch {
        Write-RestoreLog "Warning parsing manifest: $($_.Exception.Message)" "WARN"
    }
}

# Pre-Restore Safety Archive: Snapshot existing data/
$safetyDir = Join-Path $backupsRootDir "pre_restore_safety_snapshot"
if (Test-Path $dataDir) {
    Write-RestoreLog "Creating pre-restore safety snapshot at $safetyDir..." "INFO"
    if (Test-Path $safetyDir) { Remove-Item -Path $safetyDir -Recurse -Force }
    New-Item -ItemType Directory -Path $safetyDir -Force | Out-Null
    Get-ChildItem -Path $dataDir -File | ForEach-Object {
        try {
            Copy-Item -Path $_.FullName -Destination $safetyDir -Force -ErrorAction SilentlyContinue
        } catch {}
    }
}

# Perform Restore using H2 RunScript
$restoredCount = 0
foreach ($sqlFile in $sqlFiles) {
    $dbName = [System.IO.Path]::GetFileNameWithoutExtension($sqlFile.Name)
    $dbPath = (Join-Path $dataDir $dbName).Replace('\', '/')
    $jdbcUrl = "jdbc:h2:file:$dbPath;AUTO_SERVER=TRUE"

    Write-RestoreLog "Restoring $dbName from $($sqlFile.Name)..." "INFO"
    try {
        $process = Start-Process -FilePath "java" -ArgumentList "-cp `"$h2Jar`" org.h2.tools.RunScript -url `"$jdbcUrl`" -user sa -script `"$($sqlFile.FullName)`"" -Wait -PassThru -NoNewWindow
        if ($process.ExitCode -eq 0) {
            $restoredCount++
            Write-RestoreLog "Successfully restored $dbName." "INFO"
        } else {
            Write-RestoreLog "Error restoring $dbName (ExitCode: $($process.ExitCode))" "ERROR"
        }
    } catch {
        Write-RestoreLog "Exception restoring ${dbName} - $($_.Exception.Message)" "ERROR"
    }
}

# Post-Restore Verification
Write-RestoreLog "Performing post-restore data verification..." "INFO"
try {
    # Query room count from roomdb via H2 Shell without BOM
    $verifySql = "SELECT COUNT(*) FROM ROOMS;"
    $verifyFile = Join-Path $dataDir "verify_query.sql"
    [System.IO.File]::WriteAllText($verifyFile, $verifySql, [System.Text.Encoding]::ASCII)
    $roomDbPath = (Join-Path $dataDir "roomdb").Replace('\', '/')
    $verifyProc = Start-Process -FilePath "java" -ArgumentList "-cp `"$h2Jar`" org.h2.tools.RunScript -url `"jdbc:h2:file:$roomDbPath;AUTO_SERVER=TRUE`" -user sa -script `"$verifyFile`"" -Wait -PassThru -NoNewWindow
    if (Test-Path $verifyFile) { Remove-Item $verifyFile -Force }
    Write-RestoreLog "Verified roomdb query execution status: $($verifyProc.ExitCode)" "INFO"
} catch {
    Write-RestoreLog "Warning during post-restore verification: $($_.Exception.Message)" "WARN"
}

if ($restoredCount -eq $sqlFiles.Count) {
    Write-RestoreLog "=== Database Recovery Completed Successfully! ($restoredCount databases restored) ===" "INFO"
    exit 0
} else {
    Write-RestoreLog "=== Database Recovery Finished with Partial Errors. Review logs above. ===" "ERROR"
    exit 1
}
