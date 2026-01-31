────────────────────────────────────
ENGAGER – PROJECT REFERENCE v1.1
────────────────────────────────────

Status:
Minor Release (UX & Robustheit)
Basierend auf ENGAGER v1
Keine konzeptionellen Änderungen

────────────────────────────────────
ZIEL
────────────────────────────────────

ENGAGER v1.1 ergänzt ENGAGER v1 um kleine,
klar abgegrenzte Verbesserungen in UI und Bedien­sicherheit.

Grundprinzip bleibt unverändert:
„KI erstellt Entwürfe – Mensch entscheidet.“

────────────────────────────────────
NICHT GEÄNDERT GEGENÜBER v1
────────────────────────────────────

- Keine neuen Features
- Keine neuen Entitäten
- Keine Themenverwaltung
- Keine Änderungen an:
    - Prompt-Pipeline
    - Quellenlogik
    - Stilregeln
    - Status-Flow
    - Limits
- Keine neuen Status
- Keine automatische Wiederverwendung verworfener Inhalte

ENGAGER v1 ist weiterhin inhaltlich gültig.

────────────────────────────────────
NEU IN v1.1
────────────────────────────────────

1) Schutz vor Doppel-Generierung

- Mehrfachklicks auf „X-Post generieren“ dürfen keine doppelten PostDrafts erzeugen
- Während einer laufenden Generierung ist pro Thema nur eine Generierung möglich
- Ziel ist Robustheit gegen Fehlbedienung
- Keine Änderung an der Generierungslogik selbst

────────────────────────────────────

2) Archiv-Verwaltung

- Archivierte PostDrafts (status = discarded) können gelöscht werden
- Zwei Aktionen:
    - Einzelne Archiv-Posts selektiv löschen
    - Alle Archiv-Posts auf einmal löschen („Archiv leeren“)
- Löschung ist endgültig
- Gelöschte Posts gelten weiterhin als „verworfenes Material“
  im Sinne der Qualitäts- und Quellenregeln

────────────────────────────────────

3) Empty States in der UI

- Für leere Tabs wird ein klarer Zustand angezeigt:
    - Entwürfe
    - Freigegeben
    - Archiv
- Ziel ist bessere Verständlichkeit der UI
- Keine neue Logik

────────────────────────────────────
VERSIONIERUNG
────────────────────────────────────

- ENGAGER v1.1 ist vollständig kompatibel zu ENGAGER v1
- v1.1 ersetzt v1 funktional, ohne das Konzept zu verändern
- Alle weitergehenden Änderungen erfordern v2

────────────────────────────────────
