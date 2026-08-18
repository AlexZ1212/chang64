/* Set de pieces officiel de chang64, dessine par l'auteur.
   Les formes sont reprises telles quelles des SVG d'origine : ni geometrie,
   ni proportions, ni epaisseurs de contour ne sont modifiees.

   Les formes marquees "fixe" n'ont pas de fill declare dans le SVG source,
   donc elles s'affichent en noir : ce sont l'oeil et le naseau du cavalier.
   Elles ne doivent jamais etre recolorees, sous peine de disparaitre dans le
   corps d'une piece noire.

   Les pieces sont integrees au code plutot que servies en six fichiers : pas
   de requete reseau, pas d'affichage differe, et moins d'octets que l'ancien
   jeu (0,9 Ko contre 3). */
const PIECES={"p":[{"t":"path","d":"M14.31,33.79h16.38c1.14,0,2.07.93,2.07,2.07v2.14H12.24v-2.14c0-1.14.93-2.07,2.07-2.07Z","fixe":false},{"t":"path","d":"M31.85,34.14c-1.31-1.01-6.34-5.24-6.57-11.44-.84.03-1.78.03-2.77.03s-1.94,0-2.77-.03c-.24,6.2-5.26,10.43-6.57,11.44,0,0,0,0,0,0,.33-.22.73-.35,1.16-.35h16.38c.43,0,.83.13,1.16.35,0,0,0,0,0,0Z","fixe":false},{"t":"path","d":"M28.82,21.68c0,1.02-2.83,1.05-6.32,1.05s-6.32-.04-6.32-1.05,1.41-2.63,6.32-2.63,6.32,1.61,6.32,2.63Z","fixe":false},{"t":"circle","cx":"22.5","cy":"13.53","r":"5.53","fixe":false}],"n":[{"t":"path","d":"M14.4,33.1h20.67c1.39,0,2.52,1.13,2.52,2.52v2.38H11.88v-2.38c0-1.39,1.13-2.52,2.52-2.52Z","fixe":false,"sw":"1"},{"t":"path","d":"M14.65,21.66c.97-.66,4.68-.28,7.56-3.75.52-.62.98,1.68-.34,3.64-2.86,4.23-8.3,4.94-8.39,11.72.29-.11.6-.18.92-.18h20.67c.52,0,1,.16,1.4.42-.55-.46-1.93-1.71-1.93-2.68,0-1.21.9-4.35.9-9.83s-4.54-14.07-12.47-14.07l-3.39-2.95-.75,2.7-3-1.87s-.15,2.38-.24,4.01c-.54.3-2.22.96-4.03,5.99-.63,1.75-4.15,3-4.15,6.07,0,3.41,3.21,3.83,3.82,3.83,1.57,0,2.36-2.34,3.42-3.06Z","fixe":false,"sw":"1"},{"t":"path","d":"M18.54,13.2c.9-.63.98-1.58,1.21-2.02.03-.06-.02-.12-.08-.12-.49.06-1.4-.18-2.31.45-.9.64-.98,1.58-1.2,2.02-.03.06.02.12.08.12.49-.06,1.4.18,2.3-.45Z","fixe":true},{"t":"path","d":"M10.24,20.58c-.46.42-.86.73-1.07.5s.14-1.16.6-1.57.87-.16,1.08.07-.15.59-.61,1.01Z","fixe":true}],"b":[{"t":"path","d":"M13.5,32.74h18c1.36,0,2.47,1.11,2.47,2.47v2.79H11.03v-2.79c0-1.36,1.11-2.47,2.47-2.47Z","fixe":false,"sw":"1"},{"t":"path","d":"M27.46,32.74c2.5-2.65,5.01-6.42,5.01-10.9,0-3.8-1.45-6.58-3.24-8.82l-5.4,8.41c-.44.69-1.36.89-2.04.45h0c-.69-.44-.89-1.36-.45-2.04l5.83-9.09c-.88-.88-1.74-1.69-2.49-2.47.4-.56.6-1.27.47-2.04-.18-1.1-1.08-2.02-2.18-2.21-1.7-.29-3.18,1.01-3.18,2.66,0,.59.19,1.13.51,1.58-2.94,3.06-7.78,6.6-7.78,13.55,0,4.48,2.51,8.26,5.01,10.9h9.93Z","fixe":false,"sw":"1"}],"r":[{"t":"path","d":"M12.99,33.03h19.01c1.35,0,2.45,1.1,2.45,2.45v2.52H10.54v-2.52c0-1.35,1.1-2.45,2.45-2.45Z","fixe":false},{"t":"path","d":"M29.17,15.8c-.07,0-.15.01-.23.01h-12.88c-.08,0-.15,0-.23-.01-.01,5.69-.51,15.85-3.95,17.49,0,0,0,0,0,0,.33-.17.71-.27,1.11-.27h19.01c.4,0,.78.1,1.11.27,0,0,0,0,0,0-3.45-1.65-3.94-11.8-3.95-17.49Z","fixe":false},{"t":"path","d":"M27.96,8v2.99h-2.92v-2.99h-5.07v2.99h-2.92v-2.99h-4.29v4.5c0,1.83,1.48,3.31,3.31,3.31h12.88c1.83,0,3.31-1.48,3.31-3.31v-4.5h-4.29Z","fixe":false}],"q":[{"t":"path","d":"M31.62,31.91H13.38c-2.1,0-3.82,1.72-3.82,3.82v2.27h25.88v-2.27c0-2.11-1.71-3.82-3.82-3.82Z","fixe":false},{"t":"path","d":"M39.59,11.71c-.8-1.1-2.33-1.34-3.43-.54s-1.34,2.33-.54,3.43c.02.02.04.04.05.07l-5.35,6.05.82-10.77c.83-.06,1.62-.53,2.03-1.33.62-1.21.14-2.69-1.07-3.3-.19-.1-.39-.16-.58-.21h0s0,0,0,0c-1.07-.24-2.2.26-2.72,1.28-.55,1.07-.23,2.35.69,3.06l-4.16,8.89-1.94-10.57c.93-.35,1.58-1.25,1.58-2.29,0-1.36-1.1-2.46-2.46-2.46h0c-1.36,0-2.46,1.1-2.46,2.46,0,1.05.66,1.94,1.58,2.29l-1.94,10.57-4.16-8.89c.92-.71,1.23-1.99.69-3.06-.52-1.02-1.65-1.52-2.72-1.28h0s0,0,0,0c-.2.04-.39.11-.58.21-1.21.62-1.69,2.1-1.07,3.3.41.8,1.19,1.28,2.03,1.33l.82,10.77-5.35-6.05s.04-.04.05-.07c.8-1.1.55-2.63-.54-3.43s-2.63-.55-3.43.54c-.8,1.1-.55,2.63.54,3.43.58.42,1.29.55,1.94.42,1.81,4.84,4.41,12.39,4.63,16.46.28-.06.56-.1.86-.1h18.24c.3,0,.58.04.86.1.22-4.07,2.81-11.61,4.63-16.46.65.13,1.36,0,1.94-.42,1.1-.8,1.34-2.33.54-3.43Z","fixe":false}],"k":[{"t":"path","d":"M31.54,31.96H13.46c-2.08,0-3.79,1.7-3.79,3.79v2.25h25.66v-2.25c0-2.09-1.7-3.79-3.79-3.79Z","fixe":false,"sw":".98"},{"t":"path","d":"M31.08,12.5c-1.67,0-3.32.64-4.72,1.42l-1.8-2.32v-1.53h2.95v-4.12h-2.95v-2.95h-4.12v2.95h-2.95v4.12h2.95v1.53l-1.8,2.32c-1.4-.78-3.05-1.42-4.72-1.42-2.74,0-7.28,2.13-7.28,7.55,0,5.98,5.8,8.15,6.78,11.92.01,0,.03,0,.04,0h18.08s.03,0,.04,0c.97-3.77,6.78-5.94,6.78-11.92,0-5.41-4.54-7.55-7.28-7.55ZM29.1,25.07c-.58.62-1.23,1.31-1.82,2.09-.14.18-.35.29-.58.29-.35,0-.84,0-.81,0v-7.39c1.3-.96,2.57-1.55,3.39-1.56.42.03,2.24.27,2.24,2.46,0,1.37-.74,2.3-2.42,4.1ZM13.48,20.97c0-2.19,1.82-2.44,2.24-2.46.82.01,2.09.6,3.39,1.56v7.39s-.46,0-.81,0c-.23,0-.44-.11-.58-.29-.59-.77-1.24-1.46-1.82-2.09-1.68-1.8-2.42-2.73-2.42-4.1Z","fixe":false,"sw":".98"}]};
/* Boite englobante horizontale de chaque piece, marge de contour comprise.
   Sert a cadrer au plus juste les pieces prises : chacune a un vide interne
   different (de 2,4 a 6 px sur 22), donc sans recadrage aucune ne s aligne,
   ni sur le nom du joueur ni sur les autres. */
const PIECE_BB={"p":[11,34],"n":[6.2,38.8],"b":[9.8,35.2],"r":[9.3,35.7],"q":[3.8,41.3],"k":[5.4,39.6]};
/* Blanc et noir partagent le meme contour ; seul le remplissage change. */
const PIECE_COLORS={w:{fill:"#eceae3"},b:{fill:"#232b28"}};
const PIECE_STROKE="#101413";
function pieceSVG(t,c,serre){
  const remplissage=(PIECE_COLORS[c]||PIECE_COLORS.w).fill;
  /* serre : cadre la piece sur sa boite englobante au lieu du carre de 45.
     Utilise pour les pieces prises, qui doivent se toucher et partir du bord. */
  const bb=serre&&PIECE_BB[t];
  const vb=bb?(bb[0]+" 0 "+(bb[1]-bb[0])+" 45"):"0 0 45 45";
  let s='<svg viewBox="'+vb+'" aria-hidden="true">';
  for(const f of PIECES[t]||[]){
    const attrs=[];
    if(f.t==="circle")attrs.push('cx="'+f.cx+'" cy="'+f.cy+'" r="'+f.r+'"');
    else attrs.push('d="'+f.d+'"');
    if(!f.fixe){
      attrs.push('fill="'+remplissage+'"');
      attrs.push('stroke="'+(f.st||PIECE_STROKE)+'"');
      attrs.push('stroke-linecap="round" stroke-linejoin="round"');
    } else {
      /* Oeil et naseau : un simple remplissage a la couleur du contour des
         pieces, sans contour propre. Leur donner le remplissage de la piece
         les ferait disparaitre dans le corps. */
      attrs.push('fill="'+PIECE_STROKE+'"');
    }
    if(f.sw)attrs.push('stroke-width="'+f.sw+'"');
    s+='<'+f.t+' '+attrs.join(' ')+'/>';
  }
  return s+'</svg>';
}
const MARK_PATHS=["M23 15.4C14 11 3 16.4 3 25.8c0 7.4 5.6 13.6 13 16.4L23 34z","M41 15.4C50 11 61 16.4 61 25.8c0 7.4-5.6 13.6-13 16.4L41 34z","M32 5c-8.6 0-14.4 6-14.4 14.2V36c0 4.4 2.4 7.8 6.4 9.2V30h16v15.2c4-1.4 6.4-4.8 6.4-9.2V19.2C46.4 11 40.6 5 32 5z","M24 38l-3.6.6c-4 5-5.8 11-5.4 17.4 2.6-6 5.4-10.4 9-13.4z","M40 38l3.6.6c4 5 5.8 11 5.4 17.4-2.6-6-5.4-10.4-9-13.4z","M27 30h10v16c0 5.4-2.2 9-2.2 11.8 0 2.8 2.6 4 4.6 2.2-1.4 3.6-6.6 4-9.6 1.2-2.8-2.6-3.8-6.4-3.8-11.4z"];
function markSVG(fill){
  return '<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="'+fill+'">'+
    MARK_PATHS.map(d=>'<path d="'+d+'"/>').join("")+'</g></svg>';
}