import assert from "node:assert/strict";
import {
  findDependencyCycle,
  getDependencyCycleMessage,
  getDueReminderStatus,
  getPredecessorCompletionBlockMessage,
  getSubtaskCompletionBlockMessage,
  shouldShowDueReminder
} from "../src/taskRules.js";
import {
  applyNormalizedSubtaskRows,
  getStableSubtaskId,
  normalizeSubtasks,
  taskSubtasksToRows
} from "../src/subtasks.js";

import { matchesFreeTextSearch, matchesGlobalTaskSearch } from "../src/taskSearch.js";
import {
  getTaskReviewReasons,
  getTaskReviewSummary,
  shouldShowInReview
} from "../src/reviewTools.js";

const tests = [];
const todayTime = new Date("2026-06-03T00:00:00").getTime();

function test(name, fn) {
  tests.push({ name, fn });
}

function task(overrides = {}) {
  return {
    id: overrides.id || crypto.randomUUID(),
    taskCode: overrides.taskCode || "T-001",
    task: overrides.task || "Test task",
    googleStatus: "Offen",
    dependsOnTaskIds: [],
    subtasks: [],
    startdatum: "",
    faellig: "",
    deletedAt: "",
    ...overrides
  };
}

test("open subtasks block task completion", () => {
  const message = getSubtaskCompletionBlockMessage(task({
    subtasks: [
      { text: "Already done", done: true },
      { text: "Still open", done: false }
    ]
  }));

  assert.match(message, /all subtasks are done/);
});

test("completed subtasks do not block task completion", () => {
  const message = getSubtaskCompletionBlockMessage(task({
    subtasks: [{ text: "Done", done: true }]
  }));

  assert.equal(message, "");
});

test("open predecessors block task completion", () => {
  const predecessor = task({ id: "a", taskCode: "T-001", task: "Before" });
  const current = task({ id: "b", taskCode: "T-002", task: "After", dependsOnTaskIds: ["a"] });
  const message = getPredecessorCompletionBlockMessage(current, new Map([[predecessor.id, predecessor]]));

  assert.match(message, /T-001/);
});

test("done predecessors do not block task completion", () => {
  const predecessor = task({ id: "a", taskCode: "T-001", googleStatus: "Erledigt" });
  const current = task({ id: "b", taskCode: "T-002", dependsOnTaskIds: ["a"] });
  const message = getPredecessorCompletionBlockMessage(current, new Map([[predecessor.id, predecessor]]));

  assert.equal(message, "");
});

test("dependency cycles are detected", () => {
  const tasks = [
    task({ id: "a", taskCode: "T-001", dependsOnTaskIds: ["c"] }),
    task({ id: "b", taskCode: "T-002", dependsOnTaskIds: ["a"] }),
    task({ id: "c", taskCode: "T-003", dependsOnTaskIds: ["b"] })
  ];

  assert.deepEqual(findDependencyCycle(tasks), ["a", "c", "b", "a"]);
  assert.match(getDependencyCycleMessage(tasks), /T-001/);
});

test("started tasks hide start reminders but still show due reminders", () => {
  assert.equal(shouldShowDueReminder(task({
    googleStatus: "Gestartet",
    startdatum: "2026-06-03"
  }), todayTime), false);
  assert.deepEqual(getDueReminderStatus(task({
    googleStatus: "Gestartet",
    startdatum: "2026-06-03",
    faellig: "2026-06-02"
  }), todayTime), ["overdue"]);
  assert.equal(shouldShowDueReminder(task({
    googleStatus: "Gestartet",
    faellig: "2026-06-02"
  }), todayTime), true);
});

test("done tasks are hidden from reminder popup", () => {
  assert.equal(shouldShowDueReminder(task({
    googleStatus: "Erledigt",
    faellig: "2026-06-02"
  }), todayTime), false);
});

test("due tasks produce reminder statuses", () => {
  assert.deepEqual(getDueReminderStatus(task({
    faellig: "2026-06-03"
  }), todayTime), ["due today"]);
});

test("task_subtasks rows override legacy task subtasks", () => {
  const tasks = [task({
    id: "task-a",
    subtasks: ["[ ] Legacy subtask"]
  })];
  const nextTasks = applyNormalizedSubtaskRows(tasks, [
    {
      task_id: "task-a",
      user_id: "user-a",
      position: 1,
      id: "legacy-2",
      title: "Second normalized",
      is_done: false,
      startdatum: null,
      faellig: "2026-06-04"
    },
    {
      task_id: "task-a",
      user_id: "user-a",
      position: 0,
      id: getStableSubtaskId("task-a", 0, "user-a"),
      title: "First normalized",
      is_done: true,
      startdatum: "2026-06-03",
      faellig: null
    }
  ]);

  assert.deepEqual(normalizeSubtasks(nextTasks[0].subtasks), [
    { text: "First normalized", done: true, startdatum: "2026-06-03", faellig: "" },
    { text: "Second normalized", done: false, startdatum: "", faellig: "2026-06-04" }
  ]);
});

test("duplicate task_subtasks rows are collapsed by task and position", () => {
  const tasks = [task({
    id: "task-a",
    subtasks: ["[ ] Legacy subtask"]
  })];
  const nextTasks = applyNormalizedSubtaskRows(tasks, [
    {
      id: "old-random-id",
      task_id: "task-a",
      user_id: "user-a",
      position: 0,
      title: "Duplicate old row",
      is_done: false,
      updated_at: "2026-06-03T10:00:00Z"
    },
    {
      id: getStableSubtaskId("task-a", 0, "user-a"),
      task_id: "task-a",
      user_id: "user-a",
      position: 0,
      title: "Stable row",
      is_done: true,
      updated_at: "2026-06-03T09:00:00Z"
    }
  ]);

  assert.deepEqual(normalizeSubtasks(nextTasks[0].subtasks), [
    { text: "Stable row", done: true, startdatum: "", faellig: "" }
  ]);
});

test("task_subtasks rows with the same content are kept as separate subtasks", () => {
  const tasks = [task({
    id: "task-a",
    subtasks: ["[ ] Legacy subtask"]
  })];
  const nextTasks = applyNormalizedSubtaskRows(tasks, [
    {
      id: "row-a",
      task_id: "task-a",
      user_id: "user-a",
      position: 0,
      title: "Same subtask",
      is_done: false,
      startdatum: "2026-06-03",
      faellig: "2026-06-05",
      updated_at: "2026-06-03T10:00:00Z"
    },
    {
      id: "row-b",
      task_id: "task-a",
      user_id: "user-a",
      position: 1,
      title: "same subtask",
      is_done: false,
      startdatum: "2026-06-03",
      faellig: "2026-06-05",
      updated_at: "2026-06-03T11:00:00Z"
    }
  ]);

  assert.deepEqual(normalizeSubtasks(nextTasks[0].subtasks), [
    { text: "Same subtask", done: false, startdatum: "2026-06-03", faellig: "2026-06-05" },
    { text: "same subtask", done: false, startdatum: "2026-06-03", faellig: "2026-06-05" }
  ]);
});

test("legacy subtasks with the same content are kept as separate subtasks", () => {
  assert.deepEqual(normalizeSubtasks([
    "[ ] Same subtask",
    "[ ] same subtask",
    "[x] Same subtask"
  ]), [
    { text: "Same subtask", done: false, startdatum: "", faellig: "" },
    { text: "same subtask", done: false, startdatum: "", faellig: "" },
    { text: "Same subtask", done: true, startdatum: "", faellig: "" }
  ]);
});

test("subtasks convert to task_subtasks rows in order", () => {
  assert.deepEqual(taskSubtasksToRows(task({
    id: "task-a",
    subtasks: [
      { text: "One", done: false, startdatum: "2026-06-03", faellig: "" },
      { text: "Two", done: true, startdatum: "", faellig: "2026-06-05" }
    ]
  }), "user-a"), [
    {
      id: getStableSubtaskId("task-a", 0, "user-a"),
      task_id: "task-a",
      user_id: "user-a",
      position: 0,
      title: "One",
      is_done: false,
      startdatum: "2026-06-03",
      faellig: null
    },
    {
      id: getStableSubtaskId("task-a", 1, "user-a"),
      task_id: "task-a",
      user_id: "user-a",
      position: 1,
      title: "Two",
      is_done: true,
      startdatum: null,
      faellig: "2026-06-05"
    }
  ]);
});

test("started tasks without recent comments enter review", () => {
  const started = task({
    googleStatus: "Gestartet",
    createdAt: "2026-05-20T08:00:00.000Z",
    comments: [{ text: "old", createdAt: "2026-05-22T08:00:00.000Z" }],
    startdatum: "2026-05-20",
    faellig: "2026-06-20"
  });

  assert.match(getTaskReviewReasons(started, { today: "2026-06-03" }).join(" "), /Doing without a comment/);
});

test("review summary counts daily and weekly closure metrics", () => {
  const summary = getTaskReviewSummary([
    task({ googleStatus: "Erledigt", completedAt: "2026-06-03" }),
    task({ googleStatus: "Erledigt", completedAt: "2026-06-01" }),
    task({ googleStatus: "Gestartet" }),
    task({ googleStatus: "Offen", faellig: "2026-06-02" })
  ], { today: "2026-06-03" });

  assert.equal(summary.doneToday, 1);
  assert.equal(summary.doneWeek, 2);
  assert.equal(summary.started, 1);
  assert.equal(summary.open, 1);
  assert.equal(summary.overdue, 1);
});
test("overview free-text search matches all words across task fields", () => {
  const values = ["T-042", "Budget abstimmen", "Kommentar von Sascha", "#ETH"];
  assert.equal(matchesFreeTextSearch(values, "budget sascha"), true);
  assert.equal(matchesFreeTextSearch(values, "t-042 eth"), true);
  assert.equal(matchesFreeTextSearch(values, "budget privat"), false);
  assert.equal(matchesFreeTextSearch(values, ""), true);
});

test("global overview search ignores normal views but respects done and deleted scopes", () => {
  const values = ["BioMed", "Kein eigenes SLA"];
  assert.equal(matchesGlobalTaskSearch(values, "biomed", { deleted: false, deletedView: false }), true);
  assert.equal(matchesGlobalTaskSearch(values, "biomed", { deleted: true, deletedView: false }), false);
  assert.equal(matchesGlobalTaskSearch(values, "biomed", { deleted: true, deletedView: true }), true);
  assert.equal(matchesGlobalTaskSearch(values, "biomed", { done: true, doneView: false }), false);
  assert.equal(matchesGlobalTaskSearch(values, "biomed", { done: true, doneView: true }), true);
  assert.equal(matchesGlobalTaskSearch(values, "biomed", { done: false, doneView: true }), false);
  assert.equal(matchesGlobalTaskSearch(values, "", { deleted: false, deletedView: false }), false);
});

let failures = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log(`All ${tests.length} tests passed.`);
}
