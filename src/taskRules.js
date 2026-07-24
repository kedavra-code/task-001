import { normalizeDateValue, normalizeSubtasks } from "./subtasks.js";
export { normalizeDateValue, normalizeSubtask, normalizeSubtasks, normalizeText } from "./subtasks.js";

export const CRITERIA_PLACEHOLDER = "...";

export function getDateDayTime(value) {
  const normalized = normalizeDateValue(value);
  return normalized ? new Date(`${normalized}T00:00:00`).getTime() : null;
}

export function isDone(task) {
  return task?.googleStatus === "Erledigt";
}

export function isStarted(task) {
  return task?.googleStatus === "Gestartet";
}

export function isDeleted(task) {
  return Boolean(normalizeDateValue(task?.deletedAt));
}

export function hasOpenSubtasks(task) {
  return normalizeSubtasks(task?.subtasks).some(subtask => !subtask.done);
}

export function getSubtaskCompletionBlockMessage(task) {
  return hasOpenSubtasks(task) ? "Task can only be completed after all subtasks are done." : "";
}

export function isOverdue(task, todayTime = getTodayDayTime()) {
  if (isDeleted(task) || isDone(task)) return false;
  const dueTime = getDateDayTime(task?.faellig);
  return dueTime !== null && dueTime < todayTime;
}

export function isDueToday(task, todayTime = getTodayDayTime()) {
  if (isDeleted(task) || isDone(task)) return false;
  const dueTime = getDateDayTime(task?.faellig);
  return dueTime !== null && dueTime === todayTime;
}

export function isStartDateReached(task, todayTime = getTodayDayTime()) {
  if (isDeleted(task) || isDone(task)) return false;
  const startTime = getDateDayTime(task?.startdatum);
  return startTime !== null && startTime <= todayTime;
}

export function isStartPending(task, todayTime = getTodayDayTime()) {
  return isStartDateReached(task, todayTime) && !isStarted(task);
}

export function getTodayDayTime() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime();
}

export function getDueReminderStatus(task, todayTime = getTodayDayTime()) {
  if (isDone(task)) return [];
  return [
    isStartPending(task, todayTime) ? "Start reached" : "",
    isOverdue(task, todayTime) ? "overdue" : "",
    isDueToday(task, todayTime) ? "due today" : ""
  ].filter(Boolean);
}

export function shouldShowDueReminder(task, todayTime = getTodayDayTime()) {
  if (isDeleted(task)) return false;
  return getDueReminderStatus(task, todayTime).length > 0;
}
