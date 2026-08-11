@echo off
chcp 65001 >nul
title Admin Sakura - Servidor local
cd /d "%~dp0"
echo.
echo  Servidor del admin corriendo en:
echo    http://localhost:3000/admin/
echo.
echo  NO cierres esta ventana.
echo.
python -m http.server 3000 --bind 0.0.0.0
pause
