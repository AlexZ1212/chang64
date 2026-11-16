#!/usr/bin/env node
/* Serveur local de chang64 avec le compte (2026-11-16).

   Usage : node serveur_local.js [port]      (8067 par defaut)

   Sert site/ comme le ferait Cloudflare Pages, et fait tourner les fonctions
   du compte (functions/api/compte) contre une base SQLite en memoire qui
   imite D1 (node:sqlite, tables de compte-schema.sql). Tout est perdu a
   l'arret : c'est un banc d'essai, pas une sauvegarde. Les tests
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
  const fonctions = {};
  const fonction = async nom => fonctions[nom] || (fonctions[nom] = await import(pathToFileURL(path.join(__dirname, "functions", "api", nom)).href));
  http.createServer(async (q, r) => {
    try {
      const u = new URL(q.url, "http://localhost:" + PORT);
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
  }).listen(PORT, () => console.log("chang64 local : http://localhost:" + PORT));
}
