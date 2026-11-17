-- chang64 - tables du compte (2026-11-16)
-- A executer UNE fois dans la console D1 de la base liee au projet sous le
-- nom DB (Cloudflare > Stockage et bases de donnees > D1 > la base > Console).
-- Coller tout le fichier, ou une instruction a la fois si la console le veut.
-- Rien ici ne touche la table resultats.
--
-- Ce qui est garde : un pseudo, un code hache, un code de secours hache, la
-- progression, des dates. Ni adresse IP, ni e-mail, ni nom.

CREATE TABLE IF NOT EXISTS comptes (
  id INTEGER PRIMARY KEY,
  -- cle : le pseudo ramene a une forme unique (minuscules, sans accents,
  -- lettres cyrilliques sosies ramenees au latin) ; pseudo : tel qu'affiche.
  cle TEXT NOT NULL UNIQUE,
  pseudo TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  secours_hash TEXT NOT NULL,
  cree INTEGER NOT NULL,
  vu INTEGER NOT NULL,
  echecs INTEGER NOT NULL DEFAULT 0,
  bloque_jusqu INTEGER NOT NULL DEFAULT 0,
  donnees TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  -- Chiffres du classement, tires de la progression a chaque synchronisation.
  note INTEGER NOT NULL DEFAULT 800,
  resolus INTEGER NOT NULL DEFAULT 0,
  serie INTEGER NOT NULL DEFAULT 0,
  badges INTEGER NOT NULL DEFAULT 0,
  sprint INTEGER NOT NULL DEFAULT 0,
  sem TEXT NOT NULL DEFAULT '',
  sem_resolus INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS comptes_vu ON comptes (vu);
CREATE INDEX IF NOT EXISTS comptes_cree ON comptes (cree);
CREATE INDEX IF NOT EXISTS comptes_note ON comptes (note DESC);
CREATE INDEX IF NOT EXISTS comptes_resolus ON comptes (resolus DESC);
CREATE INDEX IF NOT EXISTS comptes_sem ON comptes (sem, sem_resolus DESC);

-- Sessions : le jeton n'est jamais garde en clair, seulement son empreinte.
CREATE TABLE IF NOT EXISTS jetons (
  hash TEXT PRIMARY KEY,
  compte_id INTEGER NOT NULL,
  cree INTEGER NOT NULL,
  vu INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS jetons_compte ON jetons (compte_id);

-- Ajout d'un appareil : un seul code en cours par compte, 10 minutes,
-- 5 essais au plus.
CREATE TABLE IF NOT EXISTS liens_appareil (
  compte_id INTEGER PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expire INTEGER NOT NULL,
  essais INTEGER NOT NULL DEFAULT 0
);

-- Defis entre membres (2026-11-17) : cinq exercices, le resultat de l'auteur,
-- puis celui du destinataire. Aucun texte libre. Effaces apres 60 jours, ou
-- avec le compte de l'un des deux.
CREATE TABLE IF NOT EXISTS defis (
  id INTEGER PRIMARY KEY,
  de INTEGER NOT NULL,
  a INTEGER NOT NULL,
  exos TEXT NOT NULL,
  r1 TEXT NOT NULL,
  t1 INTEGER NOT NULL,
  r2 TEXT,
  t2 INTEGER,
  cree INTEGER NOT NULL,
  repondu INTEGER
);
CREATE INDEX IF NOT EXISTS defis_a ON defis (a, cree);
CREATE INDEX IF NOT EXISTS defis_de ON defis (de, cree);

-- Mini-enquetes de satisfaction (2026-11-17) : une question, une note de 1 a
-- 5, un commentaire facultatif (500 caracteres au plus). Une reponse au plus
-- par compte tous les 25 jours. Effacees avec le compte.
CREATE TABLE IF NOT EXISTS enquetes (
  id INTEGER PRIMARY KEY,
  compte_id INTEGER NOT NULL,
  question TEXT NOT NULL,
  note INTEGER NOT NULL,
  commentaire TEXT,
  langue TEXT,
  cree INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS enquetes_compte ON enquetes (compte_id, cree);
CREATE INDEX IF NOT EXISTS enquetes_question ON enquetes (question, cree);

-- Pour lire les reponses, dans la console D1 :
--   moyenne et nombre de reponses par question :
--     SELECT question, ROUND(AVG(note), 2) AS moyenne, COUNT(*) AS reponses FROM enquetes GROUP BY question;
--   les commentaires, du plus recent au plus ancien :
--     SELECT datetime(e.cree / 1000, 'unixepoch') AS quand, c.pseudo, e.question, e.note, e.langue, e.commentaire
--     FROM enquetes e JOIN comptes c ON c.id = e.compte_id WHERE e.commentaire IS NOT NULL ORDER BY e.cree DESC LIMIT 50;
