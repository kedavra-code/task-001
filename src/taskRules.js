import { normalizeDateValue, normalizeSubtasks } from "./subtasks.js";
export { normalizeDateValue, normalizeSubtask, normalizeSubtasks, normalizeText } from "./subtasks.js";

export const CRITERIA_PLACEHOLDER = "...";

export function getDateDayTime(value) {
  const normalized = normalizeDateValue(value);
  return normalized ? new Date(`${normalized}T00:00:00`).getTime() : null;
}

export function normalizeTaskId(value) {
  return typeof value === "string" ? value : "";
}

export function normalizeTaskIds(values) {
  const list = Array.isArray(values) ? values : values ? [values] : [];
  return Array.from(new Set(list.map(normalizeTaskId).filter(Boolean)));
}

export function getPredecessorIds(task) {
  return normalizeTaskIds(task?.dependsOnTaskIds?.length ? task.dependsOnTaskIds : task?.dependsOnTaskId);
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

export function getOpenPredecessorTasks(task, tasksById) {
  return getPredecessorIds(task)
    .map(taskId => tasksById.get(taskId))
    .filter(predecessor => predecessor && !isDone(predecessor) && !isDeleted(predecessor));
}

export function getPredecessorCompletionBlockMessage(task, tasksById) {
  const openPredecessors = getOpenPredecessorTasks(task, tasksById);
  if (openPredecessors.length === 0) return "";

  const predecessorCodes = openPredecessors.map(predecessor => predecessor.taskCode).filter(Boolean).join(", ");
  return `Task can only be completed after these predecessors are done: ${predecessorCodes}`;
}

export function findDependencyCycle(tasks) {
  const tasksById = new Map(tasks.map(task => [task.id, task]));
  const visiting = new Set();
  const visited = new Set();

  function visit(taskId, path) {
    if (visiting.has(taskId)) {
      const cycleStart = path.indexOf(taskId);
      return path.slice(cycleStart).concat(taskId);
    }
    if (visited.has(taskId)) return null;

    visiting.add(taskId);
    const task = tasksById.get(taskId);
    const predecessorIds = getPredecessorIds(task).filter(predecessorId => tasksById.has(predecessorId));
    for (const predecessorId of predecessorIds) {
      const cycle = visit(predecessorId, [...path, taskId]);
      if (cycle) return cycle;
    }
    visiting.delete(taskId);
    visited.add(taskId);
    return null;
  }

  for (const task of tasks) {
    const cycle = visit(task.id, []);
    if (cycle) return cycle;
  }
  return [];
}

export function getDependencyCycleMessage(tasks) {
  const cycleIds = findDependencyCycle(tasks);
  if (cycleIds.length === 0) return "";

  const tasksById = new Map(tasks.map(task => [task.id, task]));
  const labels = cycleIds
    .map(taskId => tasksById.get(taskId))
    .filter(Boolean)
    .map(task => task.taskCode || task.task || task.id);
  return `Abhängigkeit würde einen Zyklus erzeugen: ${labels.join(" -> ")}.`;
}

export function getEffectiveWann(wann) {
  return wann === CRITERIA_PLACEHOLDER ? "klären" : wann;
}

export function isClarificationPending(task) {
  if (isDeleted(task)) return false;
  return !isDone(task) && getEffectiveWann(task?.wann) === "klären";
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
    !isStarted(task) && isClarificationPending(task) ? "clarify" : "",
    isStartPending(task, todayTime) ? "Start reached" : "",
    isOverdue(task, todayTime) ? "overdue" : "",
    isDueToday(task, todayTime) ? "due today" : ""
  ].filter(Boolean);
}

export function shouldShowDueReminder(task, todayTime = getTodayDayTime()) {
  if (isDeleted(task)) return false;
  return getDueReminderStatus(task, todayTime).length > 0;
}
