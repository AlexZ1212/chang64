@echo off
setlocal enabledelayedexpansion
cd /d "C:\Users\Alexandre Callot\Desktop\Chang64"

echo ============================================
echo   Mise a jour chang64.com
echo ============================================
echo.

if not exist chang64-site.zip (
  echo ERREUR : chang64-site.zip introuvable dans ce dossier.
  goto :end
)
if not exist chang64-sources.zip (
  echo ERREUR : chang64-sources.zip introuvable dans ce dossier.
  goto :end
)

echo Verification de l'identite git :
git config user.name
git config user.email
echo (doit afficher AlexZ1212)
echo.

set /p CONFIRM1="Supprimer les anciens dossiers chang64-site\ et src\ puis extraire les nouvelles archives ? (o/n) "
if /i not "%CONFIRM1%"=="o" goto :end

echo.
echo === Suppression des anciens dossiers ===
if exist chang64-site rmdir /s /q chang64-site
if exist src rmdir /s /q src

echo === Extraction de chang64-site.zip ===
powershell -NoProfile -Command "Expand-Archive -Path 'chang64-site.zip' -DestinationPath '.' -Force"

echo === Extraction de chang64-sources.zip ===
powershell -NoProfile -Command "Expand-Archive -Path 'chang64-sources.zip' -DestinationPath '.' -Force"

if not exist chang64-site (
  echo ERREUR : l'extraction de chang64-site.zip n'a pas produit de dossier chang64-site\
  goto :end
)
if not exist src (
  echo ERREUR : l'extraction de chang64-sources.zip n'a pas produit de dossier src\
  goto :end
)

echo.
echo === Etat git (fichiers modifies/ajoutes/supprimes) ===
git add -A
git status --short
echo.
echo Nombre de suppressions detectees par git :
git status --short | find /c "D "
echo.

set /p CONFIRM2="Verifie la liste ci-dessus. Creer le commit et le pousser sur origin/main ? (o/n) "
if /i not "%CONFIRM2%"=="o" (
  echo.
  echo Rien pousse. Les fichiers sont en place et ajoutes a l'index git.
  echo Pour annuler : git reset
  goto :end
)

git commit -m "Reconstruction complete : nouveau jeu de pieces, mode de couleur Au hasard, animation des deplacements, Chang Sprint deplace dans Defis, pieces capturees recadrees, SEO/securite (CSP, HSTS, canonical, hreflang), accessibilite (landmarks, skip link, contrastes), verdict d'analyse reformule"
git push origin main

echo.
echo === Termine. Verifier le site en ligne puis PageSpeed Insights. ===

:end
echo.
pause
