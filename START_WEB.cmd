@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

if not exist "Backend\.venv-ai\Scripts\python.exe" goto :need_install
if not exist "Backend\models\road_damage_yolov8s.pt" goto :need_install

set "ROAD_MODEL_PATH=%~dp0Backend\models\road_damage_yolov8s.pt"
set "YOLO_CONFIG_DIR=%~dp0Backend\.yolo"

set "LOCAL_IP=127.0.0.1"
for /f "usebackq tokens=*" %%i in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { ($_.InterfaceAlias -match 'Wi-Fi|Wireless|WLAN' -or $_.InterfaceAlias -eq 'Ethernet') -and $_.InterfaceAlias -notmatch 'vEthernet|Virtual|WSL|Host-Only' -and $_.IPAddress -notlike '169.254*' } | Select-Object -ExpandProperty IPAddress -First 1)"`) do set "LOCAL_IP=%%i"

echo =========================================================================
echo  RoadWatch - Web Project Server
echo =========================================================================
echo.
echo  [1] PC Browser:            http://localhost:8000
echo  [2] Mobile Phone on Wi-Fi:   http://!LOCAL_IP!:8000
echo.
echo  Opening http://localhost:8000 in your browser...
echo  Keep this window open while using the application. Press Ctrl+C to stop.
echo =========================================================================
echo.

start http://localhost:8000

Backend\.venv-ai\Scripts\python.exe -m uvicorn main:app --app-dir Backend --host 0.0.0.0 --port 8000
if errorlevel 1 goto :fail
exit /b 0

:need_install
echo =========================================================================
echo  [!] First time setup required.
echo  Please run INSTALL_REQUIREMENTS.cmd first to configure AI and dependencies.
echo =========================================================================
pause
exit /b 1

:fail
echo.
echo [ERROR] Web server stopped unexpectedly.
pause
exit /b 1
