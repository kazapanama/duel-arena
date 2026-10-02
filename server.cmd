@echo off
rem Азерот Арена: сервер у локальній мережі (подвійний клік). Адресу для телефона покаже нижче.
chcp 65001 >nul
cd /d "%~dp0"
node tools\server.js %*
pause
