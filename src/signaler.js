/* chang64 - signaler un exercice (2026-11-24)
 *
 * Copyright (C) 2026 AlexZ1212 - GNU GPL v3 ou ulterieure, voir /LICENSE
 *
 * Choix d'Alexandre (QCM du 24/11) : un lien discret « Signaler cet
 * exercice » sous l'explication, SEULEMENT une fois l'exercice fini (reussi
 * ou solution montree), jamais pendant qu'on cherche : « il y a un meilleur
 * coup » avant d'avoir joue n'a pas de sens, et le lien passerait pour une
 * aide. Quatre raisons ; l'envoi ne porte que le numero de l'exercice et la
 * raison (functions/api/signaler.js). Un exercice deja signale depuis cet
 * appareil affiche seulement le merci.
 *
 * Seuls les exercices de la banque (numero p123...) se signalent : ceux tires
 * des parties du joueur (pj...) n'existent que chez lui. Rien en Sprint. */
const SIGNALES_CLE = "chang64:signales";
let signalerId = null;
function signalesLire() {
  try { const l = JSON.parse(localStorage.getItem(SIGNALES_CLE) || "[]"); return Array.isArray(l) ? l : []; } catch (e) { return []; }
}
function signalerPossible() {
  try {
    return mode === "puzzles" && !!puzzleDone && !!puzzle && /^p\d{1,7}$/.test(String(puzzle.id)) && !(typeof rush !== "undefined" && rush);
  } catch (e) { return false; }
}
function signalerFermer() {
  const c = $("signalerChoix"), b = $("btnSignaler"), e = $("signalerEnvoyer");
  if (c) c.classList.add("hide");
  if (b) b.setAttribute("aria-expanded", "false");
  for (const r of document.querySelectorAll('input[name="signalerRaison"]')) r.checked = false;
  if (e) e.disabled = true;
}
function signalerMaj() {
  const z = $("exSignaler"); if (!z) return;
  const ok = signalerPossible();
  z.classList.toggle("hide", !ok);
  if (!ok) { signalerId = null; signalerFermer(); return; }
  const id = String(puzzle.id);
  if (id !== signalerId) {
    signalerId = id;
    signalerFermer();
    const m = $("signalerMerci"), deja = signalesLire().includes(id);
    if (m) { m.textContent = deja ? t("Thanks, it's noted.") : ""; m.classList.toggle("hide", !deja); }
    $("btnSignaler").classList.toggle("hide", deja);
  }
}
/* Tout changement de l'etat « exercice fini » passe par majBoutonSuivant (ui2.js). */
if (typeof majBoutonSuivant === "function") {
  const av = majBoutonSuivant;
  majBoutonSuivant = function () { const r = av.apply(this, arguments); try { signalerMaj(); } catch (e) {} return r; };
}
if (typeof setMode === "function") {
  const av = setMode;
  setMode = function () { const r = av.apply(this, arguments); try { signalerMaj(); } catch (e) {} return r; };
}
if ($("btnSignaler")) $("btnSignaler").onclick = () => {
  const c = $("signalerChoix"), ouvert = c.classList.contains("hide");
  if (ouvert) {
    c.classList.remove("hide"); $("btnSignaler").setAttribute("aria-expanded", "true");
    const r = c.querySelector("input"); if (r) { try { r.focus({ preventScroll: true }); } catch (e) { r.focus(); } }
    /* Sur telephone, la barre d'actions collee en bas cachait Envoyer et Annuler. */
    const bas = c.querySelector(".signaler-boutons"); if (bas) { try { bas.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) {} }
  }
  else signalerFermer();
};
for (const r of document.querySelectorAll('input[name="signalerRaison"]')) r.addEventListener("change", () => { $("signalerEnvoyer").disabled = false; });
if ($("signalerAnnuler")) $("signalerAnnuler").onclick = () => { signalerFermer(); $("btnSignaler").focus(); };
if ($("signalerEnvoyer")) $("signalerEnvoyer").onclick = async () => {
  const choix = document.querySelector('input[name="signalerRaison"]:checked');
  if (!choix || !signalerId) return;
  const id = signalerId, e = $("signalerEnvoyer"), m = $("signalerMerci");
  e.disabled = true;
  let ok = false;
  try {
    const r = await fetch("/api/signaler", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ exo: id, raison: choix.value }) });
    ok = !!r && r.ok;
  } catch (x) { ok = false; }
  if (id !== signalerId) return;
  if (ok) {
    const l = signalesLire().filter(x => x !== id); l.push(id);
    try { localStorage.setItem(SIGNALES_CLE, JSON.stringify(l.slice(-300))); } catch (x) {}
    signalerFermer();
    $("btnSignaler").classList.add("hide");
    m.textContent = t("Thanks, it's noted.");
  } else {
    e.disabled = false;
    m.textContent = t("The report could not be sent. Try again later.");
  }
  m.classList.remove("hide");
};
signalerMaj();
