<#
.SYNOPSIS
    Distributed Hotel Booking Database Backup Script
    Performs online, consistent SQL script dumps (SCRIPT TO) using H2 Database Engine,
    generates SHA-256 hashes, writes metadata manifests, and enforces automated retention cleanup.
#>

param(
    [int]$RetentionDays = 7,
    [string]$TargetDir = ""
)

$baseDir = if ($PSScriptRoot) { (Split-Path -Parent $PSScriptRoot) } else { (Get-Location).Path }
$dataDir = Join-Path $baseDir "data"
$backupsRootDir = Join-Path $baseDir "backups"
$logsDir = Join-Path $baseDir "logs"
$h2Jar = Join-Path $baseDir "lib\h2.jar"

if (-not (Test-Path $backupsRootDir)) { New-Item -ItemType Directory -Path $backupsRootDir -Force | Out-Null }
if (-not (Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir -Force | Out-Null }

$logFile = Join-Path $logsDir "backup.log"
$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$backupName = "backup_$timestamp"
$backupFolder = if ($TargetDir) { $TargetDir } else { Join-Path $backupsRootDir $backupName }
$masterSqlFile = Join-Path $backupsRootDir "backup_$timestamp.sql"

function Write-BackupLog([string]$msg, [string]$level = "INFO") {
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

Write-BackupLog "=== Starting Database Backup: $backupName ===" "INFO"

if (-not (Test-Path $h2Jar)) {
    Write-BackupLog "H2 Jar not found at $h2Jar. Cannot execute backup." "ERROR"
    exit 1
}

New-Item -ItemType Directory -Path $backupFolder -Force | Out-Null

$dbList = @("userdb", "roomdb", "bookingdb", "paymentdb")
$manifestFiles = @()
$successCount = 0

# Header for master unified sql
$masterContent = @("-- DISTRIBUTED HOTEL BOOKING UNIFIED BACKUP: $timestamp", "-- Retention Policy: $RetentionDays days`n")

foreach ($db in $dbList) {
    $sqlOutFile = Join-Path $backupFolder "$db.sql"
    $dbPath = (Join-Path $dataDir $db).Replace('\', '/')
    $jdbcUrl = "jdbc:h2:file:$dbPath;AUTO_SERVER=TRUE"

    try {
        Write-BackupLog "Dumping $db via H2 Script tool (with DROP cascade)..." "INFO"
        $process = Start-Process -FilePath "java" -ArgumentList "-cp `"$h2Jar`" org.h2.tools.Script -url `"$jdbcUrl`" -user sa -script `"$sqlOutFile`" -options DROP" -Wait -PassThru -NoNewWindow
        
        if ($process.ExitCode -eq 0 -and (Test-Path $sqlOutFile)) {
            $fileItem = Get-Item $sqlOutFile
            $sizeBytes = $fileItem.Length
            $sha256 = (Get-FileHash -Path $sqlOutFile -Algorithm SHA256).Hash

            $manifestFiles += [PSCustomObject]@{
                database = $db
                fileName = "$db.sql"
                sizeBytes = $sizeBytes
                sha256 = $sha256
            }
            $successCount++
            Write-BackupLog "Successfully backed up $db -> $db.sql ($sizeBytes bytes, SHA256: $($sha256.Substring(0, 12))...)" "INFO"

            # Append to master sql
            $masterContent += "`n-- =========================================="
            $masterContent += "-- DATABASE: $db"
            $masterContent += "-- =========================================="
            $masterContent += (Get-Content -Path $sqlOutFile -Raw)
        } else {
            Write-BackupLog "Failed to dump $db (ExitCode: $($process.ExitCode))" "ERROR"
        }
    } catch {
        Write-BackupLog "Exception dumping ${db} - $($_.Exception.Message)" "ERROR"
    }
}

# Write master backup .sql in backups root
$masterContent | Set-Content -Path $masterSqlFile -Encoding UTF8
$masterSize = (Get-Item $masterSqlFile).Length
$masterHash = (Get-FileHash -Path $masterSqlFile -Algorithm SHA256).Hash
Write-BackupLog "Master unified backup generated: $masterSqlFile ($masterSize bytes, SHA256: $($masterHash.Substring(0, 12))...)" "INFO"

# Create backup_info.json manifest
$manifest = [PSCustomObject]@{
    backupName = $backupName
    createdAt = (Get-Date).ToString("o")
    totalDatabases = $successCount
    masterSqlFile = "backup_$timestamp.sql"
    masterSizeBytes = $masterSize
    masterSha256 = $masterHash
    databases = $manifestFiles
    status = if ($successCount -eq $dbList.Count) { "SUCCESS" } else { "PARTIAL" }
}

$manifestJsonPath = Join-Path $backupFolder "backup_info.json"
$manifest | ConvertTo-Json -Depth 5 | Set-Content -Path $manifestJsonPath -Encoding UTF8

Write-BackupLog "Manifest created at: $manifestJsonPath" "INFO"
Write-BackupLog "Database backup completed successfully! Folder: $backupFolder" "INFO"

# Retention Policy Cleanup: Delete backups older than $RetentionDays
Write-BackupLog "Applying retention policy: Deleting backups older than $RetentionDays days..." "INFO"
$cutoffDate = (Get-Date).AddDays(-$RetentionDays)

# Clean expired backup folders
$oldFolders = Get-ChildItem -Path $backupsRootDir -Directory | Where-Object {
    $_.Name -like "backup_*" -and $_.CreationTime -lt $cutoffDate
}
foreach ($old in $oldFolders) {
    try {
        Remove-Item -Path $old.FullName -Recurse -Force
        Write-BackupLog "Retention policy purged expired folder: $($old.Name)" "INFO"
    } catch {}
}

# Clean expired master .sql files
$oldSqls = Get-ChildItem -Path $backupsRootDir -File | Where-Object {
    $_.Name -like "backup_*.sql" -and $_.CreationTime -lt $cutoffDate
}
foreach ($old in $oldSqls) {
    try {
        Remove-Item -Path $old.FullName -Force
        Write-BackupLog "Retention policy purged expired SQL file: $($old.Name)" "INFO"
    } catch {}
}

Write-BackupLog "=== Database Backup Finished ===" "INFO"
