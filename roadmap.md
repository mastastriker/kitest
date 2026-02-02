# ENGAGER – Roadmap

> **Leitprinzip:**  
> *KI erzeugt Varianten – Mensch entscheidet.*

---

## ✅ v2.2 – RELEASED (Referenz)
**Status:** abgeschlossen & gemerged

- Zentraler Master Prompt (file-basiert, Single Source of Truth)
- Master Prompt aktiv verifiziert
- Englisch-only Output erzwungen
- Stil wird erzwungen, nicht gehofft
- Explizite Auswahl der Draft-Quelle:
    - Trend-basiert (Default)
    - RSS-basiert (nur bei bewusster Auswahl)
- Keine impliziten Fallbacks zwischen Quellen
- Keine Links im Post-Text (Meta nur intern)
- Klare Trennung von:
    - Trend-Erkennung
    - Draft-Generierung
    - Redaktioneller Entscheidung
- Draft-Validation aktiv (streng, aber stabil)

---

## 🔜 v2.3 – Stability & Signal Quality
**Ziel:** weniger Noise, höhere Erfolgsquote, gleicher Stil

### 1. Smarter Retry
- Maximal ein gezielter Retry bei Validation-Fail
- Minimaler Korrekturhinweis (z. B. kürzer, Statement statt Frage)
- Keine Prompt-Aufblähung

### 2. Validation feinjustieren
- Zeichenbereich leicht erweitern (z. B. 110–220)
- Bis zu 5 kurze Sätze erlauben
- Vereinfachte Satzende-Regel
- Reduktion von False Negatives

### 3. Draft-Diversität erzwingen
- Pro Batch:
    - mindestens 1 Statement
    - maximal 1 Frage
- Keine „nur-Fragen“-Batches

---

## 🔜 v2.4 – Trend-Qualität & Vertrauen
**Ziel:** nur Trends, aus denen sinnvolle X-Posts entstehen

### 4. Trend-Scoring (redaktionell)
Bewertung je Trend (0–3):
- Recency
- Conflict / Reibung
- Narrative Pressure (Markt vs. Realität)
- Discussion Potential

Nur Trends über einem definierten Schwellwert werden genutzt.

### 5. Trend-Verifikation (light)
- Kurze Gegenprüfung auf Aktualität / Wahrheit
- Veraltete oder widersprüchliche Trends aussortieren
- Keine Post-Generierung aus falschen Trends

---

## 🔜 v2.5 – Provider-Kontrolle & Vergleich
**Ziel:** Transparenz statt Blackbox

### 6. Trend-Vergleich: Grok vs. OpenAI
- Zwei-Spalten-Ansicht
- Anzeige von:
    - Quelle
    - Zeitstempel
    - Score
- Mensch entscheidet, welchem Signal er folgt

### 7. Provider pro Funktion wählbar
- Trends:
    - Grok
    - OpenAI
- Drafts:
    - OpenAI (Default)
    - optional Grok (später)
- API-Keys nur lokal (`.env`)

---

## 🔮 v3.0 – Optional (offen)
**Nur bei validiertem Nutzen**

- Status „posted“
- optionale X-API-Integration
- kein Auto-Posting
- keine Automatisierung ohne explizite Freigabe

---

## ❗ Feste Leitlinien (nicht verhandelbar)
- Master Prompt bleibt Code-/Datei-basiert (keine DB)
- Stiländerungen sind bewusste Produktentscheidungen
- ENGAGER bleibt ein redaktionelles System
- Kein Growth-Bot, kein Scheduler, kein Auto-Poster
