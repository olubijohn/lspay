@echo off
title Start LSPay NFC Wedge (Background)
cd /d "%~dp0"

:: Start the executable completely detached in the background
powershell -NoProfile -Command "Start-Process -FilePath '%~dp0NfcKeyboardWedge.exe' -WorkingDirectory '%~dp0'"

echo ==================================================
echo   LSPay NFC Background Service Started!
echo ==================================================
echo.
echo The NFC reader service is now running silently in the
echo background. You can close this terminal window safely.
echo.
echo Your card scans will work continuously.
echo.
timeout /t 3
exit
