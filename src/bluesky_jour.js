#!/usr/bin/env node
/* bluesky_jour.js - publie l'exercice du jour sur Bluesky (2026-11-07,
   plan de lancement d'Alexandre : un rendez-vous public, comme Wordle).
   Lance tous les jours par .github/workflows/bluesky-jour.yml (depuis le
   2026-11-14, trois fois par semaine avant), pour une publication a 14 h
   UTC, avec un second depart qui rattrape un lancement saute par GitHub.

   Ce que fait le script :
     1. lit sur le site en ligne l'exercice du jour (data/jour.json, puis
        l'index data/ids/ et le morceau de niveau qui le contient), avec la
        meme regle que le site (idDuJour, ui.js) et la date de Paris ;
     2. dessine la position du point de vue du camp au trait, comme le site,
        avec le plateau des images de partage (plateau_svg.js) ;
     3. publie un message court en anglais avec l'image, le lien vers
        l'exercice et deux mots-cles. Le site se presente comme un site pour
        debutants (consigne d'Alexandre) : le message le dit.

   Rien n'est publie deux fois : si un des derniers messages du compte
   contient deja le lien du jour, le script s'arrete.

   Identifiants : variables d'environnement BLUESKY_IDENTIFIANT (le nom du
   compte, ex. chang64.bsky.social) et BLUESKY_MOT_DE_PASSE (un mot de passe
   d'APPLICATION cree dans les reglages Bluesky, jamais le mot de passe du
   compte). Dans GitHub, ce sont deux secrets du depot. Sans eux, le script
   ne publie rien et sort sans erreur : la tache quotidienne reste verte tant
   que le compte n'est pas configure.

   Lancement :
     node bluesky_jour.js                     publie l'exercice d'aujourd'hui
     node bluesky_jour.js --essai             n'envoie rien : ecrit l'image et
                                              le texte dans le dossier courant
     node bluesky_jour.js --essai --date 2026-11-09   pour un autre jour
     node bluesky_jour.js --heure 14:00       attend 14 h UTC avant de publier

   --heure (2026-11-14) : GitHub lance les taches programmees avec plusieurs
   heures de retard, mais rarement en avance. La tache part donc tot et le
   script attend l'heure voulue ; lance apres cette heure, il publie tout de
   suite. */
const fs = require("fs");
const path = require("path");
const { boardSvg } = require("./plateau_svg.js");

const SITE = (process.env.CHANG64_SITE || "https://chang64.com").replace(/\/$/, "");
const SERVEUR = "https://bsky.social";
const args = process.argv.slice(2);
const essai = args.includes("--essai");
const dateForcee = (() => { const i = args.indexOf("--date"); return i >= 0 ? args[i + 1] : null; })();
const heureVisee = (() => { const i = args.indexOf("--heure"); return i >= 0 ? args[i + 1] : null; })();

async function attendreHeure() {
  if (!heureVisee) return;
  const m = /^(\d{2}):(\d{2})$/.exec(heureVisee);
  if (!m) throw new Error("--heure attend HH:MM (UTC) : " + heureVisee);
  const n = new Date();
  const ms = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), +m[1], +m[2]) - n.getTime();
  if (ms <= 0) { console.log("Deja " + heureVisee + " UTC passees : publication tout de suite."); return; }
  console.log("Attente jusqu'a " + heureVisee + " UTC (" + Math.round(ms / 60000) + " min).");
  await new Promise(r => setTimeout(r, ms));
}

/* Date de Paris, quelle que soit l'horloge de la machine (GitHub tourne en
   UTC) : c'est elle qui decide de l'exercice, comme pour un visiteur
   francais. */
function dateDuJour() {
  if (dateForcee) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateForcee)) throw new Error("--date attend AAAA-MM-JJ : " + dateForcee);
    return dateForcee;
  }
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

async function lireJson(chemin) {
  const r = await fetch(SITE + chemin);
  if (!r.ok) throw new Error(chemin + " : HTTP " + r.status);
  return r.json();
}

/* Meme calcul que dateToDailyId et idDuJour (ui.js, ui2.js). */
async function exerciceDuJour(cle) {
  const [y, m, d] = cle.split("-").map(Number);
  const n = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  const jour = await lireJson("/data/jour.json");
  const l = jour.ids, i = n - jour.debut;
  const id = l[((i % l.length) + l.length) % l.length];
  const index = await lireJson("/data/ids/" + Math.floor(+id.slice(1) / 10000) + ".json");
  if (!index[id]) throw new Error(id + " absent de l'index");
  const [niveau, morceau] = index[id];
  const lot = await lireJson("/data/level-" + niveau + "-" + morceau + ".json");
  const p = lot.find(x => x.id === id);
  if (!p) throw new Error(id + " absent de level-" + niveau + "-" + morceau);
  return p;
}

/* Lundi 1 ... dimanche 7 : la difficulte de l'exercice du jour monte au fil
   de la semaine (voir le partage du resultat, ui2.js). */
function jourDeSemaine(cle) {
  const [y, m, d] = cle.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
}

function texteDuMessage(cle, p) {
  const [y, m, d] = cle.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
  const camp = p.fen.split(" ")[1] === "b" ? "Black" : "White";
  const consigne = p.type === "mate"
    ? camp + " to play and mate in " + p.n + (p.n > 1 ? " moves." : " move.")
    : camp + " to play and win.";
  const j = jourDeSemaine(cle);
  const lien = SITE + "/#puzzle=" + p.id;
  /* Ecriture sobre, comme un joueur qui poste son exercice : ni emoji en
     tete, ni point median, ni pastilles (retour d'Alexandre du 2026-11-07,
     ces tics font "texte genere"). */
  const texte =
    "Puzzle of the day, " + date + "\n" +
    consigne + "\n" +
    "Difficulty " + j + "/7. It gets harder from Monday to Sunday, and it's all aimed at beginners.\n\n" +
    lien + "\n\n" +
    "#chess #chesspuzzle";
  return { texte, lien, camp };
}

/* Bluesky ne rend cliquables ni les liens ni les mots-cles d'eux-memes : il
   faut les declarer en "facets", reperes en OCTETS UTF-8 et non en
   caracteres (l'elephant et les points comptent plusieurs octets). */
function facettes(texte, lien) {
  const octets = s => Buffer.byteLength(s, "utf8");
  const out = [];
  const i = texte.indexOf(lien);
  if (i >= 0) out.push({
    index: { byteStart: octets(texte.slice(0, i)), byteEnd: octets(texte.slice(0, i + lien.length)) },
    features: [{ $type: "app.bsky.richtext.facet#link", uri: lien }]
  });
  for (const m of texte.matchAll(/#([a-z]+)/g)) {
    if (texte.slice(0, m.index).endsWith("/")) continue;   /* le # du lien */
    out.push({
      index: { byteStart: octets(texte.slice(0, m.index)), byteEnd: octets(texte.slice(0, m.index + m[0].length)) },
      features: [{ $type: "app.bsky.richtext.facet#tag", tag: m[1] }]
    });
  }
  return out;
}

async function imageDuPlateau(p) {
  const sharp = require("sharp");
  const noirs = p.fen.split(" ")[1] === "b";
  return sharp(Buffer.from(boardSvg(p.fen, 1000, noirs)), { density: 96 }).png().toBuffer();
}

async function appel(methode, jeton, corps, type) {
  const r = await fetch(SERVEUR + "/xrpc/" + methode, {
    method: "POST",
    headers: Object.assign({ "Content-Type": type || "application/json" }, jeton ? { Authorization: "Bearer " + jeton } : {}),
    body: type ? corps : JSON.stringify(corps)
  });
  const t = await r.text();
  if (!r.ok) throw new Error(methode + " : HTTP " + r.status + " " + t.slice(0, 200));
  return JSON.parse(t);
}

(async () => {
  await attendreHeure();
  const cle = dateDuJour();
  const p = await exerciceDuJour(cle);
  const { texte, lien, camp } = texteDuMessage(cle, p);
  const png = await imageDuPlateau(p);
  const alt = "Chess puzzle position, " + camp + " to move. FEN: " + p.fen.split(" ").slice(0, 2).join(" ");

  if (essai) {
    fs.writeFileSync(path.join(process.cwd(), "bluesky-essai.png"), png);
    fs.writeFileSync(path.join(process.cwd(), "bluesky-essai.txt"), texte + "\n\n[alt] " + alt + "\n");
    console.log(texte + "\n\n[alt] " + alt + "\n[facets] " + JSON.stringify(facettes(texte, lien)));
    console.log("\nEssai : rien n'est publie. Image et texte ecrits dans " + process.cwd());
    return;
  }

  const identifiant = process.env.BLUESKY_IDENTIFIANT, motDePasse = process.env.BLUESKY_MOT_DE_PASSE;
  if (!identifiant || !motDePasse) {
    console.log("BLUESKY_IDENTIFIANT ou BLUESKY_MOT_DE_PASSE absent : rien n'est publie.");
    return;
  }
  const session = await appel("com.atproto.server.createSession", null, { identifier: identifiant, password: motDePasse });

  const r = await fetch(SERVEUR + "/xrpc/app.bsky.feed.getAuthorFeed?limit=10&actor=" + encodeURIComponent(session.did),
    { headers: { Authorization: "Bearer " + session.accessJwt } });
  if (r.ok) {
    const fil = await r.json();
    if ((fil.feed || []).some(x => x.post && x.post.record && String(x.post.record.text || "").includes(lien))) {
      console.log("Deja publie aujourd'hui (" + p.id + "), rien a faire.");
      return;
    }
  }

  const { blob } = await appel("com.atproto.repo.uploadBlob", session.accessJwt, png, "image/png");
  const res = await appel("com.atproto.repo.createRecord", session.accessJwt, {
    repo: session.did,
    collection: "app.bsky.feed.post",
    record: {
      $type: "app.bsky.feed.post",
      text: texte,
      facets: facettes(texte, lien),
      langs: ["en"],
      createdAt: new Date().toISOString(),
      embed: { $type: "app.bsky.embed.images", images: [{ alt, image: blob, aspectRatio: { width: 1000, height: 1000 } }] }
    }
  });
  console.log("Publie : " + p.id + " (" + cle + ") -> " + res.uri);
})().catch(e => { console.log("Echec : " + e.message); process.exit(1); });
