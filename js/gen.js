// Fisica condivisa + generatore procedurale con seed (puro, testabile anche in Node).
(function(root){
const PHYS={g:1800,jump:-780,spring:-1250,maxVx:520,W:400};
const MAXH=PHYS.jump*PHYS.jump/(2*PHYS.g); // altezza salto ≈169px
const W=PHYS.W,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function rng(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
// Zone per quota (px sopra la partenza). 1 punto = 10 px.
const BIOMES=[{n:'Prato',icon:'🌱',from:0},{n:'Cielo',icon:'☁️',from:2500},{n:'Orbita',icon:'🛰️',from:7000},{n:'Luna',icon:'🌙',from:13000},{n:'Asteroidi',icon:'☄️',from:16000},{n:'Marte',icon:'🔴',from:19000},{n:'Nebulosa',icon:'🌌',from:23000}];
const biomeAt=a=>{let i=0;while(i<BIOMES.length-1&&a>=BIOMES[i+1].from)i++;return i};
// Power-up: rari e pesati. Solo su piattaforme fisse normali (senza molla), mai prima di 90 punti, con pausa minima tra uno e l'altro e "pity timer".
const PU={start:400,cool:22,base:.026,pity:.0018,pityMax:.11};
// Buco nero: solo nello spazio (da Orbita), raro (pausa minima + probabilità), lontano dal percorso tra le piattaforme (raggio di attrazione 135)
const BH={cool:24,p:.12,far:150,pull:135};
const REACH=135; // salto massimo "comodo" tra due piattaforme (80% di MAXH)
class Gen{
  constructor(seed){this.r=rng(seed);this.y=0;this.x=W/2;this.n=0;this.lastU=false;this.sinceP=0;this.sinceB=0;this.hist=[]}
  fill(upTo,items,haz,pows){while(this.y>upTo)this.next(items,haz,pows)}
  next(items,haz,pows){
    const r=this.r,alt=-this.y,d=Math.min(1,alt/8000),w=Math.round(76-d*24),py=this.y,px=this.x,amp=Math.round(40+d*40),VA=34;
    // tipi per quota: m = orizzontale, v = sparisce, u = su/giù (da 250 punti), x = esplode (da 500 punti)
    const wt={n:100,m:alt>400?Math.min(40,alt/150):0,v:alt>1000?Math.min(12,alt/400):0,u:alt>2500?Math.min(30,(alt-2500)/120):0,x:alt>5000?Math.min(18,(alt-5000)/250):0};
    let roll=r()*Object.values(wt).reduce((a,b)=>a+b,0),t='n';for(const k in wt){if((roll-=wt[k])<0){t=k;break}}
    // le piattaforme su/giù (e quella dopo) hanno distanza ridotta: anche nel punto peggiore del movimento restano raggiungibili
    let gap=55+r()*20+d*(45+r()*10);gap=Math.min(gap,Math.max(50,REACH-VA*((t==='u'?1:0)+(this.lastU?1:0))));
    this.lastU=t==='u';this.y-=gap;
    const mx=t==='m'?amp:0,x=clamp(px+(r()-.5)*(200+d*120),w/2+mx,W-w/2-mx);
    const it={t,x,bx:x,y:this.y,by:this.y,w,amp:mx,vamp:t==='u'?VA:0,ph:r()*6.28,sp:t==='n'&&r()<.07};items.push(it);
    if(r()<.12+.25*d){const fx=clamp(x+(r()<.5?-1:1)*(90+r()*80),w/2,W-w/2);items.push({t:'f',x:fx,bx:fx,y:this.y+(r()-.5)*30,by:this.y,w,amp:0,vamp:0,ph:0})} // fragile: solo decoy
    let hz=0;this.sinceB++;
    if(this.n++>10&&r()<.1+.3*d){const my=(py+this.y)/2; // ostacoli lontani dal percorso tra due piattaforme
      const bh=alt>BIOMES[2].from&&this.sinceB>BH.cool&&r()<BH.p,far=bh?BH.far:120;
      for(let i=0;i<8;i++){const hx=30+r()*(W-60);if(Math.abs(hx-px)>far&&Math.abs(hx-x)>far){
        if(bh){haz.push({t:'b',x:hx,bx:hx,y:my,r:14,amp:0,ph:r()*6.28,pull:BH.pull});this.sinceB=0}
        else haz.push({t:(d<.25||r()<.5)?'s':'o',x:hx,bx:hx,y:my,r:16,amp:35,ph:r()*6.28});
        hz=1;break}}}
    // --- power-up: la probabilità cresce se ne passa troppo senza; il tipo dipende da cosa ha incontrato il giocatore di recente
    this.hist.push([hz,t==='m'||t==='u'||t==='x'||t==='v'?1:0]);if(this.hist.length>12)this.hist.shift();
    this.sinceP++;
    if(pows&&t==='n'&&!it.sp&&alt>PU.start&&this.n>12&&this.sinceP>PU.cool&&r()<PU.base+Math.min(PU.pityMax,(this.sinceP-PU.cool)*PU.pity)){
      const hd=this.hist.reduce((a,h)=>a+h[0],0)/12,sd=this.hist.reduce((a,h)=>a+h[1],0)/12;
      const wt={shield:30+60*hd,potion:35+20*sd,jet:alt>2500?8+14*sd:0}; // scudo più probabile dopo molti ostacoli, jetpack solo in quota e dopo tratti difficili
      let roll=r()*(wt.shield+wt.potion+wt.jet),k='potion';for(const q in wt){if((roll-=wt[q])<0){k=q;break}}
      pows.push({k,x:clamp(x+(r()-.5)*w*.6,18,W-18),y:this.y-46});this.sinceP=0}
    this.x=x;
  }
}
const api={PHYS,Gen,MAXH,BIOMES,biomeAt};if(typeof module!=='undefined')module.exports=api;else root.EJ=api;
})(this);
