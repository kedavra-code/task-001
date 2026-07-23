# Codex Review

Stand: 2026-06-04

## Kurzfazit

Die App ist funktional schon sehr weit: schnelle Erfassung, kompakte Uebersicht, sichere Task-Regeln, Backup/Restore und Supabase-RLS sind vorhanden. Die groessten naechsten Hebel liegen nicht in mehr UI, sondern in Datenmodell, Auth-Betrieb und Testabdeckung.

## UX / Workflow

- Gut: Mobile Capture bleibt leicht, Browser Capture vollstaendig; das passt zum Arbeitskontext.
- Gut: Kompakte Karten reduzieren Reibung, besonders weil Browser optional dieselbe Ansicht nutzen kann.
- Risiko: Viele Funktionen sitzen inzwischen im `...`-Menue. Bei weiterem Wachstum sollte das Menue in klare Gruppen aufgeteilt werden: Anzeige, Daten, Benutzer, Hilfe.
- Recommendation: Later, evaluate a fixed triage view for `clarify` and `prioritize` if those tasks often remain unresolved.

## Datenmodell

- Gut: Tasks sind user-scoped, Soft Delete und Done Date sind explizit gespeichert.
- Gut: Subtasks werden appseitig normalisiert, in `task_subtasks` dual-geschrieben und aus dieser Tabelle bevorzugt gelesen. `tasks.subtasks` bleibt waehrend der Uebergangszeit Legacy-Fallback.
- Empfehlung: Nach stabiler Uebergangszeit pruefen, ob `tasks.subtasks` nur noch als Import-/Fallback-Pfad benoetigt wird.

## Security

- Gut: RLS prueft `user_id` und `public.is_allowed_user()`.
- Gut: Admin-verwaltete `allowed_users` ist fuer den aktuellen kleinen Nutzerkreis passend.
- Gut: Supabase Auth Hooks sind aktiviert und getestet, damit unerlaubte Signups/Logins vor Token/User-Erstellung blockiert werden.

## Maintainability

- Risiko: `src/App.jsx` ist sehr gross und traegt UI, Datenmapping, Regeln, Sync und Dialoge gleichzeitig.
- Empfehlung: Weiter in kleinen Schritten Funktionen auslagern. Erste Auslagerungen sind `src/subtasks.js` und `src/TaskScopeTabs.jsx`; moegliche weitere Module:
  - `taskStorage`
  - `userSettings`
  - `taskFilters`
  - `taskDialogs`
- Gut: Core-Regeln haben bereits Node-Tests. Das sollte bei jeder neuen Regel fortgefuehrt werden.

## Priorisierte naechste Schritte

1. Normalisierte Subtasks im Betrieb beobachten und erst spaeter Legacy-Textarray-Schreiben entfernen.
2. Weitere Settings-Synchronisierung beobachten: letzte Ansicht und Filter sollten nicht nerven, sondern beim Wechsel zwischen Geraeten helfen.
3. `App.jsx` weiter schrittweise modularisieren, sobald wieder groessere Feature-Arbeit ansteht.
4. Danach eines der groesseren Zukunftsfeatures angehen, z.B. Email-to-Task.
