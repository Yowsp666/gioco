// Audio con Web Audio API (bassa latenza, funziona anche su iOS). I file mancanti vengono ignorati senza errori.
// Cartella: assets/sounds/<nome>.mp3 (vedi LEGGIMI.txt). music2 = seconda musica (dissolvenza incrociata dall'app a 2900 punti, caricata solo quando serve). Override opzionali in config.js: SOUND_EXT, SOUND_DIR, SOUND_VOL:{nome:0-1}, SOUNDS:{nome:"url"}.
(()=>{
const NAMES=['click','start','jump','spring','vanish','break','hit','fall','gameover','record','gradeup','gradedown','pause','resume','login','error','share','pickup','potion','jetpack','shieldbreak','explode','biome','music','music2'];
const LAZY=['music2']; // tracce pesanti in memoria (una musica di 3 min decodificata ~75 MB): decodificate solo quando servono e liberate a fine partita
const CF=window.CONFIG||{},EXT=CF.SOUND_EXT||'mp3',DIR=CF.SOUND_DIR||'assets/sounds/',VOL=Object.assign({music:.35},CF.SOUND_VOL||{});if(VOL.music2==null)VOL.music2=VOL.music; // stesso volume della prima, salvo diversa indicazione
let on=true;try{on=localStorage.snd!=='0'}catch{}
const AC=window.AudioContext||window.webkitAudioContext,bufs={},pending={},miss={};let ctx,master,mus=null,old=null,musName='',want=null,saved=null,ana=null,fdata=null,avgB=0,lvl=0,lastBeat=0,lastT=0;
function init(){
  if(ctx||!AC)return;ctx=new AC();master=ctx.createGain();master.gain.value=on?1:0;master.connect(ctx.destination);
  ana=ctx.createAnalyser();ana.fftSize=1024;ana.smoothingTimeConstant=.5;fdata=new Uint8Array(ana.frequencyBinCount); // ascolta solo la musica (per lo sfondo)
  const z=ctx.createGain();z.gain.value=0;ana.connect(z);z.connect(ctx.destination);
  for(const n of NAMES)if(!LAZY.includes(n))load(n);
}
function load(n){ // scarica e decodifica un suono (una volta sola; i file mancanti non vengono richiesti di nuovo)
  if(bufs[n]||miss[n]||!ctx)return Promise.resolve();
  if(pending[n])return pending[n];
  return pending[n]=fetch((CF.SOUNDS&&CF.SOUNDS[n])||DIR+n+'.'+EXT).then(r=>{if(!r.ok)throw 0;return r.arrayBuffer()})
    .then(b=>new Promise((ok,ko)=>ctx.decodeAudioData(b,ok,ko))).then(b=>{bufs[n]=b}).catch(()=>{miss[n]=1})
    .then(()=>{delete pending[n];if(bufs[n]&&want===n&&!mus)music(true,n)}); // se la musica richiesta era ancora in caricamento, parte appena pronta
}
const resume=()=>{init();if(ctx&&ctx.state!=='running')ctx.resume().catch(()=>{})}; // iOS/Chrome: l'audio parte solo dopo un gesto dell'utente
for(const t of['pointerup','touchend','click','keydown'])addEventListener(t,resume,{passive:true});
document.addEventListener('visibilitychange',()=>{if(ctx)document.hidden?ctx.suspend().catch(()=>{}):resume()}); // niente audio in background
function play(n,loop,off){
  if(!on||!ctx||ctx.state!=='running'||!bufs[n])return null;
  const s=ctx.createBufferSource(),g=ctx.createGain();s.buffer=bufs[n];s.loop=!!loop;
  if(n==='jump')s.playbackRate.value=.95+Math.random()*.1; // piccola variazione di tono: meno monotono
  g.gain.value=VOL[n]==null?1:VOL[n];if(n.startsWith('music')&&ana)g.connect(ana);s.g=g;s.off=off||0;s.t0=ctx.currentTime;s.connect(g);g.connect(master);s.start(0,s.off);s.onended=()=>{s.disconnect();g.disconnect()};return s;
}
const stopSrc=s=>{if(s){try{s.stop()}catch{}}};
function music(go,name,off){ // avvio/stop immediato (anche di una dissolvenza in corso); off = secondi da cui partire
  stopSrc(mus);stopSrc(old);mus=old=null;musName='';want=null;saved=null;if(!go)return;
  name=name||'music';if(!bufs[name]&&bufs.music&&name!=='music')name='music';
  want=name;if(bufs[name]){mus=play(name,true,off);if(mus)musName=name}
}
// pausa: ricorda il punto della musica e la riprende da lì (la ripresa avvia la traccia attuale, anche se la pausa è arrivata a metà dissolvenza)
const posOf=s=>s&&s.buffer?(s.off+(ctx.currentTime-s.t0))%s.buffer.duration:0;
function pauseMusic(){if(!mus){saved=null;return}const sv={name:musName,off:posOf(mus)};stopSrc(mus);stopSrc(old);mus=old=null;musName='';want=null;saved=sv}
function resumeMusic(name){const sv=saved;saved=null;music(true,name,sv&&sv.name===name?sv.off:0)}
function crossfade(name,sec){ // la musica in corso sfuma a 0 mentre la nuova sale: durata sec. Ritorna true se fatto (o inutile), false se riprovare
  if(!on||musName===name)return true;
  if(!ctx||ctx.state!=='running'||!bufs[name])return false;
  if(!mus){music(true,name);return true}
  const t=ctx.currentTime,n=play(name,true);if(!n)return false;
  const v=VOL[name]==null?1:VOL[name];
  const o=mus,g0=o.g.gain.value,curve=f=>Float32Array.from({length:64},(_,i)=>f(i/63)); // curve a potenza costante: il volume percepito non cala a metà dissolvenza
  n.g.gain.setValueCurveAtTime(curve(x=>v*Math.sin(x*Math.PI/2)),t,sec);
  o.g.gain.cancelScheduledValues(t);o.g.gain.setValueCurveAtTime(curve(x=>g0*Math.cos(x*Math.PI/2)),t,sec);try{o.stop(t+sec+.05)}catch{}
  stopSrc(old);old=o;mus=n;musName=name;want=name;return true;
}
function fx(){ // [livello dei bassi 0-1 (liscio), battito appena avvenuto?] della musica in corso
  if(!ana||!mus||!on)return[0,false];
  ana.getByteFrequencyData(fdata);let b=0;for(let i=1;i<7;i++)b+=fdata[i];b/=6*255;
  lvl+=(b-lvl)*.35;const t=ctx.currentTime,dt=Math.min(.1,t-lastT);lastT=t;
  const beat=b>avgB*1.18+.03&&b>.25&&t-lastBeat>.25;avgB+=(b-avgB)*(1-Math.exp(-dt/1.5));if(beat)lastBeat=t; // media lenta (~1,5 s) come riferimento: un colpo sopra la media = battito
  return[Math.min(1,lvl*1.6),beat]}
const preload=n=>load(n),free=n=>{if(LAZY.includes(n)&&musName!==n)delete bufs[n]}; // libera la memoria di una traccia pesante
function toggle(){on=!on;try{localStorage.snd=on?'1':'0'}catch{}if(master)master.gain.value=on?1:0;if(!on)music(false);return on}
init();window.SFX={fx,play,music,pauseMusic,resumeMusic,pos:()=>mus?posOf(mus):null,crossfade,preload,free,toggle,isOn:()=>on,name:()=>musName,has:n=>!!bufs[n],levels:()=>[mus&&mus.g.gain.value,old&&old.g.gain.value]};
})();
