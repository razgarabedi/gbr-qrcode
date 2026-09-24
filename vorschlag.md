# Vorschlag: Zwei Modi — Start & Erweitert

## Ziel

Die App bleibt eine Single-Page-Anwendung (kein neuer Router). Stattdessen gibt es oben einen klaren Umschalter zwischen zwei Ansichten:

| Modus | Zweck |
|--------|--------|
| **Start** | Schneller, einfacher Weg: Kontaktdaten eingeben → Logo wählen → QR & Hintergrundbild herunterladen |
| **Erweitert** | Der heutige volle Funktionsumfang — unverändert |

Gemeinsamer State in `App.tsx` (Kontakt, Logo, Wallpaper, QR-Stil), damit ein Wechsel der Tabs die Eingaben behält.

---

## UI-Umschalter

- Oben unter dem Hero (oder direkt im Hero) ein **Segmented Control** — gleiches Muster wie bereits bei Logo-Fit / QR-Stil (`.segmented` / `.segmented__btn` in `src/styles/index.css`).
- Labels: **Start** | **Erweitert**
- State z. B. `uiMode: 'start' | 'advanced'` in `App.tsx`
- Keine neuen Seiten-Routen nötig

---

## Start-Seite (einfaches Modell)

Nur die nötigsten Schritte — **keine neuen Komponenten**, bestehende wiederverwenden und per Props/Flags vereinfachen.

### Was erscheint

1. **Kontaktdaten** — `ContactForm`
2. **Logo** — vereinfachte Auswahl (siehe unten)
3. **QR-Code-Vorschau** — `QrPreview` (Download „QR-Code als PNG“ bleibt)
4. **Hintergrundbild-Vorschau** — `WallpaperPreview` (Download „Hintergrundbild als PNG“ bleibt)

### Was *nicht* erscheint

| Feature | Komponente / Ort heute | Start |
|---------|------------------------|-------|
| Kontakt importieren (VCF) | `ContactForm` — „Meine Visitenkarte importieren“ | ausblenden |
| Stapelimport / Batch-QR | `BatchImport` | ausblenden |
| Freier Logo-Upload / „Firmenlogo laden“ | `LogoUpload` (Datei + Sample) | ersetzen durch 2 feste Logos |
| Export-Sektion (inkl. VCF) | `ExportActions` | ausblenden |

Hinweis: Die Download-Buttons **„QR-Code als PNG“** und **„Hintergrundbild als PNG“** sitzen bereits in `QrPreview` bzw. `WallpaperPreview` — auf der Start-Seite reichen diese; die zentrale Export-Sektion entfällt.

### Logo auf der Start-Seite

Zwei vordefinierte Logos aus dem `public/`-Ordner (bereits vorhanden, noch nicht verdrahtet):

| Anzeige | Datei | URL im Browser |
|---------|--------|----------------|
| **Stein** | `public/stein.png` | `/stein.png` |
| **GBHX** | `public/gbhx.png` | `/gbhx.png` |

Umsetzung ohne neue Logik-Bibliothek:

- Bestehende Helper nutzen: `loadLogoFromUrl` aus `src/lib/logo.ts` (wie schon „Firmenlogo laden“ in `LogoUpload`)
- UI: kleiner Auswahlblock (z. B. zwei Buttons / Segmented Control „Stein“ | „GBHX“), optional „Kein Logo“
- Entweder:
  - **Variante A (bevorzugt):** `LogoUpload` um einen optionalen Prop erweitern, z. B. `mode?: 'full' | 'presets'`, und im Preset-Modus nur die zwei Logos anbieten, **oder**
  - **Variante B:** In `App.tsx` auf der Start-Seite statt `LogoUpload` nur zwei Buttons, die `loadLogoFromUrl('/stein.png')` / `loadLogoFromUrl('/gbhx.png')` aufrufen und `setLogo` setzen

Keine neue Logo-Komponente nötig — bestehende APIs reichen.

### Kontaktformular auf der Start-Seite

- Weiterhin `ContactForm` mit denselben Feldern
- Import-UI (Button + Hinweistext) per optionalem Prop ausblenden, z. B. `showImport?: boolean` (Default `true` für Erweitert, `false` für Start)
- Share-Target-Import (`consumeSharedContactImport` in `App`) kann im Erweitert-Modus bleiben; auf Start optional deaktivieren oder still übernehmen — Empfehlung: **weiterhin übernehmen**, aber ohne Import-Button in der UI

### Wallpaper / QR auf der Start-Seite

- `QrPreview` und `WallpaperPreview` **wie bisher** einbinden (gleiche Props)
- Keine Extra-Export-Sektion; Downloads nur über die bestehenden Buttons in den Previews
- Erweiterte Wallpaper-Einstellungen (Theme, Hintergrund-Upload, …) dürfen auf Start sichtbar bleiben, sofern sie schon in `WallpaperPreview` stecken — Ziel ist Vereinfachung der *Navigation/Optionen*, nicht ein zweites Wallpaper-System. Falls Start noch schlanker werden soll: später optional Props zum Ausblenden von Upload/Presets — **nicht Teil der ersten Umsetzung**, außer es stört den Flow.

---

## Erweitert (heutige App)

Wenn `uiMode === 'advanced'`, exakt die aktuelle Struktur aus `App.tsx` rendern:

1. Kontaktdaten (`ContactForm` inkl. Import)
2. Stapelimport & Batch-QR (`BatchImport`)
3. Logo (`LogoUpload` vollständig: Upload, Firmenlogo, Fit-Mode)
4. QR-Vorschau + Hintergrundbild (`QrPreview` / `WallpaperPreview`)
5. Export (`ExportActions`: QR-PNG, Hintergrundbild-PNG, VCF)

Keine Funktionskürzung in diesem Modus.

---

## Architektur (kurz)

```
App.tsx
├── Hero
├── Mode-Switch: Start | Erweitert   ← neu (bestehendes .segmented)
├── shared state: contact, logo, wallpaperBackground, qrStyle, wallpaperSettings
│
├── [Start]
│   ├── ContactForm (showImport=false)
│   ├── Logo-Presets (stein / gbhx via loadLogoFromUrl)
│   ├── QrPreview          → „QR-Code als PNG“
│   └── WallpaperPreview   → „Hintergrundbild als PNG“
│
└── [Erweitert]  (= heutiger main-Inhalt)
    ├── ContactForm (showImport=true)
    ├── BatchImport
    ├── LogoUpload
    ├── QrPreview + WallpaperPreview
    └── ExportActions
```

**Prinzip:** Keine neuen Feature-Komponenten. Nur:

- Mode-State + bedingtes Rendering in `App.tsx`
- Kleine optionale Props an bestehenden Komponenten (`ContactForm`, ggf. `LogoUpload`)
- Nutzung von `/stein.png` und `/gbhx.png` über `loadLogoFromUrl`

---

## Dateien, die voraussichtlich angefasst werden

| Datei | Änderung |
|--------|----------|
| `src/App.tsx` | `uiMode`, Umschalter, bedingte Sections |
| `src/components/ContactForm.tsx` | optional `showImport` |
| `src/components/LogoUpload.tsx` | optional Preset-Modus **oder** Presets nur in `App` |
| `src/styles/index.css` | ggf. kleine Styles für Mode-Switch / Logo-Presets |
| `public/stein.png`, `public/gbhx.png` | bereits vorhanden — nur verdrahten |

Unverändert bleiben u. a.: `QrPreview`, `WallpaperPreview`, `ExportActions`, `BatchImport`, Lib-Layer (`logo.ts`, `wallpaper.ts`, …).

---

## Akzeptanzkriterien

- [x] Umschalter Start / Erweitert sichtbar und bedienbar
- [x] Start: kein Import-Button, kein BatchImport, keine Export-Sektion
- [x] Start: Logo-Wahl nur Stein und GBHX (aus `public/`)
- [x] Start: Downloads nur „QR-Code als PNG“ und „Hintergrundbild als PNG“ (über bestehende Preview-Buttons)
- [x] Erweitert: Verhalten und Aufbau wie heute
- [x] Wechsel zwischen den Tabs behält Kontaktdaten und gewähltes Logo
- [x] Keine neuen Abhängigkeiten / kein Router

---

## Prompt-Skelett für Cursor AI

Die folgenden Prompts nacheinander in Cursor ausführen (Chat oder Agent). Jeder Prompt baut auf dem vorherigen Stand auf.

### Prompt 1 — Mode-Switch in App

```
Lies vorschlag.md und die aktuelle src/App.tsx.

Ziel: UI-Modus „Start“ | „Erweitert“ einführen.

- State uiMode: 'start' | 'advanced' in App.tsx (Default: 'start')
- Unter dem Hero einen Segmented Control wie bei Logo-Fit/QR-Stil (.segmented)
  mit Labels „Start“ und „Erweitert“
- Shared State (contact, logo, wallpaperBackground, qrStyle, wallpaperSettings) bleibt zentral
- Noch keine Inhaltsänderung der Sections — nur der Umschalter, beide Modi zeigen vorerst denselben Inhalt
- Keine neuen Komponenten-Dateien, kein Router
```

### Prompt 2 — Erweitert = heutige App, Start = reduzierte Sections

```
Baue auf dem uiMode-Umschalter auf.

Wenn uiMode === 'advanced': aktuelle Sections unverändert rendern
(ContactForm, BatchImport, LogoUpload, QrPreview, WallpaperPreview, ExportActions).

Wenn uiMode === 'start': nur rendern:
- Section Kontaktdaten (ContactForm)
- Section Logo (vorerst noch LogoUpload — wird im nächsten Prompt vereinfacht)
- split mit QrPreview + WallpaperPreview
- KEIN BatchImport, KEINE Export-Section (ExportActions)

State beim Wechsel beibehalten. Bestehende Komponenten wiederverwenden.
```

### Prompt 3 — Kontakt-Import auf Start ausblenden

```
Erweitere ContactForm um einen optionalen Prop showImport?: boolean (Default true).

Wenn showImport === false:
- Button „Meine Visitenkarte importieren“ und den dazugehörigen Hinweistext ausblenden
- Formularfelder unverändert lassen

In App.tsx: auf der Start-Seite <ContactForm showImport={false} ... />,
im Erweitert-Modus showImport weglassen oder true.
Keine anderen Features ändern.
```

### Prompt 4 — Logo-Presets Stein & GBHX auf Start

```
Auf der Start-Seite statt freiem Logo-Upload nur zwei vordefinierte Logos:

- „Stein“ → /stein.png (public/stein.png)
- „GBHX“ → /gbhx.png (public/gbhx.png)

Nutze loadLogoFromUrl aus src/lib/logo.ts (wie Firmenlogo in LogoUpload).
UI: Segmented Control oder zwei Buttons; Auswahl setzt logo via onChange/setLogo.
Optional: „Kein Logo“ zum Zurücksetzen (revokeLogoAsset beachten).

Variante: LogoUpload um mode?: 'full' | 'presets' erweitern — Start nutzt presets,
Erweitert bleibt full (Upload + Firmenlogo + Fit-Mode).

Keine neuen Lib-Dateien. public/gbhx.png und public/stein.png nur verdrahten.
```

### Prompt 5 — Feinschliff & Check

```
Prüfe gegen vorschlag.md Akzeptanzkriterien:

- Start: kein Import, kein Batch, keine Export-Sektion; nur Stein/GBHX-Logos;
  Downloads nur über QrPreview („QR-Code als PNG“) und WallpaperPreview („Hintergrundbild als PNG“)
- Erweitert: identisch zum bisherigen Vollumfang
- Tab-Wechsel behält State
- Bestehende Styles (.segmented) nutzen; nur minimale CSS-Ergänzungen falls nötig

Kleine UI-Texte/Section-Descriptions für Start anpassen
(z. B. Logo-Description: „Stein oder GBHX wählen“).
Keine Refactors außerhalb dieses Scope.
```

### Optional — Prompt 6 (nur wenn Start noch zu voll wirkt)

```
Optional: WallpaperPreview auf Start vereinfachen — Hintergrund-Upload und
erweiterte Einstellungen per Prop ausblendbar machen. Nur wenn nötig.
Ansonsten unverändert lassen. Keine Duplikate der Wallpaper-Logik.
```
