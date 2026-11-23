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
  sem_resolus INTEGER NOT NULL DEFAULT 0,
  -- Date du dernier changement de pseudo (un par semaine au plus).
  pseudo_change INTEGER NOT NULL DEFAULT 0,
  -- Pays choisi par le joueur pour sa fiche (code a deux lettres), vide = non montre.
  pays TEXT NOT NULL DEFAULT '',
  -- Parties en direct gagnees, nulles, perdues (2026-11-19) : comptees par le
  -- Worker des parties a la fin de chaque partie, pas par le navigateur.
  direct_v INTEGER NOT NULL DEFAULT 0,
  direct_n INTEGER NOT NULL DEFAULT 0,
  direct_d INTEGER NOT NULL DEFAULT 0,
  -- Elo entre membres (2026-11-21) : calcule par le Worker des parties a la fin
  -- de chaque partie en direct, jamais par le navigateur. elo = 0 tant qu'aucune
  -- partie n'a compte ; elo_n = nombre de parties comptees.
  elo INTEGER NOT NULL DEFAULT 0,
  elo_n INTEGER NOT NULL DEFAULT 0,
  -- Un Elo par famille de cadences (decision d'Alexandre du 2026-11-21 au
  -- soir) : elo et elo_n ci-dessus sont desormais l'Elo RAPIDE (10 min, 5+3,
  -- 15+10) ; s'y ajoutent le Blitz (3+2), le Classique (30 min, 30+20, 60 min)
  -- et la Correspondance (1, 3, 7 jours par coup). Meme regle : 0 tant
  -- qu'aucune partie de la famille n'a compte, _n = nombre de parties comptees.
  -- Un nouvel Elo part de l'Elo Rapide du joueur quand il en a un.
  elo_blitz INTEGER NOT NULL DEFAULT 0,
  elo_blitz_n INTEGER NOT NULL DEFAULT 0,
  elo_classique INTEGER NOT NULL DEFAULT 0,
  elo_classique_n INTEGER NOT NULL DEFAULT 0,
  elo_corr INTEGER NOT NULL DEFAULT 0,
  elo_corr_n INTEGER NOT NULL DEFAULT 0,
  -- Parties gagnees, nulles, perdues par famille de cadences (2026-11-23, SQL
  -- accepte par Alexandre) : b = Blitz, r = Rapide, c = Classique,
  -- k = Correspondance ; v = gagnees, n = nulles, d = perdues. Comptees par le
  -- Worker des parties dans la meme ecriture que le total (direct_v, direct_n,
  -- direct_d). Elles partent de zero : les parties jouees avant restent dans
  -- le total, sans famille.
  direct_b_v INTEGER NOT NULL DEFAULT 0,
  direct_b_n INTEGER NOT NULL DEFAULT 0,
  direct_b_d INTEGER NOT NULL DEFAULT 0,
  direct_r_v INTEGER NOT NULL DEFAULT 0,
  direct_r_n INTEGER NOT NULL DEFAULT 0,
  direct_r_d INTEGER NOT NULL DEFAULT 0,
  direct_c_v INTEGER NOT NULL DEFAULT 0,
  direct_c_n INTEGER NOT NULL DEFAULT 0,
  direct_c_d INTEGER NOT NULL DEFAULT 0,
  direct_k_v INTEGER NOT NULL DEFAULT 0,
  direct_k_n INTEGER NOT NULL DEFAULT 0,
  direct_k_d INTEGER NOT NULL DEFAULT 0
);
-- Base creee avant les resultats par famille (2026-11-23, SQL accepte par
-- Alexandre) : les colonnes s'ajoutent par
--   ALTER TABLE comptes ADD COLUMN direct_b_v INTEGER NOT NULL DEFAULT 0;
--   ALTER TABLE comptes ADD COLUMN direct_b_n INTEGER NOT NULL DEFAULT 0;
--   ALTER TABLE comptes ADD COLUMN direct_b_d INTEGER NOT NULL DEFAULT 0;
--   ALTER TABLE comptes ADD COLUMN direct_r_v INTEGER NOT NULL DEFAULT 0;
--   ALTER TABLE comptes ADD COLUMN direct_r_n INTEGER NOT NULL DEFAULT 0;
--   ALTER TABLE comptes ADD COLUMN direct_r_d INTEGER NOT NULL DEFAULT 0;
--   ALTER TABLE comptes ADD COLUMN direct_c_v INTEGER NOT NULL DEFAULT 0;
--   ALTER TABLE comptes ADD COLUMN direct_c_n INTEGER NOT NULL DEFAULT 0;
--   ALTER TABLE comptes ADD COLUMN direct_c_d INTEGER NOT NULL DEFAULT 0;
--   ALTER TABLE comptes ADD COLUMN direct_k_v INTEGER NOT NULL DEFAULT 0;
--   ALTER TABLE comptes ADD COLUMN direct_k_n INTEGER NOT NULL DEFAULT 0;
--   ALTER TABLE comptes ADD COLUMN direct_k_d INTEGER NOT NULL DEFAULT 0;
-- Base creee avant l'Elo par famille (2026-11-21 au soir, SQL accepte par
-- Alexandre) : les colonnes s'ajoutent par
--   ALTER TABLE comptes ADD COLUMN elo_blitz INTEGER NOT NULL DEFAULT 0;
--   ALTER TABLE comptes ADD COLUMN elo_blitz_n INTEGER NOT NULL DEFAULT 0;
--   ALTER TABLE comptes ADD COLUMN elo_classique INTEGER NOT NULL DEFAULT 0;
--   ALTER TABLE comptes ADD COLUMN elo_classique_n INTEGER NOT NULL DEFAULT 0;
--   ALTER TABLE comptes ADD COLUMN elo_corr INTEGER NOT NULL DEFAULT 0;
--   ALTER TABLE comptes ADD COLUMN elo_corr_n INTEGER NOT NULL DEFAULT 0;
-- Base creee avant le 2026-11-21 : les colonnes s'ajoutent par
--   ALTER TABLE comptes ADD COLUMN elo INTEGER NOT NULL DEFAULT 0;
--   ALTER TABLE comptes ADD COLUMN elo_n INTEGER NOT NULL DEFAULT 0;
-- Base creee avant le 2026-11-19 : les colonnes s'ajoutent par
--   ALTER TABLE comptes ADD COLUMN direct_v INTEGER NOT NULL DEFAULT 0;
--   ALTER TABLE comptes ADD COLUMN direct_n INTEGER NOT NULL DEFAULT 0;
--   ALTER TABLE comptes ADD COLUMN direct_d INTEGER NOT NULL DEFAULT 0;
-- Base creee avant le 2026-11-18 : la colonne s'ajoute par
--   ALTER TABLE comptes ADD COLUMN pays TEXT NOT NULL DEFAULT '';
-- Base creee avant le 2026-11-17 : la colonne s'ajoute par
--   ALTER TABLE comptes ADD COLUMN pseudo_change INTEGER NOT NULL DEFAULT 0;
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

-- Joueurs dont on ne veut plus recevoir de defis (2026-11-17).
CREATE TABLE IF NOT EXISTS blocages (
  compte_id INTEGER NOT NULL,
  bloque_id INTEGER NOT NULL,
  cree INTEGER NOT NULL,
  PRIMARY KEY (compte_id, bloque_id)
);

-- Creations de compte par connexion (2026-11-18) : un compteur par jour et
-- par empreinte brouillee de l'adresse reseau (l'adresse elle-meme n'est pas
-- gardee et ne peut pas etre retrouvee). 20 creations au plus par jour et par
-- connexion. Les lignes des jours passes sont effacees. Lie a aucun compte.
CREATE TABLE IF NOT EXISTS creations (
  empreinte TEXT NOT NULL,
  jour TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (empreinte, jour)
);

-- Amis (2026-11-18) : la liste des joueurs qu'un membre a ajoutes a ses amis.
-- Sans demande ni acceptation : personne n'est prevenu, et la liste n'est
-- visible que de son proprietaire. 100 amis au plus par compte. Effacee avec
-- le compte de l'un ou de l'autre.
CREATE TABLE IF NOT EXISTS amis (
  compte_id INTEGER NOT NULL,
  ami_id INTEGER NOT NULL,
  cree INTEGER NOT NULL,
  PRIMARY KEY (compte_id, ami_id)
);
CREATE INDEX IF NOT EXISTS amis_ami ON amis (ami_id);

-- Demandes d'amis (2026-11-19) : « Ajouter » envoie une demande, que l'autre
-- accepte ou refuse. Effacee a la reponse, au bout de 60 jours, ou avec le
-- compte de l'un ou de l'autre. 30 demandes en attente au plus par compte.
CREATE TABLE IF NOT EXISTS demandes_amis (
  de INTEGER NOT NULL,
  a INTEGER NOT NULL,
  cree INTEGER NOT NULL,
  PRIMARY KEY (de, a)
);
CREATE INDEX IF NOT EXISTS demandes_amis_a ON demandes_amis (a, cree);

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

-- Ligues (2026-11-18) : cinq ligues, de 0 (Pion) a 4 (Dame). Une ligne par
-- membre : sa ligue, son groupe de la semaine (-1 = pas encore range), ses
-- exercices reussis dans la semaine, et s'il vient de monter (1) ou de
-- descendre (-1). Rien de nouveau sur le joueur : le pseudo et les exercices
-- de la semaine sont deja publics. Effacee avec le compte.
CREATE TABLE IF NOT EXISTS ligues (
  compte_id INTEGER PRIMARY KEY,
  sem TEXT NOT NULL,
  ligue INTEGER NOT NULL DEFAULT 0,
  groupe INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  mouv INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ligues_groupe ON ligues (sem, ligue, groupe);

-- Une ligne par semaine : le changement de semaine a ete fait (ouvert = -1
-- pendant le calcul), combien de membres actifs, ligues ouvertes ou non.
CREATE TABLE IF NOT EXISTS ligues_semaines (
  sem TEXT PRIMARY KEY,
  cree INTEGER NOT NULL,
  actifs INTEGER NOT NULL DEFAULT 0,
  ouvert INTEGER NOT NULL DEFAULT 0
);

-- Invitations a une partie en direct (2026-11-19, creee dans D1 le meme jour
-- avec l'accord d'Alexandre). Ecrite par le Worker des parties
-- (worker-parties/index.js) quand un membre en invite un autre par son pseudo.
-- Gardee 30 minutes au plus ; effacee des que l'invite rejoint ou refuse, et
-- avec l'un des deux comptes.
CREATE TABLE IF NOT EXISTS invitations (
  partie TEXT PRIMARY KEY,
  de INTEGER NOT NULL,
  a INTEGER NOT NULL,
  cad INTEGER NOT NULL,
  cree INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS invitations_a ON invitations (a, cree);

-- Faux codes a la connexion (2026-11-21) : comptes par connexion Internet, pour
-- que celui qui devine un code se bloque lui-meme sans fermer le compte a son
-- proprietaire. Meme principe que la table creations : ni adresse ni compte en
-- clair, une empreinte calculee avec le secret du serveur et la date du jour
-- (illisible, differente chaque jour), un compteur, et la date jusqu'a
-- laquelle cette connexion est bloquee. Deux sortes de lignes : une par
-- (compte, connexion), une par compte (plafond du jour, toutes connexions
-- confondues). Effacee le lendemain.
CREATE TABLE IF NOT EXISTS essais (
  empreinte TEXT NOT NULL,
  jour TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  jusqu INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (empreinte, jour)
);

-- Pseudos quittes (2026-11-21) : apres un changement de pseudo ou une
-- suppression de compte, l'ancien pseudo reste reserve 30 jours, pour que
-- personne ne se fasse passer pour son ancien proprietaire. La colonne cle ne
-- garde pas le pseudo mais son empreinte (calculee avec le secret du serveur),
-- qui suffit a le reconnaitre. compte_id : l'ancien proprietaire, qui peut le
-- reprendre ; 0 apres une suppression de compte. Effacee a l'echeance.
CREATE TABLE IF NOT EXISTS pseudos_quittes (
  cle TEXT PRIMARY KEY,
  compte_id INTEGER NOT NULL DEFAULT 0,
  jusqu INTEGER NOT NULL
);

-- Parties par correspondance (2026-11-21) : l'annuaire des parties entre
-- membres ou chacun joue quand il veut (1, 3 ou 7 jours par coup). Ecrit par
-- le Worker des parties (worker-parties/index.js). Il sert a deux choses :
-- montrer a un membre la liste de ses parties en cours, et lui dire quand
-- c'est a lui de jouer. Les coups n'y sont pas : ils restent dans la partie
-- elle-meme. Aucun texte libre. Une ligne par partie, effacee 14 jours apres
-- la fin de la partie, a l'echeance d'une invitation restee sans reponse
-- (7 jours), et avec le compte de l'un des deux joueurs (une partie en cours
-- est d'abord donnee gagnee a celui qui reste).
CREATE TABLE IF NOT EXISTS correspondances (
  partie TEXT PRIMARY KEY,
  -- Comptes qui jouent les Blancs et les Noirs ; 0 = place encore libre.
  b INTEGER NOT NULL DEFAULT 0,
  n INTEGER NOT NULL DEFAULT 0,
  -- Membre invite, tant qu'il n'a pas repondu ; 0 = ouverte a un adversaire au hasard.
  pour INTEGER NOT NULL DEFAULT 0,
  -- Numero de la cadence : 6 = 1 jour par coup, 7 = 3 jours, 8 = 7 jours.
  cad INTEGER NOT NULL,
  -- 0 = en attente d'un adversaire, 1 = en cours, 2 = finie.
  etat INTEGER NOT NULL DEFAULT 0,
  -- Compte qui doit jouer ; 0 = personne.
  trait INTEGER NOT NULL DEFAULT 0,
  -- Date limite : de la reponse a l'invitation, du coup en cours, ou de l'effacement.
  echeance INTEGER NOT NULL,
  -- Une fois finie : 1-0, 0-1, 1/2, vide (annulee) ou refus (invitation declinee).
  res TEXT NOT NULL DEFAULT '',
  -- Qui a vu la fin : 1 = les Blancs, 2 = les Noirs, 3 = les deux.
  vu INTEGER NOT NULL DEFAULT 0,
  -- Niveau du createur, pour rapprocher les adversaires tires au hasard.
  note INTEGER NOT NULL DEFAULT 0,
  cree INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS correspondances_b ON correspondances (b);
CREATE INDEX IF NOT EXISTS correspondances_n ON correspondances (n);
CREATE INDEX IF NOT EXISTS correspondances_pour ON correspondances (pour);
CREATE INDEX IF NOT EXISTS correspondances_ouvertes ON correspondances (etat, cad);

-- Temoin du balayage horaire du Worker des parties (2026-11-22, SQL accepte
-- par Alexandre) : une seule ligne, reecrite a chaque passage. Elle sert a
-- savoir si le declencheur horaire tourne vraiment (la page « Cron events »
-- de Cloudflare n'en montrait aucun). Aucun pseudo, aucun numero de compte.
CREATE TABLE IF NOT EXISTS balayages (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  -- Heure du dernier passage.
  dernier INTEGER NOT NULL,
  -- Nombre de parties qu'il a eu a traiter a ce passage.
  traitees INTEGER NOT NULL DEFAULT 0
);
