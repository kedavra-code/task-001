# Supabase Auth Hook Setup

Stand: 2026-06-03

## Ziel

Unerlaubte Accounts sollen nicht nur in der App und per RLS blockiert werden, sondern schon durch Supabase Auth:

- `Before User Created`: blockiert neue User, bevor sie angelegt werden.
- `Custom Access Token`: blockiert Token-Ausstellung fuer nicht mehr erlaubte bestehende User.

Die SQL-Funktionen sind in `docs/supabase-schema.sql` enthalten:

- `public.hook_before_user_created(event jsonb)`
- `public.hook_custom_access_token(event jsonb)`

Beide pruefen `public.allowed_users` plus den festen Admin `miro@pixelina.me`.

## Manuelle Aktivierung in Supabase

1. `docs/supabase-schema.sql` im Supabase SQL Editor ausfuehren.
2. Supabase Dashboard oeffnen.
3. `Authentication` -> `Hooks` oeffnen.
4. `Before User Created` aktivieren.
5. Als Hook-Typ `Postgres Function` waehlen.
6. Funktion `public.hook_before_user_created` auswaehlen.
7. `Custom Access Token` aktivieren.
8. Als Hook-Typ `Postgres Function` waehlen.
9. Funktion `public.hook_custom_access_token` auswaehlen.

## Test

- Login mit `miro@pixelina.me`: muss funktionieren.
- Login mit einem in `...` -> `Benutzer` freigegebenen Account: muss funktionieren.
- Signup/Login mit nicht freigegebenem Account: muss mit `Dieser Account ist fuer task-001 nicht freigegeben.` blockiert werden.

## Hinweis

Die Hook-Aktivierung selbst ist Dashboard-Konfiguration und kann nicht allein durch Git-Push passieren. Bis sie aktiv ist, schuetzen weiterhin Frontend-Logout und RLS.
