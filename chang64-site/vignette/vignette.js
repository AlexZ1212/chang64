/* Vignette de l'exercice du jour : genere par vignette_build.js, ne pas modifier. */
(function () {
"use strict";
var PIECE_FILL = {"w":"#eceae3","b":"#232b28"};
var PIECE_STROKE = "#101413";
var PIECE_SHAPES = {"p":[{"t":"path","d":"M14.31,33.79h16.38c1.14,0,2.07.93,2.07,2.07v2.14H12.24v-2.14c0-1.14.93-2.07,2.07-2.07Z","fixe":false},{"t":"path","d":"M31.85,34.14c-1.31-1.01-6.34-5.24-6.57-11.44-.84.03-1.78.03-2.77.03s-1.94,0-2.77-.03c-.24,6.2-5.26,10.43-6.57,11.44,0,0,0,0,0,0,.33-.22.73-.35,1.16-.35h16.38c.43,0,.83.13,1.16.35,0,0,0,0,0,0Z","fixe":false},{"t":"path","d":"M28.82,21.68c0,1.02-2.83,1.05-6.32,1.05s-6.32-.04-6.32-1.05,1.41-2.63,6.32-2.63,6.32,1.61,6.32,2.63Z","fixe":false},{"t":"circle","cx":"22.5","cy":"13.53","r":"5.53","fixe":false}],"n":[{"t":"path","d":"M14.4,33.1h20.67c1.39,0,2.52,1.13,2.52,2.52v2.38H11.88v-2.38c0-1.39,1.13-2.52,2.52-2.52Z","fixe":false,"sw":"1"},{"t":"path","d":"M14.65,21.66c.97-.66,4.68-.28,7.56-3.75.52-.62.98,1.68-.34,3.64-2.86,4.23-8.3,4.94-8.39,11.72.29-.11.6-.18.92-.18h20.67c.52,0,1,.16,1.4.42-.55-.46-1.93-1.71-1.93-2.68,0-1.21.9-4.35.9-9.83s-4.54-14.07-12.47-14.07l-3.39-2.95-.75,2.7-3-1.87s-.15,2.38-.24,4.01c-.54.3-2.22.96-4.03,5.99-.63,1.75-4.15,3-4.15,6.07,0,3.41,3.21,3.83,3.82,3.83,1.57,0,2.36-2.34,3.42-3.06Z","fixe":false,"sw":"1"},{"t":"path","d":"M18.54,13.2c.9-.63.98-1.58,1.21-2.02.03-.06-.02-.12-.08-.12-.49.06-1.4-.18-2.31.45-.9.64-.98,1.58-1.2,2.02-.03.06.02.12.08.12.49-.06,1.4.18,2.3-.45Z","fixe":true},{"t":"path","d":"M10.24,20.58c-.46.42-.86.73-1.07.5s.14-1.16.6-1.57.87-.16,1.08.07-.15.59-.61,1.01Z","fixe":true}],"b":[{"t":"path","d":"M13.5,32.74h18c1.36,0,2.47,1.11,2.47,2.47v2.79H11.03v-2.79c0-1.36,1.11-2.47,2.47-2.47Z","fixe":false,"sw":"1"},{"t":"path","d":"M27.46,32.74c2.5-2.65,5.01-6.42,5.01-10.9,0-3.8-1.45-6.58-3.24-8.82l-5.4,8.41c-.44.69-1.36.89-2.04.45h0c-.69-.44-.89-1.36-.45-2.04l5.83-9.09c-.88-.88-1.74-1.69-2.49-2.47.4-.56.6-1.27.47-2.04-.18-1.1-1.08-2.02-2.18-2.21-1.7-.29-3.18,1.01-3.18,2.66,0,.59.19,1.13.51,1.58-2.94,3.06-7.78,6.6-7.78,13.55,0,4.48,2.51,8.26,5.01,10.9h9.93Z","fixe":false,"sw":"1"}],"r":[{"t":"path","d":"M12.99,33.03h19.01c1.35,0,2.45,1.1,2.45,2.45v2.52H10.54v-2.52c0-1.35,1.1-2.45,2.45-2.45Z","fixe":false},{"t":"path","d":"M29.17,15.8c-.07,0-.15.01-.23.01h-12.88c-.08,0-.15,0-.23-.01-.01,5.69-.51,15.85-3.95,17.49,0,0,0,0,0,0,.33-.17.71-.27,1.11-.27h19.01c.4,0,.78.1,1.11.27,0,0,0,0,0,0-3.45-1.65-3.94-11.8-3.95-17.49Z","fixe":false},{"t":"path","d":"M27.96,8v2.99h-2.92v-2.99h-5.07v2.99h-2.92v-2.99h-4.29v4.5c0,1.83,1.48,3.31,3.31,3.31h12.88c1.83,0,3.31-1.48,3.31-3.31v-4.5h-4.29Z","fixe":false}],"q":[{"t":"path","d":"M31.62,31.91H13.38c-2.1,0-3.82,1.72-3.82,3.82v2.27h25.88v-2.27c0-2.11-1.71-3.82-3.82-3.82Z","fixe":false},{"t":"path","d":"M39.59,11.71c-.8-1.1-2.33-1.34-3.43-.54s-1.34,2.33-.54,3.43c.02.02.04.04.05.07l-5.35,6.05.82-10.77c.83-.06,1.62-.53,2.03-1.33.62-1.21.14-2.69-1.07-3.3-.19-.1-.39-.16-.58-.21h0s0,0,0,0c-1.07-.24-2.2.26-2.72,1.28-.55,1.07-.23,2.35.69,3.06l-4.16,8.89-1.94-10.57c.93-.35,1.58-1.25,1.58-2.29,0-1.36-1.1-2.46-2.46-2.46h0c-1.36,0-2.46,1.1-2.46,2.46,0,1.05.66,1.94,1.58,2.29l-1.94,10.57-4.16-8.89c.92-.71,1.23-1.99.69-3.06-.52-1.02-1.65-1.52-2.72-1.28h0s0,0,0,0c-.2.04-.39.11-.58.21-1.21.62-1.69,2.1-1.07,3.3.41.8,1.19,1.28,2.03,1.33l.82,10.77-5.35-6.05s.04-.04.05-.07c.8-1.1.55-2.63-.54-3.43s-2.63-.55-3.43.54c-.8,1.1-.55,2.63.54,3.43.58.42,1.29.55,1.94.42,1.81,4.84,4.41,12.39,4.63,16.46.28-.06.56-.1.86-.1h18.24c.3,0,.58.04.86.1.22-4.07,2.81-11.61,4.63-16.46.65.13,1.36,0,1.94-.42,1.1-.8,1.34-2.33.54-3.43Z","fixe":false}],"k":[{"t":"path","d":"M31.54,31.96H13.46c-2.08,0-3.79,1.7-3.79,3.79v2.25h25.66v-2.25c0-2.09-1.7-3.79-3.79-3.79Z","fixe":false,"sw":".98"},{"t":"path","d":"M31.08,12.5c-1.67,0-3.32.64-4.72,1.42l-1.8-2.32v-1.53h2.95v-4.12h-2.95v-2.95h-4.12v2.95h-2.95v4.12h2.95v1.53l-1.8,2.32c-1.4-.78-3.05-1.42-4.72-1.42-2.74,0-7.28,2.13-7.28,7.55,0,5.98,5.8,8.15,6.78,11.92.01,0,.03,0,.04,0h18.08s.03,0,.04,0c.97-3.77,6.78-5.94,6.78-11.92,0-5.41-4.54-7.55-7.28-7.55ZM29.1,25.07c-.58.62-1.23,1.31-1.82,2.09-.14.18-.35.29-.58.29-.35,0-.84,0-.81,0v-7.39c1.3-.96,2.57-1.55,3.39-1.56.42.03,2.24.27,2.24,2.46,0,1.37-.74,2.3-2.42,4.1ZM13.48,20.97c0-2.19,1.82-2.44,2.24-2.46.82.01,2.09.6,3.39,1.56v7.39s-.46,0-.81,0c-.23,0-.44-.11-.58-.29-.59-.77-1.24-1.46-1.82-2.09-1.68-1.8-2.42-2.73-2.42-4.1Z","fixe":false,"sw":".98"}]};
function pieceShapes(type, white) {
  const remplissage = white ? PIECE_FILL.w : PIECE_FILL.b;
  return (PIECE_SHAPES[type] || []).map(f => {
    const a = [];
    if (f.t === "circle") a.push(`cx="${f.cx}" cy="${f.cy}" r="${f.r}"`);
    else a.push(`d="${f.d}"`);
    if (!f.fixe) {
      a.push(`fill="${remplissage}"`, `stroke="${f.st || PIECE_STROKE}"`,
             'stroke-linecap="round" stroke-linejoin="round"');
    } else {
      /* Oeil et naseau du cavalier : remplissage a la couleur du contour,
         sans contour propre. */
      a.push(`fill="${PIECE_STROKE}"`);
    }
    if (f.sw) a.push(`stroke-width="${f.sw}"`);
    return `<${f.t} ${a.join(" ")}/>`;
  }).join("");
}
var CASE_CLAIRE = "#EDE3D5", CASE_FONCEE = "#4A6A68";
function coordsSvg(size, flipped) {
  const S = size / 8, m = S * 0.06;
  const encre = (f, r) => (f + r) % 2 ? CASE_CLAIRE : CASE_FONCEE;
  /* Quatre <text> en tout (un par couleur, pour les chiffres et pour les
     lettres), chaque signe place par les listes x et y : seize balises
     alourdissaient de 4 Ko les pages a plusieurs diagrammes. */
  const n = v => String(Math.round(v * 10) / 10);
  let t = `<g font-family="'JetBrains Mono',monospace" font-weight="600" font-size="${n(S * 0.22)}" aria-hidden="true">`;
  for (const couleur of [CASE_FONCEE, CASE_CLAIRE]) {
    const rangs = [0, 1, 2, 3, 4, 5, 6, 7].filter(r => encre(0, r) === couleur);
    t += `<text x="${rangs.map(() => n(m)).join(" ")}" y="${rangs.map(r => n(r * S + S * 0.25)).join(" ")}" fill="${couleur}">${rangs.map(r => flipped ? r + 1 : 8 - r).join("")}</text>`;
    const cols = [0, 1, 2, 3, 4, 5, 6, 7].filter(f => encre(f, 7) === couleur);
    t += `<text x="${cols.map(f => n((f + 1) * S - m)).join(" ")}" y="${n(8 * S - m)}" text-anchor="end" fill="${couleur}">${cols.map(f => (flipped ? "hgfedcba" : "abcdefgh")[f]).join("")}</text>`;
  }
  return t + "</g>";
}
function boardSvg(fen, size, flipped, coords) {
  const S = size / 8;
  let rows = fen.split(" ")[0].split("/");
  if (flipped) rows = rows.slice().reverse().map(row => row.split("").reverse().join(""));
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Chess position">`;
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    svg += `<rect x="${f * S}" y="${r * S}" width="${S}" height="${S}" fill="${(f + r) % 2 ? CASE_FONCEE : CASE_CLAIRE}"/>`;
  }
  if (coords) svg += coordsSvg(size, flipped);
  /* Les formes de pieces sont declarees une fois en <defs> et posees par
     <use>. Auparavant chaque piece repetait ses chemins complets, ce qui
     faisait 19 Ko par diagramme, soit 40 Mo pour les seules pages
     d'exercices. On ne declare que les pieces reellement presentes. */
  const need = new Set();
  rows.forEach(row => { for (const ch of row) if (!(ch >= "1" && ch <= "8")) need.add(ch); });
  let defs = "";
  for (const ch of need) {
    const white = ch === ch.toUpperCase();
    defs += `<symbol id="p${white ? "w" : "b"}${ch.toLowerCase()}" viewBox="0 0 45 45">` +
      pieceShapes(ch.toLowerCase(), white) + `</symbol>`;
  }
  svg += `<defs>${defs}</defs>`;
  rows.forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (ch >= "1" && ch <= "8") { f += +ch; continue; }
      const white = ch === ch.toUpperCase();
      svg += `<use href="#p${white ? "w" : "b"}${ch.toLowerCase()}" x="${(f * S).toFixed(1)}" y="${(r * S).toFixed(1)}" width="${S}" height="${S}"/>`;
      f++;
    }
  });
  return svg + "</svg>";
}
var DICTS = {"en":{},"fr":{"Puzzle of the day":"Exercice du jour","Solve":"Résoudre","White to play and mate in {n} move.":"Les Blancs jouent et matent en {n} coup.","White to play and mate in {n} moves.":"Les Blancs jouent et matent en {n} coups.","Black to play and mate in {n} move.":"Les Noirs jouent et matent en {n} coup.","Black to play and mate in {n} moves.":"Les Noirs jouent et matent en {n} coups.","White to play and win.":"Les Blancs jouent et gagnent.","Black to play and win.":"Les Noirs jouent et gagnent."},"es":{"Puzzle of the day":"Ejercicio del día","Solve":"Resolver","White to play and mate in {n} move.":"Juegan las blancas y dan mate en {n} jugada.","White to play and mate in {n} moves.":"Juegan las blancas y dan mate en {n} jugadas.","Black to play and mate in {n} move.":"Juegan las negras y dan mate en {n} jugada.","Black to play and mate in {n} moves.":"Juegan las negras y dan mate en {n} jugadas.","White to play and win.":"Juegan las blancas y ganan.","Black to play and win.":"Juegan las negras y ganan."},"pt":{"Puzzle of the day":"Exercício do dia","Solve":"Resolver","White to play and mate in {n} move.":"As brancas jogam e dão mate em {n} lance.","White to play and mate in {n} moves.":"As brancas jogam e dão mate em {n} lances.","Black to play and mate in {n} move.":"As pretas jogam e dão mate em {n} lance.","Black to play and mate in {n} moves.":"As pretas jogam e dão mate em {n} lances.","White to play and win.":"As brancas jogam e ganham.","Black to play and win.":"As pretas jogam e ganham."},"de":{"Puzzle of the day":"Aufgabe des Tages","Solve":"Lösen","White to play and mate in {n} move.":"Weiß zieht und setzt in {n} Zug matt.","White to play and mate in {n} moves.":"Weiß zieht und setzt in {n} Zügen matt.","Black to play and mate in {n} move.":"Schwarz zieht und setzt in {n} Zug matt.","Black to play and mate in {n} moves.":"Schwarz zieht und setzt in {n} Zügen matt.","White to play and win.":"Weiß zieht und gewinnt.","Black to play and win.":"Schwarz zieht und gewinnt."},"ru":{"Puzzle of the day":"Задача дня","Solve":"Решать","White to play and mate in {n} move.":{"one":"Белые начинают и ставят мат в {n} ход.","few":"Белые начинают и ставят мат в {n} хода.","many":"Белые начинают и ставят мат в {n} ходов.","other":"Белые начинают и ставят мат в {n} хода."},"White to play and mate in {n} moves.":{"one":"Белые начинают и ставят мат в {n} ход.","few":"Белые начинают и ставят мат в {n} хода.","many":"Белые начинают и ставят мат в {n} ходов.","other":"Белые начинают и ставят мат в {n} хода."},"Black to play and mate in {n} move.":{"one":"Чёрные начинают и ставят мат в {n} ход.","few":"Чёрные начинают и ставят мат в {n} хода.","many":"Чёрные начинают и ставят мат в {n} ходов.","other":"Чёрные начинают и ставят мат в {n} хода."},"Black to play and mate in {n} moves.":{"one":"Чёрные начинают и ставят мат в {n} ход.","few":"Чёрные начинают и ставят мат в {n} хода.","many":"Чёрные начинают и ставят мат в {n} ходов.","other":"Чёрные начинают и ставят мат в {n} хода."},"White to play and win.":"Белые начинают и выигрывают.","Black to play and win.":"Чёрные начинают и выигрывают."},"it":{"Puzzle of the day":"Esercizio del giorno","Solve":"Risolvi","White to play and mate in {n} move.":"Il Bianco muove e dà matto in {n} mossa.","White to play and mate in {n} moves.":"Il Bianco muove e dà matto in {n} mosse.","Black to play and mate in {n} move.":"Il Nero muove e dà matto in {n} mossa.","Black to play and mate in {n} moves.":"Il Nero muove e dà matto in {n} mosse.","White to play and win.":"Il Bianco muove e vince.","Black to play and win.":"Il Nero muove e vince."},"tr":{"Puzzle of the day":"Günün bulmacası","Solve":"Çöz","White to play and mate in {n} move.":"Beyaz oynar ve {n} hamlede mat eder.","White to play and mate in {n} moves.":"Beyaz oynar ve {n} hamlede mat eder.","Black to play and mate in {n} move.":"Siyah oynar ve {n} hamlede mat eder.","Black to play and mate in {n} moves.":"Siyah oynar ve {n} hamlede mat eder.","White to play and win.":"Beyaz oynar ve kazanır.","Black to play and win.":"Siyah oynar ve kazanır."},"pl":{"Puzzle of the day":"Zadanie dnia","Solve":"Rozwiąż","White to play and mate in {n} move.":{"one":"Białe zaczynają i dają mata w {n} ruchu.","other":"Białe zaczynają i dają mata w {n} ruchach."},"White to play and mate in {n} moves.":{"one":"Białe zaczynają i dają mata w {n} ruchu.","other":"Białe zaczynają i dają mata w {n} ruchach."},"Black to play and mate in {n} move.":{"one":"Czarne zaczynają i dają mata w {n} ruchu.","other":"Czarne zaczynają i dają mata w {n} ruchach."},"Black to play and mate in {n} moves.":{"one":"Czarne zaczynają i dają mata w {n} ruchu.","other":"Czarne zaczynają i dają mata w {n} ruchach."},"White to play and win.":"Białe zaczynają i wygrywają.","Black to play and win.":"Czarne zaczynają i wygrywają."},"id":{"Puzzle of the day":"Teka-teki hari ini","Solve":"Pecahkan","White to play and mate in {n} move.":"Putih jalan dan skakmat dalam {n} langkah.","White to play and mate in {n} moves.":"Putih jalan dan skakmat dalam {n} langkah.","Black to play and mate in {n} move.":"Hitam jalan dan skakmat dalam {n} langkah.","Black to play and mate in {n} moves.":"Hitam jalan dan skakmat dalam {n} langkah.","White to play and win.":"Putih jalan dan menang.","Black to play and win.":"Hitam jalan dan menang."}};
var ACCUEILS = {"en":"/","fr":"/fr/","es":"/es/","pt":"/pt/","de":"/de/","ru":"/ru/","it":"/it/","tr":"/tr/","pl":"/pl/","id":"/id/"};
var lang = new URLSearchParams(location.search).get("lang");
if (!ACCUEILS[lang]) lang = "en";
var dict = DICTS[lang] || {};
function t(k, v) {
  var s = dict[k];
  if (s && typeof s === "object") {
    var f = "other";
    try { f = new Intl.PluralRules(lang).select(v && v.n || 0); } catch (e) {}
    s = s[f] || s.other;
  }
  if (typeof s !== "string") s = k;
  return s.replace(/\{(\w+)\}/g, function (x, c) { return v && c in v ? v[c] : x; });
}
function $(id) { return document.getElementById(id); }
document.documentElement.lang = lang;
$("lien").href = location.origin + ACCUEILS[lang] + "#daily";
$("titre").textContent = t("Puzzle of the day");
$("bouton").textContent = t("Solve");
function lire(chemin) {
  return fetch(chemin).then(function (r) { if (!r.ok) throw new Error(chemin + " " + r.status); return r.json(); });
}
var d = new Date();
var n = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
lire("/data/jour.json").then(function (jour) {
  var l = jour.ids, i = n - jour.debut, id = l[((i % l.length) + l.length) % l.length];
  return lire("/data/ids/" + Math.floor(+id.slice(1) / 10000) + ".json").then(function (index) {
    var e = index[id];
    return lire("/data/level-" + e[0] + "-" + e[1] + ".json").then(function (lot) {
      for (var k = 0; k < lot.length; k++) if (lot[k].id === id) return lot[k];
      throw new Error(id);
    });
  });
}).then(function (p) {
  var noirs = p.fen.split(" ")[1] === "b";
  var camp = noirs ? "Black" : "White";
  $("plateau").innerHTML = boardSvg(p.fen, 360, noirs);
  $("plateau").firstChild.setAttribute("aria-label", t("Puzzle of the day"));
  $("consigne").textContent = p.type === "mate"
    ? t(camp + " to play and mate in {n} " + (p.n > 1 ? "moves." : "move."), { n: p.n })
    : t(camp + " to play and win.");
}).catch(function () { $("plateau").style.display = "none"; });
})();
