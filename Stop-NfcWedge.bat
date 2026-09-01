@echo off
title Stop LSPay NFC Wedge
echo Stopping LSPay NFC Background Service...
powershell -NoProfile -Command "Stop-Process -Name 'NfcKeyboardWedge' -Force -ErrorAction SilentlyContinue"
echo.
echo NFC Background Service has been stopped.
echo.
timeout /t 3
exit
