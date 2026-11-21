@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

if not exist "Backend\.venv-ai\Scripts\python.exe" goto :need_install
if not exist "Backend\models\road_damage_yolov8s.pt" goto :need_install

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js 24 LTS was not found. Please install Node.js from https://nodejs.org
  pause
  exit /b 1
)

set "ROAD_MODEL_PATH=%~dp0Backend\models\road_damage_yolov8s.pt"
set "YOLO_CONFIG_DIR=%~dp0Backend\.yolo"

set "LOCAL_IP=127.0.0.1"
for /f "usebackq tokens=*" %%i in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { ($_.InterfaceAlias -match 'Wi-Fi|Wireless|WLAN' -or $_.InterfaceAlias -eq 'Ethernet') -and $_.InterfaceAlias -notmatch 'vEthernet|Virtual|WSL|Host-Only' -and $_.IPAddress -notlike '169.254*' } | Select-Object -ExpandProperty IPAddress -First 1)"`) do set "LOCAL_IP=%%i"

echo =========================================================================
echo  RoadWatch - Native Mobile App (Expo Go Demonstration)
echo =========================================================================
echo.
echo  Checking Backend AI Service on port 8000...
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/health' -TimeoutSec 1 -UseBasicParsing; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  echo  [+] Launching RoadWatch AI Backend in background...
  start "RoadWatch AI Backend" /min cmd /c "set ROAD_MODEL_PATH=%~dp0Backend\models\road_damage_yolov8s.pt& set YOLO_CONFIG_DIR=%~dp0Backend\.yolo& Backend\.venv-ai\Scripts\python.exe -m uvicorn main:app --app-dir Backend --host 0.0.0.0 --port 8000"
  timeout /t 2 /nobreak >nul
) else (
  echo  [v] Backend is already running on port 8000.
)

echo.
echo  -----------------------------------------------------------------------
echo  Instructions for Phone Demonstration:
echo   1. Connect your phone to the same Wi-Fi network as this PC.
echo      (PC IP on Wi-Fi: !LOCAL_IP!)
echo   2. Open "Expo Go" app on your iPhone or Android phone.
echo   3. Scan the QR code below.
echo  -----------------------------------------------------------------------
echo.

cd /d "%~dp0RoadWatch"
if not exist "node_modules" (
  echo Installing mobile dependencies...
  call npm.cmd install
  if errorlevel 1 goto :fail
)

echo Starting Expo Development Server...
call npm.cmd start
pause
exit /b 0

:need_install
echo =========================================================================
echo  [!] First time setup required.
echo  Please run INSTALL_REQUIREMENTS.cmd first to configure AI and dependencies.
echo =========================================================================
pause
exit /b 1

:fail
echo [ERROR] Expo failed to start. Check the error message above.
pause
exit /b 1
