/* Sélection · l'outil de décision (24/11/2026).
   Données : donnees/<slug>/selection.json (+ details.json facultatif : matière, photos, tailles et prix par taille, lus par
   ~/Documents/selection/details.py) + choix.json. Choix : localStorage marques-choix-<slug> (clé de l'app Marques) + POST /api/upload
   selection-choix-<slug>-<ts>.json {slug,url,marque,titre,decision:garde|jette|annule,t} → ~/Documents/selection/choix.py.
   Couches : 1) tuile = 3 faits (prix + vraie remise, ta taille, la raison) ; 2) appui long = fiche complète ; 3) Ma sélection = gardées
   classées, toutes les infos. Strict : quitter une page = les pièces non gardées passent ; limite de garde (12 par défaut) = duel. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LS=k=>{try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},SV=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const hap=k=>{try{window.ToknApp&&window.ToknApp.haptic&&window.ToknApp.haptic(k||'light')}catch(e){}};
let tT;const toast=(m,ms)=>{const t=$('toast');t.textContent=m;t.classList.add('on');clearTimeout(tT);tT=setTimeout(()=>t.classList.remove('on'),ms||1700)};
const ouvrirLien=u=>{if(!u)return;try{if(window.ToknApp&&window.ToknApp.ouvrir){window.ToknApp.ouvrir(u);return}}catch(e){}window.open(u,'_blank','noopener')};
const petite=u=>{u=String(u||'');return /cdn\.shopify\.com/.test(u)&&!/[?&]width=/.test(u)?u+(u.includes('?')?'&':'?')+'width=400':u};
const roule=(el,n)=>{if(!el)return;const s=String(n),p=el.dataset.v||'';if(s===p)return;el.dataset.v=s;const w=Math.max(s.length,p.length),a=s.padStart(w,' '),b=p.padStart(w,' ');el.innerHTML=[...a].map((c,i)=>c===' '?'':`<span class="ch"${c===b[i]?' style="animation:none"':''}>${c}</span>`).join('')};
const TX={EUR:1,GBP:1.15,USD:1/1.105,AUD:1/1.7,SEK:1/11.5,DKK:1/7.46,JPY:1/176.83,CHF:1.06};
const eur=x=>x.prix_eur!=null?x.prix_eur:(x.prix?x.prix*(TX[x.devise||'EUR']||1):null);
const fmtE=n=>n==null?'':Math.round(n)+' €';

/* ---------- État ---------- */
const estAffil=x=>x&&(x.type==='affiliation'||x.slug==='affiliation');
const S={slug:null,s:null,IDX:[],P:[],D:{},CH:{},T:{},RANG:[],LIM:12,TA:{v:null,p:null},pages:[],ip:0,cols:2,rows:3};

/* ---------- Tailles : on ramène tout à TA taille (lettre) et TA pointure (EU) ---------- */
const LET=['XXS','XS','S','M','L','XL','XXL','3XL','4XL'];
const genre=x=>{const t=(x.type||'')+' '+(x.theme||'')+' '+(x.titre||'');if(/sneaker|chaussure|shoe|boot|basket|mocassin|derby|loafer|runner|trainer|sandal|mule|clog/i.test(t))return 'p';if(/pantalon|jean|short|trouser|\bpants?\b|chino|cargo|jogger/i.test(t))return 'b';return 'h'};
function norm(raw,g){let s=String(raw||'').trim();if(!s)return null;const U=s.toUpperCase().replace(/\s+/g,' ');
  if(/^(OS|O\/S|ONE SIZE|TU|TAILLE UNIQUE|UNIQUE|ONESIZE)$/.test(U))return {l:'TU',c:'TU',a:false};
  if(g==='p'){let m;
    if((m=U.match(/UK\s?(\d{1,2}(?:[.,]5)?)/)))return {l:s,c:+m[1].replace(',','.')+34,a:true};
    if((m=U.match(/(\d{1,2}(?:[.,]5)?)\s?US|US\s?M?\s?(\d{1,2}(?:[.,]5)?)/)))return {l:s,c:+(m[1]||m[2]).replace(',','.')+33.5,a:true};
    if((m=U.match(/(\d{2})(?:[.,](\d))?(?:\s?(1\/2|½|⅓|⅔|1\/3|2\/3))?/))){let n=+m[1]+(m[2]?+('0.'+m[2]):0);const f=m[3];if(f)n+=/1\/2|½/.test(f)?.5:/1\/3|⅓/.test(f)?.33:.67;if(n>=34&&n<=50)return {l:s,c:n,a:false}}
    return {l:s,c:null,a:false}}
  let m=U.match(/^(?:W\s?)?(\d{2})(?:\s?[\/X]\s?(?:L\s?)?\d{2})?$/);
  if(g==='b'&&m){const w=+m[1];if(w>=26&&w<=44){const c=w<30?'XS':w<32?'S':w<34?'M':w<36?'L':w<38?'XL':'XXL';return {l:'W'+w,c,a:true}}}
  const t=U.split(/\s?\/\s?|\s+(?=USA|ASIA|EU)/)[0].replace(/\s?(USA|US|EU|ASIA|INT)$/,'').trim();
  const mots={'XX-SMALL':'XXS','X-SMALL':'XS','EXTRA SMALL':'XS','SMALL':'S','MEDIUM':'M','LARGE':'L','X-LARGE':'XL','EXTRA LARGE':'XL','XX-LARGE':'XXL','2XL':'XXL','XXL':'XXL','XXX-LARGE':'3XL','XXXL':'3XL','3XL':'3XL','4XL':'4XL','XXXXL':'4XL'};
  if(mots[t])return {l:mots[t],c:mots[t],a:false};
  if(LET.includes(t))return {l:t,c:t,a:false};
  if((m=t.match(/^(?:IT\s?|EU\s?)?(4[4-9]|5[0-8])$/))){const n=+m[1];const c={44:'XS',46:'S',48:'M',50:'L',52:'XL',54:'XXL',56:'3XL',58:'4XL'}[n-(n%2)];return {l:s,c,a:true}}
  if((m=t.match(/^([0-5])$/))){return {l:s,c:['XS','S','M','L','XL','XXL'][+m[1]],a:true}}
  return {l:s,c:null,a:false}}
function tailles(x){const g=genre(x),d=S.D[x.url];let L=[];
  if(d&&d.tailles&&d.tailles.length)L=d.tailles.map(t=>({...norm(t.t,g),dispo:!!t.dispo,prix:t.prix,barre:t.barre})).filter(t=>t.l);
  else if(Array.isArray(x.tailles_dispo))L=x.tailles_dispo.map(t=>({...norm(t,g),dispo:true})).filter(t=>t.l);
  else if(typeof x.tailles==='string'&&!/^\d+\s?\/\s?\d+$/.test(x.tailles))L=x.tailles.split(/\s?[·,|]\s?/).map(t=>({...norm(t,g),dispo:true})).filter(t=>t.l);
  return L}
const nDispo=x=>{const L=tailles(x);if(L.length)return L.filter(t=>t.dispo).length;const m=String(x.tailles||'').match(/^(\d+)\s?\/\s?\d+$/);return m?+m[1]:null};
function maTaille(x){const g=genre(x),moi=g==='p'?S.TA.p:S.TA.v;if(moi==null)return null;const L=tailles(x);if(!L.length)return null;
  if(L.some(t=>t.c==='TU'))return {ok:true,l:'TU'};
  const hit=g==='p'?L.filter(t=>typeof t.c==='number'&&Math.abs(t.c-moi)<=.5):L.filter(t=>t.c===moi);
  const lab=g==='p'?String(moi).replace('.',','):moi;
  if(!hit.length)return {ok:false,l:lab,absent:true};
  const ok=hit.find(t=>t.dispo);
  /* prix dans ta taille : les variantes sont dans la devise de la boutique ; on ne garde que l'écart relatif au prix courant */
  const pv=L.map(t=>t.prix).filter(v=>v>0),freq={};pv.forEach(v=>freq[v]=(freq[v]||0)+1);const mode=+Object.keys(freq).sort((p,q)=>freq[q]-freq[p])[0];
  const v=(ok||hit[0]).prix,e=eur(x);const prix=v&&mode&&e&&Math.abs(v-mode)/mode>.03?e*v/mode:null;
  return {ok:!!ok,l:lab,approx:hit.every(t=>t.a),prix}}

/* ---------- Les 3 faits ---------- */
function remise(x){const an=x.remise||(x.barre&&x.prix&&x.barre>x.prix?Math.round((1-x.prix/x.barre)*100):null);const m=String(x.pourquoi||'').match(/(\d{1,2})\s?%\s?sous le prix habituel/i);
  if(m)return {v:+m[1],vraie:true,an:an?+an:null};
  if(/constat/i.test(x.preuve||'')&&an)return {v:+an,vraie:true,an:+an};
  return an?{v:+an,vraie:false,an:+an}:null}
/* la raison = pourquoi elle est là (communauté, note, atout, matière), jamais l'économie : la remise est déjà dans la pastille */
function raison(x){const pq=String(x.pourquoi||''),d=S.D[x.url]||{},R=[];
  if(x.note)R.push(x.note.split(/[.;]/)[0]);
  if(/communaut/i.test(pq)&&!S.comU)R.push('Communauté');else if(x.catalogue===true)R.push('Ton catalogue');
  (d.atouts||[]).slice(0,1).forEach(a=>R.push(a));
  const mt=(d.matiere||[])[0];if(mt&&R.length<3)R.push(mt.replace(/\s+/g,' ').replace(/^(\d+)\s?%/,'$1 %'));
  if(R.length<2&&d.coupe)R.push('Coupe '+d.coupe);
  if(!R.length){const n=nDispo(x);if(n)R.push(`${n} taille${n>1?'s':''} en stock`)}
  return R.slice(0,2).join(' · ')}
/* tuile : la vraie remise seule si on l'a (le barré de la boutique est souvent gonflé) ; fiche : les deux, nommées */
const prixHTML=(x,mode)=>{const r=remise(x),b=x.barre&&x.prix&&x.barre>x.prix?Math.round(x.barre*(TX[x.devise||'EUR']||1)):null,p=`<b>${x.prix?fmtE(eur(x)):'prix ?'}</b>`;
  if(mode==='fiche')return p+(b?`<s>${b} €</s>`:'')+(r&&r.an?`<span class="pill annonce">−${r.an} % annoncé</span>`:'')+(r&&r.vraie?`<span class="pill vraie">−${r.v} % réel</span>`:'');
  if(r&&r.vraie)return p+`<span class="pill vraie">−${r.v} % réel</span>`;
  return p+(b?`<s>${b} €</s>`:'')+(mode&&r?`<span class="pill annonce">−${r.v} %</span>`:'')};
const tailleBadge=x=>{const m=maTaille(x);if(m)return `<span class="tl ${m.ok?'ok':'non'}">${m.ok?`${esc(m.l)}${m.approx?' ≈':''} ✓`:`épuisé en ${esc(m.l)}`}</span>`;const n=nDispo(x);return n!=null?`<span class="tl">${n} taille${n>1?'s':''}</span>`:''};

/* ---------- Données ---------- */
async function charger(){
  const qs=new URLSearchParams(location.search);
  const pre=window.__pre||{};
  try{S.IDX=(pre.idx?await pre.idx:null)||await (await fetch('donnees/index.json?'+Date.now())).json()}catch(e){S.IDX=[]}
  const prets=S.IDX.filter(x=>(!x.statut||x.statut==='prête')&&!estAffil(x)).sort((a,b)=>(Date.parse(b.maj||'')||0)-(Date.parse(a.maj||'')||0));
  let slug=qs.get('s')||decodeURIComponent(location.hash.slice(1)||'')||LS('sel-derniere');if(slug==='affiliation')slug=null;
  if(!slug||(!qs.get('s')&&!S.IDX.some(x=>x.slug===slug)))slug=(prets[0]||{}).slug;
  if(!slug)throw new Error('aucune sélection');
  S.slug=slug;S.s=S.IDX.find(x=>x.slug===slug)||{slug,titre:slug};
  const lire=f=>fetch(`donnees/${slug}/${f}?`+Date.now()).then(r=>r.ok?r.json():null).catch(()=>null);
  const pd=pre.slug===slug&&pre.d;
  let [P,SRV,DD]=await Promise.all(pd?[pd.sel,pd.ch,pd.dd]:[lire('selection.json'),lire('choix.json'),lire('details.json')]);if(pd&&!P)P=await lire('selection.json');SV('sel-courante',slug);if(!P)throw new Error('selection.json');P=Array.isArray(P)?P:(P.produits||[]);SRV=SRV||{};
  try{if(DD){const D=DD;for(const k in D)S.D[k]=D[k];P.forEach(x=>{const u=x.url.split('?')[0].split('#')[0].replace(/\/$/,'');if(D[u]&&!D[x.url])S.D[x.url]=D[u]})}}catch(e){}
  for(const k in S.D)if(S.D[k]&&S.D[k].erreur)delete S.D[k];
  const K='marques-choix-'+slug;S.K=K;
  /* 24/11 : le serveur fait foi quand il est plus récent que l'appareil (choix.json du cerveau : dernier geste par pièce, d=null = remise en jeu) */
  const LOC=LS(K)||{},LT=LS('sel-t-'+slug)||{};S.CH=Object.assign({},LOC);S.T=Object.assign({},LT);let maj=0;
  Object.entries(SRV).forEach(([u,v])=>{const ts=v.t||0;if(u in LOC||u in LT){if(ts>(LT[u]||0)){if(v.d)S.CH[u]=v.d;else delete S.CH[u];S.T[u]=ts;maj++}}else if(v.d){S.CH[u]=v.d;S.T[u]=ts}});
  if(maj){SV(K,S.CH);SV('sel-t-'+slug,S.T)}
  /* groupes : on compare ce qui se ressemble (sneakers avec sneakers) ; meilleurs d'abord dans chaque groupe */
  const g={};P.forEach(x=>{const k=x.theme||'Autres';(g[k]=g[k]||[]).push(x)});
  let G=Object.entries(g);const petits=G.filter(([,L])=>L.length<3);if(petits.length>1){G=G.filter(([,L])=>L.length>=3);G.push(['Le reste',petits.flatMap(([,L])=>L)])}
  G.sort((a,b)=>b[1].length-a[1].length);
  S.G=G;S.TA=Object.assign({v:null,p:null},LS('sel-taille')||{});ordonner();S.comU=S.P.filter(x=>/communaut/i.test(x.pourquoi||'')).length>=.8*S.P.length;
  S.LIM=LS('sel-limite')||12;S.TA=Object.assign({v:null,p:null},LS('sel-taille')||{});
  rangRecal();document.title=(S.s.titre||slug)+' · Sélection';
}
/* ordre dans chaque groupe : meilleur score d'abord, les pièces épuisées dans ta taille à la fin */
function ordonner(){const cle=x=>(ep(x)?1e6:0)+(x.score!=null?-x.score:-(remise(x)||{v:0}).v);S.G.forEach(([,L])=>L.sort((a,b)=>cle(a)-cle(b)));S.P=S.G.flatMap(([,L])=>L)}
const gardees=()=>S.P.filter(x=>S.CH[x.url]==='g');
function rangRecal(){const R=(LS('sel-rang-'+S.slug)||[]).filter(u=>S.CH[u]==='g');const set=new Set(R);
  gardees().filter(x=>!set.has(x.url)).sort((a,b)=>(S.T[a.url]||0)-(S.T[b.url]||0)).forEach(x=>R.push(x.url));S.RANG=R;SV('sel-rang-'+S.slug,R)}
async function decider(x,d,silence){const u=x.url,av=S.CH[u];if(d)S.CH[u]=d;else delete S.CH[u];SV(S.K,S.CH);S.T[u]=Date.now();SV('sel-t-'+S.slug,S.T);
  if(d==='g'&&av!=='g'&&!S.RANG.includes(u))S.RANG.push(u);if(d!=='g')S.RANG=S.RANG.filter(v=>v!==u);SV('sel-rang-'+S.slug,S.RANG);
  if(!silence)hap(d==='g'?'medium':'light');
  try{const r=await fetch('/api/upload',{method:'POST',headers:{'X-Nom':`selection-choix-${S.slug}-${Date.now()}-${Math.random().toString(36).slice(2,6)}.json`,'Content-Type':'text/plain; charset=utf-8'},body:JSON.stringify({slug:S.slug,url:u,marque:x.marque,titre:x.titre,decision:d==='g'?'garde':d==='j'?'jette':'annule',t:Date.now()})});if(!r.ok)throw 0}
  catch(e){if(!S.horsLigne){S.horsLigne=true;toast('Choix gardés sur cet appareil')}}}

/* ---------- Pages ---------- */
function mesurer(){const h0=$('haut').getBoundingClientRect().height,bd=$('bandeau');bd.style.top=h0+'px';const h=h0+(bd.classList.contains('on')?bd.getBoundingClientRect().height:0),ib=$('indice').getBoundingClientRect().height+($('onglets')?$('onglets').getBoundingClientRect().height:0);const sc=$('scene');sc.style.top=h+'px';sc.style.bottom=ib+'px';
  const H=innerHeight-h-ib,W=innerWidth;const tw=(W-24-8)/2;S.rows=Math.max(2,Math.min(4,Math.floor((H+8)/(tw*1.08+8))));S.th=Math.floor((H-8*(S.rows-1)-4)/S.rows);S.H=H}
function paginer(){const n=S.cols*S.rows;S.pages=[];S.G.forEach(([nom,L])=>{const k=Math.ceil(L.length/n);for(let i=0;i<k;i++)S.pages.push({grp:nom,i:i+1,k,items:L.slice(i*n,(i+1)*n)})})}
const ep=x=>{const m=maTaille(x);return !!(m&&!m.ok)};
const tuile=x=>{const c=S.CH[x.url];return `<button class="t${c==='g'?' g':c==='j'?' j':''}${ep(x)?' ep':''}" data-u="${esc(x.url)}" style="height:${S.th}px"><span class="conf">Épuisée en ${esc((maTaille(x)||{}).l||'')} · retape pour la garder</span><span class="ph"><img src="${esc(petite(x.image_petite||x.image))}" alt="" decoding="async" draggable="false"></span>${tailleBadge(x)}<span class="coche">✓</span><span class="info"><span class="m">${esc(x.marque||'')}</span><span class="p">${prixHTML(x,true)}</span><span class="r">${esc(raison(x))}</span></span></button>`};
const pageHTML=i=>{const p=S.pages[i];return p?p.items.map(tuile).join(''):''};
let couches=null;
function peindre(){const sc=$('scene');sc.innerHTML='';couches=[-1,0,1].map(o=>{const d=document.createElement('div');d.className='page';d.dataset.o=o;d.style.transform=`translate3d(0,${o*100}%,0)`;d.innerHTML=pageHTML(S.ip+o);sc.appendChild(d);return d});
  [2,-1].forEach(o=>{const p=S.pages[S.ip+o];if(p)p.items.forEach(x=>{const i=new Image();i.src=petite(x.image_petite||x.image)})});majHaut()}
function majHaut(){const ng=gardees().length;roule($('ng'),ng);$('lim').textContent=S.LIM;
  const j=$('jauge');const n=Math.min(S.LIM,24);if(j.children.length!==n)j.innerHTML='<i></i>'.repeat(n);const GR=S.RANG.map(parU).filter(Boolean);[...j.children].forEach((d,i)=>{const on=i<ng;d.classList.toggle('ep',on&&!!GR[i]&&ep(GR[i]));if(on&&!d.classList.contains('on')){d.classList.add('neuf');setTimeout(()=>d.classList.remove('neuf'),260)}d.classList.toggle('on',on)});j.classList.toggle('plein',ng>=S.LIM);
  roule($('reste'),S.P.filter(x=>!S.CH[x.url]).length);
  const p=S.pages[S.ip];$('grp').textContent=p?`${p.grp}${p.k>1?` · ${p.i}/${p.k}`:''}`:'';
  const nPasse=p?p.items.filter(x=>!S.CH[x.url]).length:0,der=S.ip>=S.pages.length-1;
  if($('indice').classList.contains('retour'))return;$('indice-t').textContent=nPasse?`glisse · ${nPasse} passe${nPasse>1?'nt':''}`:(der?'glisse · terminer':'glisse · suite');
  if(!$('indice').classList.contains('retour'))$('taille-q').classList.toggle('on',!$('bandeau').classList.contains('on')&&(!S.TA.v||(S.P.some(x=>genre(x)==='p')&&!S.TA.p)))}
function aller(dir){const ni=S.ip+dir;if(dir>0){const p=S.pages[S.ip];const aPasser=p?p.items.filter(x=>!S.CH[x.url]):[];
    S.nPasse=aPasser.length;if(aPasser.length){aPasser.forEach(x=>decider(x,'j',true));hap('light')}
    if(ni>=S.pages.length){couches[1].classList.add('sort');setTimeout(()=>{ouvrirMa(true);S.ip=S.pages.length-1;peindre()},260);return}}
  if(ni<0){ressort();return}
  const [a,b,c]=couches;[a,b,c].forEach(d=>d.classList.add('anim'));
  if(dir>0){b.classList.add('sort');b.style.transform='translate3d(0,-100%,0)';c.style.transform='translate3d(0,0,0)'}else{b.style.transform='translate3d(0,100%,0)';a.style.transform='translate3d(0,0,0)'}
  setTimeout(()=>{S.ip=ni;SV('sel-page-'+S.slug,ni);peindre();if(dir>0&&S.nPasse){const ind=$('indice'),t=$('indice-t');ind.classList.add('retour');t.textContent=`glisse pour revenir · ${S.nPasse} passée${S.nPasse>1?'s':''}`;clearTimeout(S.tR);S.tR=setTimeout(()=>{ind.classList.remove('retour');majHaut()},2600)}},350)}
function ressort(){couches.forEach(d=>{d.classList.add('anim');d.style.transform=`translate3d(0,${d.dataset.o*100}%,0)`});setTimeout(()=>couches.forEach(d=>d.classList.remove('anim')),360)}

/* ---------- Gestes du tri : tap = garder, appui long = fiche, glisser ↑ = page suivante (les autres passent), ↓ = retour ---------- */
function gestes(){const sc=$('scene');let y0=0,x0=0,t0=0,dy=0,on=false,glisse=false,lp=null,cible=null,long=false;
  sc.addEventListener('pointerdown',e=>{if(e.button)return;on=true;glisse=false;long=false;y0=e.clientY;x0=e.clientX;t0=performance.now();dy=0;cible=e.target.closest('.t');
    couches.forEach(d=>d.classList.remove('anim'));if(cible){cible.classList.add('presse');lp=setTimeout(()=>{long=true;cible.classList.remove('presse');const x=parU(cible.dataset.u);if(x)fiche(x)},380)}
    try{sc.setPointerCapture(e.pointerId)}catch(_){}});
  sc.addEventListener('pointermove',e=>{if(!on||long)return;dy=e.clientY-y0;if(!glisse&&Math.abs(dy)>9&&Math.abs(dy)>Math.abs(e.clientX-x0)){glisse=true;clearTimeout(lp);if(cible)cible.classList.remove('presse')}
    if(glisse){let d=dy;if((d>0&&S.ip===0))d=d*.3;const [a,b,c]=couches;b.style.transform=`translate3d(0,${d}px,0)`;if(d<0)c.style.transform=`translate3d(0,calc(100% + ${d}px),0)`;else a.style.transform=`translate3d(0,calc(-100% + ${d}px),0)`}});
  const fin=e=>{if(!on)return;on=false;clearTimeout(lp);if(cible)cible.classList.remove('presse');if(long)return;
    const dt=performance.now()-t0,v=dy/Math.max(1,dt);
    if(glisse){if(dy<-70||(dy<-28&&v<-.45))aller(1);else if(dy>70||(dy>28&&v>.45))aller(-1);else ressort();return}
    if(cible&&dt<380){const x=parU(cible.dataset.u);if(x)basculer(x,cible)}};
  sc.addEventListener('pointerup',fin);sc.addEventListener('pointercancel',fin);sc.addEventListener('contextmenu',e=>e.preventDefault());
  $('haut').addEventListener('click',()=>ouvrirMa());$('taille-q').addEventListener('click',e=>{e.stopPropagation();reglerTaille()});
  document.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA/.test((e.target||{}).tagName||''))return;if($('feuille').classList.contains('on')||$('duel').classList.contains('on')){if(e.key==='Escape'){fermerFiche();fermerDuel()}return}
    if($('ma').classList.contains('on')){if(e.key==='Escape')fermerMa();return}
    if(e.key===' '||e.key==='ArrowDown'||e.key==='Enter'){e.preventDefault();aller(1)}else if(e.key==='ArrowUp'){e.preventDefault();aller(-1)}else if(e.key==='m')ouvrirMa()})}
const parU=u=>S.P.find(x=>x.url===u);
function basculer(x,el){const c=S.CH[x.url];
  if(c==='g'){const pageCourante=S.pages[S.ip]&&S.pages[S.ip].items.includes(x);decider(x,S.ip<maxVu()||!pageCourante?'j':null);if(el){el.classList.remove('g');el.classList.toggle('j',S.CH[x.url]==='j')}majHaut();return}
  if(ep(x)&&el&&!el.classList.contains('conf')){el.classList.add('conf');hap('warning');clearTimeout(el._c);el._c=setTimeout(()=>el.classList.remove('conf'),2200);return}
  if(el)el.classList.remove('conf');
  if(gardees().length>=S.LIM){duel(x);return}
  decider(x,'g');if(el){el.classList.add('g','neuf');el.classList.remove('j');setTimeout(()=>el.classList.remove('neuf'),450)}majHaut()}
const maxVu=()=>LS('sel-vu-'+S.slug)||0;

/* ---------- Limite stricte : la nouvelle contre ta plus faible ---------- */
function duel(x){const w=parU(S.RANG[S.RANG.length-1]);if(!w){decider(x,'g');majHaut();return}const el=$('duel');hap('warning');
  const carte=(y,tag)=>`<button class="dc" data-u="${esc(y.url)}"><img src="${esc(petite(y.image_petite||y.image))}" alt=""><div class="x"><span class="tag">${tag}</span><span class="m mono" style="display:block">${esc(y.marque||'')}</span><h5>${esc(y.titre||'')}</h5><div class="p">${prixHTML(y,true)}</div><div class="r">${esc(raison(y))}</div></div></button>`;
  el.innerHTML=`<div class="mono">${gardees().length} / ${S.LIM} · limite atteinte</div><h3>Une seule reste</h3><div class="sous">Tape celle que tu gardes. L'autre passe.</div><div class="deux">${carte(x,'La nouvelle')}${carte(w,'Ta n° '+S.RANG.length)}</div><button class="autre" id="d-autre">Faire sortir une autre</button><div class="grille-k" id="d-grille"></div>`;
  el.classList.add('on');
  el.querySelectorAll('.dc').forEach(b=>b.onclick=()=>{const gagne=b.dataset.u===x.url;b.classList.add('gagne');el.querySelectorAll('.dc').forEach(o=>{if(o!==b)o.classList.add('perd')});
    setTimeout(()=>{if(gagne){const i=S.RANG.indexOf(w.url);decider(w,'j',true);decider(x,'g');S.RANG=S.RANG.filter(u=>u!==x.url);S.RANG.splice(Math.max(0,i),0,x.url);SV('sel-rang-'+S.slug,S.RANG)}else{decider(x,'j')}fermerDuel();peindre()},300)});
  $('d-autre').onclick=()=>{$('d-grille').innerHTML=S.RANG.map((u,i)=>{const y=parU(u);return y?`<button data-u="${esc(u)}"><img src="${esc(petite(y.image_petite||y.image))}" alt=""><span>${i+1}</span></button>`:''}).join('');$('d-autre').style.display='none';
    $('d-grille').querySelectorAll('button').forEach(b=>b.onclick=()=>{const y=parU(b.dataset.u),i=S.RANG.indexOf(y.url);decider(y,'j',true);decider(x,'g');S.RANG=S.RANG.filter(u=>u!==x.url);S.RANG.splice(Math.max(0,i),0,x.url);SV('sel-rang-'+S.slug,S.RANG);toast(`${y.marque} sort`);fermerDuel();peindre()})};
  el.onclick=e=>{if(e.target===el)fermerDuel()}}
function fermerDuel(){$('duel').classList.remove('on')}

/* ---------- Fiche complète (couche 2) ---------- */
function fiche(x,depuisMa){const f=$('feuille'),d=S.D[x.url]||{},r=remise(x),m=maTaille(x),L=tailles(x),g=genre(x);hap('soft');
  const imgs=[petite(x.image_petite||x.image),...(d.images||[]).slice(1)].filter(Boolean);
  const moiC=g==='p'?S.TA.p:S.TA.v;const estMoi=t=>moiC!=null&&(g==='p'?typeof t.c==='number'&&Math.abs(t.c-moiC)<=.5:t.c===moiC);
  const pq=String(x.pourquoi||'').split(/\s·\s/).filter(p=>p&&!/annonc|économie|habituel|^\d+\s?tailles?$/i.test(p));
  const host=(()=>{try{return new URL(x.url).hostname.replace(/^www\./,'')}catch(e){return 'le site'}})();
  const c=S.CH[x.url];
  f.innerHTML=`<div class="poignee"></div><div class="photos${imgs.length<2?' une':''}">${imgs.map((u,i)=>`<img src="${esc(u)}" alt="" ${i?'loading="lazy"':''}>`).join('')}</div>
   <div class="fc"><div class="m mono">${esc(x.marque||'')}${x.revendeur&&x.revendeur!==x.marque?` · chez ${esc(x.revendeur)}`:''}</div><h2>${esc(x.titre||'')}</h2>
   <div class="prix">${prixHTML(x,'fiche')}</div>
   ${x.affil?`<div class="af-fiche">${x.affil.statut==='non'?'<span class="rz manuel">sans affiliation · promo relevée</span>':`<span class="rz ${esc(x.affil.statut)}">${esc(x.affil.reseau||'')}${/^a_/.test(x.affil.statut)?' · à activer':''}</span>`}${x.affil.taux?`<span>${esc(x.affil.taux)}</span>`:''}${x.affil.code?`<span>Code <b>${esc(x.affil.code)}</b></span>`:''}${x.affil.lien?'<span>lien affilié prêt</span>':x.affil.mode==='smi'?'<span>lien à créer dans Shop My Influence</span>':''}${x.affil.note?`<p class="legende">${esc(x.affil.note)}</p>`:''}</div>`:''}
   <p class="preuve">${r?(r.vraie?`Réel : −${r.v} % sous son prix habituel${r.an&&r.an!==r.v?` (la boutique annonce −${r.an} %)`:''}.`:`Remise annoncée par la boutique, pas vérifiée.`):''}${x.economie_eur?` ${Math.round(x.economie_eur)} € d'économie.`:''}${m&&m.prix?` Dans ta taille : ${fmtE(m.prix)}.`:''}</p>
   ${L.length?`<h4>Tailles${m?` · la tienne : ${esc(m.l)} ${m.ok?'en stock':'épuisée'}`:''}</h4><div class="chips">${L.map(t=>`<span class="chip${t.dispo?'':' non'}${estMoi(t)?' moi':''}">${esc(t.l)}</span>`).join('')}</div>${L.some(t=>t.a)?'<p class="legende">≈ : converti vers ta taille, à vérifier sur le guide de la marque.</p>':''}`:''}
   ${(d.matiere||[]).length?`<h4>Matière</h4><p>${d.matiere.map(esc).join(' · ')}</p>`:''}
   ${(d.atouts||[]).length||d.coupe?`<h4>Atouts</h4><div class="chips">${(d.atouts||[]).map(a=>`<span class="chip">${esc(a)}</span>`).join('')}${d.coupe?`<span class="chip">Coupe ${esc(d.coupe)}</span>`:''}</div>`:''}
   ${pq.length||x.theme||x.note?`<h4>Pourquoi elle est là</h4><p>${esc([x.theme,...pq,x.note].filter(Boolean).join(' · '))}</p>`:''}
   ${d.description?`<h4>Description</h4><p class="desc" id="f-desc">${esc(d.description)}</p>`:''}
   <a class="lien" href="${esc(x.url)}" id="f-lien">Ouvrir la fiche sur ${esc(host)} ↗</a>${x.maj?`<p class="legende">Prix relevé le ${esc(String(x.maj).slice(0,10).split('-').reverse().join('/'))}, à revérifier avant de publier.</p>`:''}</div>
   <div class="f-bas">${x.affil?`<button class="btn prim" id="f-copie">Copier le lien${x.affil.lien?' affilié':''}</button>`:`<button class="btn ${c==='g'?'on':'prim'}" id="f-garde">${c==='g'?'✓ Gardée · tape pour retirer':'Garder'}</button>`}</div>`;
  const ds=$('f-desc');if(ds)ds.onclick=()=>ds.classList.toggle('ouvert');
  $('f-lien').onclick=e=>{e.preventDefault();ouvrirLien(x.url)};
  if($('f-copie')){$('f-copie').onclick=()=>{copierTexte(affilTexte(x),x.affil.lien?'Lien affilié copié':x.affil.mode==='smi'?'Copié · crée le lien dans SMI':'Copié')}}
  if($('f-garde'))$('f-garde').onclick=()=>{fermerFiche();const el=document.querySelector(`.page[data-o="0"] .t[data-u="${CSS.escape(x.url)}"]`);if(S.CH[x.url]==='g'){decider(x,'j');if(el){el.classList.remove('g');el.classList.add('j')}}else{if(gardees().length>=S.LIM){duel(x);return}decider(x,'g');if(el){el.classList.add('g');el.classList.remove('j')}}majHaut();if(depuisMa)peindreMa()};
  f.scrollTop=0;$('voile').classList.add('on');requestAnimationFrame(()=>f.classList.add('on'));
  let yy=null;f.ontouchstart=e=>{yy=f.scrollTop<=0?e.touches[0].clientY:null};f.ontouchend=e=>{if(yy!=null&&e.changedTouches[0].clientY-yy>80)fermerFiche();yy=null}}
function fermerFiche(){$('feuille').classList.remove('on');$('voile').classList.remove('on')}
$('voile').onclick=fermerFiche;

/* ---------- Réglage de taille (une fois) ---------- */
function reglerTaille(){const f=$('feuille');const chaus=S.P.some(x=>genre(x)==='p');const P=[38,39,40,40.5,41,42,42.5,43,44,44.5,45,46,47];
  f.innerHTML=`<div class="poignee"></div><div class="fc"><h2>Ta taille</h2><p>Une fois : chaque pièce te dira si ta taille est en stock.</p><h4>Vêtements</h4><div class="chips">${['XS','S','M','L','XL','XXL'].map(t=>`<button class="chip${S.TA.v===t?' moi':''}" data-v="${t}">${t}</button>`).join('')}</div>${chaus?`<h4>Pointure (EU)</h4><div class="chips">${P.map(t=>`<button class="chip${S.TA.p===t?' moi':''}" data-p="${t}">${String(t).replace('.',',')}</button>`).join('')}</div>`:''}</div><div class="f-bas"><button class="btn prim" id="f-ok">C'est réglé</button></div>`;
  f.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{S.TA.v=b.dataset.v;SV('sel-taille',S.TA);f.querySelectorAll('[data-v]').forEach(o=>o.classList.toggle('moi',o===b));hap('light')});
  f.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{S.TA.p=+b.dataset.p;SV('sel-taille',S.TA);f.querySelectorAll('[data-p]').forEach(o=>o.classList.toggle('moi',o===b));hap('light')});
  $('f-ok').onclick=()=>{fermerFiche();ordonner();remesurer(true);if($('ma').classList.contains('on'))peindreMa()};
  $('voile').classList.add('on');requestAnimationFrame(()=>f.classList.add('on'))}

/* ---------- Ma sélection (couche 3) ---------- */
function ouvrirMa(fin){peindreMa(fin);$('ma').classList.add('on');hap(fin?'success':'soft')}
function fermerMa(){$('ma').classList.remove('on');peindre()}
function peindreMa(fin){rangRecal();const ma=$('ma');const G=S.RANG.map(parU).filter(Boolean);const reste=S.P.filter(x=>!S.CH[x.url]).length;
  const marques=[...new Set(G.map(x=>x.marque))];const px=G.map(eur).filter(v=>v!=null);const eco=G.reduce((s,x)=>s+(x.economie_eur||0),0);
  const okT=G.filter(x=>{const m=maTaille(x);return m&&m.ok}).length,avecT=G.filter(x=>maTaille(x)).length;
  let VID=LS('marques-video-'+S.slug);if(VID&&VID.t&&Date.now()-VID.t>30*60*1000)VID=null;
  ma.innerHTML=`<div class="ma-haut" id="ma-haut"><span class="ret">${reste?`↓ reprendre le tri · ${reste} à trier`:'↓ revoir les pages'}</span><div class="ma-titre"><span class="mono">Ma sélection</span><span class="nom" id="ma-nom">${esc(S.s.titre||S.slug)}</span></div>
   <div class="ma-geant">${G.length}<small> / ${S.LIM}</small></div><div class="ma-resume">${fin||!reste?'<b style="color:#fff">Tout est trié.</b> ':''}${G.length?`${marques.length} marque${marques.length>1?'s':''} · ${px.length?`${fmtE(Math.min(...px))} à ${fmtE(Math.max(...px))}`:''}${eco?` · ${fmtE(eco)} d'économie`:''}${avecT?` · ta taille en stock : ${okT}/${avecT}${okT<avecT?` (${avecT-okT} épuisée${avecT-okT>1?'s':''} gardée${avecT-okT>1?'s':''})`:''}`:''}`:'Rien de gardé pour l\'instant.'}</div></div>
   <div class="reglages"><div class="rg">Limite <b id="rg-lim">${S.LIM}</b><button data-l="-1" aria-label="Moins">−</button><button data-l="1" aria-label="Plus">+</button></div><button class="rg choix" id="rg-taille">Ta taille <b>${S.TA.v||'?'}</b>${S.P.some(x=>genre(x)==='p')?` · pointure <b>${S.TA.p?String(S.TA.p).replace('.',','):'?'}</b>`:''}</button></div>
   ${G.length?`<ol class="liste" id="liste">${G.map((x,i)=>ligne(x,i)).join('')}</ol>`:`<div class="ma-vide">Tape les pièces que tu gardes pendant le tri.<br>Elles arrivent ici, classées, avec toutes leurs infos.</div>`}
   <div class="ma-bas"><button class="btn prim" id="ma-video" ${G.length&&!(VID&&VID.sid&&!VID.fini)?'':'disabled'}>${VID&&VID.sid&&!VID.fini?'Page de tournage en préparation…':`Préparer la vidéo${G.length?' · '+G.length:''}`}</button><button class="btn verre" id="ma-copie" ${G.length?'':'disabled'}>Copier</button></div>`;
  $('ma-haut').onclick=e=>{if(e.target.closest('#ma-nom')){changer();return}fermerMa()};
  ma.querySelectorAll('[data-l]').forEach(b=>b.onclick=()=>{S.LIM=Math.max(1,Math.min(40,S.LIM+ +b.dataset.l));SV('sel-limite',S.LIM);$('rg-lim').textContent=S.LIM;hap('light');majHaut();if(gardees().length>S.LIM)toast(`${gardees().length} gardées pour ${S.LIM} : retire-en ${gardees().length-S.LIM}`)});
  $('rg-taille').onclick=reglerTaille;$('ma-video').onclick=preparerVideo;$('ma-copie').onclick=copier;
  const li=$('liste');if(li){li.querySelectorAll('.ln').forEach(r=>{r.addEventListener('click',e=>{if(e.target.closest('.rk'))return;const x=parU(r.dataset.u);if(x)fiche(x,true)})});glisserRang(li)}
  let yy=null;ma.ontouchstart=e=>{const l=$('liste');yy=(!l||l.scrollTop<=0)&&e.target.closest('.ma-haut,.ma-vide')?e.touches[0].clientY:null};ma.ontouchend=e=>{if(yy!=null&&e.changedTouches[0].clientY-yy>90)fermerMa();yy=null}}
function ligne(x,i){const m=maTaille(x),d=S.D[x.url]||{},n=nDispo(x),r=remise(x);
  const mini=[m?`<span class="${m.ok?'ok':'non'}">${esc(m.l)}${m.approx?' ≈':''}</span>`:'',n!=null?`<span>${n} taille${n>1?'s':''}</span>`:'',(d.matiere||[])[0]?`<span>${esc(d.matiere[0])}</span>`:'',...(d.atouts||[]).slice(0,1).map(a=>`<span>${esc(a)}</span>`),/communaut/i.test(x.pourquoi||'')&&!S.comU?'<span>Communauté</span>':''].filter(Boolean).join('');
  const b=x.barre&&x.prix&&x.barre>x.prix?Math.round(x.barre*(TX[x.devise||'EUR']||1)):null;
  return `<li class="ln" data-u="${esc(x.url)}"><span class="rk">${i+1}</span><img src="${esc(petite(x.image_petite||x.image))}" alt=""><div class="c1"><span class="m">${esc(x.marque||'')}${x.revendeur&&x.revendeur!==x.marque?' · '+esc(x.revendeur):''}</span><b>${esc(x.titre||'')}</b><div class="mini">${mini}</div></div><div class="c2"><b>${x.prix?fmtE(eur(x)):'?'}</b>${b?`<s>${b} €</s>`:''}${r?`<span class="pill ${r.vraie?'vraie':'annonce'}">−${r.v} %${r.vraie?' réel':''}</span>`:''}</div></li>`}
/* Classer : on tient le numéro et on glisse */
function glisserRang(li){li.querySelectorAll('.rk').forEach(h=>h.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();const row=h.closest('.ln'),rows=[...li.querySelectorAll('.ln')],i0=rows.indexOf(row),hh=row.getBoundingClientRect().height+8,y0=e.clientY;let j=i0;
    row.classList.add('leve');hap('medium');try{h.setPointerCapture(e.pointerId)}catch(_){}
    const mv=ev=>{const dy=ev.clientY-y0;row.style.transform=`translate3d(0,${dy}px,0) scale(1.02)`;j=Math.max(0,Math.min(rows.length-1,i0+Math.round(dy/hh)));rows.forEach((r,k)=>{if(r===row)return;const s=(k>i0&&k<=j)?-hh:(k<i0&&k>=j)?hh:0;r.style.transform=s?`translate3d(0,${s}px,0)`:''})};
    const up=()=>{h.removeEventListener('pointermove',mv);h.removeEventListener('pointerup',up);h.removeEventListener('pointercancel',up);row.classList.remove('leve');
      if(j!==i0){const u=S.RANG.splice(i0,1)[0];S.RANG.splice(j,0,u);SV('sel-rang-'+S.slug,S.RANG);hap('light')}peindreMa()};
    h.addEventListener('pointermove',mv);h.addEventListener('pointerup',up);h.addEventListener('pointercancel',up)}))}
function changer(){const ma=$('ma');const L=S.IDX.filter(x=>(!x.statut||x.statut==='prête')&&!estAffil(x)).sort((a,b)=>(Date.parse(b.maj||'')||0)-(Date.parse(a.maj||'')||0));
  ma.innerHTML=`<div class="ma-haut" id="ch-haut"><span class="ret">↓ retour</span><div class="ma-geant" style="font-size:40px">Tes sélections</div></div><div class="liste-sel">${L.map(s=>{const c=LS('marques-choix-'+s.slug)||{};const g=Object.values(c).filter(v=>v==='g').length,f=Object.keys(c).length;return `<button class="ls${s.slug===S.slug?' on':''}" data-s="${esc(s.slug)}"><b>${esc(s.titre||s.slug)}</b><small>${s.n||'?'} pièces · ${f?`${g} gardées · ${Math.max(0,(s.n||0)-f)} à trier`:'pas commencée'}${s.date?' · '+esc(s.date):''}</small></button>`}).join('')}</div>`;
  $('ch-haut').onclick=()=>peindreMa();ma.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{SV('sel-derniere',b.dataset.s);location.search='?s='+encodeURIComponent(b.dataset.s)})}
function texteListe(){const G=S.RANG.map(parU).filter(Boolean);return `${S.s.titre||S.slug} · ${G.length} pièce${G.length>1?'s':''}\n\n`+G.map((x,i)=>{const d=S.D[x.url]||{},r=remise(x),L=tailles(x).filter(t=>t.dispo).map(t=>t.l);
    return `${i+1}. ${x.marque} · ${x.titre}\n   ${x.prix?fmtE(eur(x)):'?'}${x.barre&&x.barre>x.prix?` (au lieu de ${Math.round(x.barre*(TX[x.devise||'EUR']||1))} €)`:''}${r?` · −${r.v} % ${r.vraie?'vérifié':'annoncé'}`:''}${x.revendeur?` · chez ${x.revendeur}`:''}\n   ${L.length?`Tailles en stock : ${L.join(', ')}`:''}${(d.matiere||[]).length?` · ${d.matiere.join(', ')}`:''}\n   ${x.url}`}).join('\n\n')}
function copier(){const t=texteListe();(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>toast('Liste copiée, toutes les infos'),()=>prompt('Copie ce texte',t))}
async function preparerVideo(){const G=S.RANG.map(parU).filter(Boolean);if(!G.length)return;const b=$('ma-video');b.disabled=true;b.textContent='Je lance…';
  /* l'ordre de la vidéo = ton classement : on reconfirme chaque gardée dans l'ordre (choix.py garde le dernier choix, video.py trie par heure) */
  const t0=Date.now();for(let i=0;i<G.length;i++){const x=G[i];try{await fetch('/api/upload',{method:'POST',headers:{'X-Nom':`selection-choix-${S.slug}-${t0+i}-r${i}.json`,'Content-Type':'text/plain; charset=utf-8'},body:JSON.stringify({slug:S.slug,url:x.url,marque:x.marque,titre:x.titre,decision:'garde',t:t0+i})})}catch(e){}}
  try{await fetch('/api/upload',{method:'POST',headers:{'X-Nom':`selection-fin-${S.slug}-${Date.now()}.json`,'Content-Type':'text/plain; charset=utf-8'},body:JSON.stringify({slug:S.slug,t:Date.now(),gardes:G.map((x,i)=>({rang:i+1,url:x.url,marque:x.marque,titre:x.titre,prix:x.prix,barre:x.barre,devise:x.devise,revendeur:x.revendeur,tailles:tailles(x).filter(t=>t.dispo).map(t=>t.l),matiere:(S.D[x.url]||{}).matiere||[],pourquoi:x.pourquoi||null}))})})}catch(e){}
  /* 24/11 : sur le cerveau (l'app iPhone), video.py et Notion n'existent pas : le relais du Mac (selection-relais) voit l'envoi
     selection-fin ci-dessus et lance /selection-video sur le Mac. On ne lance une session ici que si on est SUR le Mac. */
  if(!/^(127\.0\.0\.1|localhost)$/.test(location.hostname)){SV('marques-video-'+S.slug,{sid:'relais',t:Date.now(),fini:false});b.textContent='Envoyé · ton Mac prépare la page';toast('Page de tournage : ton Mac la crée en 2 à 5 min',3200);hap('success');return}
  try{const r=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({texte:`/selection-video ${S.slug}`,titre:'Vidéo · '+(S.s.titre||S.slug),espace:'marque',modele:'sonnet'})});if(!r.ok)throw new Error(r.status);const j=await r.json();SV('marques-video-'+S.slug,{sid:(j.session||j).id,t:Date.now(),fini:false});b.textContent='Page de tournage en préparation…';toast('Tu recevras le lien Notion',2500);hap('success')}
  catch(e){b.disabled=false;b.textContent='Préparer la vidéo · '+G.length;toast('Tokn ne répond pas ('+e.message+')')}}

/* ---------- Premier lancement : ta taille en un tap + les 3 gestes, au-dessus de la grille (pas d'écran intermédiaire) ---------- */
function bandeau(){const bd=$('bandeau'),chaus=S.P.some(x=>genre(x)==='p');const P=[39,40,41,42,43,44,45,46];
  const peindreB=()=>{bd.innerHTML=`<div class="ligne"><span class="lab">Ta taille</span>${['XS','S','M','L','XL','XXL'].map(t=>`<button class="ch2${S.TA.v===t?' on':''}" data-v="${t}">${t}</button>`).join('')}<button class="tard" id="b-tard">plus tard</button></div>${chaus?`<div class="ligne"><span class="lab">Pointure</span>${P.map(t=>`<button class="ch2${S.TA.p===t?' on':''}" data-p="${t}">${t}</button>`).join('')}</div>`:''}<div class="aide"><b>Tape</b> = garder · <b>glisse ↑</b> = les autres passent · <b>appui long</b> = tout voir</div>`;
    bd.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{S.TA.v=b.dataset.v;SV('sel-taille',S.TA);hap('light');fini()});
    bd.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{S.TA.p=+b.dataset.p;SV('sel-taille',S.TA);hap('light');fini()});
    $('b-tard').onclick=()=>{SV('sel-bandeau-vu',1);fermer()}};
  const fermer=()=>{bd.classList.remove('on');remesurer()};
  const fini=()=>{ordonner();if(S.TA.v&&(!chaus||S.TA.p)){SV('sel-bandeau-vu',1);setTimeout(fermer,250)}peindreB();remesurer(true)};
  peindreB();bd.classList.add('on');remesurer()}
function remesurer(force){const r=S.rows;mesurer();if(force||r!==S.rows){const cur=(S.pages[S.ip]||{items:[]}).items;const x=cur.find(y=>!S.CH[y.url])||cur[0];paginer();const i=S.pages.findIndex(p=>p.items.includes(x));S.ip=Math.max(0,i)}peindre()}
/* ---------- Échéance (ex. Black Friday : à trancher avant jeudi soir) : un compte à rebours qui tourne ---------- */
async function echeance(){let E={};try{E=await (await fetch('echeances.json?'+Date.now())).json()}catch(e){}const e=E[S.slug];const el=$('echeance');if(!e||!el)return;const fin=Date.parse(e.iso);
  const f=()=>{let s=Math.floor((fin-Date.now())/1000);if(s<=0){el.textContent='échéance passée';return}const j=Math.floor(s/86400);s%=86400;const h=Math.floor(s/3600),m=Math.floor(s%3600/60),sec=s%60;
    el.innerHTML=`<em>${esc(e.texte)}</em> · ${j?j+' j ':''}${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;el.classList.toggle('urgent',j===0&&h<6)};f();setInterval(f,1000)}


/* ---------- Onglets Affiliés / Promos (25/11/2026) : deux fenêtres, même liste (A.mode). Affiliés = statut actif/code/manuel (lien qui rapporte) ; Promos = le reste (lien direct).
   Données : donnees/affiliation/selection.json (+ resume.json) écrites par ~/Documents/selection/affiliation/affiliation.py chaque heure. ---------- */
const A={P:[],R:null,f:null,on:false,mode:'affil'};try{localStorage.removeItem('sel-affil-seg')}catch(e){}
const affilLien=x=>(x.affil||{}).lien||null;
const affilTexte=x=>{const a=x.affil||{},l=a.lien||x.url,b=x.barre&&x.barre>x.prix?` (au lieu de ${Math.round(x.barre)} €)`:'';
  return `${x.marque} · ${x.titre}\n${x.prix?fmtE(eur(x)):'?'}${b}${x.remise?` · −${x.remise} %`:''}${x.revendeur&&x.revendeur!==x.marque?` · chez ${x.revendeur}`:''}\n${l}${a.code?`\nCode ${a.code}`:''}${a.mode==='smi'?'\n(lien à créer dans Shop My Influence)':''}`};
function copierTexte(t,msg){(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>{toast(msg||'Copié');hap('success')},()=>prompt('Copie ce texte',t))}
async function chargerAffil(force){if(A.P.length&&!force)return;const lire=f=>fetch(`donnees/affiliation/${f}?`+Date.now()).then(r=>r.ok?r.json():null).catch(()=>null);
  const [P,R]=await Promise.all([lire('selection.json'),lire('resume.json')]);A.P=Array.isArray(P)?P:(P&&P.produits)||[];A.R=R||{}}
const rz=a=>a.statut==='non'||!a.statut?'':`<span class="rz ${esc(a.statut)}">${esc(a.reseau||'')}${/^a_/.test(a.statut)?' · à activer':''}${a.taux&&!/voir|selon/i.test(a.taux)?' · '+esc(a.taux):''}${a.lien?' · lien prêt ✓':a.mode==='smi'?' · lien via l\'app SMI':''}</span>`;
const revA=x=>x.revendeur||x.marque||'';
function ligneA(x){const a=x.affil||{},b=x.barre&&x.prix&&x.barre>x.prix?Math.round(x.barre):null,nt=(x.tailles_dispo||[]).length;
  return `<li class="ln la" data-u="${esc(x.url)}"><img src="${esc(petite(x.image_petite||x.image))}" alt="" loading="lazy"><div class="c1"><span class="m">${esc(x.marque||'')}${x.revendeur&&x.revendeur!==x.marque?' · '+esc(x.revendeur):''}</span><b>${esc(x.titre||'')}</b><div class="mini">${rz(a)}${a.code?`<span>code ${esc(a.code.split(' ')[0])}</span>`:''}${nt?`<span>${nt} taille${nt>1?'s':''}</span>`:''}</div></div><div class="c2"><b>${x.prix?fmtE(eur(x)):'?'}</b>${b?`<s>${b} €</s>`:''}${x.remise?`<span class="pill annonce">−${x.remise} %</span>`:''}<button class="cp" data-cp="${esc(x.url)}" aria-label="Copier le lien">⧉</button></div></li>`}
function peindreAffil(){const el=$('affil'),R=A.R||{};const estA=x=>x.affil&&/^(actif|code|manuel)$/.test(x.affil.statut);const actifs=A.P.filter(estA);
  const pr=A.mode==='promos',base=pr?A.P.filter(x=>!estA(x)):actifs;const cnt={};base.forEach(x=>{const r=revA(x);cnt[r]=(cnt[r]||0)+1});const revs=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a]);if(A.f&&!cnt[A.f])A.f=null;
  const L=(A.f?base.filter(x=>revA(x)===A.f):base).slice().sort((p,q)=>(q.remise||0)-(p.remise||0));A.n=A.n||120;const V=L.slice(0,A.n);
  const aAct=R.a_activer||[],nA=aAct.reduce((s,m)=>s+(m.n_promos||0),0),sans=(R.sans_source||[]);
  const maj=R.maj?new Date(R.maj):null,hm=maj?maj.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'';
  el.innerHTML=`<div class="ma-haut"><div class="ma-titre"><span class="mono">${pr?'Promos':'Affiliés'}</span><span class="mono" style="color:var(--t3)">${hm?'relevé '+esc(hm):''}</span></div><div class="ma-geant">${L.length}<small> offre${L.length>1?'s':''}</small></div><div class="ma-resume">${pr?`${revs.length} boutique${revs.length>1?'s':''} · promos relevées, lien direct`:`${revs.length} revendeur${revs.length>1?'s':''} où ton lien rapporte`} · tape une offre pour la fiche, <b style="color:#fff">⧉</b> copie le lien</div></div>
   <div class="reglages af-chips"><button class="rg${A.f?'':' on'}" data-f="">Toutes <b>${base.length}</b></button>${revs.map(r=>`<button class="rg${A.f===r?' on':''}" data-f="${esc(r)}">${esc(r)} <b>${cnt[r]}</b></button>`).join('')}</div>
   <ol class="liste af-liste" id="af-liste">${V.map(ligneA).join('')}
   ${L.length>V.length?`<li class="af-act"><button class="af-act-b" id="af-plus">Afficher ${Math.min(120,L.length-V.length)} de plus · ${L.length-V.length} restantes</button></li>`:''}
   ${pr&&sans.length?`<li class="af-act"><button class="af-act-b" id="af-sans-b">${sans.length} autres partenaires sans relevé automatique (${sans.map(s=>s.nom).slice(0,4).join(', ')}…)</button><div class="af-act-l" id="af-sans-l">${sans.map(m=>`<div class="af-m"><div><b>${esc(m.nom)}</b><small>${esc(m.reseau)}${m.taux?' · '+esc(m.taux):''}${m.code?' · code '+esc(m.code):''}${m.note?' · '+esc(m.note):''}</small></div></div>`).join('')}</div></li>`:''}
   ${pr&&aAct.length?`<li class="af-act"><button class="af-act-b" id="af-act-b">${nA} promos chez ${aAct.length} revendeurs où tu n'es pas encore affilié · voir</button><div class="af-act-l" id="af-act-l">${aAct.map(m=>`<div class="af-m"><div><b>${esc(m.nom)}</b><small>${esc(m.reseau)} · ${m.n_promos} promos${m.statut==='a_activer'?' · 1 clic dans Awin':' · réseau à ouvrir'}</small></div>${m.lien_rejoindre?`<button class="af-go" data-go="${esc(m.lien_rejoindre)}">Activer ↗</button>`:''}</div>`).join('')}</div></li>`:''}
   <li class="af-src">Sources : ${Object.entries(R.sources||{}).filter(([k])=>!/total/.test(k)).map(([k,v])=>`${k.replace(/_/g,' ')} ${v}`).join(' · ')}.${pr&&R.seuils_tout?` Promos = ${esc(R.seuils_tout)}.`:''} Prix affichés par les boutiques, à revérifier avant d'envoyer.</li></ol>
   <div class="ma-bas"><button class="btn prim" id="af-tout" ${L.length?'':'disabled'}>Copier ${Math.min(L.length,200)} lien${L.length>1?'s':''} pour Alexi</button></div>`;
  el.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{A.f=b.dataset.f||null;A.n=120;peindreAffil();hap('light')});
  const plus=$('af-plus');if(plus)plus.onclick=()=>{const st=$('af-liste').scrollTop;A.n+=120;peindreAffil();$('af-liste').scrollTop=st};
  el.querySelectorAll('.la').forEach(r=>r.onclick=e=>{if(e.target.closest('.cp'))return;const x=A.P.find(y=>y.url===r.dataset.u);if(x)fiche(x)});
  el.querySelectorAll('.cp').forEach(b=>b.onclick=()=>{const x=A.P.find(y=>y.url===b.dataset.cp);if(!x)return;copierTexte(affilTexte(x),affilLien(x)?'Lien affilié copié':(x.affil||{}).mode==='smi'?'Copié · crée le lien dans SMI':'Lien copié');b.classList.add('ok');b.textContent='✓'});
  [['af-act-b','af-act-l'],['af-sans-b','af-sans-l']].forEach(([b,l])=>{const bb=$(b);if(bb)bb.onclick=()=>$(l).classList.toggle('on')});
  el.querySelectorAll('.af-go').forEach(b=>b.onclick=()=>ouvrirLien(b.dataset.go));
  $('af-tout').onclick=()=>{const C=L.slice(0,200);copierTexte(`${pr?'Promos':'Affiliés'}${A.f?' · '+A.f:''} · ${C.length} offre${C.length>1?'s':''} · ${new Date().toLocaleDateString('fr-FR')}\n\n`+C.map((x,i)=>`${i+1}. `+affilTexte(x)).join('\n\n'),C.length<L.length?`${C.length} premières copiées (sur ${L.length})`:'Liste copiée, liens compris')}}
async function onglet(o){SV('sel-onglet',o);document.querySelectorAll('#onglets button').forEach(b=>b.classList.toggle('on',b.dataset.o===o));const af=$('affil');
  if(o==='affil'||o==='promos'){if(A.mode!==o){A.mode=o;A.f=null;A.n=120}af.classList.add('on');A.on=true;if(!A.P.length){af.innerHTML='<div class="ma-vide">Je charge les offres…</div>';await chargerAffil()}
    if(!A.P.length){af.innerHTML='<div class="ma-vide">Pas encore d\'offres : le relevé tourne chaque heure.</div>';return}peindreAffil()}
  else{af.classList.remove('on');A.on=false}}
function onglets(){document.querySelectorAll('#onglets button').forEach(b=>b.onclick=()=>{onglet(b.dataset.o);hap('light')});
  const o0=new URLSearchParams(location.search).get('o')||LS('sel-onglet')||(/github\.io$/.test(location.hostname)?'affil':null);if(o0==='affil'||o0==='promos')onglet(o0)}

/* ---------- Démarrage ---------- */
(async()=>{try{await charger()}catch(e){$('scene').innerHTML=`<p class="vide-p">Rien à trier ici : ouvre l'onglet Affiliés ou Promos en bas.</p>`;onglets();return}
  mesurer();paginer();
  let ip=S.pages.findIndex(p=>p.items.some(x=>!S.CH[x.url]));const vu=()=>{SV('sel-vu-'+S.slug,Math.max(maxVu(),S.ip))};
  S.ip=ip<0?S.pages.length-1:ip;peindre();gestes();
  const og=aller;aller=function(d){og(d);setTimeout(vu,400)};
  if(ip<0)ouvrirMa();else if(!S.TA.v&&!LS('sel-bandeau-vu'))bandeau();
  echeance();onglets();
  addEventListener('resize',remesurer);
  window.__sel=S;
})();
})();
