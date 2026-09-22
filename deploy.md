# Deployment: gbr-qrcode auf Ubuntu (Nginx + PM2)

Anleitung zum Hosting der **Digital Business Card QR**-App (Vite/React-SPA) auf einem Ubuntu-Server mit **Nginx** (Reverse Proxy / HTTPS) und **PM2** (Node-Prozess für den Static-Server).

> **Hinweis:** Die App ist rein clientseitig (kein Backend). Für den Handy-Kontakt-Picker (`Vom Handy auswählen`) ist **HTTPS** erforderlich (Chrome Android).

---

## Voraussetzungen

- Ubuntu 22.04 LTS oder neuer
- Domäne (z. B. `qr.beispiel.de`), die auf die Server-IP zeigt (A-Record)
- SSH-Zugriff als Benutzer mit `sudo`
- Git-Repository dieses Projekts

---

## 1. Server vorbereiten

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx git curl ufw
```

### Node.js 22 (LTS) via NodeSource

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # z. B. v22.x
npm -v
```

### PM2 global

```bash
sudo npm install -g pm2
```

### Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## 2. App deployen

### Verzeichnis und Clone

```bash
sudo mkdir -p /var/www/gbr-qrcode
sudo chown "$USER":"$USER" /var/www/gbr-qrcode
cd /var/www/gbr-qrcode
git clone <IHRE_REPO_URL> .
# oder: Dateien per scp/rsync nach /var/www/gbr-qrcode kopieren
```

### Abhängigkeiten und Production-Build

```bash
cd /var/www/gbr-qrcode
npm ci
npm run build
```

Ergebnis: statische Dateien in `/var/www/gbr-qrcode/dist/`.

### Production-Static-Server (`serve`)

Vite liefert die SPA; für PM2 nutzen wir das schlanke Paket `serve`:

```bash
cd /var/www/gbr-qrcode
npm install --save-prod serve
```

### PM2-Ecosystem

Datei `/var/www/gbr-qrcode/ecosystem.config.cjs` anlegen:

```js
module.exports = {
  apps: [
    {
      name: 'gbr-qrcode',
      cwd: '/var/www/gbr-qrcode',
      script: 'node_modules/serve/build/main.js',
      args: '-s dist -l 4173',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
```

`-s` aktiviert SPA-Fallback (alle Routen → `index.html`).

Starten und Autostart:

```bash
cd /var/www/gbr-qrcode
pm2 start ecosystem.config.cjs
pm2 status
pm2 logs gbr-qrcode --lines 50

# Nach Reboot automatisch starten
pm2 startup
# den angezeigten sudo-Befehl ausführen, danach:
pm2 save
```

Lokal prüfen (auf dem Server):

```bash
curl -I http://127.0.0.1:4173
```

---

## 3. Nginx als Reverse Proxy

Site-Config anlegen:

```bash
sudo nano /etc/nginx/sites-available/gbr-qrcode
```

Inhalt (Domain anpassen):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name qr.beispiel.de;

    # Optional: Upload-Größe für Logo/Hintergrund im Browser irrelevant hier,
    # aber harmlos für Proxies setzen:
    client_max_body_size 16m;

    location / {
        proxy_pass http://127.0.0.1:4173;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Aktivieren und testen:

```bash
sudo ln -s /etc/nginx/sites-available/gbr-qrcode /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 4. HTTPS mit Let’s Encrypt (Certbot)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d qr.beispiel.de
```

Certbot passt die Nginx-Config an und richtet die Verlängerung ein. Prüfen:

```bash
sudo systemctl status certbot.timer
curl -I https://qr.beispiel.de
```

Nach HTTPS ist der **Kontakt-Picker auf Android-Chrome** nutzbar.

---

## 5. Updates (neue Version)

```bash
cd /var/www/gbr-qrcode
git pull
npm ci
npm run build
pm2 restart gbr-qrcode
```

Ohne Git (nur Dateien hochgeladen):

```bash
cd /var/www/gbr-qrcode
npm ci
npm run build
pm2 restart gbr-qrcode
```

---

## 6. Nützliche Befehle

| Aktion              | Befehl                                      |
|---------------------|---------------------------------------------|
| App-Status          | `pm2 status`                                |
| Logs                | `pm2 logs gbr-qrcode`                       |
| Neustart            | `pm2 restart gbr-qrcode`                    |
| Stop                | `pm2 stop gbr-qrcode`                       |
| Nginx neu laden     | `sudo systemctl reload nginx`               |
| Nginx-Fehlerlog     | `sudo tail -f /var/log/nginx/error.log`     |

---

## 7. Alternative: Nginx liefert `dist/` direkt (ohne PM2)

Wenn Sie **keinen** Node-Prozess brauchen, kann Nginx die gebauten Dateien selbst ausliefern:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name qr.beispiel.de;
    root /var/www/gbr-qrcode/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Lange Cache-Zeit für gehashte Vite-Assets
    location /assets/ {
        try_files $uri =404;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Dann genügen Build + Nginx; PM2 entfällt. Für dieses Projekt reicht das aus — PM2 ist sinnvoll, wenn Sie den Node-`serve`-Prozess einheitlich mit anderen Apps verwalten wollen.

---

## 8. Troubleshooting

| Problem | Mögliche Ursache / Lösung |
|--------|---------------------------|
| Kontakt-Picker fehlt auf dem Handy | Kein HTTPS, oder kein Chrome Android → VCF-Datei importieren |
| `502 Bad Gateway` | PM2 läuft nicht / falscher Port → `pm2 status`, `curl 127.0.0.1:4173` |
| Weiße Seite nach Deploy | Build vergessen (`npm run build`) oder altes `dist/` |
| Certbot schlägt fehl | DNS zeigt nicht auf den Server; Port 80 von außen erreichbar? |
| App nur lokal erreichbar | Firewall / Security Group: 80 und 443 freigeben |

---

## Kurz-Checkliste

1. [ ] Node.js + Nginx + PM2 installiert  
2. [ ] Repo unter `/var/www/gbr-qrcode`, `npm ci && npm run build`  
3. [ ] `serve` installiert, `ecosystem.config.cjs`, `pm2 start` + `pm2 save`  
4. [ ] Nginx Reverse Proxy auf Port `4173`  
5. [ ] Certbot HTTPS für die Domain  
6. [ ] Im Browser: `https://qr.beispiel.de` öffnen und QR/Wallpaper testen  
