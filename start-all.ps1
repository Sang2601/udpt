$java = "C:\Users\duysa\.jdks\openjdk-27\bin\java.exe"
$baseDir = $PSScriptRoot
Set-Location $baseDir

# Stop previous services if running
if (Test-Path "$baseDir\stop-all.ps1") {
    & "$baseDir\stop-all.ps1"
}

$services = @(
    @{ Name = "auth-service"; Port = 8080; RelJar = "services\auth-service\target\auth-service-0.0.1-SNAPSHOT.jar" },
    @{ Name = "user-service"; Port = 8081; RelJar = "services\user-service\target\user-service-0.0.1-SNAPSHOT.jar" },
    @{ Name = "booking-service"; Port = 8082; RelJar = "services\booking-service\target\booking-service-0.0.1-SNAPSHOT.jar" },
    @{ Name = "room-service"; Port = 8083; RelJar = "services\room-service\target\room-service-0.0.1-SNAPSHOT.jar" },
    @{ Name = "payment-service"; Port = 8084; RelJar = "services\payment-service\target\payment-service-0.0.1-SNAPSHOT.jar" },
    @{ Name = "api-gateway"; Port = 8088; RelJar = "services\api-gateway\target\api-gateway-0.0.1-SNAPSHOT.jar" }
)

New-Item -ItemType Directory -Force -Path "$baseDir\logs" | Out-Null

$procList = @()

foreach ($s in $services) {
    Write-Host "Starting $($s.Name) on port $($s.Port)..."
    $cmdLine = "/c $java -Xms64m -Xmx192m -jar $($s.RelJar) > logs\$($s.Name).log 2>&1"
    $p = Start-Process "cmd.exe" -ArgumentList $cmdLine -WorkingDirectory $baseDir -NoNewWindow -PassThru
    $procList += $p
    Start-Sleep -Milliseconds 600
}

Write-Host "Starting Frontend HTTP Server on port 5500..."
$cmdLineFront = "/c python -m http.server 5500 --directory frontend > logs\frontend.log 2>&1"
$frontP = Start-Process "cmd.exe" -ArgumentList $cmdLineFront -WorkingDirectory $baseDir -NoNewWindow -PassThru
$procList += $frontP

$pids = @{}
foreach ($p in $procList) {
    $pids["$($p.Id)"] = $p.ProcessName
}
$pids | ConvertTo-Json | Set-Content "$baseDir\running-processes.json"

Write-Host "Waiting for microservices to finish initializing..."
$portsToCheck = @(8080, 8081, 8082, 8083, 8084, 8088, 5500)
$maxWaitSeconds = 50
$startTime = Get-Date

while (((Get-Date) - $startTime).TotalSeconds -lt $maxWaitSeconds) {
    $listening = @()
    foreach ($port in $portsToCheck) {
        $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if ($conn) { $listening += $port }
    }
    if ($listening.Count -ge $portsToCheck.Count) {
        break
    }
    Start-Sleep -Seconds 2
}

Write-Host "=========================================="
Write-Host "STATUS REPORT:"
foreach ($port in $portsToCheck) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    $status = if ($conn) { "[ONLINE] (PID: $($conn[0].OwningProcess))" } else { "[PENDING/OFFLINE]" }
    Write-Host "Port $port : $status"
}
Write-Host "------------------------------------------"
Write-Host "Gateway:  http://localhost:8088"
Write-Host "Frontend: http://localhost:5500"
Write-Host "=========================================="
