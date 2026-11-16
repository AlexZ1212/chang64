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
