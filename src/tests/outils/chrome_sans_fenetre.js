/* Un Chrome sans fenetre pilote par le protocole DevTools (2026-11-22).

   jsdom ne met rien en page : une largeur, un libelle sur deux lignes ou un
   debordement ne se mesurent que dans un vrai navigateur. Le volet navigateur
   de l'application fige les animations quand il est masque ; ce Chrome-ci
   tourne toujours. Il sert aux mesures a 360 px (mesure_apprendre.js).

   Le binaire est celui que Remotion a telecharge (lancement/video, hors git),
   ou celui que designe la variable CHROME_SANS_FENETRE. Aucun paquet en plus :
   node fournit fetch et WebSocket.

     const c = await ouvrir({ largeur: 360, hauteur: 740 });
     await c.aller("http://localhost:8083/fr/");
     const v = await c.js("document.title");
     await c.capture("fichier.png");
     await c.fermer();
*/
const fs = require("fs"), path = require("path"), os = require("os"), { spawn } = require("child_process");
const dodo = ms => new Promise(r => setTimeout(r, ms));

function binaire() {
  if (process.env.CHROME_SANS_FENETRE && fs.existsSync(process.env.CHROME_SANS_FENETRE)) return process.env.CHROME_SANS_FENETRE;
  /* Depuis un worktree (.claude/worktrees/x/src/tests/outils) comme depuis le depot. */
  let d = __dirname;
  for (let i = 0; i < 9; i++) {
    const base = path.join(d, "lancement", "video", "node_modules", ".remotion", "chrome-headless-shell");
    if (fs.existsSync(base)) {
      const trouve = [];
      const voir = x => { for (const f of fs.readdirSync(x)) { const p = path.join(x, f); if (fs.statSync(p).isDirectory()) voir(p); else if (/^chrome-headless-shell(\.exe)?$/.test(f)) trouve.push(p); } };
      voir(base);
      if (trouve.length) return trouve[0];
    }
    d = path.dirname(d);
  }
  return null;
}

async function ouvrir(o) {
  o = o || {};
  const exe = binaire();
  if (!exe) throw new Error("Chrome sans fenetre introuvable (variable CHROME_SANS_FENETRE, ou lancement/video de Remotion).");
  const port = o.port || 9300 + Math.floor(Math.random() * 400);
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-chang64-"));
  const proc = spawn(exe, ["--remote-debugging-port=" + port, "--user-data-dir=" + profil, "--no-first-run", "--hide-scrollbars", "--mute-audio",
    "--host-resolver-rules=MAP cloudflareinsights.com 127.0.0.1, MAP static.cloudflareinsights.com 127.0.0.1", "about:blank"], { stdio: "ignore" });
  let cible = null;
  for (let i = 0; i < 100 && !cible; i++) {
    await dodo(100);
    try { const l = await (await fetch("http://127.0.0.1:" + port + "/json")).json(); cible = l.find(x => x.type === "page"); } catch (e) {}
  }
  if (!cible) { proc.kill(); throw new Error("Chrome sans fenetre : pas de page."); }
  const ws = new WebSocket(cible.webSocketDebuggerUrl);
  await new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = ko; });
  let n = 0;
  const attente = new Map(), ecoutes = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && attente.has(m.id)) { const [ok, ko] = attente.get(m.id); attente.delete(m.id); m.error ? ko(new Error(m.error.message)) : ok(m.result); }
    else if (m.method) for (const f of ecoutes) f(m);
  };
  const cdp = (methode, params) => new Promise((ok, ko) => { const id = ++n; attente.set(id, [ok, ko]); ws.send(JSON.stringify({ id, method: methode, params: params || {} })); });
  await cdp("Page.enable"); await cdp("Runtime.enable");
  const taille = (l, h) => cdp("Emulation.setDeviceMetricsOverride", { width: l, height: h, deviceScaleFactor: o.echelle || 2, mobile: l < 600 });
  await taille(o.largeur || 360, o.hauteur || 740);
  if (o.sombre !== false) await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
  const C = {
    cdp, taille,
    async aller(url) {
      const charge = new Promise(ok => { const f = m => { if (m.method === "Page.loadEventFired") { ecoutes.splice(ecoutes.indexOf(f), 1); ok(); } }; ecoutes.push(f); });
      await cdp("Page.navigate", { url });
      await Promise.race([charge, dodo(20000)]);
      await dodo(o.pause || 400);
    },
    /* Evalue une expression (une promesse est attendue) et rend sa valeur. */
    async js(expr) {
      const r = await cdp("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error("Dans la page : " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
      return r.result.value;
    },
    async capture(fichier, entier) {
      const r = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: !!entier });
      fs.writeFileSync(fichier, Buffer.from(r.data, "base64"));
    },
    attendre: dodo,
    async fermer() {
      try { ws.close(); } catch (e) {}
      proc.kill();
      await dodo(300);
      try { fs.rmSync(profil, { recursive: true, force: true }); } catch (e) {}
    }
  };
  return C;
}
module.exports = { ouvrir, binaire };
