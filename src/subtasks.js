const MAX_SUBTASK_TEXT_LENGTH = 1000;

export function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeDateValue(value) {
  const text = normalizeText(value);
  if (!text) return "";

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const swissMatch = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (swissMatch) {
    const [, day, month, year] = swissMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeSubtask(value) {
  if (value && typeof value === "object") {
    const text = normalizeText(value.text ?? value.title ?? value.value ?? "").slice(0, MAX_SUBTASK_TEXT_LENGTH);
    if (!text) return null;
    return {
      text,
      done: Boolean(value.done ?? value.is_done),
      startdatum: normalizeDateValue(value.startdatum),
      faellig: normalizeDateValue(value.faellig)
    };
  }

  const rawText = normalizeText(value);
  if (!rawText) return null;
  const doneMatch = rawText.match(/^\[(x|done|erledigt)\]\s+(.+)$/i);
  const openMatch = rawText.match(/^\[\s\]\s+(.+)$/);

  if (doneMatch) return normalizeSubtaskTextPayload(doneMatch[2], true);
  if (openMatch) return normalizeSubtaskTextPayload(openMatch[1], false);
  return normalizeSubtaskTextPayload(rawText, false);
}

export function normalizeSubtasks(values) {
  const list = Array.isArray(values) ? values : String(values || "").split("|");
  return list.map(normalizeSubtask).filter(Boolean);
}

export function getSubtaskDedupeKey(subtask) {
  const normalizedSubtask = normalizeSubtask(subtask);
  if (!normalizedSubtask) return "";
  return [
    normalizedSubtask.text.toLocaleLowerCase(),
    normalizedSubtask.done ? "done" : "open",
    normalizedSubtask.startdatum || "",
    normalizedSubtask.faellig || ""
  ].join("\u001f");
}

export function dedupeSubtasks(subtasks) {
  const seenKeys = new Set();
  return subtasks.filter(subtask => {
    const key = getSubtaskDedupeKey(subtask);
    if (!key) return false;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });
}

export function normalizeSubtaskTextPayload(value, done) {
  const text = normalizeText(value);
  if (!text) return null;

  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text);
      const parsedText = normalizeText(parsed.text ?? parsed.title ?? parsed.value ?? "").slice(0, MAX_SUBTASK_TEXT_LENGTH);
      if (!parsedText) return null;
      return {
        text: parsedText,
        done,
        startdatum: normalizeDateValue(parsed.startdatum),
        faellig: normalizeDateValue(parsed.faellig)
      };
    } catch {
      // Legacy plain text is still valid even if it starts with a brace.
    }
  }

  return { text: text.slice(0, MAX_SUBTASK_TEXT_LENGTH), done, startdatum: "", faellig: "" };
}

export function formatSubtaskForText(subtask) {
  const normalizedSubtask = normalizeSubtask(subtask);
  if (!normalizedSubtask) return "";
  const hasDates = Boolean(normalizedSubtask.startdatum || normalizedSubtask.faellig);
  const payload = hasDates
    ? JSON.stringify({
        text: normalizedSubtask.text,
        startdatum: normalizedSubtask.startdatum || "",
        faellig: normalizedSubtask.faellig || ""
      })
    : normalizedSubtask.text;
  return `${normalizedSubtask.done ? "[x]" : "[ ]"} ${payload}`;
}

export function getStableSubtaskId(taskId, position, userId = "") {
  const input = `${userId}:${taskId}:${position}`;
  let first = 0x811c9dc5;
  let second = 0x01000193;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x811c9dc5);
  }

  const hex = [
    first >>> 0,
    second >>> 0,
    Math.imul(first ^ second, 0x85ebca6b) >>> 0,
    Math.imul(second ^ first, 0xc2b2ae35) >>> 0
  ].map(value => value.toString(16).padStart(8, "0")).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0")}${hex.slice(18, 20)}-${hex.slice(20, 32)}`;
}

export function subtaskRowToSubtask(row) {
  return normalizeSubtask({
    text: row?.title,
    done: row?.is_done,
    startdatum: row?.startdatum || "",
    faellig: row?.faellig || ""
  });
}

export function taskSubtasksToRows(task, userId) {
  return normalizeSubtasks(task?.subtasks).map((subtask, index) => ({
    id: getStableSubtaskId(task.id, index, userId),
    task_id: task.id,
    user_id: userId,
    position: index,
    title: subtask.text,
    is_done: subtask.done,
    startdatum: subtask.startdatum || null,
    faellig: subtask.faellig || null
  }));
}

export function applyNormalizedSubtaskRows(tasks, subtaskRows) {
  if (!Array.isArray(subtaskRows)) return tasks;

  const rowsByTaskAndPosition = new Map();
  subtaskRows.forEach(row => {
    const position = Number(row.position ?? 0);
    const key = `${row.task_id}:${position}`;
    const current = rowsByTaskAndPosition.get(key);
    const stableId = getStableSubtaskId(row.task_id, position, row.user_id || "");
    const rowIsStable = row.id === stableId;
    const currentIsStable = current?.id === stableId;
    const rowUpdatedAt = new Date(row.updated_at || 0).getTime();
    const currentUpdatedAt = new Date(current?.updated_at || 0).getTime();

    if (!current || (rowIsStable && !currentIsStable) || (rowIsStable === currentIsStable && rowUpdatedAt >= currentUpdatedAt)) {
      rowsByTaskAndPosition.set(key, { ...row, position });
    }
  });

  const subtaskRowsByTaskId = new Map();
  Array.from(rowsByTaskAndPosition.values())
    .slice()
    .sort((first, second) => (first.position ?? 0) - (second.position ?? 0))
    .forEach(row => {
      const subtask = subtaskRowToSubtask(row);
      if (!subtask) return;
      const current = subtaskRowsByTaskId.get(row.task_id) || [];
      subtaskRowsByTaskId.set(row.task_id, [...current, subtask]);
    });

  return tasks.map(task => {
    const normalizedSubtasks = subtaskRowsByTaskId.get(task.id);
    return normalizedSubtasks ? { ...task, subtasks: normalizedSubtasks } : task;
  });
}
