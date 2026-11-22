@echo off
rem Controle du coach de relecture sur 600 parties (4 fenetres de 150), hors de Claude.
rem Lancer par explorer.exe. Journaux : %TEMP%\coach-controle-1.log a -4.log (derniere ligne : "termine").
rem Bilan ensuite : node coach_controle.js --bilan
cd /d "%~dp0"
del /q coach-controle-*.jsonl 2>nul
for %%i in (1 2 3 4) do (
  start "coach %%i" /min cmd /c "node coach_controle.js --jouer --part=%%i/4 --parties=150 > "%TEMP%\coach-controle-%%i.log" 2>&1"
  timeout /t 3 /nobreak >nul
)
