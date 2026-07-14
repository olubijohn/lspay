@echo off
title LSPay NFC Wedge
cd /d "%~dp0"
echo ==================================================
echo Starting LSPay NFC Keyboard Wedge...
echo ==================================================
echo.
start NfcKeyboardWedge.exe
echo NFC Keyboard Wedge has been started in the background.
echo You can tap your NFC cards now.
echo.
pause
