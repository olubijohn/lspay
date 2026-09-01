@echo off
title LSPay NFC Wedge - Windows One-Time Setup
cd /d "%~dp0"

echo.
echo ==============================================
echo   LSPay NFC Wedge - Windows One-Time Setup
echo ==============================================
echo.
echo Run this ONCE. The wedge will auto-start on every login.
echo.

:: ── Check Python ──────────────────────────────────────────
where python >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed.
    echo Install from: https://www.python.org/downloads/
    echo Make sure to tick "Add Python to PATH" during install.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('python --version') do echo Found: %%v

:: ── Install packages ──────────────────────────────────────
echo.
echo Installing Python packages (pyscard, pyautogui)...
python -m pip install --quiet pyscard pyautogui
echo Packages installed.

:: ── Create a hidden VBS launcher (no console window) ──────
set "WEDGE_PY=%~dp0nfc_wedge.py"
set "LAUNCHER=%~dp0nfc_wedge_launcher.vbs"
set "LOG_FILE=%~dp0nfc-wedge-log.txt"

echo Set oShell = CreateObject("WScript.Shell") > "%LAUNCHER%"
echo oShell.Run "python ""%WEDGE_PY%""", 0, False >> "%LAUNCHER%"

echo Launcher created: %LAUNCHER%

:: ── Register in Windows Startup folder ────────────────────
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT=%STARTUP%\LSPayNfcWedge.lnk"

powershell -NoProfile -Command ^
  "$s = New-Object -ComObject WScript.Shell; ^
   $sc = $s.CreateShortcut('%SHORTCUT%'); ^
   $sc.TargetPath = '%LAUNCHER%'; ^
   $sc.WorkingDirectory = '%~dp0'; ^
   $sc.Description = 'LSPay NFC Keyboard Wedge'; ^
   $sc.Save()"

echo Registered in Startup folder: %STARTUP%

:: ── Start immediately (no reboot needed) ──────────────────
echo.
echo Starting NFC wedge now...
start "" "%LAUNCHER%"

echo.
echo ==============================================
echo   Setup complete!
echo ==============================================
echo.
echo   The NFC wedge is now running silently.
echo   It will auto-start on every login - no action needed.
echo.
echo   To check it is running:
echo     Open Task Manager - look for "python" process
echo.
echo   To uninstall:
echo     Delete: %SHORTCUT%
echo     Then restart your PC.
echo.
pause
