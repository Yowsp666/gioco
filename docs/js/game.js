// Motore di gioco Canvas 2D: input touch/tilt, fisica, rendering, particelle (pool).
(function(){
const {PHYS,Gen}=window.EJ,W=PHYS.W,R=15,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
class Game{
  constructor(cv,o){
    this.cv=cv;this.cx=cv.getContext('2d');this.o=o;this.state='idle';this.keys={};this.tx=null;this.tiltV=0;this.last=null;this.t=0;this.b0=0;this.f0=0;
    this.p={x:W/2,y:0,vx:0,vy:0,sq:0,rot:0};this.items=[];this.haz=[];this.cam=0;this.top=0;this.score=0;
    this.parts=Array.from({length:40},()=>({l:0,x:0,y:0,vx:0,vy:0}));
    this.deco=Array.from({length:14},(_,i)=>({x:(i*97)%W,y:i*61,r:6+(i%4)*5}));
    this.logo=new Image();this.logo.src=window.CONFIG.LOGO;
    this.resize();addEventListener('resize',()=>this.resize());
    cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);this.f0=e.clientX;this.b0=this.p.x;this.tx=this.p.x});
    cv.addEventListener('pointermove',e=>{if(this.tx!=null)this.tx=this.b0+(e.clientX-this.f0)*W/this.cw}); // trascinamento relativo: il dito non copre la palla
    const up=()=>{this.tx=null};cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
    addEventListener('keydown',e=>this.keys[e.code]=1);addEventListener('keyup',e=>this.keys[e.code]=0);
    addEventListener('deviceorientation',e=>{this.tiltV=(e.gamma||0)/22});
    document.addEventListener('visibilitychange',()=>document.hidden&&this.pause());addEventListener('blur',()=>this.pause());
    this.loop=t=>{requestAnimationFrame(this.loop);
      if(this.state==='run'){const dt=this.last?Math.min((t-this.last)/1000,.033):0;this.last=t;this.update(dt);this.draw()}else this.last=null};
    requestAnimationFrame(this.loop);
  }
  resize(){const d=Math.min(devicePixelRatio||1,2),w=Math.min(innerWidth,innerHeight*.62),h=innerHeight;
    this.cw=w;this.H=W*h/w;this.cv.style.width=w+'px';this.cv.width=w*d;this.cv.height=h*d;this.k=w*d/W}
  start(seed){this.gen=new Gen(seed);this.items=[{t:'n',x:W/2,bx:W/2,y:0,w:90,amp:0,ph:0}];this.haz=[];
    this.p={x:W/2,y:-30,vx:0,vy:PHYS.jump,sq:0,rot:0};this.top=-30;this.cam=-this.H*.7;this.t=0;this.score=0;this.tx=null;this.state='run';this.last=null;this.o.onScore(0)}
  pause(){if(this.state==='run'){this.state='pause';this.o.onPause()}}
  resume(){if(this.state==='pause')this.state='run'}
  stop(){this.state='idle'}
  burst(x,y){let n=8;for(const q of this.parts)if(q.l<=0&&n>0){n--;q.l=1;q.x=x;q.y=y;q.vx=(Math.random()-.5)*260;q.vy=-Math.random()*160}}
  update(dt){
    const p=this.p,k=this.keys;this.t+=dt;
    const ax=(k.ArrowRight||k.KeyD?1:0)-(k.ArrowLeft||k.KeyA?1:0);
    if(ax)p.vx=ax*PHYS.maxVx;else if(this.tx!=null)p.vx=clamp((this.tx-p.x)*12,-700,700);
    else if(this.o.tilt())p.vx=clamp(this.tiltV,-1,1)*PHYS.maxVx*1.1;else p.vx*=Math.pow(.02,dt);
    const oy=p.y;p.vy+=PHYS.g*dt;p.y+=p.vy*dt;p.x+=p.vx*dt;p.rot+=p.vx*dt/R;p.sq=Math.max(0,p.sq-dt);
    const sh=p.x<-R?W+2*R:p.x>W+R?-(W+2*R):0;if(sh){p.x+=sh;this.b0+=sh;if(this.tx!=null)this.tx+=sh} // wrap ai bordi
    for(const q of this.items){
      if(q.t==='m')q.x=q.bx+Math.sin(this.t*1.6+q.ph)*q.amp;
      if(q.broke)q.y+=450*dt;
      else if(q.fade!==undefined)q.fade-=dt;
      else if(p.vy>0&&oy+R<=q.y+2&&p.y+R>=q.y&&Math.abs(p.x-q.x)<q.w/2+R*.6){
        if(q.t==='f'){q.broke=true;this.burst(q.x,q.y);continue}
        p.vy=q.sp?PHYS.spring:PHYS.jump;p.sq=.3;this.burst(p.x,q.y);if(q.t==='v')q.fade=.3;
      }
    }
    for(const h of this.haz){if(h.t==='o')h.x=h.bx+Math.sin(this.t*1.3+h.ph)*h.amp;
      if(Math.hypot(h.x-p.x,h.y-p.y)<R+h.r-5)return this.die()}
    if(p.y<this.cam+this.H*.4)this.cam=p.y-this.H*.4;
    const bot=this.cam+this.H+80;
    this.items=this.items.filter(q=>q.y<bot&&!(q.fade<=0));this.haz=this.haz.filter(h=>h.y<bot);
    this.gen.fill(this.cam-200,this.items,this.haz);
    for(const q of this.parts)if(q.l>0){q.l-=dt*2.5;q.vy+=600*dt;q.x+=q.vx*dt;q.y+=q.vy*dt}
    if(p.y<this.top){this.top=p.y;const s=Math.floor((-30-this.top)/10);if(s>this.score){this.score=s;this.o.onScore(s)}}
    if(p.y>this.cam+this.H+R)this.die();
  }
  die(){if(this.state!=='run')return;this.state='over';this.o.onOver(this.score)}
  rr(x,y,w,h,r){const c=this.cx;c.beginPath();c.roundRect?c.roundRect(x,y,w,h,r):c.rect(x,y,w,h);c.fill()}
  draw(){
    const c=this.cx,p=this.p,d=Math.min(1,-this.cam/10000);
    c.setTransform(this.k,0,0,this.k,0,0);
    c.fillStyle=`hsl(${215+d*80},55%,${24-d*10}%)`;c.fillRect(0,0,W,this.H);
    c.fillStyle='rgba(255,255,255,.07)';const M=this.H+60;
    for(const b of this.deco){c.beginPath();c.arc(b.x,(((b.y-this.cam*.25)%M)+M)%M-30,b.r,0,6.3);c.fill()}
    c.translate(0,-this.cam);
    for(const q of this.items){
      c.globalAlpha=q.fade!==undefined?Math.max(0,q.fade/.3):1;
      c.fillStyle={n:'#4ade80',m:'#38bdf8',v:'#f1f5f9',f:'#b45309'}[q.t];this.rr(q.x-q.w/2,q.y,q.w,12,6);
      if(q.t==='f'){c.fillStyle='#451a03';c.fillRect(q.x-2,q.y,4,12)}
      if(q.sp){c.fillStyle='#facc15';this.rr(q.x-9,q.y-9,18,9,3)}
    }
    c.globalAlpha=1;
    for(const h of this.haz){
      if(h.t==='s'){c.fillStyle='#f43f5e';for(let i=-1;i<2;i++){c.beginPath();c.moveTo(h.x+i*14-8,h.y+12);c.lineTo(h.x+i*14,h.y-14);c.lineTo(h.x+i*14+8,h.y+12);c.fill()}}
      else{c.fillStyle='#a21caf';c.beginPath();c.arc(h.x,h.y,h.r,0,6.3);c.fill();c.fillStyle='#fde047';c.beginPath();c.arc(h.x,h.y,5,0,6.3);c.fill()}
    }
    c.fillStyle='#fff';for(const q of this.parts)if(q.l>0){c.globalAlpha=q.l;c.beginPath();c.arc(q.x,q.y,3,0,6.3);c.fill()}
    c.globalAlpha=1;
    const st=clamp(Math.abs(p.vy)/1800,0,.22),sx=p.sq>0?1+p.sq*.6:1-st*.5,sy=p.sq>0?1-p.sq*.6:1+st;
    c.save();c.translate(p.x,p.y+(p.sq>0?R*p.sq*.6:0));c.scale(sx,sy);
    const g=c.createRadialGradient(-5,-5,2,0,0,R);g.addColorStop(0,'#fff');g.addColorStop(1,'#93c5fd');
    c.fillStyle=g;c.beginPath();c.arc(0,0,R,0,6.3);c.fill();
    c.save();c.beginPath();c.arc(0,0,R-2,0,6.3);c.clip();c.rotate(p.rot*.25);
    if(this.logo.complete&&this.logo.naturalWidth)c.drawImage(this.logo,-R+2,-R+2,2*R-4,2*R-4);c.restore();
    c.lineWidth=2;c.strokeStyle='#1e3a8a';c.beginPath();c.arc(0,0,R,0,6.3);c.stroke();c.restore();
  }
}
window.Game=Game;
})();
