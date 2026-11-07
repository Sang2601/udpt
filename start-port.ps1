param(
    [Parameter(Mandatory=$false, Position=0, ValueFromRemainingArguments=$true)]
    [string[]]$Targets
)

if (-not $Targets -or $Targets.Count -eq 0) {
    Write-Host "Cú pháp: .\start-port.bat <Số_Cổng_hoặc_Tên_Service>" -ForegroundColor Yellow
    Write-Host "Ví dụ:   .\start-port.bat 8083" -ForegroundColor Cyan
    Write-Host "         .\start-port.bat room" -ForegroundColor Cyan
    exit
}

$java = "C:\Users\duysa\.jdks\openjdk-27\bin\java.exe"
$baseDir = $PSScriptRoot

$services = @{
    8080 = @{ Name = "auth-service"; Jar = "services\auth-service\target\auth-service-0.0.1-SNAPSHOT.jar" }
    8081 = @{ Name = "user-service"; Jar = "services\user-service\target\user-service-0.0.1-SNAPSHOT.jar" }
    8082 = @{ Name = "booking-service"; Jar = "services\booking-service\target\booking-service-0.0.1-SNAPSHOT.jar" }
    8083 = @{ Name = "room-service"; Jar = "services\room-service\target\room-service-0.0.1-SNAPSHOT.jar" }
    8084 = @{ Name = "payment-service"; Jar = "services\payment-service\target\payment-service-0.0.1-SNAPSHOT.jar" }
    8088 = @{ Name = "api-gateway"; Jar = "services\api-gateway\target\api-gateway-0.0.1-SNAPSHOT.jar" }
    5500 = @{ Name = "frontend"; Jar = "" }
}

$nameToPort = @{
    "auth" = 8080; "user" = 8081; "booking" = 8082; "room" = 8083; "payment" = 8084; "gateway" = 8088; "frontend" = 5500
}

foreach ($target in $Targets) {
    $port = 0
    if ([int]::TryParse($target, [ref]$port)) {
        # port
    } elseif ($nameToPort.ContainsKey($target.ToLower())) {
        $port = $nameToPort[$target.ToLower()]
    } else {
        $matched = $nameToPort.Keys | Where-Object { $_ -like "*$($target.ToLower())*" } | Select-Object -First 1
        if ($matched) { $port = $nameToPort[$matched] }
    }

    if ($port -and $services.ContainsKey($port)) {
        $s = $services[$port]
        $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if ($conn) {
            Write-Host "[THÔNG BÁO] $($s.Name) (Cổng $port) ĐANG CHẠY RỒI (PID: $($conn[0].OwningProcess))." -ForegroundColor Yellow
            continue
        }

        Write-Host "Đang bật lại $($s.Name) trên cổng $port..." -ForegroundColor Cyan
        if ($port -eq 5500) {
            $cmd = "/c python -m http.server 5500 --directory frontend > logs\frontend.log 2>&1"
            Start-Process "cmd.exe" -ArgumentList $cmd -WorkingDirectory $baseDir -NoNewWindow
        } else {
            $cmd = "/c $java -Xms64m -Xmx192m -jar $($s.Jar) > logs\$($s.Name).log 2>&1"
            Start-Process "cmd.exe" -ArgumentList $cmd -WorkingDirectory $baseDir -NoNewWindow
        }
        Write-Host "[ĐÃ KHỞI CHẠY] $($s.Name) trên cổng $port. Đang khởi tạo trong nền..." -ForegroundColor Green
    } else {
        Write-Host "[LỖI] Không tìm thấy service cho: $target" -ForegroundColor Red
    }
}
