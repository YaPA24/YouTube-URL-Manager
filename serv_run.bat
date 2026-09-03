@echo off 
:: ЗАПУСК В НОВОМ ОКНЕ
echo.
CD youtube-url-manager 
:: Передаем рабочую директорию через флаг /d самой команды start
wt -w 1 -d "%cd%" --title "%DIR_NAME% - Локальный сервер" --suppressApplicationTitle cmd /k "python3 -m http.server 8000"
echo [INFO] Запуск программы передана в новое окно.
:end
echo.
echo ============================================
rem pause
