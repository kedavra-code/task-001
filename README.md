# Task Sheet / task-001

React web app for tracking and coordinating tasks. The current
app was migrated from the existing local `task-sheet` React app.

task-001 focuses on fast operational task triage: capture incoming work, decide what is important, urgent, or still unclear, and keep it visible until it is started or done. It is aimed at individuals and small operational teams that need lightweight action steering rather than a broad project or collaboration suite. Collaboration happens in other tools; this app stays deliberately narrow: categorize, prioritize, and review tasks.

## Current Status

The repository contains the working task sheet app on top of a Vite React
TypeScript scaffold.

## Stack

- React 19
- TypeScript 6
- Vite 8
- lucide-react icons
- Supabase for auth and task storage
- Google OAuth via Supabase Auth
- Vercel for hosting/deployment
- GitHub for source control

## Services

- **GitHub**: source of truth for the repository.
- **Supabase**: database, Row Level Security, and Google Auth session handling.
- **Google Cloud / Google Auth Platform**: OAuth client for Google login.
- **Vercel**: production hosting at `https://task-001.pixelina.me/`.

## Features

- Add, edit, complete, delete, filter, sort, import, and export tasks
- Online task persistence via Supabase
- Google login/logout
- `Backlog` and `Doing` filtering via the header filter's `Status` dropdown; `Done` and `Deleted` each have their own top-level tab next to `All`
- Toggleable Kanban view with persistent optional `Backlog`, `Doing`, and `Done` columns
- Managed task tags, max 1 per task and max 10 catalog tags, with synced optional tag-based tabs
- Derived `Prio` value from simple criteria
- Structured descriptions with paragraphs and bulletpoint display
- Separate backlog, doing, and done views
- Compact card overview shared by browser and mobile
- Mobile task cards with compact action icons for descriptions, sharing, deletion, and completion
- Predecessor/successor dependency indicators derived automatically from existing task dependencies
- JSON and CSV import/export
- Undo/redo for task-list changes
- Derived `Prio` handling: `Prio`/priority answers `How important?`; criteria dropdowns derive the value; the derived value is shown while capturing/editing and is not set manually

## Options Menu

The `...` options menu is grouped into clear themed blocks with headings for view, tabs, layout, Kanban, cards, editing, task views, management, history, data, and logout. Rows with a single option keep that option in the left
table cell of the two-cell menu instead of stretching across the full menu. In the browser, the menu
opens from the left edge of the `...` button so it stays inside the viewport.

## Mobile Task Cards

The app includes a current user documentation panel under the `...` options menu. Keep the in-app panel and this section aligned when user-facing behavior changes.

The mobile overview is intentionally compact. Each card shows the task ID and title first, followed by compact meta values in a fixed 3-column mobile grid. Compact card values show their visible label only while the value is still empty, except `Start:` and `Due:`, which always keep their labels and may wrap to two lines on phones only after the colon. The label before the colon stays neutral, has a small gap after the colon, and the value keeps the badge color. When tooltips are enabled, compact card values expose their column name as a tooltip: hover on browser, or tap/focus the value on touch devices. Tooltips appear near the value and are clamped inside the visible viewport so they do not overflow off-screen.
On mobile capture and mobile editing, the derived `Prio` value is shown so changes to the criteria stay visible without making that value manually selectable.
Browser capture keeps the full desktop form, but the capture card is content-based and Task, description, and tag fields are width-limited so they do not stretch across the whole screen. Phone capture remains responsive/full-width.
The `...` options menu includes separate persistent `Layout Browser` and `Layout phone` selectors for `Normal` or `Dark Mode`, separate browser/phone default-open/default-closed choices for the four edit sections, a persistent `Show tooltips` checkbox, a `Default task details` Minimum/Maximum selector. Edit sections default to expanded on both browser and phone. Task cards default to `Minimum`, meaning parameter badges, card content, and the `Additional details` label stay hidden. `Maximum` shows parameter badges by default; cards with a description, subtasks, or comments show their content panels directly below the badges, with no `Additional details` label or click needed. The header task-detail icon temporarily switches the current List/Kanban view between Minimum and Maximum without changing the saved default; its tooltip starts with `View:`. The menu controls themselves have short tooltips explaining what each option does. `Show tooltips` defaults to enabled; when active, capture and edit fields on browser and phone expose tooltips with the current value and a short explanation. The `Prio` tooltip also states that `Prio`/priority answers `How important?`, then shows the selected criteria that produced the derived value and the default sort order. Dark Mode, edit-section defaults, task-card detail default, browser card badge column counts, browser Kanban badge column count, separate browser/phone default list/Kanban view, Kanban columns, tooltips, Browser compact, tab layout, and tag catalog sync through `user_settings` when the schema columns exist, with local browser storage as fallback. Current working selections such as active tab, tag scope, search text, filters, column sorts, the temporary List/Kanban toggle, and the temporary task-detail toggle stay session-only while the app is open; a fresh app session starts from the configured option defaults.

Header icons:

- Plus icon: opens task capture. Capture is no longer a tab.
- Kanban/List icon: toggles the task overview between the standard list view and a Kanban board for the current session only. Persistent browser/phone defaults are changed only in the `...` options menu.
- The `task-001` title jumps back to neutral `All` without additional status or due filters.
- On phones, the device/browser back button is intercepted while the app is active and returns to `All / Backlog` when the browser exposes it as history navigation. The app also registers a best-effort native browser warning before the page/app is closed; Android/Chrome decides whether that warning is shown and controls its text.
- On phones, the title is intentionally shorter so the header icons remain visible.
- Icon order is always: edit, share, delete, completion. Adjacent action icons use the same visual size throughout the UI and are aligned to the right side of the card header, including edit mode. The old Details icon is replaced by the card's content panels: in Maximum detail mode, a task's description/subtasks/comments/dependency panels show directly below the badges with no toggle; in Minimum detail mode, a collapsible `Additional details` label appears only for a card locally opened via its task ID, and only when the task has a description, subtasks, or comments. Predecessors and successors no longer use separate arrow icons; they stay as labeled clickable relation text in the card details. An upcoming task shows a small red `!` marker directly left of the task ID in overview and edit mode. Its tooltip lists the concrete reasons such as `Start reached`, `due today`, or subtask reminders, including on touch devices. If a task title wraps to multiple lines, the `!` marker and task ID stay aligned with the first title line. In Minimum detail mode, the task ID is clickable in overview cards/rows to locally reveal that card's badges (its content still opens through a collapsible `Additional details` label); clicking it again collapses the card, and clicking another task ID collapses the previous one before locally opening the new one, without changing the global view mode; only the currently open card renders detail content. In edit mode it is display-only. Editing starts from the pencil icon. In mobile edit mode, the edited card header uses the same width as the colored edit-section dividers; the optional `!` marker and task number stay left, and action icons are anchored to the right edge of the card.
- `↑`: davor erfolgt. Tapping it jumps to the predecessor task.
- `↓`: danach erfolgt. Tapping it jumps to the successor task.
- `↕`: both preceding and following tasks exist. Tapping it opens the target picker when several related tasks exist.
- Text-page icon: shown when a task has a description, comments, or subtasks. Tapping it opens the content area with description, subtasks, and comments; tapping again or tapping elsewhere closes it. Scrolling keeps the content area open.
- Share icon: copies a compact task summary and direct task URL such as `https://task-001.pixelina.me/?task-id=T-123` to the clipboard and opens the device share sheet when available. Opening such a link after login opens the task in the normal Maximum detail view for the matching user's task list; use the pencil icon to edit it. Some share targets such as Microsoft Teams may open the chosen chat without accepting the shared text; in that case the copied task summary can be pasted directly into the chat field.
- Trash icon: deletes the task after confirmation. Check icon: toggles completion. On mobile, marking a task as done first opens `Complete? Yes No`; tapping the icon again, scrolling, or tapping elsewhere closes the prompt.

The predecessor/successor icons do not require extra data fields. They are derived from the existing internal dependency relationship: a task with a predecessor points to the task that must happen before, and a task referenced by other tasks has successors.

For dependency direction, the predecessor is the task that must happen before; the successor is the task that happens after.

Task capture, desktop editing, and mobile editing support selecting multiple predecessors and multiple successors through searchable dropdown popups with checkboxes. Typing in the popup filters the available tasks, while the checkbox selection works as before. The first predecessor is also stored in the legacy single-predecessor field for compatibility.
Popups and dialogs have an `x` in the top-right corner, close when the user clicks or taps outside them, and keep newly opened inline confirmations inside the visible popup or viewport.
Only open tasks can be selected or shown as dependency targets. When a task is marked done, it is removed from predecessor/successor selectors and from other tasks' predecessor lists. If the task is later reopened, those removed dependencies are intentionally not restored automatically because the dependency situation may have changed; set any needed predecessors or successors again.

`Prio` is derived dynamically from the related criteria dropdowns. `Prio`/priority answers `How important?`.
It is displayed in the overview and edit views, but it is not set manually.
Whenever a task is normalized or saved, the stored value is recalculated from
the saved criteria so the persisted `Prio` matches the displayed value.
`Priority = Impact × Likelihood`.

Compact cards show predecessors and successors as labeled clickable text in the card details outside edit mode; clicking a related task jumps to it while preserving the current view, and multiple related tasks use the same picker popup pattern. In edit mode, `Predecessors` and `Successors` use a searchable multi-select popup for choosing target tasks. In Minimum detail mode, relation details stay hidden because the `Additional details` label is not shown.

Clicking a dependency target preserves the current overview view and scrolls to the selected task if it is visible there, highlighting it briefly.

## Subtasks

Tasks can contain a lightweight internal subtask list. These subtasks exist only inside the parent task, do not have priority or dependencies, and are intentionally not a replacement for full task management in other tools. Subtasks can have their own optional start and due dates.
Subtasks can be marked done and reopened. Done subtasks remain visible in a greyed/struck style. A parent task cannot be marked done while any subtask is still open; the app shows a popup hint in that case.

On mobile cards, subtasks are not shown by default. They appear together with the description in the expandable content area behind the text-page icon and are shown as numbered, visually separated entries like comments, without an extra inner label below the section heading.

Descriptions support lightweight structure. Blank lines create separate
paragraphs, and lines starting with `-`, `*`, or `•` are shown as bulletpoints
in the shared compact card description panel on browser and mobile.
URLs in descriptions are clickable in read views. Links starting with `http://`, `https://`, or `www.` open in a new browser tab; the stored description remains plain text.
The full description is shown in read mode inside the card's collapsible
`Additional details` panel, with no length truncation.
Description edits happen inline in the Description section, using the same local disk and `X` pattern as comments and subtasks. The disk icon is grey without changes and highlighted when the description draft differs from the saved value. The local `X` opens the familiar Save changes? prompt for that description draft only. The task-level disk icon stays highlighted while any local draft exists. The task-level `Save changes?` dialog appears only when leaving or closing the task with unsaved changes.

Comments sit below the subtasks in the task content area. In task edit mode, a comment editor
appears with an empty input at the top; new
comments are inserted above older comments. Each comment stores when it was
created and, after changes, when it was edited. Comments can be changed or deleted with the same right-side icon layout used by subtasks; save/delete icons use matching size and sit directly to the right of the text fields, and deletion uses a trash icon. Comments use the same unsaved-draft save flow as the rest of task editing. Description fields grow from one visible row up to ten rows before scrolling; new comment and subtask fields grow up to four rows, while existing comment and subtask edit fields size to their content up to six rows.
A new comment is saved through the highlighted disk icon or, when leaving the task, the `Save changes?` dialog; the adjacent `x` opens the familiar Save changes? prompt before discarding or saving pending new-comment text. Simply leaving the field keeps it pending and highlights the task-level disk icon. Further edits to a comment are saved with its own highlighted disk icon; unsaved local drafts also keep the task-level disk highlighted until saved through either the local disk or the global task disk, or until discarded. Clicking or touching outside the comment editor does not open a prompt. Leaving or closing the task with unsaved comment edits uses the normal `Save changes?` dialog.

Subtasks are edited inline in the task edit view with the same create/edit card pattern as comments. New subtask textareas grow from one visible row up to four rows, then scroll internally; existing subtask textareas size to their content up to six rows, then scroll internally. An empty `Write a new subtask` field is always shown at the top; Start and Due date fields remain directly below that field. Press Enter or use the highlighted disk icon to create and save the new subtask below existing subtasks; use the adjacent `x` to open the familiar Save changes? prompt before discarding or saving the pending new subtask. Existing subtasks are shown as visually separated cards like comments, with right-side save, trash/delete, and done/reopen icons in one row, optional Start/Due dates, drag-and-drop reordering, and sideways drag or trash deletion. Done subtasks do not show a separate done/open text; their content is struck through. Subtask row changes and pending new-subtask text stay in the local subtask draft until the highlighted local disk icon, the global task disk icon, or the task-exit save dialog saves them; they also highlight the global task save disk icon. Clicking/touching outside the subtask editor keeps the draft pending and does not open a prompt. Leaving or closing the task with unsaved subtask changes opens `Save changes?`.

Subtask dates must fit inside the parent task dates where those parent dates exist: a subtask cannot start before the parent start date, cannot be due after the parent due date, and cannot be due before its own start date. If the parent has no corresponding date, the subtask may still use its own date.

Supabase stores multiple predecessors in `depends_on_task_ids`. If a task has several predecessors and that column has not been added yet, the app blocks remote saving instead of silently reducing the relation to the legacy single predecessor.
Supabase stores subtasks in the normalized `task_subtasks` table and still writes the legacy `tasks.subtasks` text array during the transition. On load, `task_subtasks` is preferred when rows exist; duplicate rows for the same task position are collapsed, and otherwise the legacy text array remains the fallback. Identical subtask text is allowed because two checklist items may intentionally have the same wording. Subtask rows use stable IDs and the schema has a unique `(user_id, task_id, position)` index to prevent technical duplicate rows.
Supabase stores the automatic done date in `completed_at`. Apply the schema update before relying on online persistence of the done date.
Supabase stores the task creation timestamp in `tasks.created_at`, previously used to sort the now-removed `Newest` tab by most recently added tasks first. New tasks keep their real creation timestamp and sort before repaired legacy fallbacks. For older tasks without a stored creation timestamp, with the former task-code-derived legacy timestamp, or with an identical Supabase backfill timestamp shared by several old tasks, the app uses the task start date once as the creation timestamp on load/save. Tasks with neither creation timestamp nor start date are placed after dated tasks. Apply the schema update before relying on online persistence of the creation timestamp:

```sql
alter table public.tasks
add column if not exists created_at timestamptz not null default now();

create index if not exists tasks_created_at_idx
on public.tasks (created_at);
```

Supabase stores task tags in the `tags` text array. Apply the schema update before relying on online tag persistence.
Supabase stores task comments in `tasks.comments` as JSON. Apply the schema update before relying on online comment persistence:

```sql
alter table public.tasks
add column if not exists comments jsonb not null default '[]'::jsonb;
```

Supabase stores the managed tag catalog in `user_settings.available_tags`, selected tag tabs in `user_settings.selected_tag_tabs`, tooltip preference, separate browser/phone dark-mode preferences, configurable card badge columns including browser Kanban, the separate browser/phone default list/Kanban view modes, active Kanban columns, separate browser/phone edit-section defaults, and the custom three-row tab layout. Active tab, tag scope, search text, filters, and column sorts are intentionally session-only and are not restored on a fresh app start. Apply the schema update before relying on synced settings across phone and browser:

```sql
alter table public.user_settings
add column if not exists tooltips_enabled boolean default true;

alter table public.user_settings
add column if not exists dark_mode boolean default false;

alter table public.user_settings
add column if not exists dark_mode_browser boolean default false;

alter table public.user_settings
add column if not exists dark_mode_mobile boolean default false;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_settings'
      and column_name = 'dark_mode'
  ) then
    update public.user_settings
    set dark_mode_browser = true,
        dark_mode_mobile = true
    where dark_mode is true
      and dark_mode_browser is false
      and dark_mode_mobile is false;
  end if;
end $$;

alter table public.user_settings
add column if not exists edit_section_defaults jsonb not null default '{"version":5,"browser":{"parameters":true,"description":true,"comments":true,"subtasks":true},"mobile":{"parameters":true,"description":true,"comments":true,"subtasks":true}}'::jsonb;

-- due_reminder_order is no longer read/written by the app since the Upcoming tab was removed; kept only for old rows.
alter table public.user_settings
add column if not exists due_reminder_order jsonb not null default '[]'::jsonb;

alter table public.user_settings
add column if not exists tab_layout jsonb not null default '[]'::jsonb;

alter table public.user_settings
add column if not exists card_badge_columns jsonb not null default '{"overview":"default","edit":"default","kanban":"default"}'::jsonb;

alter table public.user_settings
alter column card_badge_columns set default '{"overview":"default","edit":"default","kanban":"default"}'::jsonb;

alter table public.user_settings
add column if not exists default_view_mode text not null default 'kanban';

alter table public.user_settings
alter column default_view_mode set default 'kanban';

alter table public.user_settings
add column if not exists default_view_mode_mobile text not null default 'kanban';

-- 'active' is the only valid value since the Upcoming tab was removed; kept as a column for compatibility.
alter table public.user_settings
add column if not exists default_start_tab text not null default 'active';

alter table public.user_settings
add column if not exists default_start_tab_mobile text not null default 'active';

alter table public.user_settings
add column if not exists kanban_columns jsonb not null default '["open","started","done"]'::jsonb;

alter table public.user_settings
add column if not exists upcoming_badge_defaults jsonb not null default '{"version":2,"browser":false,"mobile":false,"dependenciesBrowser":false,"dependenciesMobile":false}'::jsonb;
```
Supabase stores the soft-delete date in `tasks.deleted_at`. Apply the schema update before relying on online persistence of the `Deleted` tab:

```sql
alter table public.tasks
add column if not exists deleted_at date;
```

Google access is managed through `allowed_users`. The admin account `miro@pixelina.me` can add or remove allowed Google users in the app under `...` -> `Users`. Every allowed user has a separate task list and separate synced settings because tasks and user settings are scoped by Supabase `user_id`. Apply the schema update before using app-managed user access:

```sql
create table if not exists public.allowed_users (
  email text primary key,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.allowed_users enable row level security;

insert into public.allowed_users (email)
values ('miro@pixelina.me')
on conflict (email) do nothing;

drop policy if exists "Allow users to read own access row and admin all access rows" on public.allowed_users;

create policy "Allow users to read own access row and admin all access rows"
on public.allowed_users
for select
to authenticated
using (
  lower(email) = lower(auth.jwt() ->> 'email')
  or lower(auth.jwt() ->> 'email') = 'miro@pixelina.me'
);

drop policy if exists "Allow admin to insert access rows" on public.allowed_users;

create policy "Allow admin to insert access rows"
on public.allowed_users
for insert
to authenticated
with check (lower(auth.jwt() ->> 'email') = 'miro@pixelina.me');

drop policy if exists "Allow admin to update access rows" on public.allowed_users;

create policy "Allow admin to update access rows"
on public.allowed_users
for update
to authenticated
using (lower(auth.jwt() ->> 'email') = 'miro@pixelina.me')
with check (lower(auth.jwt() ->> 'email') = 'miro@pixelina.me');

drop policy if exists "Allow admin to delete access rows" on public.allowed_users;

create policy "Allow admin to delete access rows"
on public.allowed_users
for delete
to authenticated
using (
  lower(auth.jwt() ->> 'email') = 'miro@pixelina.me'
  and lower(email) <> 'miro@pixelina.me'
);
```

For stronger auth gating, `docs/supabase-schema.sql` also creates `public.hook_before_user_created` and `public.hook_custom_access_token`. After running the SQL, enable both Postgres functions in Supabase under `Authentication` -> `Hooks`. Detailed steps are in `docs/auth-hook-setup.md`.

The app also keeps a local browser backup of the current task list and preserves local subtasks when remote data has none, so schema gaps do not silently replace existing local subtask content. On login, local-only tasks (created while Supabase was unreachable/misconfigured) are merged into the synced list rather than dropped. Synced settings (dark mode, tab layout, tags, ...) only pull down from Supabase when the remote value actually differs from its own default; a still-default remote value defers to whatever is set locally instead of silently overwriting it, so this behaves correctly both when recovering from a broken sync and when opening the app on a new device that should pick up already-synced settings.

A task cannot be marked as done while it still has open predecessors or open subtasks. This applies both to the completion icon and to the header filter's `Status` dropdown. Complete predecessor tasks and subtasks first, then mark the task as done.

The header filter popup can filter the visible task list by column, including ID, Prio, Tag, task text, description, subtasks, predecessors, successors, status, start date, due date, done date, and deleted date where those fields are visible. The `Status` filter remains an editable dropdown for `All`, `Backlog`, and `Doing`; `Done` and `Deleted` are reached through their own top-level tabs or the scoped `...` menu views. Choosing status or due filters activates the matching visible tabs where such tabs exist. The `ID` filter combines free text input with a dropdown of existing task IDs, so tasks can be narrowed directly by codes like `T-016`.
The info line below the tabs always shows the current working selection: view, scope, list/Kanban mode, and search state. The filter icon shows a small count when filters, sorts, or the scoped `Done`/`Deleted` views are active, and its hover tooltip lists the active filters/sorts. The neutral active-task view is shown as `All active`, so tag tabs remain consistent as a scope such as `#ETH`. Active non-default filters and sorts are shown there as small muted chips so the current view remains understandable without reopening the filter popup. `Done` and `Deleted` appear there as `View` filters and `Reset filters` returns to `All active` in the current scope. This row is hidden in single-task edit mode.
Column filters include a sort icon next to the filter field. Clicking it cycles
through standard, ascending, and descending sort. Multiple active sort controls
are combined in the filter popup's field order.
The browser overview always shows the same compact task cards used on phones; browser compact cards keep their compact width, and longer task names are edited in the wider edit title field. There is no classic wide-table alternative or setting to switch back to it. This only affects the overview display; browser task capture keeps the full desktop form.
Browser and phone now each open on the `All` tab on every fresh start. Task capture is opened with the plus icon. Tab selection, tag scope, search text, filters, and column sorts stay in memory only for the current app session; return/navigation flows can still use that in-session state, but closing and reopening the app starts from the configured option defaults. Task cards default to Minimum detail mode, where badges and the `Additional details` label stay hidden. Maximum detail mode shows the badge grid, and tasks with description, subtasks, or comments show that content directly below the badges, with no `Additional details` label to open.
While editing tasks in the browser, short controls such as dropdowns and date fields stay narrow; the task title, description, subtasks, and comments share the same controlled editing width so the card background does not stretch wider than the fields. In the browser parameter editor, Tag and Status form one row, followed by Start date and Due on the next row. Small dropdowns do not show a redundant close X; single-choice dropdowns such as Tag close after selection, while multi-select dependency dropdowns stay open for additional selections and close on outside click/Escape/trigger. On phones, the same order is kept but each parameter uses its own row. Comment and subtask text inputs use the same full editor width and text size as the description field, with content-based height.
Status values are `Backlog`, `Doing`, `Done`, and `Deleted`; `Backlog` and `Doing` are reached through the header filter's `Status` dropdown, `Done` has its own top-level tab next to `All` (and is also available from the `...` options menu), while `Deleted` is opened from the `...` options menu. `Deleted` is also available in the status dropdown: choosing it sets the soft-delete date, while choosing `Backlog`, `Doing`, or `Done` from a deleted task restores it into that status. When a task is marked done, the app stores the done date automatically and stays in the previous view instead of jumping to `Done`. Done tasks are shown in the `Done` menu view with the `Done on` column; compact cards show `done on [date]`. The `Done` view sorts by newest done date first by default, and the column still supports text filtering and manual ascending/descending sorting.
Subtask start and due dates also feed the reminder popup and visible due-today hints while the parent task and the subtask are still open. Subtask hints include the subtask number, for example `Subtask 2: due today`, and clicking a reminder still jumps to the parent task.
The quick filter popup was removed. Pending clarification, start, due-today, and overdue work is instead marked directly on tasks with the red `!` reminder marker and the red due-date coloring described below.
Task cards show reached start dates, due-today dates, and overdue due dates directly by coloring the date value red instead of adding separate due badges. The tooltips add `Start reached` on start dates and `due today` or `overdue` on due dates. Doing tasks still show due and overdue reminders until they are done. While editing an upcoming task, the compact card shows a red `!` icon immediately before the disk icon, with a touch-safe tooltip (hover on browser, tap/focus on phone) listing every reason why the task is upcoming.

Tags are managed separately in the `...` options menu under `Tags`. They remain available even when no current task uses them, until they are deleted there. The catalog is limited to 10 tags and the dialog shows the current count, for example `3 of 10`. Deleting a tag removes it from task assignments and from selected tag tabs. Existing tags can be renamed with the pencil icon and saved with the disk icon; renaming updates task assignments, selected tag tabs, drafts, and the active scope.

Tasks can have one tag from this managed tag catalog. Tags are stored on the task and can replace older category-like uses such as `Private`. A tag can be assigned while capturing and editing tasks on both phone and browser through a compact selection popup. Selecting another tag replaces the previous one; `No tag` removes it. If a task has no tag, the tag field shows `-`; clicking it opens the same popup.

When a tag is assigned to a task, the matching tag tab is activated automatically. Existing catalog tags can also be selected or deselected in the `...` options menu under `Tags` as `Tag-Tabs`; each selected tag creates its own top tab while selected. Tag tabs can be reordered by drag-and-drop directly in the top tab bar or inside the tags dialog. The tag catalog, selected tag tabs, and their order are stored in Supabase user settings, so the same setup applies on phone and browser after login.

The task overview includes a session-only free-text search above the task list on browser and phone; the same search field remains visible while capturing a new task. It searches across task ID, title, description, comments, subtasks, tags, priority, status, dependencies, start date, and due date. While text is entered, the search ignores the active tab, tag scope, and column filters so it can find every active task; `Done` searches done tasks only, and `Deleted` searches deleted tasks only. During an active search, scope and status tabs remain visible but none is highlighted as active. Multiple words may match across different fields.

The overview uses two configurable tab rows. The default layout is row 1 `All`, `Done`, and `Deleted`, and row 2 active tag tabs. `Done` and `Deleted` are top-level tabs in both List and Kanban view; selecting either always switches to List view (`Done` needs its dedicated `Done on` column and newest-first sorting, even though Kanban also has its own optional `Done` board column; `Deleted` has no Kanban column at all). Leaving `Done` or `Deleted` back to `All`, either by clicking the same tab again or the `task-001` title, restores Kanban view if that is the persistent default for the current device. Any visible tab can be moved across these two rows by drag-and-drop; drag-and-drop surfaces show an open-hand cursor on hover and a closed-hand cursor while dragging. On phones, each tab row shows at most 3 equal-width tabs; a row with more than 3 tabs wraps into additional rows of 3, and a row with fewer than 3 keeps the same tab width rather than stretching to fill the row. In the browser, every tab across both rows shares the same fixed width regardless of label length; a longer tag name truncates with an ellipsis instead of making that tab wider than the others. The custom layout is stored locally and in `user_settings.tab_layout` when the Supabase column exists. `All` has an explanatory tooltip. Tag tabs do not get extra explanatory tooltips. `Backlog` and `Doing` are no longer top-level tabs; reach them through the header filter's `Status` dropdown. `Newest` (sorting active, not-done tasks by newest effective creation timestamp) has been removed along with its tab and is no longer reachable in the UI. Normal task views use the standard task order: `Prio` (`prioritize`, `P1`, `P2`, `P3`), then due date, then task title. The Kanban/List options default to `Kanban` separately for browser and phone, persist locally, and sync through `user_settings.default_view_mode` and `user_settings.default_view_mode_mobile` when available; the header toggle switches only the current session view and does not change the persistent default. Browser and phone always start on the `All` tab. The Kanban toggle keeps the current task scope/search/filter context, groups the visible cards into the active Kanban columns `Backlog`, `Doing`, and `Done`, and sorts each column with that same default task order. The `Done` Kanban column is the only place besides the `Done` tab where done tasks are visible from the `All` tab and tag scopes; List view keeps hiding done tasks there. The visible Kanban columns can be switched on or off persistently in the `...` options menu. On browser, cards can be dragged between Kanban columns to change status directly: dropping a card on `Backlog`, `Doing`, or `Done` sets the task's status to `Offen`, `Gestartet`, or `Erledigt` and re-applies the usual rules for that change (start date auto-fills when a task first becomes `Doing`, and completion is blocked with the normal message if open predecessors or subtasks remain). The current tab/scope/filter view does not change during a Kanban drag, unlike the header filter's `Status` dropdown. Dragging is desktop-only; phone Kanban keeps its existing tap-to-edit and horizontal-swipe behavior. Browser Kanban cards use their own configurable badge-column count, defaulting to 3, and the same badge styling as compact list cards. The Kanban board keeps non-squeezable badge tracks but uses slimmer flexible column tracks on browser, so four default columns fit better on high-resolution screens before horizontal scrolling is needed. Kanban-specific headings and empty states use the same compact card font sizing, while tab font sizes remain unchanged. Kanban badges use the same fixed 145px cell width as list badges, stay on one line, and shorten visually instead of wrapping; task IDs and the red upcoming marker also stay uncompressed. Within task cards, view and edit mode use one shared font family and text size; existing bold weights remain bold. On phones the board is presented as a landscape-style horizontal board with horizontal scrolling; edge fades and chevrons near the top of the cards indicate when more columns are available to the left or right, the board snaps to each column while scrolling, and each Kanban column/card uses the same width and fixed 3-column badge layout as the mobile list/edit cards. `Done` and `Deleted` (via their own top-level tab) apply to the active scope, so `#Private` plus `Done` shows matching private done tasks while `All` plus `Done` shows matching done tasks across all tags. Capture is opened from the header plus icon instead of a tab.

Deleting a task asks for confirmation first using the same inline confirmation component and visual style as task completion (`Delete? Yes No` / `Complete? Yes No`), then moves it to `Deleted` instead of removing it immediately. The app stays in the previous view instead of jumping to `Deleted`, and resets that view's filters so the remaining tasks stay visible. Deleted tasks are hidden from active status views, dependency selectors, reminders, and completion workflows. In the scoped `Deleted` view, they show the `Deleted on` date, can still be edited while retained, and can be restored. After 30 days, deleted tasks are permanently removed during the next save/load cycle.

Browser compact cards and Kanban columns keep fixed calculated widths on desktop. Browser card width is derived from the exact badge-grid width plus card padding/border and a small safety reserve, and does not grow or shrink while resizing the desktop window, so badges remain inside the card when horizontal scrolling appears. Browser edit cards additionally keep a content-based minimum width for the parameter section, title/header, text editors, and colored dividers so edit controls never protrude beyond the card background without forcing unnecessarily wide cards when only a few badge columns are active. Kanban columns use fixed tracks rather than flexible `1fr` tracks, and the board can be scrolled horizontally with the scrollbar or by dragging the board with the mouse. Touch/phone layouts keep the responsive 100% card width. If the browser window becomes too narrow, the card list or Kanban board scrolls horizontally instead of squeezing cards, badges, or right-side icons past the card edge. Kanban is an overview only: clicking a task opens the normal single-task edit card outside the board, and closing/completing/deleting returns to the previous Kanban view.
The visible horizontal Kanban scrollbar sits above the Kanban columns directly below search. The lower board scrollbar is hidden visually, but the board still supports horizontal wheel/touch scrolling. Mouse-drag scrolling and the open/closed hand cursor are enabled only while the board actually has horizontal overflow.
Resizing the browser window across desktop/mobile breakpoints keeps the current List/Kanban choice for the session and does not reapply the persistent default view.
Dependencies are shown as `Blockiert durch` / `Blockiert` in relation popups and icon tooltips. Dependency cycles are rejected when tasks are captured or edited.
Top-level tabs show compact counters for `All`, `Done`, `Deleted`, and selected tag tabs. `All` and tag tabs count only active tasks in `Backlog` and `Doing`; `Done` and `Deleted` show their own scoped totals directly on the tab. Normal task views are already sorted by `Prio`, then due date, then task title unless a column sort is active. The Kanban view uses the same card renderer, groups visible tasks into active columns `Backlog`, `Doing`, and `Done`, uses its own browser-only configurable badge-column count with default 3, keeps the same badge styling as compact list cards, uses flexible browser column tracks with a non-squeezing minimum, shows mobile edge fades/chevrons when additional columns are off-screen, snaps horizontally by column on phones, and sorts each Kanban column by the default task order.

After creating a task, the app returns to `All` immediately, in Kanban view if that is the persistent default view for the current device (browser or phone) and List view otherwise, showing `Task T-123 created` as a plain-text confirmation — the task code is not a link. Only the task name is required and explicitly marked as `required`; the criteria dropdowns remain optional and start visibly unset on every new capture because the app can derive `Prio` from missing or placeholder values. Other task links jump to the scope and view where the task is visible; for tagged tasks with an active tag tab, that means the matching tag scope plus the task's current view, while done and deleted tasks open the scoped `Done` or `Deleted` view. Pure save while staying in edit mode keeps the edited task visible even if a non-completion status change would otherwise remove it from the active filter. Completing a task closes edit mode and returns to the previous view; deleting keeps the previous view, while editing, restoring, and direct task links may still navigate to the matching visible view.

Text fields use lightweight input guidance. Task names wrap in capture/edit fields, use a wider controlled field while capturing and editing, are not manually resizable, warn at 80 characters, warn stronger at 125, and stop at 250. Other multiline text fields scroll internally when needed, but none of them show a manual resize handle. Subtasks warn at 250 and stop at 1000. Comments warn at 500 and stop only at the high technical limit of 5000. Descriptions have no early warning and use a high technical limit of 20000. Tags stop at 24 characters.

In browser and phone edit mode, changed drafts stay in the edit draft until the header disk icon is pressed. The disk icon is grey and disabled without changes, and highlighted/clickable when there are unsaved changes, including local description/comment/subtask drafts. Clicking or touching outside the active task edit surface does not close the task and does not open a prompt. The edit view is always a single-task view: no table, list, Kanban board, tabs, or filter chips are shown around the active task, even when the browser tab resumes after a pause. Description edits happen inline in the Description section with the same local disk and `X` pattern as comments and subtasks. Clicking outside does not close local text editors; the local `X` asks in the familiar Save changes? dialog whether to save or discard that local draft only. Leaving an editor or edit mode with unsaved changes opens an `Save changes?` dialog with only `Discard` and `Save`. Discarding a freshly typed unsaved comment does not create it. In mobile editing, save, delete, completion, and close are available as same-size right-aligned header icons: disk, trash, check, and x. Completing and deleting tasks keep their explicit inline confirmations; in edit mode these prompts open directly below the header icons.
Description editors grow from one line up to ten lines and then scroll internally; new subtask and new comment editors grow up to four lines, while existing subtask and comment editors grow with their content up to six lines and then scroll internally.
All task-card action icons use the same shared icon button style for size, border, background, and neutral colors.
Task edit mode is divided into four clearly separated, individually collapsible sections: `Parameter`, `Description`, `Subtasks`, and `Comments`. While `Parameter` is collapsed, it keeps showing the same compact overview values. Tapping a value opens only its tooltip; tapping the `Parameter` label or arrow expands the editable controls. Empty description, comment, and subtask areas show their prompt directly inside the field: `Write a new description`, `Write a new comment`, or `Write a new subtask`. Description, subtasks, and comments are edited inline with the same local save/discard pattern. No separate empty-state text is rendered below the fields. In the `...` options menu, each section can independently default to `Expanded` or `Collapsed` separately for browser and phone; all sections default to expanded on both devices. Card detail mode controls overview cards separately: `Minimum` hides parameter badges, card content, and the `Additional details` label; `Maximum` shows the parameter badges by default. In Maximum mode, cards with a description, subtasks, or comments show their labeled panels (`Dependencies`, `Description`, `Subtasks`, `Comments`) directly below the badges, with no `Additional details` label or toggle. In Minimum mode, locally opening a card via its task ID still shows a collapsible `Additional details` label (which also includes a `Parameter` panel, since badges aren't otherwise visible there); opening details on another task closes the previously opened one, and clicking the same label toggles that task open/closed. The header task-detail icon switches the current view immediately between Minimum and Maximum, while Options define only the default for fresh sessions. Compact browser cards and phone editing use section headings, spacing, and colored divider lines. In the options menu, browser card badge columns can be set separately for overview cards, edit cards, and Kanban cards as `Default (3)` or any value from 1 to 8; the Kanban setting applies only to browser view. Phone list, edit, and Kanban cards keep the mobile card width and fixed 3-column mobile badge layout. Card rows are padded with empty `-` slots so the final row stays full and cards keep a consistent grid width.

In Dark Mode, dialogs, dropdowns, picker popups, parameter controls including Tag and predecessor/successor selectors, the mobile Prio row, and the derived Prio display while capturing a new task on browser or phone use dark surfaces with light text. `Prio` badges use the same semantic colors in browser and phone views, regardless of Normal or Dark Mode.
Dropdown controls and their headings use the same inherited font and 13px bold size across browser and phone. The `...` Options menu uses the same consistent styling throughout: one heading style for all section titles, and one label size/weight for every setting and checkbox, matching the size already used by the dropdown controls next to them.

In browser and phone capture/edit mode, editable values and derived values expose tooltips with the current selection and a short explanation while `Show tooltips` is enabled in the `...` options menu. The derived `Prio` tooltip includes its selected criteria.
In mobile edit mode, the task number and same-size header action icons sit in one row. The task title input is directly underneath, giving the icons enough touch space without squeezing the title.
Compact task cards keep their task title visible in browser compact mode and their short meta values in aligned cells so `Prio`, status, and dates stay aligned across cards; phones always show three meta cells per row and wrap badge text instead of letting it overflow horizontally. Cards render the compact values in this order: `Prio`, tag, status, start date, and due date; done/deleted date appears only when the task is done or deleted. Compact values show the label before the colon only while the value is empty; `Start:` and `Due:` always keep their labels. The label before the colon stays neutral, followed by a small gap; only the value uses the semantic badge color. Prio values keep visible backgrounds: `prioritize` yellow, `P1` red, `P2` dark yellow, `P3` green. Real empty values show `-`; row-padding slots stay invisible and borderless while still reserving their grid cells so every compact card fills complete badge rows for the selected browser column count. On phones the count stays fixed at 3. In browser compact mode badge cells use a fixed width, and each card width follows the selected browser column count while staying independent of long task titles. Long cell values are shortened visually and remain available through the card tooltip behavior. Overview card tooltips for `Prio` also state that `Prio`/priority answers `How important?`.

Reached start dates, due-today work, and overdue work are marked directly on tasks through the red date coloring and the red `!` reminder marker described above. Date checks tolerate stored date-only values and ISO timestamp values, so Supabase date formats and local date inputs are treated consistently. Selecting a task or subtask reminder opens the parent task in the Maximum detail view with details expanded; use the pencil icon to edit it.

The `...` menu can export a metadata-rich backup JSON in addition to plain JSON and CSV. `Import` can import that backup format, older JSON task arrays, or CSV files after confirmation.

## Planned Features

- Zielarchitektur fuer langfristige Plattformunabhaengigkeit: gemeinsames Web-Frontend als Kern der App, lokale Storage-Schicht fuer Offline-first Nutzung, optionale Sync-Schicht spaeter z.B. ueber Google Drive, Android/iOS via Capacitor und Desktop via Tauri. Daten sollen lokal zuerst liegen, Sync nur ergaenzend arbeiten; fuer produktive Nutzung kein eigenes Backend und moeglichst keine Hosting-Abhaengigkeit voraussetzen.
- Zielprozess fuer Entwicklung und Release nach der lokalen Zielarchitektur: Development, Test/Preview und Production als getrennte App-Kanaele behandeln, nicht nur als unterschiedliche URLs. Jede Umgebung braucht eigene App-/Bundle-Identifier, eigene lokale Storage-Namen bzw. Datenverzeichnisse und eigene optionale Sync-Ziele, damit Testversionen nie produktive Daten oeffnen. Entwicklung laeuft auf Feature-Branches mit lokalen Testdaten; nach Merge nach main entstehen Preview/Test-Builds mit separaten Testdaten; stabile Versionen werden per Versionstag, Changelog und Release-Builds fuer Web, Android/iOS und Desktop veroeffentlicht. Produktivdaten duerfen nur mit getesteten Release-Builds geoeffnet werden; Datenmodell-Aenderungen brauchen Migration, Backup und moeglichst Rueckfallstrategie.
- Email to Task: allow emails sent to a dedicated address to become tasks in the app automatically. Preferred direction is provider-neutral inbound email, e.g. Cloudflare Email Routing/Email Worker plus Supabase insert, not a Gmail-only integration.
- Optional mobile/web push notifications: notify explicitly opted-in devices about tasks that start today, are due today, or are overdue. Keep the in-app reminder popup as fallback. Likely direction is Web Push with per-device subscriptions in Supabase, VAPID keys, scheduled checks, duplicate-notification prevention, and special care for iOS because iPhones require the app to be added to the Home Screen for web push.
- Optional REST API: future idea for creating, reading, updating, or linking tasks from external tools. If pursued, it should be authenticated, respect the separate per-user task lists, avoid exposing Supabase anon access directly as an integration contract, and start with a small protected endpoint surface such as task lookup by `task-id`, task creation, and status/date updates.
- Alternative multi-user authentication with two-factor protection: investigate replacing or supplementing Google login with Supabase email/password or magic-link login plus TOTP MFA through authenticator apps. Keep the existing `allowed_users` whitelist, miro as admin, and separate per-user task lists/settings through `user_id`. Avoid SMS-based 2FA because it is usually not reliably free.

## Development

Install dependencies and start the local dev server:

```powershell
npm install
npm run dev
```

The local dev server usually runs on:

```text
http://127.0.0.1:5180/
```

If Vite chooses another port, use the URL printed in the terminal.

Useful checks:

```powershell
npm run lint
npm run build
```

Implementation note: the overview prepares reusable task filter/search caches, shares the same mobile-card prop builder for list and Kanban cards, debounces remote user-settings sync, and uses `--task-card-*` CSS variables for card typography/badge sizing. These are refactoring-only optimizations and can be reverted as one commit if needed.

## Environment Variables

Create a local `.env` file. Do not commit it.

```text
VITE_SUPABASE_URL=https://izvmyvpxbmitajgopgar.supabase.co
VITE_SUPABASE_ANON_KEY=<supabase anon public key>
```

The same variables must be configured in Vercel for Production and Preview.

## Supabase

The database schema is documented in:

```text
docs/supabase-schema.sql
```

Run that SQL in the Supabase SQL Editor when setting up a fresh project.

Recent schema requirements include `tasks.tags` for task tag assignments, `user_settings.available_tags` for the synced tag catalog, `user_settings.selected_tag_tabs` for synced tag-tab settings, `user_settings.tab_layout` for the synced three-row tab arrangement, `user_settings.card_badge_columns` for list/edit/browser-Kanban badge-column counts, `user_settings.default_view_mode` for the synced list/Kanban default, `user_settings.kanban_columns` for synced Kanban column visibility, `user_settings.edit_section_defaults` for separate browser/phone edit-section defaults, and `allowed_users` for app-managed Google access.

The app expects Google Auth to be enabled in Supabase:

```text
Authentication -> Providers -> Google
```

Supabase URL configuration should include:

```text
Site URL: https://task-001.pixelina.me
Redirect URL: https://task-001.pixelina.me
```

For local testing, also allow:

```text
http://127.0.0.1:5180
http://localhost:5180
```

## Google OAuth

Google Cloud OAuth client:

- Application type: Web application
- Authorized JavaScript origins:
  - `http://127.0.0.1:5180`
  - `http://localhost:5180`
  - `https://task-001.pixelina.me`
- Authorized redirect URI:
  - `https://izvmyvpxbmitajgopgar.supabase.co/auth/v1/callback`

## Vercel

Project:

```text
task-dispatcher
```

Recommended settings:

```text
Framework preset: Vite
Build command: npm run build
Output directory: dist
```

Vercel deploys automatically when `main` is pushed to GitHub.
The repository includes `vercel.json` with `Cache-Control: no-store` so the task app should not keep serving old UI builds after a deployment.

## Working Across Computers

Start of a session:

```powershell
cd C:\Dev\task-001
git pull
git status
```

End of a session:

```powershell
git status
git add -A
git commit -m "WIP: current state"
git push
```

- Task card badges use the fixed order `Prio`, `Tag`, `Status`, `Created`, `Start`, `Due`; non-applicable badge slots use invisible placeholders so card layouts stay stable.
- Confirmation dialogs, completion-block messages, tag placeholders, and Supabase error messages must use English UI text (`Yes`/`No`, not German labels).
- In browser task edit mode, Tag and Status form the first compact parameter row; Start date and Due sit directly below.
- Tag, Predecessor, and Successor dropdown menus use separated row-style choices with wrapping text, hover states, and dark-mode styling so long task labels stay readable.
- In browser task edit mode, Predecessors and Successors sit together as compact half-width fields below the main parameter rows; their dropdown menus use extra width for readable task labels.
- Browser edit-mode Predecessor and Successor dropdown choices override the compact parameter-label width so each row uses the full dropdown width.
- In Minimum detail mode, compact cards hide parameter badges, card content, and the `Additional details` label by default in List and Kanban. Maximum detail mode shows the badges, and tasks with a description, subtasks, or comments show that content directly, with no `Additional details` label.
