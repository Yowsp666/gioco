'use strict';
// Endless Jumper - API: auth (nickname+PIN, Argon2id), run tokens, punteggi, classifiche. DB: SQLite.
const express=require('express'),argon2=require('argon2'),Database=require('better-sqlite3'),crypto=require('crypto'),path=require('path');
const PORT=+process.env.PORT||3000,ORIGIN=process.env.ALLOWED_ORIGIN||'*',DAY=864e5,SESSION_MS=30*DAY,MAXRATE=65; // MAXRATE: punti/secondo massimi plausibili
const END=process.env.CONTEST_END?Date.parse(process.env.CONTEST_END):0; // es. set CONTEST_END=2026-12-15T23:59:00+01:00: dopo la scadenza i punteggi non contano
const NICK=/^[A-Za-z0-9_]{3,16}$/;
const db=new Database(path.join(__dirname,'data.db'));db.pragma('journal_mode=WAL');
db.exec(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,nick TEXT NOT NULL,nick_lc TEXT NOT NULL UNIQUE,hash TEXT NOT NULL,best INTEGER NOT NULL DEFAULT 0,games INTEGER NOT NULL DEFAULT 0,created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,uid INTEGER NOT NULL,exp INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,uid INTEGER NOT NULL,seed INTEGER NOT NULL,t0 INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS scores(id INTEGER PRIMARY KEY,uid INTEGER NOT NULL,score INTEGER NOT NULL,ts INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS ix_best ON users(best DESC);CREATE INDEX IF NOT EXISTS ix_scores_ts ON scores(ts,score DESC);`);
const now=()=>Date.now(),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const hits=new Map(); // rate limit in memoria
const limited=(k,max,win)=>{const t=now(),a=(hits.get(k)||[]).filter(x=>t-x<win);a.push(t);hits.set(k,a);return a.length>max};
setInterval(()=>{const t=now();for(const[k,a]of hits)if(t-a[a.length-1]>36e5)hits.delete(k);db.prepare('DELETE FROM sessions WHERE exp<?').run(t);db.prepare('DELETE FROM runs WHERE t0<?').run(t-DAY)},6e5).unref();
const app=express();app.disable('x-powered-by');
app.use((q,s,n)=>{s.set({'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'Content-Type,Authorization','Access-Control-Allow-Methods':'GET,POST,OPTIONS','X-Content-Type-Options':'nosniff'});q.method==='OPTIONS'?s.sendStatus(204):n()});
app.use(express.json({limit:'2kb'}));
const ip=q=>q.get('cf-connecting-ip')||q.ip;
const DUMMY=argon2.hash('dummy',{type:argon2.argon2id}); // equalizza i tempi se il nick non esiste
function session(uid,nick){const token=crypto.randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(sha(token),uid,now()+SESSION_MS);return{token,nick}}
function auth(q,s,n){const t=(q.get('Authorization')||'').replace('Bearer ','');const u=t&&db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.uid WHERE s.token=? AND s.exp>?').get(sha(t),now());if(!u)return s.status(401).json({error:'Sessione scaduta'});q.user=u;q.th=sha(t);n()}
const rank=b=>b>0?db.prepare('SELECT COUNT(*)+1 n FROM users WHERE best>?').get(b).n:null;
const profile=u=>({nick:u.nick,best:u.best,games:u.games,rank:rank(u.best),since:u.created});

app.post('/api/register',async(q,s)=>{
  if(limited('reg:'+ip(q),5,36e5))return s.status(429).json({error:'Troppe registrazioni, riprova tra un po\''});
  const{nick,pin}=q.body||{};
  if(typeof nick!=='string'||!NICK.test(nick)||typeof pin!=='string'||pin.length<4||pin.length>32)return s.status(400).json({error:'Nickname 3-16 caratteri (lettere, numeri, _). PIN 4-32 caratteri.'});
  const hash=await argon2.hash(pin,{type:argon2.argon2id});
  try{const r=db.prepare('INSERT INTO users(nick,nick_lc,hash,created) VALUES(?,?,?,?)').run(nick,nick.toLowerCase(),hash,now());s.json(session(r.lastInsertRowid,nick))}
  catch{s.status(409).json({error:'Nickname già in uso'})}
});
app.post('/api/login',async(q,s)=>{
  const{nick,pin}=q.body||{};
  if(typeof nick!=='string'||typeof pin!=='string'||pin.length>32)return s.status(400).json({error:'Dati non validi'});
  if(limited('li:'+ip(q),30,9e5)||limited('ln:'+nick.toLowerCase(),6,9e5))return s.status(429).json({error:'Troppi tentativi, riprova tra 15 minuti'});
  const u=db.prepare('SELECT * FROM users WHERE nick_lc=?').get(nick.toLowerCase());
  const ok=await argon2.verify(u?u.hash:await DUMMY,pin).catch(()=>false);
  if(!u||!ok)return s.status(401).json({error:'Nickname o PIN errati'});
  s.json(session(u.id,u.nick));
});
app.post('/api/logout',auth,(q,s)=>{db.prepare('DELETE FROM sessions WHERE token=?').run(q.th);s.json({ok:true})});
app.get('/api/me',auth,(q,s)=>s.json(profile(q.user)));

// Una partita = token monouso con seed deciso dal server; il punteggio è accettato solo se plausibile rispetto al tempo trascorso.
app.post('/api/run/start',auth,(q,s)=>{
  const id=crypto.randomBytes(12).toString('hex'),seed=crypto.randomInt(1,2**31-1);
  db.prepare('INSERT INTO runs(id,uid,seed,t0) VALUES(?,?,?,?)').run(id,q.user.id,seed,now());s.json({id,seed});
});
app.post('/api/run/finish',auth,(q,s)=>{
  if(limited('fin:'+q.user.id,120,36e5))return s.status(429).json({error:'Troppe partite'});
  const{id,score}=q.body||{},run=db.prepare('SELECT * FROM runs WHERE id=? AND uid=?').get(id,q.user.id);
  if(!run||run.used||!Number.isInteger(score)||score<0)return s.status(400).json({error:'Partita non valida'});
  db.prepare('UPDATE runs SET used=1 WHERE id=?').run(id);
  const sec=(now()-run.t0)/1000,ok=sec<=7200&&score<=sec*MAXRATE+20&&(!END||now()<=END);
  const u=q.user;let best=u.best;
  if(ok){db.prepare('INSERT INTO scores(uid,score,ts) VALUES(?,?,?)').run(u.id,score,now());best=Math.max(best,score)}
  db.prepare('UPDATE users SET games=games+1,best=? WHERE id=?').run(best,u.id);
  s.json({accepted:ok,best,newRecord:ok&&score>u.best,rank:rank(best)});
});

const PER={all:0,day:DAY,week:7*DAY}; // giornaliera/settimanale: finestre mobili 24h / 7 giorni
app.get('/api/leaderboard',(q,s)=>{
  const p=Object.hasOwn(PER,q.query.period)?q.query.period:'all';
  const rows=p==='all'?db.prepare('SELECT nick,best score FROM users WHERE best>0 ORDER BY best DESC,created LIMIT 100').all()
   :db.prepare('SELECT u.nick,MAX(c.score) score FROM scores c JOIN users u ON u.id=c.uid WHERE c.ts>? GROUP BY c.uid ORDER BY score DESC LIMIT 100').all(now()-PER[p]);
  s.json(rows.map((r,i)=>({rank:i+1,...r})));
});
app.get('/api/player/:nick',(q,s)=>{const u=db.prepare('SELECT * FROM users WHERE nick_lc=?').get(String(q.params.nick).toLowerCase());u?s.json(profile(u)):s.status(404).json({error:'Giocatore non trovato'})});
app.get('/api/search',(q,s)=>{
  const t=String(q.query.q||'').toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,16);if(!t)return s.json([]);
  s.json(db.prepare('SELECT nick,best score FROM users WHERE nick_lc LIKE ? ORDER BY best DESC LIMIT 20').all('%'+t+'%').map(r=>({...r,rank:rank(r.score)})));
});
app.use(express.static(path.join(__dirname,'..','web'))); // utile per test locali: http://localhost:3000
app.listen(PORT,'127.0.0.1',()=>console.log('Endless Jumper su http://localhost:'+PORT));
