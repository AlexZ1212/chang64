#!/usr/bin/env node
/* Serveur local de chang64 avec le compte (2026-11-16).

   Usage : node serveur_local.js [port]      (8067 par defaut)

   Sert site/ comme le ferait Cloudflare Pages, et fait tourner les fonctions
   du compte (functions/api/compte) contre une base SQLite en memoire qui
   imite D1 (node:sqlite, tables de compte-schema.sql). Tout est perdu a
   l'arret : c'est un banc d'essai, pas une sauvegarde. Depuis le 2026-11-19
   il fait aussi tourner le Worker des parties en direct (/api/partie/...),
   WebSockets compris. Les tests
   (tests/check_compte_*.js) se servent de la meme fausse base. */
const http = require("http"), fs = require("fs"), path = require("path"), { pathToFileURL } = require("url");
process.removeAllListeners("warning"); process.on("warning", () => {});
const { DatabaseSync } = require("node:sqlite");

function fausseD1() {
  const db = new DatabaseSync(":memory:");
  db.exec(fs.readFileSync(path.join(__dirname, "compte-schema.sql"), "utf8"));
  const prep = (sql, args) => ({
    bind(...a) { return prep(sql, a); },
    async first() { const r = db.prepare(sql).get(...(args || [])); return r === undefined ? null : Object.assign({}, r); },
    async all() { return { results: db.prepare(sql).all(...(args || [])).map(r => Object.assign({}, r)) }; },
    async run() {
      const st = db.prepare(sql);
      if (/RETURNING/i.test(sql)) { st.all(...(args || [])); return { meta: {} }; }
      const r = st.run(...(args || [])); return { meta: { changes: Number(r.changes) } };
    }
  });
  return { brut: db, prepare: sql => prep(sql), async batch(l) { const out = []; for (const s of l) out.push(await s.run()); return out; } };
}
module.exports = { fausseD1 };

if (require.main === module) {
  const PORT = +process.argv[2] || 8067, RACINE = path.join(__dirname, "site");
  const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon", ".wasm": "application/wasm" };
  const env = { DB: fausseD1() };
  /* Parties en direct (2026-11-19) : le Worker a part (worker-parties/) tourne
     ici dans le meme processus, sur un faux Cloudflare. Ses WebSockets sont
     servis a la main (pas de paquet en plus) : texte seulement, messages courts. */
  const { fauxCloudflare } = require("./worker-parties/faux_cloudflare.js");
  let parties = null, faux = null;
  const worker = async () => {
    if (!parties) {
      parties = await import(pathToFileURL(path.join(__dirname, "worker-parties", "index.js")).href);
      faux = fauxCloudflare(parties.Partie, env);
      env.PARTIES = faux.espace;
      setInterval(() => { faux.sonner(Date.now()).catch(() => {}); }, 250).unref();
    }
    return parties.default;
  };
  const requete = async (q, u) => {
    const morceaux = [];
    if (!["GET", "HEAD"].includes(q.method)) for await (const m of q) morceaux.push(m);
    const entetes = new Headers();
    for (const [k, v] of Object.entries(q.headers)) if (typeof v === "string") entetes.set(k, v);
    return new Request(u.href, { method: q.method, headers: entetes, body: ["GET", "HEAD"].includes(q.method) ? undefined : Buffer.concat(morceaux) });
  };
  const trame = (code, texte) => {
    const c = Buffer.from(texte || "", "utf8");
    const t = c.length < 126 ? Buffer.from([0x80 | code, c.length]) : Buffer.from([0x80 | code, 126, c.length >> 8, c.length & 255]);
    return Buffer.concat([t, c]);
  };
  async function monter(q, prise) {
    const u = new URL(q.url, "http://" + (q.headers.host || "localhost:" + PORT));
    const refuser = statut => { prise.end("HTTP/1.1 " + statut + " Refus\r\nConnection: close\r\n\r\n"); };
    if (u.pathname !== "/api/partie/ws") return refuser(404);
    const rep = await (await worker()).fetch(await requete(q, u), env);
    if (rep.status !== 101) return refuser(rep.status);
    const cote = rep.webSocket, nom = u.searchParams.get("id");
    const cle = require("crypto").createHash("sha1").update(q.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
    prise.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + cle + "\r\n\r\n");
    for (const m of cote.recus) prise.write(trame(1, m));
    cote.surMessage = m => { if (!prise.destroyed) prise.write(trame(1, m)); };
    cote.surFermeture = () => { if (!prise.destroyed) prise.end(trame(8, "")); };
    let parti = false;
    const partir = () => { if (!parti) { parti = true; faux.quitter(nom, cote).catch(() => {}); } };
    let reste = Buffer.alloc(0), file = Promise.resolve();
    prise.on("data", d => {
      reste = Buffer.concat([reste, d]);
      for (;;) {
        if (reste.length < 2) return;
        let n = reste[1] & 127, debut = 2;
        if (n === 126) { if (reste.length < 4) return; n = reste.readUInt16BE(2); debut = 4; }
        else if (n === 127) { prise.destroy(); return; }
        const masque = reste[1] & 128 ? 4 : 0;
        if (reste.length < debut + masque + n) return;
        const code = reste[0] & 15, c = Buffer.from(reste.subarray(debut + masque, debut + masque + n));
        if (masque) for (let i = 0; i < n; i++) c[i] ^= reste[debut + (i & 3)];
        reste = reste.subarray(debut + masque + n);
        if (code === 8) { prise.end(trame(8, "")); partir(); return; }
        if (code === 9) prise.write(trame(10, c.toString("utf8")));
        if (code === 1) {
          const texte = c.toString("utf8");
          /* Comme la reponse automatique de Cloudflare, sans reveiller l'objet. */
          if (texte === "ping") prise.write(trame(1, "pong"));
          else file = file.then(() => faux.envoyer(nom, cote, texte)).catch(() => {});
        }
      }
    });
    prise.on("close", partir);
    prise.on("error", partir);
  }
  const fonctions = {};
  const fonction = async nom => fonctions[nom] || (fonctions[nom] = await import(pathToFileURL(path.join(__dirname, "functions", "api", nom)).href));
  http.createServer(async (q, r) => {
    try {
      const u = new URL(q.url, "http://" + (q.headers.host || "localhost:" + PORT));
      if (u.pathname.startsWith("/api/partie/")) {
        const rep = await (await worker()).fetch(await requete(q, u), env);
        const h = {};
        rep.headers.forEach((v, k) => { h[k] = v; });
        r.writeHead(rep.status, h);
        return r.end(Buffer.from(await rep.arrayBuffer()));
      }
      const api = u.pathname.match(/^\/api\/(compte|classement)(?:\/(.*))?$/);
      if (api) {
        const morceaux = [];
        for await (const m of q) morceaux.push(m);
        const entetes = new Headers();
        for (const [k, v] of Object.entries(q.headers)) if (typeof v === "string") entetes.set(k, v);
        const req = new Request(u.href, { method: q.method, headers: entetes, body: ["GET", "HEAD"].includes(q.method) ? undefined : Buffer.concat(morceaux) });
        const mod = await fonction(api[1] === "compte" ? "compte/[[route]].js" : "classement.js");
        const ctx = { request: req, env, params: { route: (api[2] || "").split("/").filter(Boolean) }, waitUntil() {} };
        const rep = await (mod.onRequest || mod["onRequest" + q.method[0] + q.method.slice(1).toLowerCase()])(ctx);
        const h = {};
        rep.headers.forEach((v, k) => { h[k] = v; });
        /* Plusieurs Set-Cookie (session + compteur de creations) : un tableau, sinon le dernier ecrase le premier. */
        if (typeof rep.headers.getSetCookie === "function" && rep.headers.getSetCookie().length) h["set-cookie"] = rep.headers.getSetCookie();
        r.writeHead(rep.status, h);
        return r.end(Buffer.from(await rep.arrayBuffer()));
      }
      let x = path.join(RACINE, decodeURIComponent(u.pathname));
      if (!x.startsWith(RACINE)) { r.writeHead(403); return r.end(); }
      if (fs.existsSync(x) && fs.statSync(x).isDirectory()) x = path.join(x, "index.html");
      else if (!fs.existsSync(x) && fs.existsSync(x + ".html")) x += ".html";
      if (!fs.existsSync(x)) { r.writeHead(404); return r.end("404"); }
      r.writeHead(200, { "Content-Type": TYPES[path.extname(x)] || "application/octet-stream" });
      fs.createReadStream(x).pipe(r);
    } catch (e) { r.writeHead(500); r.end(String(e && e.stack || e)); }
  }).on("upgrade", (q, prise) => { monter(q, prise).catch(() => prise.destroy()); }).listen(PORT, () => console.log("chang64 local : http://localhost:" + PORT));
}
