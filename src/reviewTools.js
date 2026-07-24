export const REVIEW_STALE_DAYS = 7;

function normalizeText(value) {
  return String(value ?? "").trim();
}

function getDateOnlyTime(value) {
  const normalized = normalizeText(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const time = new Date(`${normalized}T00:00:00`).getTime();
  return Number.isFinite(time) ? time : null;
}

function getIsoTime(value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const time = new Date(normalized).getTime();
  return Number.isFinite(time) ? time : null;
}

function getTodayTime(today = new Date()) {
  const source = today instanceof Date ? today : new Date(today);
  return getDateOnlyTime(source.toISOString().slice(0, 10));
}

function daysBetween(fromTime, toTime) {
  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime)) return 0;
  return Math.floor((toTime - fromTime) / 86400000);
}

function isDone(task) {
  return task?.googleStatus === "Erledigt";
}

function isDeleted(task) {
  return Boolean(normalizeText(task?.deletedAt));
}

function isStarted(task) {
  return task?.googleStatus === "Gestartet";
}

function isActive(task) {
  return task && !isDone(task) && !isDeleted(task);
}

export function getLatestCommentTime(task) {
  const comments = Array.isArray(task?.comments) ? task.comments : [];
  return comments.reduce((latest, comment) => {
    const updatedAt = getIsoTime(comment?.updatedAt);
    const createdAt = getIsoTime(comment?.createdAt);
    return Math.max(latest, updatedAt || 0, createdAt || 0);
  }, 0);
}

export function getTaskActivityTime(task) {
  return Math.max(
    getIsoTime(task?.createdAt) || 0,
    getLatestCommentTime(task),
    getIsoTime(task?.completedAt) || 0
  );
}

export function isOverdueTask(task, today = new Date()) {
  if (!isActive(task)) return false;
  const dueTime = getDateOnlyTime(task?.faellig);
  return Boolean(dueTime && dueTime <= getTodayTime(today));
}

export function getTaskReviewReasons(task, options = {}) {
  if (!isActive(task)) return [];
  const todayTime = getTodayTime(options.today);
  const staleDays = Number.isFinite(options.staleDays) ? options.staleDays : REVIEW_STALE_DAYS;
  const reasons = [];
  const activityTime = getTaskActivityTime(task);
  const commentTime = getLatestCommentTime(task);

  if (task.googleStatus === "Offen" && activityTime && daysBetween(activityTime, todayTime) >= staleDays) {
    reasons.push(`Open for ${staleDays}+ days without activity`);
  }

  if (isStarted(task)) {
    const referenceTime = commentTime || activityTime;
    if (referenceTime && daysBetween(referenceTime, todayTime) >= staleDays) {
      reasons.push(`Started without a comment for ${staleDays}+ days`);
    }
  }

  if (!normalizeText(task.startdatum) || !normalizeText(task.faellig)) {
    reasons.push("Start or due date missing");
  }

  return reasons;
}

export function shouldShowInReview(task, options = {}) {
  return getTaskReviewReasons(task, options).length > 0;
}

function isDateInRange(value, today, daysBack) {
  const dateTime = getDateOnlyTime(value);
  if (!dateTime) return false;
  const end = getTodayTime(today);
  const start = end - ((daysBack - 1) * 86400000);
  return dateTime >= start && dateTime <= end;
}

export function getTaskReviewSummary(tasks, options = {}) {
  const list = Array.isArray(tasks) ? tasks : [];
  const today = options.today || new Date();
  return {
    doneToday: list.filter(task => isDateInRange(task.completedAt, today, 1)).length,
    doneWeek: list.filter(task => isDateInRange(task.completedAt, today, 7)).length,
    started: list.filter(task => isActive(task) && isStarted(task)).length,
    open: list.filter(task => isActive(task) && task.googleStatus === "Offen").length,
    overdue: list.filter(task => isOverdueTask(task, today)).length
  };
}