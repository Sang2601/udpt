<#
.SYNOPSIS
    Distributed Hotel Booking System Orchestrator (Windows Native)
    Controls service lifecycle, health monitoring, horizontal scaling,
    self-healing watchdog, database backups, and load testing.

.USAGE
    .\orchestrator.ps1 start
    .\orchestrator.ps1 stop
    .\orchestrator.ps1 restart [service]
    .\orchestrator.ps1 status
    .\orchestrator.ps1 scale room-service 2
    .\orchestrator.ps1 watchdog
    .\orchestrator.ps1 backup
    .\orchestrator.ps1 restore [backup_name]
    .\orchestrator.ps1 benchmark
#>

param(
    [Parameter(Position = 0)]
    [string]$Command = "status",

    [Parameter(Position = 1)]
    [string]$Target = "",

    [Parameter(Position = 2)]
    [string]$Count = ""
)

$baseDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$baseDir = $baseDir.TrimEnd('\')
$logsDir = Join-Path $baseDir "logs"
$dataDir = Join-Path $baseDir "data"
$configDir = Join-Path $baseDir "config"

if (-not (Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir -Force | Out-Null }
if (-not (Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir -Force | Out-Null }
if (-not (Test-Path $configDir)) { New-Item -ItemType Directory -Path $configDir -Force | Out-Null }
$clusterStateFile = Join-Path $configDir "cluster-state.json"

function Get-ClusterState() {
    if (Test-Path $clusterStateFile) {
        try { return Get-Content -Path $clusterStateFile -Raw | ConvertFrom-Json } catch {}
    }
    return [PSCustomObject]@{ "room-service" = 1; "booking-service" = 1 }
}

function Set-ClusterState($svc, $count) {
    $state = Get-ClusterState
    $state | Add-Member -Name $svc -Value ([int]$count) -Force
    $state | ConvertTo-Json | Set-Content -Path $clusterStateFile -Encoding UTF8
}

$serviceDefs = @(
    @{ Name = "auth-service";     Port = 8080; Jar = "services\auth-service\target\auth-service-0.0.1-SNAPSHOT.jar";         Health = "http://localhost:8080/actuator/health"; Category = "Core" },
    @{ Name = "user-service";     Port = 8081; Jar = "services\user-service\target\user-service-0.0.1-SNAPSHOT.jar";         Health = "http://localhost:8081/actuator/health"; Category = "Core" },
    @{ Name = "booking-service";  Port = 8082; Jar = "services\booking-service\target\booking-service-0.0.1-SNAPSHOT.jar";   Health = "http://localhost:8082/actuator/health"; Category = "App" },
    @{ Name = "room-service";     Port = 8083; Jar = "services\room-service\target\room-service-0.0.1-SNAPSHOT.jar";         Health = "http://localhost:8083/actuator/health"; Category = "App" },
    @{ Name = "payment-service";  Port = 8084; Jar = "services\payment-service\target\payment-service-0.0.1-SNAPSHOT.jar";   Health = "http://localhost:8084/actuator/health"; Category = "App" },
    @{ Name = "room-service-2";   Port = 8085; Jar = "services\room-service\target\room-service-0.0.1-SNAPSHOT.jar";         Health = "http://localhost:8085/actuator/health"; Category = "Scaled" },
    @{ Name = "booking-service-2";Port = 8086; Jar = "services\booking-service\target\booking-service-0.0.1-SNAPSHOT.jar";   Health = "http://localhost:8086/actuator/health"; Category = "Scaled" },
    @{ Name = "api-gateway";      Port = 8088; Jar = "services\api-gateway\target\api-gateway-0.0.1-SNAPSHOT.jar";           Health = "http://localhost:8088/actuator/health"; Category = "Gateway" },
    @{ Name = "frontend";         Port = 5500; Jar = "";                                                                      Health = "http://localhost:5500/index.html";      Category = "Frontend" }
)

function Get-PortPID([int]$port) {
    try {
        $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if ($conns) { return $conns[0].OwningProcess }
    } catch {}
    return $null
}

function Stop-ServicePort([string]$name, [int]$port) {
    $pidToKill = Get-PortPID $port
    if ($pidToKill) {
        Write-Host "Stopping $name (Port $port, PID $pidToKill)..." -ForegroundColor Yellow
        try {
            Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
            Write-Host "-> Stopped $name (PID $pidToKill)" -ForegroundColor Green
        } catch {
            Write-Host "-> Failed to stop PID $pidToKill - $($_.Exception.Message)" -ForegroundColor Red
        }
    } else {
        Write-Host "$name on port $port is not running." -ForegroundColor DarkGray
    }
}

$serviceStartTimes = @{}

function Start-SingleService($s) {
    $pidExisting = Get-PortPID $s.Port
    if ($pidExisting) {
        Write-Host "$($s.Name) is already running on port $($s.Port) (PID $pidExisting)." -ForegroundColor Cyan
        return
    }

    Write-Host "Starting $($s.Name) on port $($s.Port)..." -ForegroundColor Yellow
    $global:serviceStartTimes[$s.Name] = [System.DateTime]::UtcNow

    if ($s.Name -eq "frontend") {
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = "python"
        $psi.Arguments = "-m http.server 5500 -d frontend"
        $psi.WorkingDirectory = $baseDir
        $psi.CreateNoWindow = $true
        $psi.UseShellExecute = $false
        [System.Diagnostics.Process]::Start($psi) | Out-Null
    } else {
        $logPath = "logs\$($s.Name).log"
        $jvmArgs = "-Xms64m -Xmx256m -XX:TieredStopAtLevel=1 -jar `"$($s.Jar)`" --server.port=$($s.Port) --logging.file.name=`"$logPath`""
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = "java"
        $psi.Arguments = $jvmArgs
        $psi.WorkingDirectory = $baseDir
        $psi.CreateNoWindow = $true
        $psi.UseShellExecute = $false
        [System.Diagnostics.Process]::Start($psi) | Out-Null
    }

    Start-Sleep -Milliseconds 600
    $newPid = Get-PortPID $s.Port
    if ($newPid) {
        Write-Host "-> $($s.Name) started successfully (PID $newPid)" -ForegroundColor Green
    } else {
        Write-Host "-> $($s.Name) launch initiated in background. Check logs\$($s.Name).log" -ForegroundColor Gray
    }
}

function Show-Status() {
    Write-Host "`n==========================================================================================" -ForegroundColor Cyan
    Write-Host "                     DISTRIBUTED HOTEL BOOKING - CLUSTER STATUS                            " -ForegroundColor Cyan
    Write-Host "==========================================================================================" -ForegroundColor Cyan
    Write-Host ("{0,-18} {1,-6} {2,-10} {3,-8} {4,-12} {5,-16}" -f "SERVICE", "PORT", "CATEGORY", "PID", "STATUS", "HEALTH RESPONSE")
    Write-Host ("-" * 78)

    foreach ($s in $serviceDefs) {
        $pidNum = Get-PortPID $s.Port
        $statusStr = "STOPPED"
        $healthResp = "-"
        $color = "DarkGray"

        if ($pidNum) {
            try {
                $sw = [System.Diagnostics.Stopwatch]::StartNew()
                $resp = Invoke-WebRequest -Uri $s.Health -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
                $sw.Stop()
                if ($resp.StatusCode -eq 200) {
                    $statusStr = "ONLINE"
                    $healthResp = "UP ($($sw.ElapsedMilliseconds)ms)"
                    $color = "Green"
                } else {
                    $statusStr = "DEGRADED"
                    $healthResp = "HTTP $($resp.StatusCode)"
                    $color = "Yellow"
                }
            } catch {
                $statusStr = "STARTING"
                $healthResp = "Booting..."
                $color = "Yellow"
            }
        }

        $displayPid = if ($pidNum) { $pidNum } else { "-" }
        Write-Host ("{0,-18} {1,-6} {2,-10} {3,-8} {4,-12} {5,-16}" -f $s.Name, $s.Port, $s.Category, $displayPid, $statusStr, $healthResp) -ForegroundColor $color
    }

    $gwPid = Get-PortPID 8088
    if ($gwPid) {
        Write-Host "`n--- Active Load Balancer Registry (Spring Cloud Gateway) ---" -ForegroundColor Cyan
        try {
            $lbStatus = Invoke-RestMethod -Uri "http://localhost:8088/api/lb/status" -TimeoutSec 2 -ErrorAction Stop
            foreach ($entry in $lbStatus.services.PSObject.Properties) {
                $svc = $entry.Name
                $instances = $entry.Value
                $instSummaries = @()
                foreach ($inst in $instances) {
                    $h = if ($inst.healthy) { "HEALTHY" } else { "DOWN" }
                    $instSummaries += "$($inst.url) [$h, served: $($inst.servedRequests)]"
                }
                Write-Host "  * ${svc}: $([string]::Join(', ', $instSummaries))" -ForegroundColor Gray
            }
        } catch {
            Write-Host "  (Gateway LB status endpoint warming up...)" -ForegroundColor DarkGray
        }
    }
    Write-Host ""
}

# ----------------- COMMAND DISPATCH -----------------
switch ($Command.ToLower()) {
    "start" {
        Write-Host "Starting Distributed Hotel Booking Cluster..." -ForegroundColor Cyan
        $primaryServices = $serviceDefs | Where-Object { $_.Category -ne "Scaled" }
        foreach ($s in $primaryServices) {
            Start-SingleService $s
            Start-Sleep -Milliseconds 600
        }
        Write-Host "`nWaiting 5 seconds for services to initialize..." -ForegroundColor Gray
        Start-Sleep -Seconds 5
        Show-Status
        Write-Host "`n[SUCCESS] System online! Frontend accessible at: http://localhost:5500" -ForegroundColor Green
        Write-Host "Monitor Dashboard accessible at: http://localhost:5500/monitor.html" -ForegroundColor Green
        Write-Host "API Gateway accessible at: http://localhost:8088" -ForegroundColor Green
    }

    "stop" {
        Write-Host "Stopping all cluster services..." -ForegroundColor Yellow
        foreach ($s in $serviceDefs) {
            Stop-ServicePort $s.Name $s.Port
        }
        Write-Host "`n[SUCCESS] All services stopped." -ForegroundColor Green
    }

    "restart" {
        if ($Target) {
            $s = $serviceDefs | Where-Object { $_.Name -eq $Target }
            if ($s) {
                Stop-ServicePort $s.Name $s.Port
                Start-Sleep -Seconds 1
                Start-SingleService $s
            } else {
                Write-Host "Service '$Target' not recognized." -ForegroundColor Red
            }
        } else {
            & $PSCommandPath stop
            Start-Sleep -Seconds 2
            & $PSCommandPath start
        }
    }

    "status" {
        Show-Status
    }

    "scale" {
        $svcName = $Target.ToLower()
        $instCount = [int]$Count

        if ($svcName -in @("room-service", "booking-service")) {
            Set-ClusterState $svcName $instCount
            Write-Host "Set desired replica count for $svcName to $instCount. Watchdog will reconcile cluster state." -ForegroundColor Green
            Start-Sleep -Seconds 2
            Show-Status
        } else {
            Write-Host "Scale target must be 'room-service' or 'booking-service'. Example: .\orchestrator.ps1 scale room-service 2" -ForegroundColor Red
        }
    }

    "watchdog" {
        Write-Host "==========================================================================" -ForegroundColor Cyan
        Write-Host " [SELF-HEALING WATCHDOG] Cluster Health Monitoring & Auto-Restart Active   " -ForegroundColor Cyan
        Write-Host " Press Ctrl+C to stop watchdog                                            " -ForegroundColor Cyan
        Write-Host "==========================================================================" -ForegroundColor Cyan

        while ($true) {
            $state = Get-ClusterState
            $roomReplicas = if ($state."room-service") { [int]$state."room-service" } else { 1 }
            $bookingReplicas = if ($state."booking-service") { [int]$state."booking-service" } else { 1 }

            # Build active services list based on desired state
            $activeServices = $serviceDefs | Where-Object {
                if ($_.Name -eq "room-service-2") {
                    return ($roomReplicas -ge 2)
                } elseif ($_.Name -eq "booking-service-2") {
                    return ($bookingReplicas -ge 2)
                }
                return ($_.Category -ne "Scaled")
            }

            # Reconcile scaled-down services
            if ($roomReplicas -lt 2) {
                $pidR2 = Get-PortPID 8085
                if ($pidR2) { Stop-ServicePort "room-service-2" 8085 }
            }
            if ($bookingReplicas -lt 2) {
                $pidB2 = Get-PortPID 8086
                if ($pidB2) { Stop-ServicePort "booking-service-2" 8086 }
            }

            foreach ($s in $activeServices) {
                $pidNum = Get-PortPID $s.Port
                $isAlive = $false
                if ($pidNum) {
                    try {
                        $resp = Invoke-WebRequest -Uri $s.Health -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
                        if ($resp.StatusCode -eq 200) { $isAlive = $true }
                    } catch {}
                }

                if (-not $isAlive) {
                    # Check startup grace period
                    $inGracePeriod = $false
                    if ($global:serviceStartTimes.ContainsKey($s.Name)) {
                        $elapsedSec = ([System.DateTime]::UtcNow - $global:serviceStartTimes[$s.Name]).TotalSeconds
                        if ($elapsedSec -lt 25) {
                            $inGracePeriod = $true
                        }
                    }

                    if (-not $inGracePeriod) {
                        $now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
                        Write-Host "[$now] [ALERT] Service $($s.Name) on port $($s.Port) is DEAD or UNRESPONSIVE! Initiating auto-recovery..." -ForegroundColor Red
                        Stop-ServicePort $s.Name $s.Port
                        Start-Sleep -Milliseconds 500
                        Start-SingleService $s
                        Write-Host "[$now] [HEALED] Service $($s.Name) restarted." -ForegroundColor Green
                    }
                }
            }
            Start-Sleep -Seconds 8
        }
    }

    "backup" {
        & powershell.exe -ExecutionPolicy Bypass -File (Join-Path $baseDir "scripts\backup-db.ps1")
    }

    "restore" {
        $param = if ($Target) { $Target } else { "latest" }
        & powershell.exe -ExecutionPolicy Bypass -File (Join-Path $baseDir "scripts\restore-db.ps1") -BackupName $param
    }

    "benchmark" {
        python (Join-Path $baseDir "scripts\load-test.py")
    }

    default {
        Write-Host "Available commands: start | stop | restart | status | scale <svc> <count> | watchdog | backup | restore | benchmark" -ForegroundColor Yellow
    }
}
