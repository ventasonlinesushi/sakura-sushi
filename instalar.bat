@echo off
title INSTALADOR - Sistema de Pedidos
cd /d "%~dp0"
cls
echo.
echo   ==========================================
echo      INSTALACION AUTOMATICA
echo   ==========================================
echo.

REM 1. Verificar Python
python --version >nul 2>&1
if errorlevel 1 (
    echo   [ERROR] Python no esta instalado.
    echo   Descargalo de https://python.org
    echo   IMPORTANTE: marca "Add Python to PATH"
    pause
    exit /b
)
echo   [OK] Python detectado

REM 2. Instalar dependencias
echo   Instalando dependencias...
pip install pywin32 -q 2>nul
echo   [OK] Dependencias listas

REM 3. Configurar impresora
echo.
echo   Buscando impresoras...
for /f "delims=" %%i in ('python -c "import win32print; [print(p[2]) for p in win32print.EnumPrinters(2)]" 2^>nul ^| findstr /i "POS YICHIP termica"') do set IMPRESORA=%%i
if "%IMPRESORA%"=="" set IMPRESORA=YICHIP POS-58

echo   Impresora: %IMPRESORA%
cd receptor
python -c "import json; f=open('config.json','r',encoding='utf-8'); c=json.load(f); f.close(); c['impresoras']={'caja':'%IMPRESORA%','cocina':'%IMPRESORA%','sushi':'%IMPRESORA%','bebidas':'%IMPRESORA%','barra':'%IMPRESORA%'}; f=open('config.json','w',encoding='utf-8'); json.dump(c,f,indent=2); f.close()"
cd ..

REM 4. Obtener IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4" ^| findstr "192.168 10."') do set IP=%%a
set IP=%IP: =%
if "%IP%"=="" set IP=192.168.1.194

REM 5. Elegir puerto
set PUERTO=3000
if exist "sakura-card.png" set PUERTO=3001

cls
echo.
echo   ==========================================
echo      SISTEMA INICIADO
echo   ==========================================
echo.
echo     Panel admin (esta PC):
echo     http://localhost:%PUERTO%/admin/
echo.
echo     Celular / Tablet (mismo WiFi):
echo     http://%IP%:%PUERTO%/admin/
echo.
echo     Cocina:
echo     http://%IP%:%PUERTO%/admin/cocina.html
echo.
echo   ==========================================
echo     NO CIERRES ESTA VENTANA
echo   ==========================================
echo.

REM 6. Iniciar servidores
start "Web Server" cmd /c "python -m http.server %PUERTO%"
start "Print Server" cmd /c "cd /d %~dp0receptor && python print_server.py"
for /f "tokens=*" %%m in ('python -c "import json; print(json.load(open('receptor/config.json','r',encoding='utf-8')).get('marcas',{}).get(list(json.load(open('receptor/config.json','r',encoding='utf-8')).get('marcas',{}).keys()[0],{}).get('empresa',''))" 2^>nul') do set MARCA=%%m
if exist "sakura-card.png" (start "Receiver" cmd /c "cd /d %~dp0receptor && python ordereceiver.py --marca sakura") else (start "Receiver" cmd /c "cd /d %~dp0receptor && python ordereceiver.py --marca mandala")
echo.
echo   Servidores activos. Presiona para detener...
pause >nul
taskkill /F /FI "WINDOWTITLE eq Web*" /T 2>nul
taskkill /F /FI "WINDOWTITLE eq Print*" /T 2>nul
taskkill /F /FI "WINDOWTITLE eq Receiver*" /T 2>nul
