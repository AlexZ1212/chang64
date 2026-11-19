/* chang64 - faux Cloudflare pour le Worker des parties (2026-11-19)
 *
 * Imite, dans node, juste ce dont src/worker-parties/index.js se sert : un
 * espace de Durable Objects, leur stockage, leur alarme, et des WebSockets
 * qui survivent au sommeil de l'objet. Sert aux tests
 * (tests/check_partie_directe.js) ; jamais deploye.
 *
 *   const faux = fauxCloudflare(Partie);
 *   env.PARTIES = faux.espace;
 *   faux.dormir()            oublie tous les objets en memoire (hibernation)
 *   await faux.sonner(now)   declenche les alarmes echues
 *   cote.surMessage / cote.surFermeture   branchements du serveur local
 *   faux.ecritures           lignes ecrites (put + setAlarm), pour le budget
 */
const VraieReponse = globalThis.Response;
/* node refuse le statut 101 : on le laisse passer pour la poignee de main. */
globalThis.Response = new Proxy(VraieReponse, {
  construct(cible, args) {
    const init = args[1] || {};
    if (init.status === 101) return { status: 101, ok: false, webSocket: init.webSocket, headers: new Headers() };
    return new cible(...args);
  }
});
globalThis.WebSocketRequestResponsePair = class { constructor(q, r) { this.request = q; this.response = r; } };

class FauxWS {
  constructor() { this.pair = null; this.recus = []; this.ferme = false; this.attache = null; }
  send(m) { if (this.ferme) throw new Error("ferme"); this.pair.recus.push(m); if (this.pair.surMessage) this.pair.surMessage(m); }
  close() { this.ferme = true; if (this.pair.surFermeture) this.pair.surFermeture(); }
  serializeAttachment(a) { this.attache = JSON.parse(JSON.stringify(a)); }
  deserializeAttachment() { return this.attache; }
  /* Cote test : dernier message recu, decode. */
  dernier() { return this.recus.length ? JSON.parse(this.recus[this.recus.length - 1]) : null; }
}
globalThis.WebSocketPair = class { constructor() { this[0] = new FauxWS(); this[1] = new FauxWS(); this[0].pair = this[1]; this[1].pair = this[0]; } };

function fauxCloudflare(Classe, env) {
  const faux = { ecritures: 0, panne: false, objets: new Map(), espace: null };
  const objet = nom => {
    let o = faux.objets.get(nom);
    if (!o) {
      o = { nom, donnees: new Map(), alarme: null, sockets: [], instance: null };
      const refus = () => { if (faux.panne) throw new Error("limite du jour"); };
      o.ctx = {
        storage: {
          async get(k) { const v = o.donnees.get(k); return v === undefined ? undefined : JSON.parse(v); },
          async put(k, v) { refus(); faux.ecritures++; o.donnees.set(k, JSON.stringify(v)); },
          async setAlarm(t) { refus(); faux.ecritures++; o.alarme = t; },
          async getAlarm() { return o.alarme; },
          async deleteAll() { o.donnees.clear(); o.alarme = null; }
        },
        acceptWebSocket(ws) { o.sockets.push(ws); },
        getWebSockets() { return o.sockets.filter(ws => !ws.ferme); },
        setWebSocketAutoResponse() {}
      };
      faux.objets.set(nom, o);
    }
    if (!o.instance) o.instance = new Classe(o.ctx, env);
    return o;
  };
  faux.espace = {
    idFromName: nom => nom,
    get: nom => ({
      fetch(req, init) { return objet(nom).instance.fetch(req instanceof Request ? req : new Request(req, init)); }
    })
  };
  faux.dormir = () => { for (const o of faux.objets.values()) o.instance = null; };
  /* Message venu du navigateur : cote est le WebSocket rendu au client. */
  faux.envoyer = async (nom, cote, message) => {
    await objet(nom).instance.webSocketMessage(cote.pair, typeof message === "string" ? message : JSON.stringify(message));
  };
  faux.quitter = async (nom, cote) => { cote.pair.ferme = true; await objet(nom).instance.webSocketClose(cote.pair, 1001); };
  faux.sonner = async now => {
    let n = 0;
    for (const o of [...faux.objets.values()]) {
      if (o.alarme !== null && o.alarme <= now) { o.alarme = null; n++; await objet(o.nom).instance.alarm(); }
    }
    return n;
  };
  return faux;
}
module.exports = { fauxCloudflare };
