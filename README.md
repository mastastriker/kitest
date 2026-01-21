# KI X-Post Generator (MVP)

Schlanke Basis für eine Webanwendung zur KI-gestützten Erstellung von X/Twitter-Posts. Fokus: Themen verwalten, Beiträge generieren, persistent speichern.

## Architekturüberblick
- **Frontend (`public/`)**: Statische HTML/CSS/JS. Themen anlegen, Themenlisten anzeigen, Beitragsgenerierung triggern, Beiträge anzeigen.
- **Backend (`src/server.js`)**: Express-API, orchestriert Themen/Posts, ruft KI-Logik, liefert statische Assets aus.
- **Speicher (`src/store.js`, `data/store.json`)**: File-basierte Persistenz (Topics + Posts), bewusst simpel, synchronisierte Lese/Schreib-Operationen.
- **KI-Logik (`src/chatgpt.js`)**: Kapselt OpenAI-Aufruf, liefert strukturierte Post-Liste. Fallback-Generator aktiv, falls kein API-Key gesetzt ist.

### Datenfluss
1) Nutzer legt Thema im Frontend an → `POST /api/topics`.
2) Backend speichert Thema → `data/store.json`.
3) Nutzer klickt „Beiträge generieren“ → `POST /api/topics/:id/generate`.
4) Backend ruft KI-Logik auf (OpenAI) → erhält Post-Texte → speichert Posts dem Thema zugeordnet.
5) Frontend lädt Posts über `GET /api/topics/:id/posts` und rendert sie.

### Verantwortlichkeiten
- Frontend: Eingaben, Rendern, API-Aufrufe, kein Secret-Handling.
- Backend: Validierung, Routing, Persistenz, KI-Orchestrierung, statische Assets.
- KI-Modul: Prompt-Design, Modellwahl, strukturiertes JSON-Ergebnis, Fallback.
- Speicher: Einfache ID-Vergabe, persistentes JSON, Topic/Post-Beziehung.

## Schnellstart (lokal)
```bash
npm install
cp .env.example .env    # OPENAI_API_KEY setzen
npm start               # startet auf http://localhost:3000
```
Ohne `OPENAI_API_KEY` werden Platzhalter-Posts generiert (für UI-Smoke-Tests).

## API-Kurzreferenz
- `GET /api/topics` → `{ topics: [...] }`
- `POST /api/topics` → Body `{ name }` → `{ topic }`
- `POST /api/topics/:id/generate` → Body `{ count?: number }` → `{ topic, posts }`
- `GET /api/topics/:id/posts` → `{ topic, posts }`
- `GET /api/posts` → `{ posts }` (flach, inkl. `topicName`)

## Erweiterungsideen (später)
- **Post-Planung**: Zeitstempel in Posts ergänzen; Scheduler/Queue hinzufügen; Export in ICS oder Cron-ähnliche Tasks.
- **Export**: Endpunkte für CSV/JSON-Export; Webhook-Publisher; simple SDK/CLI.
- **Automatisierung**: Post-Pipeline mit Status (draft/approved/queued); Validierungen (Länge, verbotene Wörter); Mehrsprachigkeit.
- **Datenhaltung**: Migration auf SQLite/Postgres; Repositories/Services abstrahieren; Migrations-Tooling.
- **Auth & Multi-User**: Session/JWT-Schicht ergänzen; RBAC pro Thema/Post.

## Projektstruktur
- `src/server.js` – Express-Server, Routen, Static Serving.
- `src/store.js` – File-basierte Persistenz (Topics/Posts).
- `src/chatgpt.js` – OpenAI-Client + Fallback.
- `public/` – Statisches Frontend (HTML/CSS/JS).
- `data/store.json` – Persistente Datenablage.
