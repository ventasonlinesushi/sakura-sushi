@echo off
title Sakura Sushi - Sistema de Pedidos (Auto-restaurable)
cd /d "%~dp0"

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4" ^| findstr "192.168 10."') do set IP=%%a
set IP=%IP: =%
if "%IP%"=="" set IP=192.168.1.194

cls
echo.
echo   ==========================================
echo      SAKURA SUSHI PASEOS MID
echo      Sistema de Pedidos y POS
echo   ==========================================
echo.
echo     PANEL ADMIN (computadora):
echo     http://localhost:3001/admin/
echo.
echo     MESERO / CAJERA (celular/tablet):
echo     http://%IP%:3001/admin/
echo.
echo     COCINA (KDS):
echo     http://%IP%:3001/admin/cocina.html
echo.
echo   ==========================================
echo     NO CIERRES ESTA VENTANA
echo     Los servicios se reinician automaticamente si fallan
echo   ==========================================
echo.

:loop
echo [%time%] Verificando servicios...

REM 1. Servidor web (puerto 3001)
netstat -ano | findstr ":3001.*LISTENING" >nul
if errorlevel 1 (
    echo [!] Servidor web CAIDO - reiniciando...
    start "Sakura Web" cmd /c "python web_server.py --port 3001"
) else (
    echo [OK] Servidor web (3001)
)

REM 2. Servidor de impresion (puerto 5100)
netstat -ano | findstr ":5100.*LISTENING" >nul
if errorlevel 1 (
    echo [!] Servidor de impresion CAIDO - reiniciando...
    start "Sakura Print" cmd /c "cd /d %~dp0receptor && python print_server.py"
) else (
    echo [OK] Servidor de impresion (5100)
)

REM 3. Receptor de pedidos online
tasklist /FI "WINDOWTITLE eq Sakura Receiver*" 2>nul | findstr "cmd.exe" >nul
if errorlevel 1 (
    echo [!] Receptor de pedidos CAIDO - reiniciando...
    start "Sakura Receiver" cmd /c "cd /d %~dp0receptor && python ordereceiver.py --marca sakura"
) else (
    echo [OK] Receptor de pedidos online
)

echo [%time%] Todos los servicios OK. Proxima verificacion en 15s...
timeout /t 15 /nobreak >nul
goto loop
