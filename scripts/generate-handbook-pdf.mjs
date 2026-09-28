/**
 * Build branded user handbook PDF (Start mode only).
 */
import { chromium } from 'playwright'
import { readFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const APP_URL = 'https://kontakt.it-becker.org'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DOCS = join(ROOT, 'docs', 'benutzerhandbuch')
const OUT_PDF = join(DOCS, 'Gebr-Becker-QR-Generator-Benutzerhandbuch-Start.pdf')
const LOGO = join(DOCS, 'assets', 'logo-gebr-becker.png')
const SHOTS = join(DOCS, 'screenshots')

function b64(path) {
  const buf = readFileSync(path)
  const ext = path.toLowerCase().endsWith('.png') ? 'png' : 'jpeg'
  return `data:image/${ext};base64,${buf.toString('base64')}`
}

function figure(file, caption, { variant = 'full' } = {}) {
  const src = b64(join(SHOTS, file))
  return `
    <figure class="figure figure--${variant}">
      <img src="${src}" alt="${caption.replace(/"/g, '&quot;')}" />
      <figcaption>${caption}</figcaption>
    </figure>`
}

function buildHtml() {
  const logoSrc = b64(LOGO)

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <title>Gebr. Becker QR Generator — Benutzerhandbuch Start</title>
  <style>
    @page {
      size: A4;
      margin: 12mm 14mm 16mm;
    }

    :root {
      --bg: #f3f5f8;
      --surface: #ffffff;
      --ink: #152033;
      --muted: #5b667a;
      --border: #d5dbe6;
      --red: #b3202a;
      --navy: #1c2b4a;
      --gebr: #a8002a;
      --becker: #00325f;
    }

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      font-family: "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.45;
      color: var(--ink);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body { background: var(--bg); }

    .doc {
      max-width: 182mm;
      margin: 0 auto;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 7mm 9mm 6mm;
    }

    .cover {
      padding-bottom: 4mm;
      margin-bottom: 4mm;
      border-bottom: 2px solid var(--navy);
      break-after: avoid;
    }

    .cover__top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 5mm;
      margin-bottom: 3mm;
    }

    .cover__logo { height: 12mm; width: auto; }

    .cover__meta {
      text-align: right;
      font-size: 8.5pt;
      color: var(--muted);
      line-height: 1.35;
    }

    .cover__eyebrow {
      margin: 0 0 2mm;
      color: var(--red);
      font-size: 8pt;
      font-weight: 650;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .cover__title {
      margin: 0 0 2mm;
      font-size: 18pt;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.12;
      color: var(--navy);
    }

    .cover__title .gebr { color: var(--gebr); }
    .cover__title .becker { color: var(--becker); }

    .cover__subtitle {
      margin: 0 0 3mm;
      font-size: 11pt;
      font-weight: 600;
      color: var(--navy);
    }

    .cover__lead {
      margin: 0 0 3mm;
      color: var(--muted);
      font-size: 10pt;
    }

    .app-url {
      display: block;
      margin: 0 0 3mm;
      padding: 3mm 4mm;
      background: var(--navy);
      color: #fff;
      border-radius: 8px;
      text-align: center;
      break-inside: avoid;
    }

    .app-url__label {
      display: block;
      font-size: 8.5pt;
      opacity: 0.9;
      margin-bottom: 1mm;
    }

    .app-url__link {
      font-size: 13pt;
      font-weight: 700;
      letter-spacing: 0.01em;
    }

    .cover__needs {
      margin: 0;
      padding-left: 4mm;
      font-size: 9.5pt;
    }

    .cover__needs li { margin-bottom: 1mm; }

    .block {
      margin-bottom: 4mm;
      padding-bottom: 3.5mm;
      border-bottom: 1px solid var(--border);
    }

    .block:last-of-type {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }

    .block h2 {
      margin: 0 0 2.5mm;
      padding-bottom: 1.5mm;
      border-bottom: 1.5px solid var(--red);
      font-size: 11.5pt;
      font-weight: 700;
      color: var(--navy);
      break-after: avoid;
    }

    .block p { margin: 0 0 2.5mm; }
    .block p:last-child { margin-bottom: 0; }

    ul.compact {
      margin: 0 0 2mm;
      padding-left: 4.5mm;
    }

    ul.compact li { margin-bottom: 1mm; }

    .muted {
      color: var(--muted);
      font-size: 9pt;
    }

    .figure {
      margin: 2.5mm 0 0;
      text-align: center;
      break-inside: avoid;
    }

    .figure img {
      width: 100%;
      height: auto;
      object-fit: contain;
      border: 1px solid var(--border);
      border-radius: 6px;
    }

    /* Volle Breite — groß genug zum Erkennen der UI */
    .figure--full img { max-height: 82mm; }
    .figure--ios img { max-height: 72mm; max-width: 58%; margin: 0 auto; }

    .figure figcaption {
      margin-top: 1.5mm;
      font-size: 8.5pt;
      color: var(--muted);
    }

    .twocol {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3mm;
      margin: 2.5mm 0;
    }

    .callout {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 3mm 4mm;
      font-size: 9.25pt;
      break-inside: avoid;
    }

    .callout h3 {
      margin: 0 0 2mm;
      font-size: 10pt;
      color: var(--navy);
    }

    .callout--ios { border-left: 3px solid var(--red); }
    .callout--desktop { border-left: 3px solid var(--navy); }

    .summary {
      margin-top: 3mm;
      padding: 3.5mm 4mm;
      background: var(--bg);
      border-radius: 8px;
      border: 1px solid var(--border);
      break-inside: avoid;
    }

    .summary h2 {
      margin: 0 0 2mm;
      font-size: 10.5pt;
      color: var(--navy);
      border: none;
      padding: 0;
    }

    .footer-note {
      margin-top: 3mm;
      text-align: center;
      font-size: 8.5pt;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <div class="doc">
    <header class="cover">
      <div class="cover__top">
        <img class="cover__logo" src="${logoSrc}" alt="Gebr. Becker" />
        <div class="cover__meta">
          Benutzerhandbuch Start<br />
          September 2026 · IT (ABE)
        </div>
      </div>
      <p class="cover__eyebrow">Lokal · Datenschutzfreundlich · Ohne Cloud</p>
      <h1 class="cover__title">
        <span class="gebr">Gebr.</span> <span class="becker">Becker</span> QR Generator
      </h1>
      <p class="cover__subtitle">Ansicht „Start“ — Kontakt, Logo, QR &amp; Hintergrundbild als PNG</p>
      <div class="app-url">
        <span class="app-url__label">App im Browser öffnen</span>
        <span class="app-url__link">${APP_URL}</span>
      </div>
      <p class="cover__lead">
        Nur die einfache Ansicht <strong>Start</strong> (nicht „Erweitert“). Alle Daten bleiben in Ihrem Browser.
      </p>
      <ul class="cover__needs">
        <li>Browser: Chrome, Edge, Firefox oder Safari</li>
        <li>Name + mindestens Telefon oder E-Mail (optional: zweite E-Mail)</li>
      </ul>
    </header>

    <section class="block">
      <h2>1. App öffnen &amp; „Start“ wählen</h2>
      <p>Rufen Sie <strong>${APP_URL}</strong> auf. Oben bleibt <strong>Start</strong> aktiv (nicht Erweitert).</p>
      ${figure('01-desktop-start-hero.png', 'Startseite — Umschalter Start / Erweitert')}
    </section>

    <section class="block">
      <h2>2. Kontaktdaten ausfüllen</h2>
      <p>Vorname, Nachname und mindestens Telefon oder E-Mail — weitere Felder optional.</p>
      ${figure('02-desktop-kontaktdaten.png', 'Formular Kontaktdaten')}
    </section>

    <section class="block">
      <h2>3. Logo wählen</h2>
      <p><strong>Stein</strong> oder <strong>Gebr.Becker</strong> — erscheint im QR und dezent im Hintergrundbild.</p>
      ${figure('03-desktop-logo.png', 'Logo-Vorlage')}
    </section>

    <section class="block">
      <h2>4. QR-Code &amp; Hintergrundbild</h2>
      <p>QR: <strong>klassisch</strong> oder <strong>integriert</strong>, Größe wählbar. Hintergrundbild: Vorschau mit optionalen Einstellungen.</p>
      ${figure('04-desktop-qr-vorschau.png', 'QR-Vorschau und „QR-Code als PNG“')}
      ${figure('05-desktop-hintergrundbild.png', 'Hintergrundbild-Vorschau und Download')}
    </section>

    <section class="block">
      <h2>5. Speichern — Desktop und iOS</h2>
      <p>Buttons <em>QR-Code als PNG</em> und <em>Hintergrundbild als PNG</em> — gleich benannt, unterschiedlicher Ablauf:</p>
      <div class="twocol">
        <div class="callout callout--desktop">
          <h3>Windows / Mac</h3>
          <ul class="compact">
            <li>Datei im <strong>Download-Ordner</strong></li>
            <li>Kein Teilen-Menü</li>
          </ul>
        </div>
        <div class="callout callout--ios">
          <h3>iPhone / iPad</h3>
          <ul class="compact">
            <li><strong>Teilen-Menü</strong> → In Dateien sichern / Bild sichern</li>
            <li>Nicht „In Safari öffnen“</li>
            <li>Bei „Jetzt sichern“ erneut tippen</li>
          </ul>
        </div>
      </div>
      <p class="muted">Unter ${APP_URL} (HTTPS) funktioniert das Teilen-Menü auf iOS zuverlässig.</p>
      ${figure('06-ios-qr-und-hinweis.png', 'iPhone: Hinweis zum Teilen-Menü', { variant: 'ios' })}
    </section>

    <section class="block">
      <h2>6. QR-Code nutzen</h2>
      <ul class="compact">
        <li>Drucken (Visitenkarte, Flyer) oder digital teilen</li>
        <li>Kamera-App scannt → Kontakt speichern</li>
        <li>Hintergrundbild als Sperrbildschirm nutzen</li>
      </ul>
      <div class="summary">
        <h2>Kurz &amp; knapp</h2>
        <ul class="compact">
          <li><strong>${APP_URL}</strong> öffnen → <strong>Start</strong> → Kontakt → Logo → PNG speichern</li>
          <li><strong>Desktop:</strong> Download · <strong>iOS:</strong> Teilen → Dateien / Bild sichern</li>
        </ul>
      </div>
      <p class="footer-note">Local First — keine Cloud. Fragen: IT-Abteilung (ABE) · it-becker.org</p>
    </section>
  </div>
</body>
</html>`
}

async function main() {
  mkdirSync(DOCS, { recursive: true })
  const html = buildHtml()
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    await page.pdf({
      path: OUT_PDF,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="width:100%; padding:0 14mm; font-family:'Segoe UI',Helvetica,sans-serif; font-size:7.5pt; color:#5b667a; display:flex; justify-content:space-between;">
          <span>${APP_URL} · Benutzerhandbuch Start</span>
          <span>Seite <span class="pageNumber"></span> / <span class="totalPages"></span></span>
        </div>`,
      margin: { top: '10mm', bottom: '14mm', left: '0', right: '0' },
    })
    console.log('Written:', OUT_PDF)
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
