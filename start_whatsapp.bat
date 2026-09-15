@echo off
set PUPPETEER_SKIP_DOWNLOAD=true
echo ==========================================
echo Fixing Chrome Download Issue...
echo Please wait while we install requirements.
echo ==========================================
call npm install whatsapp-web.js qrcode-terminal axios
echo.
echo ==========================================
echo Starting WhatsApp...
echo Please scan the QR Code with your phone.
echo ==========================================
node index.js
pause
