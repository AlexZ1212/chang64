@echo off
rem Suite complete de chang64, 6 fichiers de tests a la fois (2026-11-21).
rem Environ 10 minutes au lieu de 46. A lancer hors de Claude (double-clic, ou
rem explorer.exe suite_complete.cmd) : une mise a jour de Claude ne la coupe pas.
rem Le site doit avoir ete construit avant : node build_site.js
rem Journal : %TEMP%\chang64-suite-complete.log (la derniere ligne commence par Fin).
cd /d "%~dp0"
echo Debut %date% %time% > "%TEMP%\chang64-suite-complete.log"
node run_tests.js --ensemble=6 >> "%TEMP%\chang64-suite-complete.log" 2>&1
echo Fin %date% %time% >> "%TEMP%\chang64-suite-complete.log"
