export function normalizeReminderOrder(value) {
  const values = Array.isArray(value) ? value : [];
  return [...new Set(values.map(item => String(item || "").trim()).filter(Boolean))];
}

export function applyReminderOrder(standardTasks, savedOrder) {
  const tasks = Array.isArray(standardTasks) ? standardTasks : [];
  const taskById = new Map(tasks.map(task => [String(task.id), task]));
  const savedIds = normalizeReminderOrder(savedOrder).filter(id => taskById.has(id));
  const savedSet = new Set(savedIds);
  const orderedTasks = savedIds.map(id => taskById.get(id));

  tasks.forEach((task, standardIndex) => {
    if (savedSet.has(String(task.id))) return;
    orderedTasks.splice(Math.min(standardIndex, orderedTasks.length), 0, task);
  });

  return orderedTasks;
}

export function moveReminderTaskIds(visibleIds, sourceId, targetId) {
  const ids = normalizeReminderOrder(visibleIds);
  const sourceIndex = ids.indexOf(String(sourceId));
  const targetIndex = ids.indexOf(String(targetId));
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return ids;

  const next = [...ids];
  const [movedId] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, movedId);
  return next;
}

export function preserveHiddenReminderOrder(savedOrder, reorderedVisibleIds) {
  const savedIds = normalizeReminderOrder(savedOrder);
  const visibleIds = normalizeReminderOrder(reorderedVisibleIds);
  const visibleSet = new Set(visibleIds);
  const result = [];
  let visibleIndex = 0;

  savedIds.forEach(id => {
    if (visibleSet.has(id)) {
      result.push(visibleIds[visibleIndex]);
      visibleIndex += 1;
    } else {
      result.push(id);
    }
  });

  result.push(...visibleIds.slice(visibleIndex));
  return normalizeReminderOrder(result);
}

export function getReminderAutoScrollSpeed(clientY, top, bottom, edgeSize = 96, maxSpeed = 14) {
  if (![clientY, top, bottom, edgeSize, maxSpeed].every(Number.isFinite) || bottom <= top || edgeSize <= 0 || maxSpeed <= 0) {
    return 0;
  }

  if (clientY < top + edgeSize) {
    const intensity = Math.min(1, Math.max(0, (top + edgeSize - clientY) / edgeSize));
    return -Math.max(1, Math.ceil(maxSpeed * intensity));
  }

  if (clientY > bottom - edgeSize) {
    const intensity = Math.min(1, Math.max(0, (clientY - (bottom - edgeSize)) / edgeSize));
    return Math.max(1, Math.ceil(maxSpeed * intensity));
  }

  return 0;
}
