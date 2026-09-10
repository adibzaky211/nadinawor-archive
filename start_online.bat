@echo off
title Nadin Apps - Online HTTPS Server
echo ========================================================
echo   Memulai Server Nadin Apps + Cloudflare HTTPS Tunnel
echo ========================================================
echo.

start "Nadin Node Server" cmd /k "node server.js"
timeout /t 2 >nul
echo Membuka tunnel HTTPS publik...
.\cloudflared.exe tunnel --url http://localhost:3000
pause
