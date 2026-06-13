# QClaw Agent Frontend - Quick Start Script
# Run from QClaw: cd F:\Qclawjob; .\start-server.ps1

param(
    [string]$Action = "start"
)

$ErrorActionPreference = "Stop"
$backendDir = "F:\Qclawjob\backend"
$pidFile = "F:\Qclawjob\.server.pid"

function Get-ServerPid {
    if (Test-Path $pidFile) {
        $serverPid = Get-Content $pidFile -Raw
        if ($serverPid -and (Get-Process -Id $serverPid -ErrorAction SilentlyContinue)) {
            return [int]$serverPid
        }
    }
    # Fallback: check port 3000
    $conn = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) {
        return $conn.OwningProcess
    }
    return $null
}

function Start-Server {
    $existingPid = Get-ServerPid
    if ($existingPid) {
        Write-Host "✓ Server already running (PID $existingPid)" -ForegroundColor Green
        Write-Host "  URL: http://localhost:3000" -ForegroundColor Cyan
        return
    }

    Write-Host "Starting QClaw Agent Frontend server..." -ForegroundColor Yellow

    # Kill any process on port 3000
    $conn = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
    if ($conn) {
        Write-Host "Cleaning old process on port 3000 (PID $($conn.OwningProcess))..." -ForegroundColor DarkYellow
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    }

    # Start server
    $logFile = "$backendDir\server.log"
    "Server started at $(Get-Date)" | Out-File $logFile

    $proc = Start-Process -FilePath "node" -ArgumentList "server.js" `
        -WorkingDirectory $backendDir `
        -WindowStyle Hidden `
        -PassThru

    $proc.Id | Out-File $pidFile

    # Wait for ready
    Write-Host "Waiting for service..." -ForegroundColor DarkGray
    $maxWait = 15
    $waited = 0
    while ($waited -lt $maxWait) {
        Start-Sleep -Seconds 1
        $waited++
        try {
            $resp = Invoke-WebRequest -Uri "http://localhost:3000/api/status" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            $status = $resp.Content | ConvertFrom-Json
            Write-Host "✓ Server ready!" -ForegroundColor Green
            Write-Host "  Gateway: $($status.gateway)" -ForegroundColor Gray
            Write-Host "  Default Agent: $($status.defaultAgent)" -ForegroundColor Gray
            Write-Host "  URL: http://localhost:3000" -ForegroundColor Cyan
            return
        } catch {
            Write-Host "  ($waited/$maxWait) ..." -ForegroundColor DarkGray -NoNewline
            Write-Host ""
        }
    }

    Write-Host "✗ Server failed to start within ${maxWait}s" -ForegroundColor Red
    Write-Host "Check log: $logFile" -ForegroundColor Red
}

function Stop-Server {
    $serverPid = Get-ServerPid
    if (-not $serverPid) {
        Write-Host "Server is not running" -ForegroundColor Yellow
        return
    }

    Write-Host "Stopping server (PID $serverPid)..." -ForegroundColor Yellow
    Stop-Process -Id $serverPid -Force -ErrorAction SilentlyContinue
    Remove-Item $pidFile -ErrorAction SilentlyContinue
    Write-Host "✓ Server stopped" -ForegroundColor Green
}

function Show-Status {
    $serverPid = Get-ServerPid
    if ($serverPid) {
        Write-Host "✓ Server is running (PID $serverPid)" -ForegroundColor Green
        try {
            $resp = Invoke-WebRequest -Uri "http://localhost:3000/api/status" -UseBasicParsing -TimeoutSec 3
            $status = $resp.Content | ConvertFrom-Json
            Write-Host "  Gateway: $($status.gateway)" -ForegroundColor Gray
            Write-Host "  Default Agent: $($status.defaultAgent)" -ForegroundColor Gray
        } catch {
            Write-Host "  Status check failed" -ForegroundColor Red
        }
        Write-Host "  URL: http://localhost:3000" -ForegroundColor Cyan
    } else {
        Write-Host "✗ Server is not running" -ForegroundColor Red
    }
}

# Main
switch ($Action.ToLower()) {
    "start" { Start-Server }
    "stop" { Stop-Server }
    "restart" { Stop-Server; Start-Sleep -Seconds 2; Start-Server }
    "status" { Show-Status }
    default {
        Write-Host "Usage: .\start-server.ps1 [start|stop|restart|status]" -ForegroundColor Cyan
        Show-Status
    }
}
