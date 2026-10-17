@echo off
rem Lance les six voies de minage, chacune dans sa fenetre, en priorite basse.
rem Usage : lancer_minage.cmd "C:\chemin\parties.pgn" depart [fenetres par voie]
rem Le depart est le chiffre donne par : node position_minage.js "C:\chemin\parties.pgn"
rem Relancer la meme commande apres une coupure reprend ou on en etait.
rem Fenetres par voie : 4 par defaut. Mesure de la fournee d'essai (18/10) :
rem 0,207 exercice par partie brute, 23 h par fenetre de 100 000. Quatre
rem fenetres x six voies = 2,4 millions de parties, environ 496 000 exercices
rem bruts en quatre jours.
if "%~2"=="" (
  echo Usage : lancer_minage.cmd "C:\chemin\parties.pgn" depart [fenetres par voie]
  exit /b 1
)
set NB=%~3
if "%NB%"=="" set NB=4
cd /d "%~dp0"
for /L %%v in (0,1,5) do start "Minage voie %%v" /low cmd /k node boucle_minage.js "%~1" "%~dp0fournees-minage" %2 %NB% --fenetre=100000 --voies=6 --voie=%%v
echo Six voies lancees, %NB% fenetres chacune. Journaux et fournees dans fournees-minage\
