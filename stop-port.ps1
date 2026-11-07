param(
    [Parameter(Mandatory=$false, Position=0, ValueFromRemainingArguments=$true)]
    [string[]]$Targets
)

if (-not $Targets -or $Targets.Count -eq 0) {
    Write-Host "Cú pháp: .\stop-port.bat <Số_Cổng_hoặc_Tên_Service>" -ForegroundColor Yellow
    Write-Host "Ví dụ:   .\stop-port.bat 8083" -ForegroundColor Cyan
    Write-Host "         .\stop-port.bat 8083 8084" -ForegroundColor Cyan
    Write-Host "         .\stop-port.bat room payment" -ForegroundColor Cyan
    exit
}

$baseDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }

$servicePortMap = @{
    "auth"     = 8080
    "user"     = 8081
    "booking"  = 8082
    "room"     = 8083
    "payment"  = 8084
    "gateway"  = 8088
    "frontend" = 5500
}

foreach ($target in $Targets) {
    $port = 0
    if ([int]::TryParse($target, [ref]$port)) {
        # Port number
    } elseif ($servicePortMap.ContainsKey($target.ToLower())) {
        $port = $servicePortMap[$target.ToLower()]
    } else {
        $matched = $servicePortMap.Keys | Where-Object { $_ -like "*$($target.ToLower())*" } | Select-Object -First 1
        if ($matched) {
            $port = $servicePortMap[$matched]
        }
    }

    if ($port -gt 0) {
        $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        if ($conns) {
            $pids = $conns.OwningProcess | Select-Object -Unique
            foreach ($procId in $pids) {
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                Write-Host "[ĐÃ TẮT] Cổng $port (PID: $procId)" -ForegroundColor Green
            }
        } else {
            Write-Host "[THÔNG BÁO] Cổng $port hiện không có tiến trình nào chạy." -ForegroundColor Yellow
        }
    } else {
        Write-Host "[LỖI] Không nhận diện được cổng hoặc service: $target" -ForegroundColor Red
    }
}
