@echo off
title Start LSPay NFC Wedge (Background)
cd /d "%~dp0nfc-wedge"

:: Start the executable completely detached in the background
powershell -NoProfile -Command "Start-Process -FilePath '%~dp0nfc-wedge\NfcKeyboardWedge.exe' -WorkingDirectory '%~dp0nfc-wedge'"

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
