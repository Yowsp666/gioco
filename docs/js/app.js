// UI, autenticazione e comunicazione con il backend.
(()=>{
const C=CONFIG,$=s=>document.querySelector(s),API=(CONFIG.API||'').replace(/\/$/,'');
let tok=localStorage.tok||'',me=null,run=null,tilt=localStorage.tilt==='1',period='all';
async function api(p,body){
  const r=await fetch(API+'/api/'+p,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(tok?{Authorization:'Bearer '+tok}:{})},body:body&&JSON.stringify(body)});
  const j=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(j.error||'Errore'),{status:r.status});return j}
const net=e=>e.status?e.message:'Server non raggiungibile';
const show=id=>{document.querySelectorAll('.screen').forEach(e=>e.classList.toggle('on',e.id===id));$('#hud').classList.toggle('hide',!(id===''||id==='pause'))};
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;e.textContent=x;return e};
const game=new Game($('#cv'),{tilt:()=>tilt,onScore:s=>$('#sc').textContent=s,onPause:()=>show('pause'),onOver:over});
function home(){game.stop();$('#hn').textContent=me.nick;$('#hb').textContent=me.best;$('#btilt').textContent='Controllo: '+(tilt?'inclinazione':'touch');show('home')}
async function loadMe(){try{me=await api('me')}catch(e){if(e.status===401){tok='';localStorage.removeItem('tok')}throw e}}
async function doAuth(kind){$('#err').textContent='';
  try{const r=await api(kind,{nick:$('#nick').value.trim(),pin:$('#pin').value});tok=r.token;localStorage.tok=tok;$('#pin').value='';await loadMe();home()}
  catch(e){$('#err').textContent=net(e)}}
async function play(){
  show('');$('#sc').textContent='0';$('#bs').textContent='Record '+me.best;
  run=await Promise.race([api('run/start',{}).catch(()=>null),new Promise(r=>setTimeout(r,1500,null))]);
  game.start(run?run.seed:(Math.random()*2**31|0)+1)}
async function over(score){
  const rid=run&&run.id;run=null;$('#os').textContent=score;$('#ob').textContent=me.best;$('#orank').textContent='…';$('#omsg').textContent='';show('over');
  if(!rid){$('#orank').textContent='-';$('#omsg').textContent='Offline: punteggio non salvato';return}
  try{const r=await api('run/finish',{id:rid,score});me.best=r.best;$('#ob').textContent=r.best;$('#orank').textContent=r.rank?'#'+r.rank:'-';
    $('#omsg').textContent=!r.accepted?'Punteggio non valido':r.newRecord?'🎉 Nuovo record!':''}
  catch(e){$('#orank').textContent='-';$('#omsg').textContent=net(e)}}
async function board(){
  const ul=$('#lb'),q=$('#q').value.trim();ul.replaceChildren(el('li','','Carico…'));
  try{const rows=await api(q?'search?q='+encodeURIComponent(q):'leaderboard?period='+period);ul.replaceChildren();
    for(const r of rows){const li=el('li',r.nick===me.nick?'me':'');li.append(el('b','','#'+(r.rank||'-')),el('span','',r.nick),el('b','',r.score));ul.append(li)}
    if(!rows.length)ul.append(el('li','','Nessun risultato'))}
  catch(e){ul.replaceChildren(el('li','',net(e)))}}
async function profile(){
  try{await loadMe();$('#pn').textContent=me.nick;const ul=$('#pst');ul.replaceChildren();
    for(const[k,v]of[['Record',me.best],['Partite giocate',me.games],['Posizione globale',me.rank?'#'+me.rank:'-'],['Iscritto dal',new Date(me.since).toLocaleDateString('it')]]){const li=el('li','');li.append(el('span','',k),el('b','',v));ul.append(li)}
    show('prof')}catch(e){alert(net(e))}}
document.querySelectorAll('[data-cfg]').forEach(e=>e.textContent=C[e.dataset.cfg]);
const MSG=[`🗳️ VOTA ${C.LIST} · ${C.SLOGAN}`,`🏆 IL N°1 IN CLASSIFICA VINCE ${C.PRIZE.toUpperCase()}!`,'⚡ GIOCA, SALI, VINCI!'];
document.querySelectorAll('.tick').forEach(t=>{const s=MSG.join('  •  ')+'  •  ',tr=el('div','tr','');tr.append(el('span','',s),el('span','',s));tr.style.animationDuration=Math.round(s.length*.28)+'s';t.append(tr)});
async function prize(){
  show('prize');$('#shirt').src=C.SHIRT;$('#lead').textContent='';
  const end=C.CONTEST_END?new Date(C.CONTEST_END):null,d=end?Math.ceil((end-Date.now())/864e5):0;
  $('#cend').textContent=!end?'Data di chiusura: sarà comunicata a breve.':d<=0?'Il contest è concluso!':'Il contest termina il '+end.toLocaleDateString('it')+' · mancano '+d+(d===1?' giorno':' giorni')+'!';
  try{const[r]=await api('leaderboard?period=all');$('#lead').textContent=(r?'👑 In testa ora: '+r.nick+' ('+r.score+')':'👑 Nessuno in testa: puoi essere il primo!')+(me.rank?' · Tu: #'+me.rank:'')}catch{}}
$('#bpz').onclick=prize;$('#bpl2').onclick=play;$('#bb3').onclick=home;
$('#bli').onclick=()=>doAuth('login');$('#bre').onclick=()=>doAuth('register');
$('#bplay').onclick=$('#bagain').onclick=play;$('#bhome').onclick=$('#bph').onclick=home;
$('#pb').onclick=()=>game.pause();$('#bres').onclick=()=>{show('');game.resume()};
$('#blb').onclick=()=>{$('#q').value='';show('board');board()};$('#bpr').onclick=profile;$('#bb1').onclick=$('#bb2').onclick=home;
$('#q').oninput=(()=>{let t;return()=>{clearTimeout(t);t=setTimeout(board,300)}})();
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{period=b.dataset.p;$('#q').value='';document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('ghost',x!==b));board()});
$('#btilt').onclick=async()=>{if(!tilt&&typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){
  try{if(await DeviceOrientationEvent.requestPermission()!=='granted')return}catch{return}}
  tilt=!tilt;localStorage.tilt=tilt?'1':'0';home()};
$('#blo').onclick=async()=>{try{await api('logout',{})}catch{}tok='';localStorage.removeItem('tok');show('login')};
(async()=>{if(!tok)return show('login');try{await loadMe();home()}catch(e){show('login');$('#err').textContent=e.status?'':net(e)}})();
if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js'));
})();
