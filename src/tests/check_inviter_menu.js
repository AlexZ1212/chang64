/* Verification automatique de chang64.
   Lancement : node tests/check_inviter_menu.js
   Le site doit avoir ete construit au prealable : node build_site.js

   « Inviter sur chang64 » (les boutons qui partagent le site) n'existait qu'a
   un endroit : au bas de l'ecran Contre un ami, sans rapport avec la partie
   qu'on y prepare. Retour d'Alexandre du 2026-11-22 : le mettre dans le menu.
   Il est dans la section A propos, avec sa propre vue. */
const { ouvrir } = require("./outils/page_langue.js");
let ok = 0, ko = 0;
const T = (n, c, d) => { if (c) { ok++; console.log("  OK   " + n); } else { ko++; console.log("  FAIL " + n + (d !== undefined ? "  -> " + d : "")); } };
const attendre = ms => new Promise(r => setTimeout(r, ms));
const net = s => String(s).replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();

(async () => {
  const w = await ouvrir("fr", { attente: 2200 });
  const d = w.document, $ = id => d.getElementById(id);
  T("plus de bloc « Inviter sur chang64 » dans l'ecran Contre un ami", !$("amiInvitePanel") && !$("pane-friend").querySelector("#siteShare") && !/Inviter sur chang64/.test(net($("pane-friend").textContent)));
  T("un seul jeu de boutons de partage du site", d.querySelectorAll("#siteShare").length === 1 && $("menuInviterVue").contains($("siteShare")));
  w.eval("menuOuvrir()"); await attendre(300);
  const ligne = d.querySelector('#menuAccueil [data-vue="inviter"]');
  T("le menu porte la ligne « Inviter sur chang64 », avec un pictogramme", !!ligne && net(ligne.textContent) === "Inviter sur chang64" && !!ligne.querySelector("svg.tiroir-ico"));
  {
    const sections = [...d.querySelectorAll("#menuAccueil > *")];
    const i = sections.indexOf(ligne), titre = sections.slice(0, i).reverse().find(e => e.classList.contains("tiroir-section"));
    T("elle est dans la section « A propos »", !!titre && net(titre.textContent) === "À propos", titre && titre.textContent);
  }
  ligne.click(); await attendre(350);
  T("elle ouvre sa vue, titree « Inviter sur chang64 »", !$("menuInviterVue").hidden && $("menuAccueil").hidden && net($("menuTitre").textContent) === "Inviter sur chang64" && !$("menuRetour").hidden);
  T("la vue dit en une phrase de quoi il s'agit", /gratuit/.test(net($("menuInviterVue").querySelector("p").textContent)), net($("menuInviterVue").querySelector("p").textContent));
  const boutons = [...$("siteShare").children].map(b => net(b.textContent));
  T("les boutons de partage y sont : WhatsApp, Messenger, Telegram, Copier", ["WhatsApp", "Messenger", "Telegram", "Copier"].every(x => boutons.includes(x)), boutons.join(", "));
  $("menuRetour").click(); await attendre(300);
  T("le retour ramene au menu", !$("menuAccueil").hidden && $("menuInviterVue").hidden);
  /* Ouvrir une autre vue ne laisse pas celle-ci affichee. */
  w.eval("menuVue('inviter');menuVue('stats')"); await attendre(300);
  T("une seule vue a la fois", $("menuInviterVue").hidden && !$("menuStats").hidden);
  w.close();

  const en = await ouvrir("en", { attente: 2200 });
  en.eval("menuOuvrir();menuVue('inviter')"); await attendre(300);
  T("en anglais : « Invite to chang64 » et sa phrase", net(en.document.getElementById("menuTitre").textContent) === "Invite to chang64" && /it is free/.test(net(en.document.getElementById("menuInviterVue").textContent)));
  en.close();

  console.log("\n=== " + ok + " OK, " + ko + " FAIL ===");
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log("  FAIL plantage -> " + (e && e.stack || e)); console.log("\n=== " + ok + " OK, " + (ko + 1) + " FAIL ==="); process.exit(1); });
