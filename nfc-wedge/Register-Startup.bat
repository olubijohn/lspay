@echo off
title Register LSPay NFC Wedge on Startup
cd /d "%~dp0"
set "WEDGE_EXE=%~dp0NfcKeyboardWedge.exe"
set "WEDGE_DIR=%~dp0"

echo ==================================================
echo Registering LSPay NFC Wedge on Windows Startup
echo ==================================================
echo.
echo This script registers the NFC wedge utility to run automatically
echo in the background every time this computer starts up.
echo.

if not exist "%WEDGE_EXE%" (
    echo Error: Could not find "%WEDGE_EXE%".
    echo Please make sure the executable is present in this directory.
    pause
    exit /b 1
)

:: Create the startup shortcut using PowerShell
powershell -Command "$WScriptShell = New-Object -ComObject WScript.Shell; $Shortcut = $WScriptShell.CreateShortcut(\"$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\LSPayNfcWedge.lnk\"); $Shortcut.TargetPath = '%WEDGE_EXE%'; $Shortcut.WorkingDirectory = '%WEDGE_DIR%'; $Shortcut.Save()"

echo.
echo NFC Keyboard Wedge has been successfully registered to Windows Startup!
echo It will now run silently in the background every time this PC starts.
echo.
pause
