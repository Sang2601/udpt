$baseDir = $PSScriptRoot

if (Test-Path "$baseDir\running-processes.json") {
    $pids = Get-Content "$baseDir\running-processes.json" | ConvertFrom-Json
    foreach ($prop in $pids.PSObject.Properties) {
        $procId = 0
        if ([int]::TryParse($prop.Name, [ref]$procId)) {
            # Stop children first
            Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $procId } | ForEach-Object {
                Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
            }
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        } elseif ([int]::TryParse($prop.Value, [ref]$procId)) {
            Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $procId } | ForEach-Object {
                Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
            }
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        }
    }
    Remove-Item "$baseDir\running-processes.json" -Force -ErrorAction SilentlyContinue
}

$ports = @(8080, 8081, 8082, 8083, 8084, 8088, 5500)
foreach ($p in $ports) {
    $conns = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue
    if ($conns) {
        $conns.OwningProcess | Select-Object -Unique | ForEach-Object {
            Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
        }
    }
}
Write-Host "All services stopped."
