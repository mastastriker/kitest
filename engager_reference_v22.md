# ENGAGER – MASTER REFERENZ v2.2

Stand: v2.2 (gemerged)  
Status: **stabil / abgeschlossen**

---

## 🧠 PROJEKTÜBERSICHT

**ENGAGER** ist ein redaktionelles System zur **KI-gestützten Erstellung von X-Post-Entwürfen**.

Leitprinzip:
> **KI erzeugt Varianten – Mensch entscheidet.**

ENGAGER ist **kein**:
- Auto-Poster
- Scheduling-Tool
- Growth-Hack
- Social-Media-Bot

---

## 📦 REPOSITORY & VERSIONEN

- Repository: https://github.com/mastastriker/kitest
- Aktueller stabiler Stand: **v2.2**
- Entwicklungsprinzip: klare, abgeschlossene Versionen
- v2.2 dient als **Referenz-Basis** für alle weiteren Versionen

---

## 🎯 PRODUKTZIEL (v2.x)

- X-taugliche, kurze Entwürfe
- klare Haltung
- keine Erklärungen
- keine Zusammenfassungen
- keine Fachaufsätze
- kein Influencer-Ton
- kein journalistischer Stil
- maximal diskutabel

Merksatz:
> **Wenn ein Post erklärt, ist er falsch.**

---

## 👤 FIXE PERSONA

- grundsätzlich **pro Krypto**
- kritisch gegenüber Macht, Akteuren und Narrativen
- nicht pro Hype
- ruhig, direkt, leicht genervt
- keine Neutralität
- keine Erklärhaltung

---

## 🧩 PROMPT-PIPELINE (v2.2)

### 1. Trend-Erkennung
**Zweck:** Rohes Signal

- Provider: Grok oder OpenAI (wählbar)
- Output:
    - Trend-Titel
    - Kurzbeschreibung
    - Zeit / Quelle
- **Keine Posts**
- **Kein Stil**

---

### 2. Trend-Aufbereitung
- Reduktion auf einen Gedanken
- Kein RSS-Zwang
- Kein Kontext-Overload

---

### 3. Analyse-Prompt (Scoring)
**Format:** JSON  
**Sprache:** Englisch

Bewertet u. a.:
- Recency
- Conflict
- Discussion Potential

Ergebnis:
- `key_takeaway`
- `total_score`

---

### 4. Idea-Prompt (These)
- Formuliert eine **klare Haltung**
- Meinungsstark
- Kurz
- Kein Erklären
- Kein Zusammenfassen

---

### 5. MASTER PROMPT (Single Source of Truth)

**Datei:**  
`backend/prompts/x_master_prompt_v2_1_1.txt`

**Rolle:** `system`

Der Master Prompt erzwingt:
- Länge (ca. 120–200 Zeichen)
- max. 3–4 kurze Sätze
- klare Haltung
- keine Erklärungen
- keine Fachsprache
- kein Influencer- oder Journalisten-Ton
- Englisch-only

⚠️ **Wichtig:**  
Der Master Prompt existiert **nur in dieser Datei**.  
Kein anderer Prompt darf Stil, Sprache oder Struktur definieren.

---

### 6. Rewrite / Draft-Generierung
- Erzeugt 1 / 3 / 5 Entwürfe
- Jeder Entwurf unabhängig
- Keine Links im Text
- Keine Meta-Kommentare

---

### 7. Validation & Retry
Validiert:
- Länge
- Satzanzahl
- Sprache
- keine URLs

Bei Fehler:
- max. 1 Retry
- kein Endlosloop
- keine stillen Fallbacks

---

## 🔀 DRAFT-QUELLEN (v2.2)

Beim Generieren wählbar:

### Trend-basiert (Default)
- nutzt Trend-Erkennung
- kein RSS
- kein Link im Text

### RSS-basiert (optional)
- **nur bei expliziter Auswahl**
- Link nur als Metadatum (`source_ref`)
- niemals im Post-Text

⚠️ Keine impliziten Fallbacks zwischen Quellen.

---

## 🧪 VALIDIERTE EIGENSCHAFTEN (v2.2)

- Master Prompt wird aktiv geladen (verifiziert)
- Englisch-only Output
- keine Link-Leaks
- keine Mischsprachen
- Stil konsistent über alle Drafts
- Mensch entscheidet final

---

## 🧭 ARCHITEKTUR-ENTSCHEIDUNGEN (fest)

- Master Prompt bleibt dateibasiert (kein DB-Feld)
- Stiländerungen sind **Produktentscheidungen**
- Keine Selbstoptimierung ohne Mensch
- Keine Automatisierung ohne Freigabe

---

## 🏁 STATUS

**v2.2 ist abgeschlossen.**  
Alle weiteren Arbeiten bauen **explizit** auf dieser Referenz auf.

Änderungen am Stil erfolgen nur durch:
- bewusste Anpassung des Master Prompts
- neue Version (v2.3+)

---
