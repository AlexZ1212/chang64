@echo off
rem Cherche les fichiers PGN de plus de 200 Mo sur tous les disques. Ecrit le resultat dans trouver_pgn.txt
cd /d "%~dp0"
echo Recherche des gros fichiers PGN, patiente... 
powershell -NoProfile -Command "$r = foreach($d in (Get-PSDrive -PSProvider FileSystem)){ Get-ChildItem -Path $d.Root -Recurse -File -Include *.pgn,*.pgn.zst -ErrorAction SilentlyContinue | Where-Object { $_.Length -gt 200MB } }; if($r){ $r | ForEach-Object { \"{0}`t{1:N1} Go\" -f $_.FullName, ($_.Length/1GB) } } else { \"AUCUN\" }" > trouver_pgn.txt 2>&1
echo FIN>> trouver_pgn.txt
echo Termine. Tu peux fermer cette fenetre.
