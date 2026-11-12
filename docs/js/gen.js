// Fisica condivisa + generatore procedurale con seed (puro, testabile anche in Node).
(function(root){
const PHYS={g:1800,jump:-780,spring:-1250,maxVx:520,W:400};
const MAXH=PHYS.jump*PHYS.jump/(2*PHYS.g); // altezza salto ≈169px
const W=PHYS.W,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function rng(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
class Gen{
  constructor(seed){this.r=rng(seed);this.y=0;this.x=W/2;this.n=0}
  fill(upTo,items,haz){while(this.y>upTo)this.next(items,haz)}
  next(items,haz){
    const r=this.r,d=Math.min(1,-this.y/8000),w=Math.round(76-d*24),py=this.y,px=this.x,amp=Math.round(40+d*40);
    this.y-=55+r()*20+d*(45+r()*10); // gap max 130px < 0.8*MAXH: sempre raggiungibile
    const x=clamp(px+(r()-.5)*(200+d*120),w/2+amp,W-w/2-amp);
    let t='n';const u=r(); // catena principale: solo piattaforme "sicure" (normale, mobile, che scompare)
    if(d>.05&&u<.12+.28*d)t='m';else if(d>.12&&u>.88-.1*d)t='v';
    items.push({t,x,bx:x,y:this.y,w,amp,ph:r()*6.28,sp:t==='n'&&r()<.07});
    if(r()<.12+.25*d){const fx=clamp(x+(r()<.5?-1:1)*(90+r()*80),w/2,W-w/2);items.push({t:'f',x:fx,bx:fx,y:this.y+(r()-.5)*30,w,amp:0,ph:0})} // fragile: solo decoy
    if(this.n++>10&&r()<.1+.3*d){const my=(py+this.y)/2; // ostacoli lontani dal percorso tra due piattaforme
      for(let i=0;i<8;i++){const hx=30+r()*(W-60);if(Math.abs(hx-px)>120&&Math.abs(hx-x)>120){haz.push({t:(d<.25||r()<.5)?'s':'o',x:hx,bx:hx,y:my,r:16,amp:35,ph:r()*6.28});break}}}
    this.x=x;
  }
}
const api={PHYS,Gen,MAXH};if(typeof module!=='undefined')module.exports=api;else root.EJ=api;
})(this);
