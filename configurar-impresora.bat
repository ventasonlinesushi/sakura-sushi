@echo off
title Configurar impresora
cd /d "%~dp0receptor"

echo.
echo   ==========================================
echo      CONFIGURACION DE IMPRESORA
echo   ==========================================
echo.
echo   Impresoras disponibles en esta PC:
echo.

python -c "import win32print; [print('    ', p[2]) for p in win32print.EnumPrinters(2)]"

echo.
echo   ==========================================
echo.
echo   Copia el nombre EXACTO de tu impresora termica
echo   (normalmente "YICHIP POS-58" o similar)
echo.
set /p IMP="Nombre de la impresora: "

python -c "import json; f=open('config.json','r',encoding='utf-8'); c=json.load(f); f.close(); c['impresoras']={'caja':'%IMP%','cocina':'%IMP%','sushi':'%IMP%','bebidas':'%IMP%','barra':'%IMP%'}; f=open('config.json','w',encoding='utf-8'); json.dump(c,f,indent=2); f.close(); print('IMPRESORA CONFIGURADA: %IMP%')"

echo.
echo   Probando impresion...
python -c "import printer; printer.imprimir_prueba('%IMP%'); print('Ticket de prueba enviado.')"

echo.
echo   Si salio el ticket, la impresora quedo lista.
pause
