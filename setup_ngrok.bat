@echo off
setlocal enabledelayedexpansion

REM Read PORT from .env
for /f "tokens=1,2 delims==" %%a in ('findstr /r "^PORT=" .env') do (
    if "%%a"=="PORT" set PORT=%%b
)

REM Open ngrok in a new terminal window
start cmd /k "ngrok http --host-header=rewrite !PORT!"

REM Wait 3 seconds
timeout /t 3 /nobreak >nul

REM Run npm sync-ngrok
npm run sync-ngrok

endlocal