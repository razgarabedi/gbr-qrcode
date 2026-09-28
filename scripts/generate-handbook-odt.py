#!/usr/bin/env python3
"""Generate Gebr.Becker QR Generator user handbook (Start mode) as ODT."""
from pathlib import Path

from odf.opendocument import OpenDocumentText
from odf.style import Style, TextProperties, ParagraphProperties
from odf.text import H, P, Span
from odf.draw import Frame, Image

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs" / "benutzerhandbuch"
OUT = DOCS / "Gebr-Becker-QR-Generator-Benutzerhandbuch-Start.odt"
LOGO = DOCS / "assets" / "logo-gebr-becker.png"
SHOTS = DOCS / "screenshots"
APP_URL = "https://kontakt.it-becker.org"

NAVY = "#1c2b4a"
RED = "#b3202a"
INK = "#152033"
MUTED = "#5b667a"
BG = "#f3f5f8"


def cm(value: float) -> str:
    return f"{value}cm"


def add_styles(doc: OpenDocumentText) -> None:
    def tp(name: str, **kwargs) -> TextProperties:
        props = TextProperties(attributes=kwargs)
        s = Style(name=name, family="text")
        s.addElement(props)
        doc.automaticstyles.addElement(s)
        return props

    tp("T1", fontweight="bold", fontsize="24pt", color=NAVY)
    tp("T2", fontweight="bold", fontsize="16pt", color=NAVY)
    tp("T3", fontweight="bold", fontsize="13pt", color=RED)
    tp("TBody", fontsize="11pt", color=INK)
    tp("TMuted", fontsize="10pt", color=MUTED)
    tp("TBullet", fontsize="11pt", color=INK)

    def pp(name: str, **kwargs) -> Style:
        s = Style(name=name, family="paragraph")
        s.addElement(ParagraphProperties(attributes=kwargs))
        doc.automaticstyles.addElement(s)
        return s

    pp("PTitle", marginbottom=cm(0.4), margintop=cm(0.2))
    pp(
        "PHeading2",
        margintop=cm(0.6),
        marginbottom=cm(0.25),
        borderbottom="0.05pt solid #b3202a",
        paddingbottom=cm(0.08),
    )
    pp("PHeading3", margintop=cm(0.45), marginbottom=cm(0.15))
    pp("PDivider", marginbottom=cm(0.35), borderbottom=f"0.75pt solid {NAVY}")
    pp("PBody", marginbottom=cm(0.2), lineheight="140%")
    pp("PBullet", marginleft=cm(0.5), marginbottom=cm(0.12), lineheight="140%")
    pp("PImage", textalign="center", margintop=cm(0.25), marginbottom=cm(0.35))
    pp("PCaption", textalign="center", marginbottom=cm(0.5))


def p(doc, text: str, stylename: str = "PBody", textstyle: str = "TBody") -> None:
    para = P(stylename=stylename)
    para.addElement(Span(stylename=textstyle, text=text))
    doc.text.addElement(para)


def bullet(doc, text: str) -> None:
    para = P(stylename="PBullet")
    para.addElement(Span(stylename="TBullet", text=f"• {text}"))
    doc.text.addElement(para)


def heading(doc, level: int, text: str) -> None:
    styles = {1: ("PTitle", "T1"), 2: ("PHeading2", "T2"), 3: ("PHeading3", "T3")}
    pstyle, tstyle = styles.get(level, ("PBody", "TBody"))
    h = H(outlinelevel=level, stylename=pstyle)
    h.addElement(Span(stylename=tstyle, text=text))
    doc.text.addElement(h)


def add_logo(doc: OpenDocumentText) -> None:
    if not LOGO.is_file():
        return
    href = doc.addPictureFromFile(str(LOGO))
    frame = Frame(
        width=cm(4.5),
        height=cm(1.35),
        anchortype="paragraph",
    )
    frame.addElement(Image(href=href))
    para = P(stylename="PImage")
    para.addElement(frame)
    doc.text.addElement(para)


def add_image(doc: OpenDocumentText, path: Path, caption: str, width_cm: float = 16.0) -> None:
    if not path.is_file():
        p(doc, f"[Bild fehlt: {path.name}]", stylename="PCaption", textstyle="TMuted")
        return
    href = doc.addPictureFromFile(str(path))
    frame = Frame(width=cm(width_cm), anchortype="paragraph")
    frame.addElement(Image(href=href))
    para = P(stylename="PImage")
    para.addElement(frame)
    doc.text.addElement(para)
    cap = P(stylename="PCaption")
    cap.addElement(Span(stylename="TMuted", text=caption))
    doc.text.addElement(cap)


def build_content(doc: OpenDocumentText) -> None:
    add_logo(doc)
    heading(doc, 1, "Benutzerhandbuch — Ansicht „Start“")
    doc.text.addElement(P(stylename="PDivider", text=""))
    p(
        doc,
        "Diese Anleitung erklärt Schritt für Schritt, wie Sie Ihre Visitenkarte als QR-Code "
        "und als Hintergrundbild erstellen. Es geht nur um die Ansicht Start — nicht um Erweitert.",
    )
    p(doc, "Stand: September 2026 · IT-Abteilung Gebr. Becker", textstyle="TMuted")
    p(doc, f"App im Browser: {APP_URL}", textstyle="TBody")

    heading(doc, 2, "1. Was Sie brauchen")
    bullet(doc, "Einen modernen Browser (Chrome, Edge, Firefox oder Safari).")
    bullet(doc, "Ihre Kontaktdaten (Name plus mindestens Telefon oder E-Mail).")
    bullet(doc, "Optional: geschäftliche und private E-Mail-Adresse.")

    heading(doc, 2, "2. Seite öffnen und „Start“ wählen")
    p(
        doc,
        f"Öffnen Sie {APP_URL} im Browser. Oben sehen Sie den Titel und den Hinweis "
        "Lokal · Datenschutzfreundlich · Ohne Cloud. Unter dem Titel wählen Sie Start (nicht Erweitert).",
    )
    add_image(doc, SHOTS / "01-desktop-start-hero.png", "Startseite mit Umschalter Start / Erweitert")

    heading(doc, 2, "3. Kontaktdaten ausfüllen")
    p(
        doc,
        "Im Bereich Kontaktdaten tragen Sie mindestens Vorname, Nachname und eine Kontaktmöglichkeit ein "
        "(Mobil, Festnetz oder E-Mail). Weitere Felder sind optional.",
    )
    add_image(doc, SHOTS / "02-desktop-kontaktdaten.png", "Formular Kontaktdaten")

    heading(doc, 2, "4. Logo wählen")
    p(
        doc,
        "Im Bereich Logo wählen Sie Stein oder Gebr.Becker. Das Logo erscheint in der Mitte des QR-Codes "
        "und dezent auf dem Hintergrundbild.",
    )
    add_image(doc, SHOTS / "03-desktop-logo.png", "Logo-Vorlage Stein oder Gebr.Becker")

    heading(doc, 2, "5. QR-Code")
    p(
        doc,
        "Unter QR-Code-Vorschau sehen Sie den Code live. Sie können zwischen klassisch und integriert "
        "(rot/navy) wechseln und die Größe anpassen.",
    )
    add_image(doc, SHOTS / "04-desktop-qr-vorschau.png", "QR-Vorschau und Button QR-Code als PNG")

    heading(doc, 2, "6. Hintergrundbild")
    p(
        doc,
        "Im Bereich Hintergrundbild-Vorschau sehen Sie ein Sperrbildschirm-Motiv mit Ihren Daten und dem QR-Code. "
        "Theme und Hintergrund können Sie optional anpassen.",
    )
    add_image(doc, SHOTS / "05-desktop-hintergrundbild.png", "Hintergrundbild-Vorschau und Download")

    heading(doc, 2, "7. Speichern auf dem Desktop (Windows / Mac)")
    bullet(doc, "Klicken Sie auf QR-Code als PNG — die Datei wird in Ihren Download-Ordner gelegt.")
    bullet(doc, "Klicken Sie auf Hintergrundbild als PNG — ebenfalls als Download.")
    bullet(doc, "Es öffnet sich kein Teilen-Menü; der Browser speichert die PNG direkt.")

    heading(doc, 2, "8. Speichern auf iPhone und iPad (iOS)")
    p(
        doc,
        "Auf dem iPhone und iPad funktioniert Speichern anders als am PC: Statt eines normalen Downloads "
        "öffnet sich das Teilen-Menü von iOS.",
    )
    bullet(doc, "Tippen Sie auf QR-Code als PNG oder Hintergrundbild als PNG.")
    bullet(doc, "Wählen Sie im Teilen-Menü „In Dateien sichern“ oder „Bild sichern“.")
    bullet(
        doc,
        "Nicht „In Safari öffnen“ — damit wird die Datei nicht zuverlässig gespeichert.",
    )
    bullet(
        doc,
        "Falls ein Button Jetzt sichern erscheint, tippen Sie darauf und wählen Sie erneut "
        "„In Dateien sichern“ oder „Bild sichern“.",
    )
    p(
        doc,
        f"Unter {APP_URL} (HTTPS) akzeptiert das Teilen-Menü auf iPhone und iPad Dateien zuverlässig.",
        textstyle="TMuted",
    )
    add_image(
        doc,
        SHOTS / "06-ios-qr-und-hinweis.png",
        "iPhone-Ansicht: QR-Bereich mit Hinweis zum Teilen-Menü",
        width_cm=8.5,
    )

    heading(doc, 2, "9. QR-Code nutzen")
    bullet(doc, "Drucken Sie den QR-Code auf Visitenkarten oder Flyer.")
    bullet(doc, "Scannen Sie ihn mit der Kamera-App — die Kontaktdaten werden angeboten.")
    bullet(doc, "Das Hintergrundbild können Sie als Sperrbildschirm auf dem Handy verwenden.")

    heading(doc, 2, "10. Kurz & knapp")
    bullet(doc, f"{APP_URL} öffnen → Start wählen → Kontakt ausfüllen → Logo wählen → PNG speichern.")
    bullet(doc, "Desktop: normaler Download.")
    bullet(doc, "iOS: Teilen-Menü → In Dateien sichern / Bild sichern.")

    p(
        doc,
        "Fragen? Wenden Sie sich an die IT-Abteilung (ABE) — it-becker.org",
        textstyle="TMuted",
    )


def main() -> None:
    doc = OpenDocumentText()
    add_styles(doc)
    build_content(doc)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(OUT))
    print(f"Written: {OUT}")


if __name__ == "__main__":
    main()
