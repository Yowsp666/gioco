# Lista 1 - Forza Intervallo (Max Planck)

## 1. Avvio su Windows (locale)
1. Installa **Node.js LTS** (nodejs.org).
2. Doppio clic su `start-server.bat` (la prima volta installa le dipendenze).
3. Apri `http://localhost:3000` (il server serve anche il gioco, utile per testare). Da telefono sulla stessa Wi-Fi il backend resta solo su localhost: per provare dal telefono usa il tunnel (punto 3).

## 2. Pubblicare il frontend su GitHub Pages
1. Modifica i file in `web/` e, dalla cartella del progetto, esegui `.\publish-web.ps1`.
2. Lo script pubblica su `main` solo il contenuto di `web/`; il backend e gli altri file locali restano fuori dal branch Pages.
3. In GitHub: Settings → Pages → Deploy from branch → `main` → `/(root)`.
4. Il gioco sarà su `https://TUONOME.github.io/REPO/`. Non fare `git push` dal branch locale `master`, che contiene anche il backend.

## 3. Backend con Cloudflare Tunnel
1. Installa `cloudflared` (`winget install Cloudflare.cloudflared`).
2. Avvia il server (`start-server.bat`), poi `start-tunnel.bat`: compare un URL `https://xxxx.trycloudflare.com`.
3. Metti l'URL in `web/config.js` → `API:"https://xxxx.trycloudflare.com"` e poi esegui `.\publish-web.ps1` (con il Quick Tunnel l'URL cambia a ogni riavvio).
4. Consigliato: avvia il server con `set ALLOWED_ORIGIN=https://TUONOME.github.io` per accettare richieste solo dal tuo sito.
5. Tunnel permanente: `cloudflared tunnel login`, `cloudflared tunnel create jumper`, `cloudflared tunnel route dns jumper api.tuodominio.it`, poi `cloudflared tunnel run --url http://localhost:3000 jumper`.

## 4. Installazione come app
- iPhone: Safari → Condividi → *Aggiungi a Home*. Android: Chrome → *Installa app*.

## Personalizzazione
- **Logo**: sostituisci `web/assets/logo.png` (o cambia `LOGO` in `config.js`; PNG/SVG quadrato). Rigenera le icone `icon-*.png` con lo stesso logo.
- **Backup**: copia `server/data.db`.
- **Recupero account**: non esiste (nessuna email). Per reimpostare un PIN dimenticato l'admin può eliminare la riga dell'utente in SQLite.

## Contest e premio
- Testi, premio, scadenza e contatto si cambiano in `web/config.js` (**sostituisci `CONTACT` e imposta `CONTEST_END`**).
- Maglietta: sostituisci `web/assets/shirt.svg` con la foto reale (o cambia `SHIRT` in `config.js`).
- Per far smettere di contare i punteggi alla scadenza avvia il server con `set CONTEST_END=2026-12-15T23:59:00+01:00` (stessa data di `config.js`).
