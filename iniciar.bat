@echo off
title Pernambucana - Iniciando Sistema...
echo ========================================================
echo   PERNAMBUCANA - PORTAL FINANCEIRO
echo ========================================================
echo.
echo [1/3] Verificando e instalando dependencias (npm install)...
call npm install
echo.
echo [2/3] Abrindo o navegador em http://localhost:5173...
start http://localhost:5173
echo.
echo [3/3] Iniciando o servidor de desenvolvimento (npm run dev)...
echo Pressione Ctrl+C na janela do terminal para encerrar o servidor.
echo --------------------------------------------------------
call npm run dev
pause
