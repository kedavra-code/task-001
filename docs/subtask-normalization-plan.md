# Subtask Normalization Plan

Stand: 2026-06-04

## Aktueller Stand

Subtasks werden appseitig normalisiert und online bevorzugt in `task_subtasks` gespeichert. Die App schreibt waehrend der Uebergangszeit weiterhin auch `tasks.subtasks`, damit alte Backups, CSV/JSON-Exporte und vorhandene Legacy-Daten lesbar bleiben.

Legacy-Textarray-Subtasks verwenden weiterhin:

- `[ ]` for open
- `[x]` for done
- optionale Datums-Metadaten JSON-kodiert im Textwert

## Zielmodell

`docs/supabase-schema.sql` legt `public.task_subtasks` an:

- `id`
- `task_id`
- `user_id`
- `position`
- `title`
- `is_done`
- `startdatum`
- `faellig`
- `created_at`
- `updated_at`

Die Tabelle hat RLS auf `user_id = auth.uid()` plus Allowlist-Pruefung.

## Umgesetzte sichere Reihenfolge

Ein direkter End-Umbau wuerde mehrere sensible Stellen gleichzeitig betreffen:

- Laden und Speichern von Tasks
- Backup/Restore
- CSV/JSON Export
- Inline-Subtask-Editor
- Reminder/Badges/Schnellfilter
- Completion-Regeln
- lokale Fallback-Sicherung

Darum wurde die sichere Uebergangsreihenfolge gewaehlt:

1. Provide target table and RLS. Done.
2. Extract shared subtask normalization into `src/subtasks.js`. Done.
3. Make the app dual-read capable: prefer the new table, keep the text array as fallback. Done.
4. Make the app dual-write capable: new table plus old text array for a transition period. Done.
5. After successful operation, treat the text array as legacy import only. Still open.

## Still Open

- Betrieb beobachten: nach normalem Laden/Speichern sollten Subtasks pro Nutzer in `task_subtasks` vorhanden sein. Doppelte Zeilen fuer dieselbe Task-Position und inhaltlich identische Subtasks werden appseitig zusammengefuehrt. Der Schema-Lauf bereinigt bestehende Inhalts- und Positionsduplikate; danach verhindert ein eindeutiger Index neue Positionsduplikate.
- Spaeter entscheiden, wann `tasks.subtasks` nur noch Legacy-Import/Fallback ist und nicht mehr aktiv mitgeschrieben wird.
- Tests bei kuenftigen Subtask-Regeln weiter ergaenzen.
