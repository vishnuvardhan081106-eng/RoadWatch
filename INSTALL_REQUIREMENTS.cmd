@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo =========================================================================
echo  RoadWatch - One-Click Requirements Installer
echo =========================================================================
echo.

echo [1/3] Setting up Python 3.12 AI Backend and PyTorch runtime...
set "PY_CMD="
where py >nul 2>nul
if not errorlevel 1 (
  py -3.12 -c "import sys; exit(0)" >nul 2>nul
  if not errorlevel 1 set "PY_CMD=py -3.12"
)
if "!PY_CMD!"=="" (
  if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    set "PY_CMD=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
  )
)
if "!PY_CMD!"=="" (
  where python >nul 2>nul
  if not errorlevel 1 set "PY_CMD=python"
)

if "!PY_CMD!"=="" (
  echo [ERROR] Python 3.12 was not found. Please install Python 3.12 from python.org
  pause
  exit /b 1
)

echo Using Python: !PY_CMD!
!PY_CMD! Backend\setup_ai.py
if errorlevel 1 (
  echo.
  echo [ERROR] Backend AI setup failed. Please check the error above.
  pause
  exit /b 1
)

echo.
echo [2/3] Setting up Frontend dependencies...
where node >nul 2>nul
if errorlevel 1 (
  echo [!] Node.js was not found in PATH.
  echo     For native mobile demonstration with Expo Go, install Node.js from https://nodejs.org
) else (
  cd RoadWatch
  if not exist "node_modules" (
    echo Installing npm packages...
    call npm.cmd install
  ) else (
    echo Frontend dependencies already installed.
  )
  echo Building production web distribution...
  call npm.cmd run build:web
  cd ..
)

echo.
echo [3/3] Verifying trained road damage detector...
if exist "Backend\.venv-ai\Scripts\python.exe" (
  Backend\.venv-ai\Scripts\python.exe Backend\setup_ai.py --verify
)

echo.
echo =========================================================================
echo  Setup Completed Successfully!
echo =========================================================================
echo.
echo  You can now start the application:
echo   - To run in Web Browser:   Double-click START_WEB.cmd
echo   - To run on Mobile Phone:  Double-click START_MOBILE.cmd
echo.
echo  (Optional) Place your Gemini API key in Backend\.env for AI vision.
echo =========================================================================
echo.
pause
