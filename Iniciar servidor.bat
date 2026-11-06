@echo off
rem Sirve esta carpeta en http://localhost:8080 para que varias personas de la red usen la plataforma.
rem Necesita Python instalado. Cierra esta ventana para detener el servidor.
cd /d "%~dp0"
echo.
echo  Pagos a contratistas - servidor en http://localhost:8080
echo  Otras personas de la red: http://%COMPUTERNAME%:8080
echo.
python -m http.server 8080 --bind 0.0.0.0
pause
