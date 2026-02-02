# ENGAGER – PROJECT REFERENCE v1

## Ziel

Engager ist ein **redaktionelles System zur KI-gestützten Erstellung von X-Post-Entwürfen**.

Grundprinzip:
> **KI erstellt Entwürfe – der Mensch entscheidet.**

Der Fokus liegt auf:
- Stil
- Qualität
- Kontrolle
- Diskussionspotenzial

Nicht auf:
- Automatisierung
- Reichweitenoptimierung
- Massenproduktion

---

## Leitlinien (verbindlich)

- KEIN automatisches Posten
- KEINE X-API
- KEIN Scheduling
- KEINE Benutzerverwaltung
- KEIN Prompt-Editor im UI

Engager ist **kein Bot**, sondern ein **Redaktionswerkzeug**.

---

## Themen (v1)

Es existieren **genau zwei Themen**:

- `crypto`
- `camping`

Themen sind:
- fest definiert
- nicht im UI erweiterbar
- Grundlage für Stil und Einordnung

---

## Zentrale Entität: PostDraft

```json
PostDraft {
  id
  theme                // "crypto" | "camping"
  content              // finaler X-Post (Text + Link)
  status               // "generated" | "approved" | "discarded"
  source_type           // "rss" | "trend" | "manual"
  source_ref            // URL oder Quellenbeschreibung
  created_at
  approved_at?          // nur bei approved
}
```

Status-Flow v1:
- generated → approved
- generated → discarded

---

## Inhalte & Quellen

### RSS (Primärquelle)

- RSS-Artikel werden **inhaltlich gelesen**, nicht zusammengefasst
- Pro RSS-Artikel:
  - maximal **ein** Draft
  - kein Wiederverwenden
- RSS-Posts enthalten **immer genau einen echten Link**
- Link steht **in eigener Zeile am Ende**

### Trends (Fallback)

- Nur wenn keine geeigneten RSS-Inhalte vorhanden sind
- Trend-Posts enthalten **keinen externen Link**
- Stattdessen:
  ```
  Quelle: <Trendbeschreibung>
  ```

---

## Prompt-Pipeline (verbindlich)

### 1) Analyse (denken, nicht schreiben)

- Artikel oder Trend vollständig erfassen
- Bewertung nach:
  - Aktualität
  - Themen-Fit
  - Konflikt / Reibung
  - Diskussionspotenzial
- Ergebnis ist **intern**, nicht sichtbar
- Nur wenn die Bewertung ausreichend ist, geht es weiter

---

### 2) Post-Idee

- Klare These
- Klarer Blickwinkel
- KEINE Zusammenfassung
- KEIN neutraler Ton
- Ziel: Haltung + Reibung

---

### 3) Anti-KI-Rewrite (final)

Der Prompt erzeugt **den finalen Text vollständig**.

#### Stilregeln (hart):

- Kurze, klare Sätze
- Kein Gedankenstrich "-"
- Keine Meta-Sprache
- Keine Floskeln
- Keine Emojis
- Keine Aufzählungen
- Verständlich beim ersten Lesen
- Kein erklärender Ton
- Kein KI-Stil

#### Struktur:

- Text zuerst
- Link (oder Quelle) **immer in eigener Zeile**
- Link **immer vollständig**
- Maximal 280 Zeichen (X-Regel)
- Inhalt wird gekürzt, **niemals abgeschnitten**

#### Wichtig:
- KEIN nachträgliches Kürzen im Code
- KEIN Anhängen von Links außerhalb des Prompts

---

## Stil-Varianz (intern, v1)

Pro Post wird intern zufällig **GENAU EIN** Stil-Modul verwendet:

- Offene Frage am Ende
- Provokante These
- Call-to-Comment
- Link am Anfang
- Link am Ende

Regeln:
- Keine UI dafür
- Keine Speicherung
- Gleiche Handschrift, wechselnde Dramaturgie

---

## Limits (v1)

- Max. **3 Drafts gleichzeitig** mit Status `generated` pro Thema
- Max. **5 Drafts pro Thema innerhalb von 24 Stunden**
- Pro Quelle maximal **ein Draft**
- Verworfenes Material darf **nie** erneut verwendet werden

---

## UI v1

### Post Generator
- Thema auswählen
- Modus:
  - Automatisch (RSS priorisiert, Trend-Fallback)
  - Manuell (RSS-Artikel auswählen)
- Button: „X-Post generieren“

### Entwürfe & Freigabe
- Tabs:
  - Entwürfe (generated)
  - Freigegeben (approved)
  - Archiv (discarded)
- Aktionen:
  - Freigeben
  - Bearbeiten
  - Verwerfen

Beim Freigeben:
- Status → approved
- approved_at wird gesetzt

---

## Qualitätsanspruch

- Jeder gespeicherte Draft muss vollständig sein
- Abgeschnittene Texte oder Links sind unzulässig
- Unvollständige Generierungen werden verworfen
- Qualität ist wichtiger als Durchsatz

---

## Nicht Teil von v1

Explizit ausgeschlossen:

- X-API
- Automatisches Posten
- Scheduling
- Retry-Strategien im UI
- Themenverwaltung
- Eigenschaften-Editor
- Benutzer- oder Account-Logik
- Reichweiten- oder KPI-Tracking

---

## Versionsphilosophie

v1 bedeutet:
> **Stil & Qualität sind stabil.**

Automatisierung, Skalierung und Optimierung
sind **bewusst** spätere Versionen (v1.1 / v2).

---

## Referenzstatus

Diese Datei ist die **verbindliche Referenz für Engager v1**.

Alle:
- Feature-Vorschläge
- Bugfixes
- Erweiterungen

müssen sich **explizit** auf diese Referenz beziehen
oder eine neue Version einführen.
