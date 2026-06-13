@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

echo.
echo ========================================
echo   QClaw Agent Frontend Launcher
echo ========================================
echo.

:: Step 0: Check Node.js
echo [0/4] Checking Node.js...
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found. Please install Node.js.
    pause
    exit /b 1
)
for /f "tokens=*" %%a in ('node --version') do echo [OK] Node.js %%a

:: Step 1: Check QClaw Gateway
echo [1/4] Checking QClaw Gateway...
openclaw gateway status >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARN] QClaw Gateway might not be running.
) else (
    echo [OK] QClaw Gateway detected
)

:: Step 2: Check dependencies
echo [2/4] Checking dependencies...
cd /d F:\Qclawjob\backend
if not exist node_modules (
    echo [INFO] Installing dependencies...
    call npm install express multer --omit=dev --no-save
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)
echo [OK] Dependencies ready

:: Step 3: Clean old processes
echo [3/4] Cleaning old processes...
for /f "tokens=*" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr LISTENING') do (
    set "line=%%a"
    for %%b in (%%a) do set "lastToken=%%b"
    if defined lastToken (
        echo [INFO] Killing old process PID:!lastToken!
        taskkill /F /PID !lastToken! >nul 2>&1
        timeout /t 1 /nobreak >nul
    )
)

:: Step 4: Start backend
echo [4/4] Starting backend service...

:: Create log file
echo Starting server... > F:\Qclawjob\backend\server.log

:: Start server in a minimized window with log output
start "" /MIN cmd /c "cd /d F:\Qclawjob\backend && node server.js >> F:\Qclawjob\backend\server.log 2>&1"

:: Wait for service
echo [INFO] Waiting for service...
set WAIT_COUNT=0
:WAIT_LOOP
timeout /t 2 /nobreak >nul
set /a WAIT_COUNT+=1
curl.exe -s -o nul http://localhost:3000/api/status 2>nul
if %ERRORLEVEL% EQU 0 goto SERVICE_OK
if %WAIT_COUNT% GEQ 7 goto SERVICE_FAIL
goto WAIT_LOOP

:SERVICE_OK
echo.
echo [OK] Service is running!
curl.exe -s http://localhost:3000/api/status
echo.
echo ========================================
echo     Open: http://localhost:3000
echo ========================================
start http://localhost:3000
goto END

:SERVICE_FAIL
echo.
echo [ERROR] Service failed to start.
echo.
if exist F:\Qclawjob\backend\server.log (
    echo --- Server Log ---
    type F:\Qclawjob\backend\server.log
    echo ------------------
)
echo.
echo Troubleshooting:
echo   1. Check if port 3000 is occupied
echo   2. Run manually: cd F:\Qclawjob\backend ^&^& node server.js

:END
echo.
pause
endlocal