import { Fragment, forwardRef, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Columns3,
  FileText,
  List,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  Search,
  Share2,
  SlidersHorizontal,
  Undo2,
  Trash2,
  X
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "./supabaseClient";
import TaskScopeTabs from "./TaskScopeTabs";
import { matchesGlobalTaskSearch } from "./taskSearch";
import { getDependencyCycleMessage } from "./taskRules";
import {
  applyNormalizedSubtaskRows,
  formatSubtaskForText,
  normalizeSubtask,
  normalizeSubtasks,
  taskSubtasksToRows
} from "./subtasks";
import {
  REVIEW_STALE_DAYS,
  getTaskReviewReasons,
  getTaskReviewSummary,
  shouldShowInReview
} from "./reviewTools";

const STORAGE_KEY = "task-sheet.tasks.v1";
const SELECTED_TAG_TABS_STORAGE_KEY = "task-001.selected-tag-tabs.v1";
const TAG_CATALOG_STORAGE_KEY = "task-001.tag-catalog.v1";
const BROWSER_COMPACT_VIEW_STORAGE_KEY = "task-001.browser-compact-view.v1";
const TOOLTIP_ENABLED_STORAGE_KEY = "task-001.tooltips-enabled.v1";
const DARK_MODE_STORAGE_KEY = "task-001.dark-mode.v1";
const DARK_MODE_BROWSER_STORAGE_KEY = "task-001.dark-mode-browser.v1";
const DARK_MODE_MOBILE_STORAGE_KEY = "task-001.dark-mode-mobile.v1";
const EDIT_SECTION_DEFAULTS_STORAGE_KEY = "task-001.edit-section-defaults.v1";
const EDIT_SECTION_DEFAULTS_VERSION = 5;
const TAB_LAYOUT_STORAGE_KEY = "task-001.tab-layout.v1";
const CARD_BADGE_COLUMNS_STORAGE_KEY = "task-001.card-badge-columns.v1";
const UPCOMING_BADGE_DEFAULTS_STORAGE_KEY = "task-001.upcoming-badge-defaults.v1";
const DEFAULT_VIEW_MODE_STORAGE_KEY = "task-001.default-view-mode.v2";
const DEFAULT_MOBILE_VIEW_MODE_STORAGE_KEY = "task-001.default-mobile-view-mode.v1";
const DEFAULT_START_TAB_STORAGE_KEY = "task-001.default-start-tab.v1";
const DEFAULT_MOBILE_START_TAB_STORAGE_KEY = "task-001.default-mobile-start-tab.v1";
const KANBAN_COLUMNS_STORAGE_KEY = "task-001.kanban-columns.v1";
const SESSION_VIEW_STORAGE_KEY = "task-001.session-view.v1";

const TASK_ID_PREFIX = "T";
const MAX_TASK_TAGS = 1;
const MAX_TAG_CATALOG_SIZE = 10;
const ALLOWED_USER_EMAIL = "lars.tremmel@gmail.com";
const DEFAULT_EDIT_SECTION_STATE = {
  parameters: true,
  description: true,
  subtasks: true,
  comments: true
};
const DEFAULT_EDIT_SECTION_DEFAULTS = {
  browser: {
    parameters: true,
    description: true,
    subtasks: true,
    comments: true
  },
  mobile: {
    parameters: true,
    description: true,
    subtasks: true,
    comments: true
  }
};
const DEFAULT_CARD_BADGE_COLUMNS = { overview: "default", edit: "default", kanban: "default" };
const TASK_DETAIL_DEFAULTS_VERSION = 3;
const TASK_DETAIL_MODES = ["minimum", "maximum"];
const DEFAULT_TASK_DETAIL_MODE = "minimum";
const DEFAULT_UPCOMING_BADGE_DEFAULTS = { version: TASK_DETAIL_DEFAULTS_VERSION, browser: DEFAULT_TASK_DETAIL_MODE, mobile: DEFAULT_TASK_DETAIL_MODE, dependenciesBrowser: false, dependenciesMobile: false };
const DEFAULT_VIEW_MODE = "kanban";
const VIEW_MODE_OPTIONS = ["list", "kanban"];
const DEFAULT_CARD_BADGE_COLUMN_COUNT = 3;
const CARD_BADGE_CELL_WIDTH = 145;
const CARD_BADGE_CELL_GAP = 5;
const KANBAN_COLUMN_EXTRA_WIDTH = 36;
const KANBAN_COLUMNS = [
  { key: "open", title: "Backlog" },
  { key: "started", title: "Doing" },
  { key: "done", title: "Done" }
];
const DEFAULT_KANBAN_COLUMN_KEYS = KANBAN_COLUMNS.map(column => column.key);
const LEGACY_KANBAN_COLUMN_KEYS = ["open", "started"];
const KANBAN_COLUMN_STATUS = { open: "Offen", started: "Gestartet", done: "Erledigt" };
const MAX_CARD_BADGE_COLUMNS = 8;
const DESCRIPTION_PREVIEW_LIMIT = 128;
const TEXT_LIMITS = {
  task: { warn: 80, strong: 125, max: 250 },
  subtask: { warn: 250, max: 1000 },
  comment: { warn: 500, max: 5000 },
  description: { max: 20000 },
  tag: { max: 24 }
};
const CSV_COLUMNS = [
  "taskCode",
  "risiko",
  "impact",
  "prio",
  "task",
  "beschreibung",
  "comments",
  "subtasks",
  "tags",
  "dependsOnTaskCode",
  "dependsOnTaskCodes",
  "googleStatus",
  "startdatum",
  "faellig",
  "createdAt",
  "completedAt",
  "deletedAt"
];

const PRIO_OPTIONS = ["P1", "P2", "P3", "priorisieren"];
const GOOGLE_STATUS_OPTIONS = ["Offen", "Gestartet", "Erledigt"];
const TASK_STATUS_OPTIONS = [...GOOGLE_STATUS_OPTIONS, "Gelöscht"];
const STATUS_FILTER_OPTIONS = ["Alle", "Offen", "Gestartet"];
const DISPLAY_VALUE_LABELS = {
  "Alle": "All",
  "Offen": "Backlog",
  "Gestartet": "Doing",
  "Erledigt": "Done",
  "Gelöscht": "Deleted",
  "priorisieren": "Prioritize",
  "hoch": "High",
  "mittel": "Medium",
  "niedrig": "Low",
  "heute starten": "Start today",
  "heute fällig": "Due today",
  "überfällig": "Overdue",
  "geplant": "Scheduled",
  "ohne Fälligkeit": "No due date",
  "Standard": "Default",
  "Aufsteigend": "Ascending",
  "Absteigend": "Descending"
};

function getDisplayValue(value) {
  const normalized = normalizeText(value);
  if (!normalized) return "-";
  return DISPLAY_VALUE_LABELS[normalized] || normalized;
}

function getDisplayListValue(value) {
  if (Array.isArray(value)) return value.length > 0 ? value.map(getDisplayValue).join(", ") : "-";
  return getDisplayValue(value);
}

function getViewLabel(tab) {
  const labels = {
    capture: "New task",
    review: "Review",
    newest: "Newest",
    open: "Backlog",
    started: "Doing",
    done: "Done",
    deleted: "Deleted",
    active: "All active"
  };
  return labels[tab] || getDisplayValue(tab);
}
const ACTIVE_TAB = "active";
const DEFAULT_START_TAB = ACTIVE_TAB;
const START_TAB_OPTIONS = [ACTIVE_TAB];
const NEWEST_TAB = "newest";
const REVIEW_TAB = "review";
const REVIEW_INFO_ITEMS = [
  "old backlog tasks without movement",
  `doing tasks without comments for ${REVIEW_STALE_DAYS}+ days`,
  "tasks without start or due date"
];
const STATUS_TABS = [ACTIVE_TAB, REVIEW_TAB, "open", "started", NEWEST_TAB];
const LIST_TABS = [ACTIVE_TAB, REVIEW_TAB, "open", "started", NEWEST_TAB, "done"];
const DONE_TAB = "done";
const DELETED_TAB = "deleted";
const DELETED_RETENTION_DAYS = 30;
const STATUS_FILTER_BY_TAB = {
  open: "Offen",
  started: "Gestartet"
};
const TAB_LAYOUT_ROW_COUNT = 2;
const STATIC_TAB_IDS = ["all", "done"];
const DUE_STATUS_OPTIONS = ["Alle", "heute starten", "heute fällig", "überfällig", "geplant", "ohne Fälligkeit"];
const CRITERIA_PLACEHOLDER = "...";
const RISIKO_OPTIONS = ["hoch", "mittel", "niedrig"];
const IMPACT_OPTIONS = ["hoch", "mittel", "niedrig"];

const DEFAULT_COLUMN_FILTERS = {
  overviewSearch: "",
  taskCodeSort: "Standard",
  taskCode: "",
  prioSort: "Standard",
  prio: "Alle",
  taskSort: "Standard",
  dueStatus: "Alle",
  task: "",
  beschreibungSort: "Standard",
  beschreibung: "",
  tagSort: "Standard",
  tagFilter: "",
  subtaskSort: "Standard",
  subtaskFilter: "",
  predecessorSort: "Standard",
  predecessorFilter: "",
  successorSort: "Standard",
  successorFilter: "",
  googleStatusSort: "Standard",
  googleStatus: "Offen",
  startdatumSort: "Standard",
  startdatum: "",
  faelligSort: "Standard",
  faellig: "",
  completedAtSort: "Standard",
  completedAt: "",
  deletedAtSort: "Standard",
  deletedAt: ""
};

function getDefaultColumnFilters(tab = "open") {
  const googleStatus = STATUS_FILTER_BY_TAB[tab] || "Alle";
  return {
    ...DEFAULT_COLUMN_FILTERS,
    tagFilter: "",
    googleStatus,
    completedAtSort: tab === DONE_TAB ? "Absteigend" : DEFAULT_COLUMN_FILTERS.completedAtSort,
    deletedAtSort: tab === DELETED_TAB ? "Absteigend" : DEFAULT_COLUMN_FILTERS.deletedAtSort
  };
}

const PRIO_HELP =
  "Priority answers: how important is this?\n\nIf damage is high or impact is high -> P1\nOtherwise, if damage and impact are both medium -> P2\nOtherwise -> P3\n\nDefault sort: prioritize -> P1 -> P2 -> P3";

const EDIT_FIELD_HELP = {
  risiko: "How high is the damage if the task is not done, or done too late? Together with impact, this derives Prio.",
  impact: "How large is the task impact? Together with damage, this derives Prio.",
  prio: PRIO_HELP,
  tags: "Tag used to classify the task. A task can currently have one tag.",
  task: "Short, clear task title.",
  beschreibung: "Structured description with paragraphs and bullet points.",
  comments: "Task comments with creation and edit dates.",
  subtasks: "Internal checklist. All subtasks must be done before the task can be completed.",
  dependsOnTaskIds: "Predecessors: tasks that must be done before this task.",
  successorTaskIds: "Successors: tasks that come after this task.",
  googleStatus: "Task status: Backlog, Doing, Done, or Deleted.",
  startdatum: "Date from which the task should start.",
  faellig: "Task due date."
};

const PRIO_ORDER = {
  P1: 1,
  P2: 2,
  P3: 3,
  priorisieren: 0
};

const EMPTY_TASK = {
  risiko: CRITERIA_PLACEHOLDER,
  impact: CRITERIA_PLACEHOLDER,
  prio: CRITERIA_PLACEHOLDER,
  taskCode: "",
  dependsOnTaskId: "",
  dependsOnTaskIds: [],
  successorTaskIds: [],
  task: "",
  beschreibung: "",
  comments: [],
  subtasks: [],
  tags: [],
  googleStatus: "Offen",
  startdatum: "",
  faellig: "",
  createdAt: "",
  completedAt: "",
  deletedAt: ""
};

function createEmptyTask() {
  return {
    ...EMPTY_TASK,
    dependsOnTaskIds: [],
    successorTaskIds: [],
    comments: [],
    subtasks: [],
    tags: []
  };
}

function findVisibleTaskElement(taskId) {
  return [`task-row-${taskId}`, `mobile-task-row-${taskId}`]
    .map(elementId => document.getElementById(elementId))
    .find(element => element && element.offsetParent !== null);
}

const SAMPLE_TASKS = [
  {
    ...EMPTY_TASK,
    id: crypto.randomUUID(),
    prio: "P2",
    task: "Info an Team: Ticket Queue ohne AI",
    beschreibung: "Siehe CxS Meeting vom 19.5. ID Service Desk"
  },
  {
    ...EMPTY_TASK,
    id: crypto.randomUUID(),
    prio: "P1",
    task: "Wie verhalten sich GLPI u. Nessus beim Clonen?",
    beschreibung: "Link zum internen Ticket"
  },
  {
    ...EMPTY_TASK,
    id: crypto.randomUUID(),
    prio: "P1",
    task: "Vorbereitung Diaphanium (Termin 25.6.2026)",
    beschreibung: "Siehe auch Formular/Bogen von Robert (-> Email)"
  },
  {
    ...EMPTY_TASK,
    id: crypto.randomUUID(),
    prio: "P1",
    task: "Wie oft wird \"SQL Navigator\" & “Toad“ genutzt? Via GLPI checken"
  },
  {
    ...EMPTY_TASK,
    id: crypto.randomUUID(),
    prio: "P1",
    task: "Konzept Betriebsmodus PC Inventory für Lead Agiles + Tools"
  },
  {
    ...EMPTY_TASK,
    id: crypto.randomUUID(),
    prio: "P3",
    task: "BPMN2 mit Codex testen"
  },
  {
    ...EMPTY_TASK,
    id: crypto.randomUUID(),
    prio: "P2",
    task: "BioMed: Kein eigenes SLA mehr, via Dept. SLA",
    beschreibung: "Magda fragen, was es kosten würde (nur Gruppe BioMed)"
  },
  {
    ...EMPTY_TASK,
    id: crypto.randomUUID(),
    prio: "P1",
    task: "Lars 50er"
  },
  {
    ...EMPTY_TASK,
    id: crypto.randomUUID(),
    prio: "P1",
    task: "Lars Steuern"
  },
  {
    ...EMPTY_TASK,
    id: crypto.randomUUID(),
    prio: "P3",
    task: "Powerrack Innenabstand messen",
    beschreibung:
      "https://www.amazon.de/Synergee-Attachment-Designed-Holes-Safety-Presses-Sold/dp/B0FQDSLQ5J"
  }
];

function getEffectivePrio(prio) {
  return prio === CRITERIA_PLACEHOLDER ? "priorisieren" : prio;
}

function normalizeEditSectionDefaults(value) {
  const parsed = typeof value === "string" ? safeJsonParse(value, {}) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      version: EDIT_SECTION_DEFAULTS_VERSION,
      browser: { ...DEFAULT_EDIT_SECTION_DEFAULTS.browser },
      mobile: { ...DEFAULT_EDIT_SECTION_DEFAULTS.mobile }
    };
  }

  function normalizeSectionState(source = {}, fallback = DEFAULT_EDIT_SECTION_DEFAULTS.browser) {
    return Object.fromEntries(
      Object.entries(DEFAULT_EDIT_SECTION_STATE).map(([key]) => [
      key,
        typeof source?.[key] === "boolean" ? source[key] : fallback[key]
    ])
    );
  }

  const hasDeviceDefaults = parsed.browser || parsed.mobile;
  if (!hasDeviceDefaults || parsed.version !== EDIT_SECTION_DEFAULTS_VERSION) {
    return {
      version: EDIT_SECTION_DEFAULTS_VERSION,
      browser: { ...DEFAULT_EDIT_SECTION_DEFAULTS.browser },
      mobile: { ...DEFAULT_EDIT_SECTION_DEFAULTS.mobile }
    };
  }

  return {
    version: EDIT_SECTION_DEFAULTS_VERSION,
    browser: normalizeSectionState(parsed.browser, DEFAULT_EDIT_SECTION_DEFAULTS.browser),
    mobile: normalizeSectionState(parsed.mobile, DEFAULT_EDIT_SECTION_DEFAULTS.mobile)
  };
}

function normalizeCardBadgeColumnValue(value) {
  if (value === "default" || value === null || typeof value === "undefined") return "default";
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return "default";
  return Math.min(MAX_CARD_BADGE_COLUMNS, Math.max(1, parsed));
}

function normalizeViewMode(value) {
  return VIEW_MODE_OPTIONS.includes(value) ? value : DEFAULT_VIEW_MODE;
}

function normalizeDefaultStartTab(value) {
  return START_TAB_OPTIONS.includes(value) ? value : DEFAULT_START_TAB;
}

function valuesEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// A synced setting should only override a local value when it carries real information.
// A remote value that still matches its own schema default could just mean "never actually
// synced yet" (e.g. Supabase was unreachable when this device/account last saved), in which
// case overwriting local customization with it would silently discard real local preferences.
function preferLocalWhenRemoteIsDefault(remoteValue, defaultValue, localValue) {
  return valuesEqual(remoteValue, defaultValue) ? localValue : remoteValue;
}

function normalizeKanbanColumns(value) {
  const parsed = typeof value === "string" ? safeJsonParse(value, []) : value;
  if (!Array.isArray(parsed)) return [...DEFAULT_KANBAN_COLUMN_KEYS];
  const allowedKeys = new Set(DEFAULT_KANBAN_COLUMN_KEYS);
  const normalized = parsed.filter(key => allowedKeys.has(key));
  return normalized.length > 0 ? normalized : [...DEFAULT_KANBAN_COLUMN_KEYS];
}

function migrateKanbanColumnKeys(value) {
  const normalized = normalizeKanbanColumns(value);
  const isLegacyDefault = normalized.length === LEGACY_KANBAN_COLUMN_KEYS.length &&
    LEGACY_KANBAN_COLUMN_KEYS.every(key => normalized.includes(key));
  return isLegacyDefault ? normalizeKanbanColumns([...normalized, "done"]) : normalized;
}

function normalizeCardBadgeColumns(value) {
  const parsed = typeof value === "string" ? safeJsonParse(value, {}) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ...DEFAULT_CARD_BADGE_COLUMNS };
  }
  return {
    overview: normalizeCardBadgeColumnValue(parsed.overview),
    edit: normalizeCardBadgeColumnValue(parsed.edit),
    kanban: normalizeCardBadgeColumnValue(parsed.kanban)
  };
}

function normalizeTaskDetailMode(value) {
  if (typeof value === "boolean") return value ? "maximum" : "minimum";
  if (value === "medium") return "maximum";
  return TASK_DETAIL_MODES.includes(value) ? value : DEFAULT_TASK_DETAIL_MODE;
}

function getNextTaskDetailMode(value) {
  const currentMode = normalizeTaskDetailMode(value);
  const currentIndex = TASK_DETAIL_MODES.indexOf(currentMode);
  return TASK_DETAIL_MODES[(currentIndex + 1) % TASK_DETAIL_MODES.length];
}

function getTaskDetailModeLabel(value) {
  const mode = normalizeTaskDetailMode(value);
  if (mode === "maximum") return "Maximum";
  return "Minimum";
}

function normalizeUpcomingBadgeDefaults(value) {
  const parsed = typeof value === "string" ? safeJsonParse(value, {}) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ...DEFAULT_UPCOMING_BADGE_DEFAULTS };
  }
  return {
    version: TASK_DETAIL_DEFAULTS_VERSION,
    browser: normalizeTaskDetailMode(parsed.browser),
    mobile: normalizeTaskDetailMode(parsed.mobile),
    dependenciesBrowser: typeof parsed.dependenciesBrowser === "boolean" ? parsed.dependenciesBrowser : normalizeTaskDetailMode(parsed.browser) !== "minimum",
    dependenciesMobile: typeof parsed.dependenciesMobile === "boolean" ? parsed.dependenciesMobile : normalizeTaskDetailMode(parsed.mobile) !== "minimum"
  };
}

function getCardBadgeColumnCount(value) {
  return normalizeCardBadgeColumnValue(value) === "default" ? DEFAULT_CARD_BADGE_COLUMN_COUNT : normalizeCardBadgeColumnValue(value);
}

function getCardBadgeGridWidth(columnValue) {
  const columnCount = getCardBadgeColumnCount(columnValue);
  return columnCount * CARD_BADGE_CELL_WIDTH + Math.max(0, columnCount - 1) * CARD_BADGE_CELL_GAP;
}
function getCardBadgeColumnClass(prefix, value) {
  return `${prefix}${getCardBadgeColumnCount(value)}`;
}

function getCardBadgePaddingCount(itemCount, columnValue) {
  const columnCount = getCardBadgeColumnCount(columnValue);
  const remainder = itemCount % columnCount;
  return remainder === 0 ? 0 : columnCount - remainder;
}

function getCardBadgeColumnSelectOptions() {
  return ["default", ...Array.from({ length: MAX_CARD_BADGE_COLUMNS }, (_, index) => index + 1)];
}
function normalizeDarkModeSettings(value) {
  if (typeof value === "boolean") {
    return { browser: value, mobile: value };
  }
  return {
    browser: Boolean(value?.browser),
    mobile: Boolean(value?.mobile)
  };
}

function normalizeColumnFilters(value, tab = "open") {
  const parsed = typeof value === "string" ? safeJsonParse(value, {}) : value;
  const defaults = getDefaultColumnFilters(tab);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return defaults;

  const filters = { ...defaults };
  Object.keys(defaults).forEach(key => {
    if (Object.prototype.hasOwnProperty.call(parsed, key)) {
      filters[key] = parsed[key];
    }
  });

  if (!STATUS_FILTER_OPTIONS.includes(filters.googleStatus)) {
    filters.googleStatus = defaults.googleStatus;
  }
  if (!["Standard", "Aufsteigend", "Absteigend"].includes(filters.completedAtSort)) {
    filters.completedAtSort = defaults.completedAtSort;
  }
  if (!["Standard", "Aufsteigend", "Absteigend"].includes(filters.deletedAtSort)) {
    filters.deletedAtSort = defaults.deletedAtSort;
  }
  return filters;
}

function getEditTooltip(field, value) {
  const labelByField = {
    risiko: "Damage",
    impact: "Impact",
    prio: "Prio",
    tags: "Tag",
    task: "Task",
    beschreibung: "Description",
    subtasks: "Subtasks",
    dependsOnTaskIds: "Predecessors",
    successorTaskIds: "Successors",
    googleStatus: "Status",
    startdatum: "Start date",
    faellig: "Due"
  };
  const normalizedValue = getDisplayListValue(value);
  return `${labelByField[field] || field}: ${normalizedValue}\n${EDIT_FIELD_HELP[field] || ""}`.trim();
}

function getDerivedCriteriaTooltip(task, field) {
  if (!task) return "";
  if (field === "prio") {
    return [
      `Damage: ${getDisplayValue(task.risiko)}`,
      `Impact: ${normalizeText(task.impact) || "-"}`
    ].join("\n");
  }
  return "";
}

function getTaskTooltip(task, field, value) {
  const baseTooltip = getEditTooltip(field, value);
  const criteriaTooltip = getDerivedCriteriaTooltip(task, field);
  return [baseTooltip, criteriaTooltip].filter(Boolean).join("\n\n");
}

function derivePrio(risiko, impact) {
  if (risiko === CRITERIA_PLACEHOLDER || impact === CRITERIA_PLACEHOLDER) {
    return CRITERIA_PLACEHOLDER;
  }

  if (risiko === "hoch" || impact === "hoch") return "P1";
  if (risiko === "mittel" && impact === "mittel") return "P2";
  return "P3";
}

function hasCompletePrioCriteria(task) {
  return RISIKO_OPTIONS.includes(task.risiko) && IMPACT_OPTIONS.includes(task.impact);
}

function syncDerivedCriteriaValues(task) {
  const next = { ...task };
  if (hasCompletePrioCriteria(next)) {
    next.prio = derivePrio(next.risiko, next.impact);
  }
  return next;
}

function inferPrioCriteria(prio) {
  if (prio === "priorisieren" || prio === CRITERIA_PLACEHOLDER) {
    return { risiko: CRITERIA_PLACEHOLDER, impact: CRITERIA_PLACEHOLDER };
  }

  if (prio === "P1") return { risiko: "hoch", impact: "mittel" };
  if (prio === "P3") return { risiko: "niedrig", impact: "niedrig" };
  return { risiko: "mittel", impact: "mittel" };
}

function isDone(task) {
  return task.googleStatus === "Erledigt";
}

function isDeleted(task) {
  return Boolean(normalizeDateValue(task.deletedAt));
}

function getDisplayStatus(task) {
  return isDeleted(task) ? "Gelöscht" : task.googleStatus;
}

function isStarted(task) {
  return task.googleStatus === "Gestartet";
}

function getKanbanColumnKey(task) {
  if (isDone(task)) return "done";
  return isStarted(task) ? "started" : "open";
}

function getStatusClass(status) {
  if (status === "Gelöscht") return "statusDeleted";
  if (status === "Erledigt") return "statusDone";
  if (status === "Gestartet") return "statusStarted";
  return "";
}

function matchesGoogleStatusFilter(task, statusFilter) {
  if (statusFilter === "Alle") return true;
  return task.googleStatus === statusFilter;
}

function isListTab(tab) {
  return LIST_TABS.includes(tab) || tab === DELETED_TAB;
}

function getTaskViewTab(task) {
  if (isDeleted(task)) return DELETED_TAB;
  if (task.googleStatus === "Erledigt") return DONE_TAB;
  if (task.googleStatus === "Gestartet") return "started";
  return "open";
}

function normalizeDateValue(value) {
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

function getDateDayTime(value) {
  const normalized = normalizeDateValue(value);
  return normalized ? new Date(`${normalized}T00:00:00`).getTime() : null;
}

function getTodayDayTime() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime();
}

function getTodayDateValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isDeletedExpired(task) {
  const deletedTime = getDateDayTime(task.deletedAt);
  if (deletedTime === null) return false;
  const retentionStart = getTodayDayTime() - DELETED_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return deletedTime < retentionStart;
}

function pruneExpiredDeletedTasks(tasks) {
  return tasks.filter(task => !isDeletedExpired(task));
}

function isOverdue(task) {
  if (isDeleted(task)) return false;
  if (isDone(task)) return false;
  const dueTime = getDateDayTime(task.faellig);
  return dueTime !== null && dueTime < getTodayDayTime();
}

function isSubtaskOverdue(subtask) {
  if (subtask.done) return false;
  const dueTime = getDateDayTime(subtask.faellig);
  return dueTime !== null && dueTime < getTodayDayTime();
}

function isDueToday(task) {
  if (isDeleted(task)) return false;
  if (isDone(task)) return false;
  const dueTime = getDateDayTime(task.faellig);
  return dueTime !== null && dueTime === getTodayDayTime();
}

function isSubtaskDueToday(subtask) {
  if (subtask.done) return false;
  const dueTime = getDateDayTime(subtask.faellig);
  return dueTime !== null && dueTime === getTodayDayTime();
}
function getDueStatus(task) {
  if (isOverdue(task)) return "überfällig";
  if (isDueToday(task)) return "heute fällig";
  if (isStartPending(task)) return "heute starten";
  if (normalizeSubtasks(task.subtasks).some(isSubtaskOverdue)) return "\u00fcberf\u00e4llig";
  if (normalizeSubtasks(task.subtasks).some(isSubtaskDueToday)) return "heute f\u00e4llig";
  if (normalizeSubtasks(task.subtasks).some(isSubtaskStartPending)) return "heute starten";
  if (task.faellig || normalizeSubtasks(task.subtasks).some(subtask => subtask.faellig)) return "geplant";
  return "ohne Fälligkeit";
}

function matchesDueStatusFilter(task, dueStatus) {
  if (dueStatus === "Alle") return true;
  if (dueStatus === "heute starten") return isStartPending(task) || normalizeSubtasks(task.subtasks).some(isSubtaskStartPending);
  if (dueStatus === "heute f\u00e4llig") return isDueToday(task) || normalizeSubtasks(task.subtasks).some(isSubtaskDueToday);
  if (dueStatus === "\u00fcberf\u00e4llig") return isOverdue(task) || normalizeSubtasks(task.subtasks).some(isSubtaskOverdue);
  if (dueStatus === "geplant") return Boolean(task.faellig || normalizeSubtasks(task.subtasks).some(subtask => subtask.faellig));
  if (dueStatus === "ohne F\u00e4lligkeit") return !task.faellig && !normalizeSubtasks(task.subtasks).some(subtask => subtask.faellig);
  return getDueStatus(task) === dueStatus;
}
function shouldShowDueReminder(task) {
  if (isDeleted(task)) return false;
  if (isDone(task)) return false;
  return getDueReminderStatus(task).length > 0;
}

function getDueReminderTasks(tasks) {
  return sortTasks(tasks).filter(shouldShowDueReminder);
}

function isStartDateReached(task) {
  if (isDeleted(task)) return false;
  if (isDone(task)) return false;
  const startTime = getDateDayTime(task.startdatum);
  return startTime !== null && startTime <= getTodayDayTime();
}

function isStartPending(task) {
  return isStartDateReached(task) && !isStarted(task);
}

function isSubtaskStartPending(subtask) {
  if (subtask.done) return false;
  const startTime = getDateDayTime(subtask.startdatum);
  return startTime !== null && startTime <= getTodayDayTime();
}

function isTaskOrSubtaskOverdue(task) {
  return isOverdue(task) || normalizeSubtasks(task.subtasks).some(isSubtaskOverdue);
}

function isTaskOrSubtaskStartAttention(task) {
  return isStartPending(task) || normalizeSubtasks(task.subtasks).some(isSubtaskStartPending);
}

function isTaskOrSubtaskDueAttention(task) {
  return isTaskOrSubtaskOverdue(task) || isDueToday(task) || normalizeSubtasks(task.subtasks).some(isSubtaskDueToday);
}

function getStartDateStateText(task) {
  return isTaskOrSubtaskStartAttention(task) ? "Start reached" : "";
}

function getDueDateStateText(task) {
  if (isTaskOrSubtaskOverdue(task)) return "Overdue";
  if (isTaskOrSubtaskDueAttention(task)) return "Due today";
  return "";
}

function getReminderStatus(task) {
  if (isDone(task)) return [];

  const taskBadges = [
    isStartPending(task) ? "Start reached" : "",
    isOverdue(task) ? "Overdue" : "",
    isDueToday(task) ? "Due today" : ""
  ].filter(Boolean);

  const subtaskBadges = normalizeSubtasks(task.subtasks).flatMap((subtask, index) => {
    const prefix = `Subtask ${index + 1}:`;
    return [
      isSubtaskStartPending(subtask) ? `${prefix} Start reached` : "",
      isSubtaskOverdue(subtask) ? `${prefix} Overdue` : "",
      isSubtaskDueToday(subtask) ? `${prefix} Due today` : ""
    ].filter(Boolean);
  });

  return [...taskBadges, ...subtaskBadges];
}

function getDueReminderStatus(task) {
  if (isDone(task)) return [];
  return getReminderStatus(task);
}

function getDueReminderTooltip(task) {
  const reasons = getDueReminderStatus(task);
  if (reasons.length === 0) return "";
  return `Task is upcoming:\n${reasons.map(reason => `- ${reason}`).join("\n")}`;
}

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const prioDiff =
      (PRIO_ORDER[getEffectivePrio(a.prio)] || 99) - (PRIO_ORDER[getEffectivePrio(b.prio)] || 99);
    if (prioDiff !== 0) return prioDiff;

    const dateA = a.faellig ? new Date(a.faellig).getTime() : Number.MAX_SAFE_INTEGER;
    const dateB = b.faellig ? new Date(b.faellig).getTime() : Number.MAX_SAFE_INTEGER;
    if (dateA !== dateB) return dateA - dateB;

    return String(a.task).localeCompare(String(b.task), "de");
  });
}

function getTaskTagText(task) {
  return normalizeTags(task.tags, 0).join(", ");
}

function getTaskSubtaskText(task) {
  return normalizeSubtasks(task.subtasks).map(formatSubtaskForDisplay).join(" ");
}

function getTaskDependencyText(taskIds, tasksById) {
  return normalizeTaskIds(taskIds)
    .map(taskId => tasksById.get(taskId))
    .filter(Boolean)
    .map(task => `${task.taskCode}: ${task.task}`)
    .join(", ");
}

function getTaskFilterCache(task, tasksById, childIdsByParent) {
  const tagText = getTaskTagText(task);
  const predecessorText = getTaskDependencyText(getPredecessorIds(task), tasksById);
  const successorText = getTaskDependencyText(childIdsByParent.get(task.id) || [], tasksById);
  const commentText = getTaskCommentText(task);
  const subtaskText = getTaskSubtaskText(task);
  const formattedStartDate = formatDate(task.startdatum);
  const formattedDueDate = formatDate(task.faellig);
  const formattedCompletedAt = formatDate(task.completedAt);
  const formattedDeletedAt = formatDate(task.deletedAt);

  return {
    commentText,
    formattedCompletedAt,
    formattedDeletedAt,
    formattedDueDate,
    formattedStartDate,
    predecessorText,
    subtaskText,
    successorText,
    tagText,
    searchableTaskValues: [
      task.taskCode,
      task.task,
      task.beschreibung,
      commentText,
      subtaskText,
      tagText,
      getEffectivePrio(task.prio),
      getDisplayStatus(task),
      predecessorText,
      successorText,
      task.startdatum,
      formattedStartDate,
      task.faellig,
      formattedDueDate
    ]
  };
}

function sortTasksWithFilters(tasks, columnFilters, tasksById = new Map(), childIdsByParent = new Map()) {
  const sorters = [
    { field: "taskCodeSort", getValue: (task) => task.taskCode },
    { field: "prioSort", getValue: (task) => PRIO_ORDER[getEffectivePrio(task.prio)] ?? 99 },
    { field: "tagSort", getValue: (task) => getTaskTagText(task) },
    { field: "taskSort", getValue: (task) => task.task },
    { field: "beschreibungSort", getValue: (task) => `${task.beschreibung} ${getTaskCommentText(task)}` },
    { field: "subtaskSort", getValue: (task) => getTaskSubtaskText(task) },
    { field: "predecessorSort", getValue: (task) => getTaskDependencyText(getPredecessorIds(task), tasksById) },
    { field: "successorSort", getValue: (task) => getTaskDependencyText(childIdsByParent.get(task.id) || [], tasksById) },
    { field: "googleStatusSort", getValue: (task) => getDisplayStatus(task) },
    { field: "startdatumSort", getValue: (task) => task.startdatum, type: "date" },
    { field: "faelligSort", getValue: (task) => task.faellig, type: "date" },
    { field: "completedAtSort", getValue: (task) => task.completedAt, type: "date" },
    { field: "deletedAtSort", getValue: (task) => task.deletedAt, type: "date" }
  ].filter(({ field }) => columnFilters[field] !== "Standard");

  if (sorters.length === 0) return sortTasks(tasks);

  return [...tasks].sort((a, b) => {
    for (const { field, getValue, type } of sorters) {
      const direction = columnFilters[field] === "Absteigend" ? -1 : 1;
      const diff = compareSortValues(getValue(a), getValue(b), direction, type);
      if (diff !== 0) return diff;
    }

    return sortTasks([a, b])[0] === a ? -1 : 1;
  });
}

function compareSortValues(firstValue, secondValue, direction = 1, type = "text") {
  if (type === "date") {
    if (!firstValue && !secondValue) return 0;
    if (!firstValue) return 1;
    if (!secondValue) return -1;
    return (new Date(firstValue).getTime() - new Date(secondValue).getTime()) * direction;
  }

  if (typeof firstValue === "number" && typeof secondValue === "number") {
    return (firstValue - secondValue) * direction;
  }

  return String(firstValue || "").localeCompare(String(secondValue || ""), "de-CH", {
    numeric: true,
    sensitivity: "base"
  }) * direction;
}

function getDueTime(value, emptyDirection) {
  if (!value) return emptyDirection > 0 ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER;
  return new Date(value).getTime();
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeTag(value) {
  return normalizeText(value).replace(/^#+/, "").replace(/\s+/g, " ").slice(0, TEXT_LIMITS.tag.max);
}

function normalizeTags(values, maxTags = MAX_TASK_TAGS) {
  const rawList = Array.isArray(values) ? values : String(values || "").split(/[|,;]/);
  const tags = [];
  const seen = new Set();
  rawList.forEach(value => {
    const tag = normalizeTag(value);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) return;
    seen.add(key);
    tags.push(tag);
  });
  return maxTags ? tags.slice(0, maxTags) : tags;
}

function normalizeTagCatalog(values) {
  return normalizeTags(values, MAX_TAG_CATALOG_SIZE);
}

function truncateText(value, maxLength) {
  const text = String(value || "");
  return maxLength ? text.slice(0, maxLength) : text;
}

function normalizeEditableFieldValue(field, value) {
  if (field === "task") return truncateText(value, TEXT_LIMITS.task.max);
  if (field === "beschreibung") return truncateText(value, TEXT_LIMITS.description.max);
  if (field === "tags") return normalizeTags(value);
  return value;
}

function getInputGuidance(value, { warn = 0, strong = 0, max = 0, label = "Text" } = {}) {
  const length = String(value || "").length;
  if (max && length >= max) return { level: "limit", text: `${label} limit reached (${length}/${max}).` };
  if (strong && length >= strong) return { level: "strong", text: `${label} is very long (${length}/${max || strong}). Consider moving details to Description.` };
  if (warn && length >= warn) return { level: "warn", text: `${label} is getting long (${length}/${max || warn}).` };
  return null;
}

function InputGuidance({ value, limits, label }) {
  const guidance = getInputGuidance(value, { ...limits, label });
  if (!guidance) return null;
  return <small className={`inputGuidance ${guidance.level}`}>{guidance.text}</small>;
}

function getTagTabId(tag) {
  return `tag:${normalizeTag(tag)}`;
}

function getTagFromTabId(id) {
  const normalizedId = normalizeText(id);
  return normalizedId.startsWith("tag:") ? normalizedId.slice(4) : "";
}

function getDefaultTabLayout(tags = []) {
  return [
    ["all", "done"],
    normalizeTags(tags, 0).map(getTagTabId)
  ];
}

function migrateLegacyTabLayout(rows) {
  const [row0 = []] = rows;
  if (row0[0] !== "all" || row0.length <= 1) return rows;
  if (row0.slice(1).some(id => STATIC_TAB_IDS.includes(id))) return rows;
  return [["all"], row0.slice(1)];
}

function normalizeTabLayout(layout, tags = []) {
  const activeTags = normalizeTags(tags, 0);
  const activeTagIds = activeTags.map(getTagTabId);
  const allowedIds = new Set([...STATIC_TAB_IDS, ...activeTagIds]);
  const sourceRows = migrateLegacyTabLayout(
    Array.isArray(layout) ? layout.map(row => (Array.isArray(row) ? [...row] : [])) : []
  );
  const rows = Array.from({ length: TAB_LAYOUT_ROW_COUNT }, () => []);
  const seenIds = new Set();

  sourceRows.slice(0, TAB_LAYOUT_ROW_COUNT).forEach((row, rowIndex) => {
    if (!Array.isArray(row)) return;
    row.forEach(rawId => {
      const id = normalizeText(rawId);
      if (!id || seenIds.has(id) || !allowedIds.has(id)) return;
      seenIds.add(id);
      rows[rowIndex].push(id);
    });
  });

  getDefaultTabLayout(activeTags).forEach((defaultRow, rowIndex) => {
    defaultRow.forEach(id => {
      if (seenIds.has(id) || !allowedIds.has(id)) return;
      seenIds.add(id);
      rows[rowIndex].push(id);
    });
  });

  return rows;
}

function moveTabInLayout(layout, sourceId, targetId, targetRowIndex, tags = []) {
  const normalizedSourceId = normalizeText(sourceId);
  const normalizedTargetId = normalizeText(targetId);
  const rows = normalizeTabLayout(layout, tags).map(row => [...row]);
  if (!normalizedSourceId || !rows.some(row => row.includes(normalizedSourceId))) return rows;

  const withoutSource = rows.map(row => row.filter(id => id !== normalizedSourceId));
  const boundedRowIndex = Math.max(0, Math.min(TAB_LAYOUT_ROW_COUNT - 1, Number(targetRowIndex) || 0));
  const targetRow = withoutSource[boundedRowIndex];
  const targetIndex = normalizedTargetId ? targetRow.indexOf(normalizedTargetId) : -1;
  targetRow.splice(targetIndex >= 0 ? targetIndex : targetRow.length, 0, normalizedSourceId);
  return withoutSource;
}

function hasTag(task, tag) {
  const normalizedTag = normalizeTag(tag).toLowerCase();
  return normalizeTags(task.tags).some(taskTag => taskTag.toLowerCase() === normalizedTag);
}

function normalizeTaskId(value) {
  return typeof value === "string" ? value : "";
}

function normalizeTaskIds(values) {
  const list = Array.isArray(values) ? values : values ? [values] : [];
  return Array.from(new Set(list.map(normalizeTaskId).filter(Boolean)));
}

function formatSubtaskForDisplay(subtask, index) {
  const normalizedSubtask = normalizeSubtask(subtask);
  if (!normalizedSubtask) return "";
  const dates = [
    normalizedSubtask.startdatum ? `Start: ${formatDate(normalizedSubtask.startdatum)}` : "",
    normalizedSubtask.faellig ? `Due: ${formatDate(normalizedSubtask.faellig)}` : ""
  ].filter(Boolean);
  return `${index + 1}. ${normalizedSubtask.done ? "[x]" : "[ ]"} ${normalizedSubtask.text}${dates.length ? ` (${dates.join(", ")})` : ""}`;
}

function hasOpenSubtasks(task) {
  return normalizeSubtasks(task.subtasks).some(subtask => !subtask.done);
}

function getPredecessorIds(task) {
  return normalizeTaskIds(task.dependsOnTaskIds?.length ? task.dependsOnTaskIds : task.dependsOnTaskId);
}

function formatTaskCode(number) {
  return `${TASK_ID_PREFIX}-${String(number).padStart(3, "0")}`;
}

function getTaskCodeNumber(taskCode) {
  const match = String(taskCode || "").match(/^T-(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function getTaskCreatedAtTime(task) {
  const createdAtTime = task.createdAt ? new Date(task.createdAt).getTime() : Number.NaN;
  return Number.isFinite(createdAtTime) ? createdAtTime : null;
}

function isLegacyTaskCodeCreatedAt(task) {
  const taskCodeNumber = getTaskCodeNumber(task.taskCode);
  const createdAtTime = getTaskCreatedAtTime(task);
  return Boolean(taskCodeNumber && createdAtTime !== null && createdAtTime === Date.UTC(2000, 0, 1, 0, 0, taskCodeNumber));
}

function getBatchCreatedAtFallbackTimes(tasks) {
  const counts = new Map();
  tasks.forEach(task => {
    if (isLegacyTaskCodeCreatedAt(task)) return;
    const createdAtTime = getTaskCreatedAtTime(task);
    if (createdAtTime === null) return;
    counts.set(createdAtTime, (counts.get(createdAtTime) || 0) + 1);
  });
  return new Set(Array.from(counts.entries()).filter(([, count]) => count > 1).map(([time]) => time));
}

function shouldTreatCreatedAtAsMissing(task, batchFallbackTimes = new Set()) {
  const createdAtTime = getTaskCreatedAtTime(task);
  return isLegacyTaskCodeCreatedAt(task) || (createdAtTime !== null && batchFallbackTimes.has(createdAtTime));
}

function isStartDateCreatedAtFallback(task, batchFallbackTimes = new Set()) {
  if (shouldTreatCreatedAtAsMissing(task, batchFallbackTimes)) return true;
  const startDate = normalizeDateValue(task.startdatum);
  if (!startDate) return false;
  const createdAtTime = getTaskCreatedAtTime(task);
  if (createdAtTime === null) return false;
  return createdAtTime === new Date(`${startDate}T00:00:00.000Z`).getTime();
}

function getTaskCreationSortInfo(task, batchFallbackTimes = new Set()) {
  const createdAtTime = getTaskCreatedAtTime(task);
  if (createdAtTime !== null && !isStartDateCreatedAtFallback(task, batchFallbackTimes)) {
    return { rank: 0, time: createdAtTime };
  }

  const startTime = task.startdatum ? new Date(task.startdatum).getTime() : Number.NaN;
  if (Number.isFinite(startTime)) return { rank: 1, time: startTime };

  return { rank: 2, time: null };
}

function getTaskCreatedAtValue(task, batchFallbackTimes = new Set()) {
  if (task.createdAt && !shouldTreatCreatedAtAsMissing(task, batchFallbackTimes)) return task.createdAt;
  const startDate = normalizeDateValue(task.startdatum);
  if (startDate) return new Date(`${startDate}T00:00:00.000Z`).toISOString();
  return new Date(Date.UTC(1900, 0, 1)).toISOString();
}

function getTaskStartTime(task) {
  const startTime = task.startdatum ? new Date(task.startdatum).getTime() : Number.NaN;
  return Number.isFinite(startTime) ? startTime : null;
}

function sortTasksByCreatedAt(tasks) {
  const batchFallbackTimes = getBatchCreatedAtFallbackTimes(tasks);
  return [...tasks].sort((a, b) => {
    const createdA = getTaskCreationSortInfo(a, batchFallbackTimes);
    const createdB = getTaskCreationSortInfo(b, batchFallbackTimes);
    if (createdA.rank !== createdB.rank) return createdA.rank - createdB.rank;
    if (createdA.time !== null && createdB.time === null) return -1;
    if (createdA.time === null && createdB.time !== null) return 1;
    if (createdA.time !== null && createdB.time !== null && createdA.time !== createdB.time) return createdB.time - createdA.time;

    const startA = getTaskStartTime(a);
    const startB = getTaskStartTime(b);
    if (startA !== null && startB === null) return -1;
    if (startA === null && startB !== null) return 1;
    if (startA !== null && startB !== null && startA !== startB) return startB - startA;

    const taskCodeDiff = getTaskCodeNumber(b.taskCode) - getTaskCodeNumber(a.taskCode);
    if (taskCodeDiff !== 0) return taskCodeDiff;
    return String(b.id || "").localeCompare(String(a.id || ""));
  });
}

function assignMissingTaskCodes(tasks) {
  const usedNumbers = new Set(tasks.map(task => getTaskCodeNumber(task.taskCode)).filter(Boolean));
  let nextNumber = 1;

  return tasks.map(task => {
    if (task.taskCode) return task;

    while (usedNumbers.has(nextNumber)) nextNumber += 1;
    const taskCode = formatTaskCode(nextNumber);
    usedNumbers.add(nextNumber);

    return { ...task, taskCode };
  });
}

function repairMissingCreatedAtFallbacks(tasks) {
  const batchFallbackTimes = getBatchCreatedAtFallbackTimes(tasks);
  let changed = false;
  const nextTasks = tasks.map(task => {
    if (!shouldTreatCreatedAtAsMissing(task, batchFallbackTimes)) return task;
    const startDate = normalizeDateValue(task.startdatum);
    if (!startDate) return task;
    const createdAt = new Date(`${startDate}T00:00:00.000Z`).toISOString();
    if (task.createdAt === createdAt) return task;
    changed = true;
    return { ...task, createdAt };
  });
  return changed ? nextTasks : tasks;
}

function prepareTaskList(tasks) {
  return repairMissingCreatedAtFallbacks(
    pruneExpiredDeletedTasks(assignMissingTaskCodes(tasks))
  );
}

function normalizeTask(task) {
  const googleStatus = GOOGLE_STATUS_OPTIONS.includes(task.googleStatus)
    ? task.googleStatus
    : task.status === "Erledigt"
      ? "Erledigt"
      : "Offen";
  const prio =
    PRIO_OPTIONS.includes(task.prio) || task.prio === CRITERIA_PLACEHOLDER
      ? task.prio
      : "priorisieren";
  const inferredPrioCriteria = inferPrioCriteria(prio);
  const risiko = RISIKO_OPTIONS.includes(task.risiko) ? task.risiko : inferredPrioCriteria.risiko;
  const impact = IMPACT_OPTIONS.includes(task.impact) ? task.impact : inferredPrioCriteria.impact;

  return syncDerivedCriteriaValues({
    id: task.id || crypto.randomUUID(),
    risiko,
    impact,
    prio,
    taskCode: normalizeText(task.taskCode),
    dependsOnTaskIds: normalizeTaskIds(task.dependsOnTaskIds?.length ? task.dependsOnTaskIds : task.dependsOnTaskId),
    dependsOnTaskId: normalizeTaskIds(task.dependsOnTaskIds?.length ? task.dependsOnTaskIds : task.dependsOnTaskId)[0] || "",
    task: truncateText(normalizeText(task.task), TEXT_LIMITS.task.max),
    beschreibung: truncateText(normalizeText(task.beschreibung), TEXT_LIMITS.description.max),
    comments: normalizeComments(task.comments),
    subtasks: normalizeSubtasks(task.subtasks),
    tags: normalizeTags(task.tags),
    googleStatus,
    startdatum: normalizeDateValue(task.startdatum),
    faellig: normalizeDateValue(task.faellig),
    createdAt: normalizeText(task.createdAt ?? task.created_at) || getTaskCreatedAtValue(task),
    completedAt: googleStatus === "Erledigt" ? normalizeDateValue(task.completedAt) : "",
    deletedAt: normalizeDateValue(task.deletedAt)
  });
}

function getNextTaskCode(tasks) {
  const usedNumbers = new Set(tasks.map(task => getTaskCodeNumber(task.taskCode)).filter(Boolean));
  let nextNumber = 1;
  while (usedNumbers.has(nextNumber)) nextNumber += 1;
  return formatTaskCode(nextNumber);
}

function taskToRow(task, userId) {
  return {
    id: task.id,
    user_id: userId,
    task_code: task.taskCode,
    risiko: task.risiko,
    impact: task.impact,
    prio: task.prio,
    depends_on_task_id: getPredecessorIds(task)[0] || null,
    depends_on_task_ids: getPredecessorIds(task),
    task: task.task,
    beschreibung: task.beschreibung,
    comments: normalizeComments(task.comments),
    subtasks: normalizeSubtasks(task.subtasks).map(formatSubtaskForText),
    tags: normalizeTags(task.tags),
    google_status: task.googleStatus,
    startdatum: task.startdatum || null,
    faellig: task.faellig || null,
    created_at: getTaskCreatedAtValue(task),
    completed_at: task.completedAt || null,
    deleted_at: task.deletedAt || null
  };
}

function rowToTask(row) {
  return normalizeTask({
    id: row.id,
    taskCode: row.task_code,
    risiko: row.risiko,
    impact: row.impact,
    prio: row.prio,
    dependsOnTaskIds: normalizeTaskIds(row.depends_on_task_ids?.length ? row.depends_on_task_ids : row.depends_on_task_id),
    dependsOnTaskId: normalizeTaskIds(row.depends_on_task_ids?.length ? row.depends_on_task_ids : row.depends_on_task_id)[0] || "",
    task: row.task,
    beschreibung: row.beschreibung,
    comments: normalizeComments(row.comments),
    subtasks: normalizeSubtasks(row.subtasks),
    tags: normalizeTags(row.tags),
    googleStatus: row.google_status,
    startdatum: row.startdatum || "",
    faellig: row.faellig || "",
    createdAt: row.created_at || "",
    completedAt: row.completed_at || "",
    deletedAt: row.deleted_at || ""
  });
}

function isMissingTaskSubtasksTableError(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("task_subtasks") || error?.code === "42P01";
}

async function loadRemoteSubtaskRows(userId) {
  const { data, error } = await supabase
    .from("task_subtasks")
    .select("id, task_id, user_id, position, title, is_done, startdatum, faellig, updated_at")
    .eq("user_id", userId)
    .order("task_id")
    .order("position");

  if (error) {
    if (isMissingTaskSubtasksTableError(error)) return null;
    throw error;
  }

  return data || [];
}

async function saveRemoteSubtaskRows(tasks, userId) {
  const taskIds = tasks.map(task => task.id).filter(Boolean);
  if (taskIds.length === 0) return;

  const rows = tasks.flatMap(task => taskSubtasksToRows(task, userId));
  const deleteQuery = supabase
    .from("task_subtasks")
    .delete()
    .eq("user_id", userId)
    .in("task_id", taskIds);
  const { error: deleteError } = rows.length > 0
    ? await deleteQuery.not("id", "in", `(${rows.map(row => row.id).join(",")})`)
    : await deleteQuery;

  if (deleteError) {
    if (isMissingTaskSubtasksTableError(deleteError)) return;
    throw deleteError;
  }

  if (rows.length === 0) return;

  const { error: upsertError } = await supabase.from("task_subtasks").upsert(rows, { onConflict: "id" });
  if (upsertError) {
    if (isMissingTaskSubtasksTableError(upsertError)) return;
    throw upsertError;
  }
}

function loadLocalTasks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return prepareTaskList(SAMPLE_TASKS.map(normalizeTask));
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed)
      ? prepareTaskList(parsed.map(normalizeTask))
      : prepareTaskList(SAMPLE_TASKS.map(normalizeTask));
  } catch {
    return prepareTaskList(SAMPLE_TASKS.map(normalizeTask));
  }
}

function mergeRemoteAndLocalTasks(remoteTasks, localTasks) {
  const localTasksById = new Map(localTasks.map(task => [task.id, task]));
  const localTasksByCode = new Map(localTasks.map(task => [task.taskCode, task]));
  const matchedLocalIds = new Set();

  const mergedRemoteTasks = remoteTasks.map(remoteTask => {
    const localTask = localTasksById.get(remoteTask.id) || localTasksByCode.get(remoteTask.taskCode);
    if (localTask) matchedLocalIds.add(localTask.id);
    const localSubtasks = normalizeSubtasks(localTask?.subtasks);
    const localComments = normalizeComments(localTask?.comments);
    const localTags = normalizeTags(localTask?.tags);
    const localPredecessorIds = getPredecessorIds(localTask || {});
    const remotePredecessorIds = getPredecessorIds(remoteTask);
    const shouldUseLocalSubtasks = normalizeSubtasks(remoteTask.subtasks).length === 0 && localSubtasks.length > 0;
    const shouldUseLocalComments = normalizeComments(remoteTask.comments).length === 0 && localComments.length > 0;
    const shouldUseLocalTags = normalizeTags(remoteTask.tags).length === 0 && localTags.length > 0;
    const shouldUseLocalPredecessors =
      remotePredecessorIds.length <= 1 && localPredecessorIds.length > remotePredecessorIds.length;

    if (!shouldUseLocalSubtasks && !shouldUseLocalComments && !shouldUseLocalTags && !shouldUseLocalPredecessors) return remoteTask;

    const nextPredecessorIds = shouldUseLocalPredecessors ? localPredecessorIds : remotePredecessorIds;
    return {
      ...remoteTask,
      subtasks: shouldUseLocalSubtasks ? localSubtasks : remoteTask.subtasks,
      comments: shouldUseLocalComments ? localComments : remoteTask.comments,
      tags: shouldUseLocalTags ? localTags : remoteTask.tags,
      dependsOnTaskIds: nextPredecessorIds,
      dependsOnTaskId: nextPredecessorIds[0] || ""
    };
  });

  // Tasks that only exist locally (e.g. a first sync after Supabase was unreachable/misconfigured,
  // or an offline edit) must never be silently dropped just because the remote list doesn't have them yet —
  // that would also delete them server-side on the next save (see saveRemoteTasks's delete-diff).
  const localOnlyTasks = localTasks.filter(task => !matchedLocalIds.has(task.id));
  return [...mergedRemoteTasks, ...localOnlyTasks];
}

async function loadRemoteTasks(userId) {
  const [{ data, error }, subtaskRows] = await Promise.all([
    supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .order("task_code"),
    loadRemoteSubtaskRows(userId)
  ]);
  if (error) throw error;
  if (!data || data.length === 0) return [];

  const tasks = applyNormalizedSubtaskRows(data.map(rowToTask), subtaskRows);
  return prepareTaskList(tasks);
}

async function saveRemoteTasks(tasks, userId) {
  const activeTasks = pruneExpiredDeletedTasks(tasks);
  const rows = activeTasks.map(task => taskToRow(task, userId));
  const rowsWithoutMultiDepends = rows.map(({ depends_on_task_ids: _dependsOnTaskIds, ...row }) => row);
  const rowsWithoutSubtasks = rows.map(({ subtasks: _subtasks, ...row }) => row);
  const rowsWithoutCompletedAt = rows.map(({ completed_at: _completedAt, ...row }) => row);
  const rowsWithoutTags = rows.map(({ tags: _tags, ...row }) => row);
  const rowsWithoutDeletedAt = rows.map(({ deleted_at: _deletedAt, ...row }) => row);
  const rowsWithoutComments = rows.map(({ comments: _comments, ...row }) => row);
  const rowsWithoutCreatedAt = rows.map(({ created_at: _createdAt, ...row }) => row);
  const legacyRows = rows.map(({ depends_on_task_ids: _dependsOnTaskIds, subtasks: _subtasks, completed_at: _completedAt, tags: _tags, deleted_at: _deletedAt, comments: _comments, created_at: _createdAt, ...row }) => row);
  const hasSubtaskData = rows.some(row => normalizeSubtasks(row.subtasks).length > 0);
  const hasMultiPredecessorData = rows.some(row => normalizeTaskIds(row.depends_on_task_ids).length > 1);
  const hasCompletedAtData = rows.some(row => row.completed_at);
  const hasTagData = rows.some(row => normalizeTags(row.tags).length > 0);
  const hasDeletedAtData = rows.some(row => row.deleted_at);
  const hasCommentData = rows.some(row => normalizeComments(row.comments).length > 0);
  const { data: existingRows, error: selectError } = await supabase
    .from("tasks")
    .select("id")
    .eq("user_id", userId);
  if (selectError) throw selectError;

  const nextIds = new Set(activeTasks.map(task => task.id));
  const idsToDelete = (existingRows || [])
    .map(row => row.id)
    .filter(id => !nextIds.has(id));

  if (idsToDelete.length > 0) {
    const { error: deleteError } = await supabase.from("tasks").delete().in("id", idsToDelete);
    if (deleteError) throw deleteError;
  }

  if (rows.length > 0) {
    const { error: upsertError } = await supabase.from("tasks").upsert(rows);
    if (upsertError) {
      const upsertMessage = String(upsertError.message || "").toLowerCase();
      if (!hasMultiPredecessorData) {
        const { error: noMultiDependsUpsertError } = await supabase.from("tasks").upsert(rowsWithoutMultiDepends);
        if (!noMultiDependsUpsertError) return;
      }

      if (hasTagData && upsertMessage.includes("tags")) {
        throw new Error("The Supabase schema must first be extended with tags, otherwise tags would be lost.");
      }

      if (!hasTagData) {
        const { error: noTagsUpsertError } = await supabase.from("tasks").upsert(rowsWithoutTags);
        if (!noTagsUpsertError) return;
      }

      if (hasDeletedAtData) {
        throw new Error("The Supabase schema must first be extended with deleted_at, otherwise deleted tasks could not be retained for 30 days.");
      }

      const { error: noDeletedAtUpsertError } = await supabase.from("tasks").upsert(rowsWithoutDeletedAt);
      if (!noDeletedAtUpsertError) return;

      if (hasCommentData) {
        throw new Error("The Supabase schema must first be extended with comments, otherwise comments would be lost.");
      }

      const { error: noCommentsUpsertError } = await supabase.from("tasks").upsert(rowsWithoutComments);
      if (!noCommentsUpsertError) return;

      if (upsertMessage.includes("created_at")) {
        throw new Error("The Supabase schema must first be extended with created_at, otherwise newest creation dates would be lost.");
      }

      const { error: noCreatedAtUpsertError } = await supabase.from("tasks").upsert(rowsWithoutCreatedAt);
      if (!noCreatedAtUpsertError) return;

      if (hasCompletedAtData) {
        throw new Error("The Supabase schema must first be extended with completed_at, otherwise done dates would be lost.");
      }

      const { error: noCompletedAtUpsertError } = await supabase.from("tasks").upsert(rowsWithoutCompletedAt);
      if (!noCompletedAtUpsertError) return;

      if (hasSubtaskData) {
        throw new Error("The Supabase schema must first be extended with subtasks, otherwise subtasks would be lost.");
      }

      const { error: noSubtasksUpsertError } = await supabase.from("tasks").upsert(rowsWithoutSubtasks);
      if (!noSubtasksUpsertError) return;

      if (hasMultiPredecessorData) {
        throw new Error("The Supabase schema must first be extended with depends_on_task_ids, otherwise multiple predecessors would be lost.");
      }

      const { error: legacyUpsertError } = await supabase.from("tasks").upsert(legacyRows);
      if (legacyUpsertError) throw upsertError;
    }
  }

  await saveRemoteSubtaskRows(activeTasks, userId);
}

async function loadRemoteUserSettings(userId) {
  const { data, error } = await supabase
    .from("user_settings")
    .select("selected_tag_tabs, available_tags, browser_compact_view, tooltips_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    const message = String(error.message || "").toLowerCase();
    if (isMissingUserSettingsColumnError(message)) {
      const { data: legacyData, error: legacyError } = await supabase
        .from("user_settings")
        .select("selected_tag_tabs, available_tags")
        .eq("user_id", userId)
        .maybeSingle();
      if (legacyError) throw legacyError;
      if (!legacyData) return null;
      return {
        selectedTagTabs: normalizeTags(legacyData?.selected_tag_tabs, 0),
        tagCatalog: normalizeTagCatalog(legacyData?.available_tags),
        browserCompactView: null,
        tooltipsEnabled: null,
        darkModeSettings: null,
        editSectionDefaults: null,
        tabLayout: null,
        cardBadgeColumns: null,
        defaultViewModes: null,
        defaultStartTabs: null,
        kanbanColumnKeys: null,
        upcomingBadgeDefaults: null
      };
    }
    throw error;
  }
  if (!data) return null;

  const { data: tabLayoutData, error: tabLayoutError } = await supabase
    .from("user_settings")
    .select("tab_layout")
    .eq("user_id", userId)
    .maybeSingle();
  const missingTabLayoutColumn = tabLayoutError && String(tabLayoutError.message || "").toLowerCase().includes("tab_layout");
  if (tabLayoutError && !missingTabLayoutColumn) throw tabLayoutError;

  const legacyDarkMode = await loadOptionalUserSettingBoolean(userId, "dark_mode");
  const browserDarkMode = await loadOptionalUserSettingBoolean(userId, "dark_mode_browser");
  const mobileDarkMode = await loadOptionalUserSettingBoolean(userId, "dark_mode_mobile");

  const { data: editSectionDefaultsData, error: editSectionDefaultsError } = await supabase
    .from("user_settings")
    .select("edit_section_defaults")
    .eq("user_id", userId)
    .maybeSingle();
  const missingEditSectionDefaultsColumn = editSectionDefaultsError && String(editSectionDefaultsError.message || "").toLowerCase().includes("edit_section_defaults");
  if (editSectionDefaultsError && !missingEditSectionDefaultsColumn) throw editSectionDefaultsError;

  const { data: cardBadgeColumnsData, error: cardBadgeColumnsError } = await supabase
    .from("user_settings")
    .select("card_badge_columns")
    .eq("user_id", userId)
    .maybeSingle();
  const missingCardBadgeColumnsColumn = cardBadgeColumnsError && String(cardBadgeColumnsError.message || "").toLowerCase().includes("card_badge_columns");
  if (cardBadgeColumnsError && !missingCardBadgeColumnsColumn) throw cardBadgeColumnsError;

  const { data: defaultViewModeData, error: defaultViewModeError } = await supabase
    .from("user_settings")
    .select("default_view_mode")
    .eq("user_id", userId)
    .maybeSingle();
  const missingDefaultViewModeColumn = defaultViewModeError && String(defaultViewModeError.message || "").toLowerCase().includes("default_view_mode");
  if (defaultViewModeError && !missingDefaultViewModeColumn) throw defaultViewModeError;

  const { data: defaultMobileViewModeData, error: defaultMobileViewModeError } = await supabase
    .from("user_settings")
    .select("default_view_mode_mobile")
    .eq("user_id", userId)
    .maybeSingle();
  const missingDefaultMobileViewModeColumn = defaultMobileViewModeError && String(defaultMobileViewModeError.message || "").toLowerCase().includes("default_view_mode_mobile");
  if (defaultMobileViewModeError && !missingDefaultMobileViewModeColumn) throw defaultMobileViewModeError;

  const { data: defaultStartTabData, error: defaultStartTabError } = await supabase
    .from("user_settings")
    .select("default_start_tab")
    .eq("user_id", userId)
    .maybeSingle();
  const missingDefaultStartTabColumn = defaultStartTabError && String(defaultStartTabError.message || "").toLowerCase().includes("default_start_tab");
  if (defaultStartTabError && !missingDefaultStartTabColumn) throw defaultStartTabError;

  const { data: defaultMobileStartTabData, error: defaultMobileStartTabError } = await supabase
    .from("user_settings")
    .select("default_start_tab_mobile")
    .eq("user_id", userId)
    .maybeSingle();
  const missingDefaultMobileStartTabColumn = defaultMobileStartTabError && String(defaultMobileStartTabError.message || "").toLowerCase().includes("default_start_tab_mobile");
  if (defaultMobileStartTabError && !missingDefaultMobileStartTabColumn) throw defaultMobileStartTabError;

  const { data: kanbanColumnsData, error: kanbanColumnsError } = await supabase
    .from("user_settings")
    .select("kanban_columns")
    .eq("user_id", userId)
    .maybeSingle();
  const missingKanbanColumnsColumn = kanbanColumnsError && String(kanbanColumnsError.message || "").toLowerCase().includes("kanban_columns");
  if (kanbanColumnsError && !missingKanbanColumnsColumn) throw kanbanColumnsError;

  const { data: upcomingBadgeDefaultsData, error: upcomingBadgeDefaultsError } = await supabase
    .from("user_settings")
    .select("upcoming_badge_defaults")
    .eq("user_id", userId)
    .maybeSingle();
  const missingUpcomingBadgeDefaultsColumn = upcomingBadgeDefaultsError && String(upcomingBadgeDefaultsError.message || "").toLowerCase().includes("upcoming_badge_defaults");
  if (upcomingBadgeDefaultsError && !missingUpcomingBadgeDefaultsColumn) throw upcomingBadgeDefaultsError;

  return {
    selectedTagTabs: normalizeTags(data?.selected_tag_tabs, 0),
    tagCatalog: normalizeTagCatalog(data?.available_tags),
    browserCompactView: data?.browser_compact_view ?? null,
    tooltipsEnabled: data?.tooltips_enabled ?? null,
    darkModeSettings: legacyDarkMode === null && browserDarkMode === null && mobileDarkMode === null
      ? null
      : normalizeDarkModeSettings({
        browser: browserDarkMode ?? legacyDarkMode,
        mobile: mobileDarkMode ?? legacyDarkMode
      }),
    editSectionDefaults: missingEditSectionDefaultsColumn ? null : normalizeEditSectionDefaults(editSectionDefaultsData?.edit_section_defaults),
    tabLayout: missingTabLayoutColumn ? null : normalizeTabLayout(tabLayoutData?.tab_layout, normalizeTags(data?.selected_tag_tabs, 0)),
    cardBadgeColumns: missingCardBadgeColumnsColumn ? null : normalizeCardBadgeColumns(cardBadgeColumnsData?.card_badge_columns),
    defaultViewModes: missingDefaultViewModeColumn ? null : {
      browser: normalizeViewMode(defaultViewModeData?.default_view_mode),
      mobile: missingDefaultMobileViewModeColumn ? normalizeViewMode(defaultViewModeData?.default_view_mode) : normalizeViewMode(defaultMobileViewModeData?.default_view_mode_mobile)
    },
    defaultStartTabs: missingDefaultStartTabColumn ? null : {
      browser: normalizeDefaultStartTab(defaultStartTabData?.default_start_tab),
      mobile: missingDefaultMobileStartTabColumn ? normalizeDefaultStartTab(defaultStartTabData?.default_start_tab) : normalizeDefaultStartTab(defaultMobileStartTabData?.default_start_tab_mobile)
    },
    kanbanColumnKeys: missingKanbanColumnsColumn ? null : normalizeKanbanColumns(kanbanColumnsData?.kanban_columns),
    upcomingBadgeDefaults: missingUpcomingBadgeDefaultsColumn ? null : normalizeUpcomingBadgeDefaults(upcomingBadgeDefaultsData?.upcoming_badge_defaults)
  };
}

async function loadOptionalUserSettingBoolean(userId, columnName) {
  const { data, error } = await supabase
    .from("user_settings")
    .select(columnName)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    const message = String(error.message || "").toLowerCase();
    if (message.includes(columnName.toLowerCase())) return null;
    throw error;
  }
  if (!data || data[columnName] === null || typeof data[columnName] === "undefined") return null;
  return Boolean(data[columnName]);
}

function isMissingUserSettingsColumnError(message) {
  return [
    "browser_compact_view",
    "tooltips_enabled",
  ].some(columnName => message.includes(columnName));
}

async function updateOptionalUserSettingColumns(userId, values, missingColumnNames) {
  const { error } = await supabase
    .from("user_settings")
    .update(values)
    .eq("user_id", userId);
  if (!error) return;
  const message = String(error.message || "").toLowerCase();
  if (!missingColumnNames.some(columnName => message.includes(columnName))) throw error;
}

async function saveRemoteUserSettings(userId, selectedTagTabs, tagCatalog, browserCompactView, tooltipsEnabled, darkModeSettings, editSectionDefaults, tabLayout, cardBadgeColumns, defaultViewModes, defaultStartTabs, kanbanColumnKeys, upcomingBadgeDefaults) {
  const normalizedDarkModeSettings = normalizeDarkModeSettings(darkModeSettings);
  const { error } = await supabase
    .from("user_settings")
    .upsert({
      user_id: userId,
      selected_tag_tabs: normalizeTags(selectedTagTabs, 0),
      available_tags: normalizeTagCatalog(tagCatalog),
      browser_compact_view: Boolean(browserCompactView),
      tooltips_enabled: Boolean(tooltipsEnabled),
    });

  if (error) {
    const message = String(error.message || "").toLowerCase();
    if (isMissingUserSettingsColumnError(message)) {
      throw new Error("The Supabase schema must first be extended with the new user_settings columns, otherwise UI settings cannot sync across devices.");
    }
    throw error;
  }

  await updateOptionalUserSettingColumns(userId, {
    tab_layout: normalizeTabLayout(tabLayout, selectedTagTabs)
  }, ["tab_layout"]);

  await updateOptionalUserSettingColumns(userId, {
    dark_mode_browser: normalizedDarkModeSettings.browser,
    dark_mode_mobile: normalizedDarkModeSettings.mobile
  }, ["dark_mode_browser", "dark_mode_mobile"]);

  await updateOptionalUserSettingColumns(userId, {
    dark_mode: normalizedDarkModeSettings.browser
  }, ["dark_mode"]);

  await updateOptionalUserSettingColumns(userId, {
    edit_section_defaults: normalizeEditSectionDefaults(editSectionDefaults)
  }, ["edit_section_defaults"]);

  await updateOptionalUserSettingColumns(userId, {
    card_badge_columns: normalizeCardBadgeColumns(cardBadgeColumns)
  }, ["card_badge_columns"]);

  await updateOptionalUserSettingColumns(userId, {
    default_view_mode: normalizeViewMode(defaultViewModes?.browser)
  }, ["default_view_mode"]);

  await updateOptionalUserSettingColumns(userId, {
    default_view_mode_mobile: normalizeViewMode(defaultViewModes?.mobile)
  }, ["default_view_mode_mobile"]);

  await updateOptionalUserSettingColumns(userId, {
    default_start_tab: normalizeDefaultStartTab(defaultStartTabs?.browser)
  }, ["default_start_tab"]);

  await updateOptionalUserSettingColumns(userId, {
    default_start_tab_mobile: normalizeDefaultStartTab(defaultStartTabs?.mobile)
  }, ["default_start_tab_mobile"]);

  await updateOptionalUserSettingColumns(userId, {
    kanban_columns: normalizeKanbanColumns(kanbanColumnKeys)
  }, ["kanban_columns"]);

  await updateOptionalUserSettingColumns(userId, {
    upcoming_badge_defaults: normalizeUpcomingBadgeDefaults(upcomingBadgeDefaults)
  }, ["upcoming_badge_defaults"]);
}

function isMissingAllowedUsersTableError(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("allowed_users") || error?.code === "42P01";
}

async function loadAllowedUserEmails() {
  const { data, error } = await supabase
    .from("allowed_users")
    .select("email")
    .order("email");

  if (error) {
    if (isMissingAllowedUsersTableError(error)) return { emails: [ALLOWED_USER_EMAIL], missingSchema: true };
    throw error;
  }

  return { emails: normalizeEmails([ALLOWED_USER_EMAIL, ...(data || []).map(row => row.email)]), missingSchema: false };
}

async function addAllowedUserEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;

  const { error } = await supabase
    .from("allowed_users")
    .upsert({ email: normalizedEmail });

  if (error) throw error;
}

async function removeAllowedUserEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || normalizedEmail === ALLOWED_USER_EMAIL) return;

  const { error } = await supabase
    .from("allowed_users")
    .delete()
    .eq("email", normalizedEmail);

  if (error) throw error;
}

function loadBrowserCompactView() {
  try {
    const saved = localStorage.getItem(BROWSER_COMPACT_VIEW_STORAGE_KEY);
    return saved === null ? true : saved === "true";
  } catch {
    return true;
  }
}

function loadTooltipsEnabled() {
  try {
    const saved = localStorage.getItem(TOOLTIP_ENABLED_STORAGE_KEY);
    return saved === null ? true : saved === "true";
  } catch {
    return true;
  }
}

function loadDarkModeSettings() {
  try {
    const legacyDarkMode = localStorage.getItem(DARK_MODE_STORAGE_KEY) === "true";
    const browserValue = localStorage.getItem(DARK_MODE_BROWSER_STORAGE_KEY);
    const mobileValue = localStorage.getItem(DARK_MODE_MOBILE_STORAGE_KEY);
    return {
      browser: browserValue === null ? legacyDarkMode : browserValue === "true",
      mobile: mobileValue === null ? legacyDarkMode : mobileValue === "true"
    };
  } catch {
    return { browser: false, mobile: false };
  }
}

function isMobileViewportNow() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(max-width: 760px)").matches;
}

function isKanbanMobileViewportNow() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(max-width: 760px), (max-width: 900px) and (orientation: landscape)").matches;
}

function loadEditSectionDefaults() {
  try {
    return normalizeEditSectionDefaults(JSON.parse(localStorage.getItem(EDIT_SECTION_DEFAULTS_STORAGE_KEY) || "{}"));
  } catch {
    return { ...DEFAULT_EDIT_SECTION_DEFAULTS };
  }
}


function loadKanbanColumnKeys() {
  try {
    return migrateKanbanColumnKeys(JSON.parse(localStorage.getItem(KANBAN_COLUMNS_STORAGE_KEY) || "[]"));
  } catch {
    return [...DEFAULT_KANBAN_COLUMN_KEYS];
  }
}

function saveKanbanColumnKeys(value) {
  try {
    localStorage.setItem(KANBAN_COLUMNS_STORAGE_KEY, JSON.stringify(normalizeKanbanColumns(value)));
  } catch {
    // Local UI preference only.
  }
}
function hasDefaultViewModePreference() {
  try {
    return localStorage.getItem(DEFAULT_VIEW_MODE_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}
function loadDefaultViewModes() {
  try {
    return {
      browser: normalizeViewMode(localStorage.getItem(DEFAULT_VIEW_MODE_STORAGE_KEY)),
      mobile: normalizeViewMode(localStorage.getItem(DEFAULT_MOBILE_VIEW_MODE_STORAGE_KEY))
    };
  } catch {
    return { browser: DEFAULT_VIEW_MODE, mobile: DEFAULT_VIEW_MODE };
  }
}

function saveDefaultViewModes(value) {
  const browser = normalizeViewMode(value?.browser);
  const mobile = normalizeViewMode(value?.mobile);
  try {
    localStorage.setItem(DEFAULT_VIEW_MODE_STORAGE_KEY, browser);
    localStorage.setItem(DEFAULT_MOBILE_VIEW_MODE_STORAGE_KEY, mobile);
  } catch {
    // Local UI preference only.
  }
}

function loadDefaultStartTabs() {
  try {
    return {
      browser: normalizeDefaultStartTab(localStorage.getItem(DEFAULT_START_TAB_STORAGE_KEY)),
      mobile: normalizeDefaultStartTab(localStorage.getItem(DEFAULT_MOBILE_START_TAB_STORAGE_KEY))
    };
  } catch {
    return { browser: DEFAULT_START_TAB, mobile: DEFAULT_START_TAB };
  }
}

function saveDefaultStartTabs(value) {
  const browser = normalizeDefaultStartTab(value?.browser);
  const mobile = normalizeDefaultStartTab(value?.mobile);
  try {
    localStorage.setItem(DEFAULT_START_TAB_STORAGE_KEY, browser);
    localStorage.setItem(DEFAULT_MOBILE_START_TAB_STORAGE_KEY, mobile);
  } catch {
    // Local UI preference only.
  }
}

function createDefaultSessionViewSnapshot(isMobile, defaultViewModes, defaultStartTabs) {
  const defaultTab = normalizeDefaultStartTab(isMobile ? defaultStartTabs.mobile : defaultStartTabs.browser);
  return {
    activeAppTab: defaultTab,
    activeTagScope: "all",
    columnFilters: getDefaultColumnFilters(defaultTab),
    isKanbanView: normalizeViewMode(isMobile ? defaultViewModes.mobile : defaultViewModes.browser) === "kanban"
  };
}

function normalizeSessionViewSnapshot(value, fallback) {
  const parsed = typeof value === "string" ? safeJsonParse(value, null) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fallback;
  const allowedTabs = new Set(["capture", ...LIST_TABS, DELETED_TAB]);
  const activeAppTab = allowedTabs.has(parsed.activeAppTab) ? parsed.activeAppTab : fallback.activeAppTab;
  const activeTagScope = normalizeText(parsed.activeTagScope) || "all";
  return {
    activeAppTab,
    activeTagScope,
    columnFilters: normalizeColumnFilters(parsed.columnFilters, activeAppTab),
    isKanbanView: typeof parsed.isKanbanView === "boolean" ? parsed.isKanbanView : Boolean(fallback.isKanbanView)
  };
}

function loadSessionViewSnapshot(fallback) {
  try {
    return normalizeSessionViewSnapshot(sessionStorage.getItem(SESSION_VIEW_STORAGE_KEY), fallback);
  } catch {
    return fallback;
  }
}

function saveSessionViewSnapshot(snapshot) {
  try {
    sessionStorage.setItem(SESSION_VIEW_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Session-only UI state.
  }
}

function loadCardBadgeColumns() {
  try {
    return normalizeCardBadgeColumns(JSON.parse(localStorage.getItem(CARD_BADGE_COLUMNS_STORAGE_KEY) || "{}"));
  } catch {
    return { ...DEFAULT_CARD_BADGE_COLUMNS };
  }
}

function saveCardBadgeColumns(value) {
  try {
    localStorage.setItem(CARD_BADGE_COLUMNS_STORAGE_KEY, JSON.stringify(normalizeCardBadgeColumns(value)));
  } catch {
    // Local UI preference only.
  }
}
function loadUpcomingBadgeDefaults() {
  try {
    return normalizeUpcomingBadgeDefaults(JSON.parse(localStorage.getItem(UPCOMING_BADGE_DEFAULTS_STORAGE_KEY) || "{}"));
  } catch {
    return { ...DEFAULT_UPCOMING_BADGE_DEFAULTS };
  }
}

function saveUpcomingBadgeDefaults(value) {
  try {
    localStorage.setItem(UPCOMING_BADGE_DEFAULTS_STORAGE_KEY, JSON.stringify(normalizeUpcomingBadgeDefaults(value)));
  } catch {
    // Local UI preference only.
  }
}
function loadSelectedTagTabs() {
  try {
    return normalizeTags(JSON.parse(localStorage.getItem(SELECTED_TAG_TABS_STORAGE_KEY) || "[]"), 0);
  } catch {
    return [];
  }
}

function loadTagCatalog() {
  try {
    return normalizeTagCatalog(JSON.parse(localStorage.getItem(TAG_CATALOG_STORAGE_KEY) || "[]"));
  } catch {
    return [];
  }
}

function loadTabLayout() {
  try {
    const layout = JSON.parse(localStorage.getItem(TAB_LAYOUT_STORAGE_KEY) || "[]");
    return Array.isArray(layout) ? layout : getDefaultTabLayout();
  } catch {
    return getDefaultTabLayout();
  }
}

function saveTabLayout(layout, tags = []) {
  try {
    localStorage.setItem(TAB_LAYOUT_STORAGE_KEY, JSON.stringify(normalizeTabLayout(layout, tags)));
  } catch {
    // Local UI preference only.
  }
}

function saveSelectedTagTabs(tags) {
  try {
    localStorage.setItem(SELECTED_TAG_TABS_STORAGE_KEY, JSON.stringify(normalizeTags(tags, 0)));
  } catch {
    // Local UI preference only.
  }
}

function saveTagCatalog(tags) {
  try {
    localStorage.setItem(TAG_CATALOG_STORAGE_KEY, JSON.stringify(normalizeTagCatalog(tags)));
  } catch {
    // Local UI preference only.
  }
}

function saveLocalTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pruneExpiredDeletedTasks(tasks)));
}

function saveBrowserCompactView(isCompact) {
  try {
    localStorage.setItem(BROWSER_COMPACT_VIEW_STORAGE_KEY, isCompact ? "true" : "false");
  } catch {
    // Local UI preference only.
  }
}

function saveTooltipsEnabled(isEnabled) {
  try {
    localStorage.setItem(TOOLTIP_ENABLED_STORAGE_KEY, isEnabled ? "true" : "false");
  } catch {
    // Local UI preference only.
  }
}

function saveDarkModeSettings(settings) {
  const normalized = normalizeDarkModeSettings(settings);
  try {
    localStorage.setItem(DARK_MODE_BROWSER_STORAGE_KEY, normalized.browser ? "true" : "false");
    localStorage.setItem(DARK_MODE_MOBILE_STORAGE_KEY, normalized.mobile ? "true" : "false");
    localStorage.setItem(DARK_MODE_STORAGE_KEY, normalized.browser ? "true" : "false");
  } catch {
    // Local UI preference only.
  }
}

function saveEditSectionDefaults(defaults) {
  try {
    localStorage.setItem(EDIT_SECTION_DEFAULTS_STORAGE_KEY, JSON.stringify(normalizeEditSectionDefaults(defaults)));
  } catch {
    // Local UI preference only.
  }
}


function readOAuthCallbackTokens() {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");

  if (!accessToken || !refreshToken) return null;

  return {
    access_token: accessToken,
    refresh_token: refreshToken
  };
}

function readOAuthCallbackError() {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const hashParams = new URLSearchParams(hash);
  const searchParams = new URLSearchParams(window.location.search);
  const errorDescription = hashParams.get("error_description") || searchParams.get("error_description");
  const error = hashParams.get("error") || searchParams.get("error");

  return errorDescription || error || "";
}

function getFriendlyAuthMessage(message) {
  const normalizedMessage = normalizeText(message).toLowerCase();
  if (
    normalizedMessage.includes("nicht freigegeben") ||
    normalizedMessage.includes("not allowed") ||
    normalizedMessage.includes("allowed_users") ||
    normalizedMessage.includes("hook")
  ) {
    return "Nicht freigeschaltet.";
  }
  return message;
}

function clearOAuthCallbackFromUrl() {
  const url = new URL(window.location.href);
  const authParams = ["access_token", "refresh_token", "expires_at", "expires_in", "token_type", "type", "error", "error_code", "error_description"];
  let changed = false;

  authParams.forEach(param => {
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param);
      changed = true;
    }
  });

  if (url.hash) {
    url.hash = "";
    changed = true;
  }

  if (changed) {
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
  }
}

function readTaskDeepLinkParam() {
  const params = new URLSearchParams(window.location.search);
  return normalizeText(params.get("task-id") || params.get("taskId") || "");
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeEmails(values) {
  const list = Array.isArray(values) ? values : [values];
  return Array.from(new Set(list.map(normalizeEmail).filter(Boolean)));
}

function isAdminUser(user) {
  return normalizeEmail(user?.email) === ALLOWED_USER_EMAIL;
}

function isAllowedUser(user, allowedEmails = [ALLOWED_USER_EMAIL]) {
  const email = normalizeEmail(user?.email);
  if (!email) return false;
  return email === ALLOWED_USER_EMAIL || normalizeEmails(allowedEmails).includes(email);
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

function ensureElementVisible(element, container = null, margin = 8) {
  if (!element) return;
  const scrollContainer = container || document.scrollingElement || document.documentElement;
  const containerRect = container
    ? container.getBoundingClientRect()
    : { top: 0, bottom: window.innerHeight };
  const elementRect = element.getBoundingClientRect();

  if (elementRect.top < containerRect.top + margin) {
    scrollContainer.scrollTop -= containerRect.top + margin - elementRect.top;
  } else if (elementRect.bottom > containerRect.bottom - margin) {
    scrollContainer.scrollTop += elementRect.bottom - (containerRect.bottom - margin);
  }
}

function formatDateTime(value) {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) return "";
  const date = new Date(normalizedValue);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function normalizeComment(value) {
  if (value && typeof value === "object") {
    const text = truncateText(normalizeText(value.text ?? value.comment ?? value.value ?? ""), TEXT_LIMITS.comment.max);
    if (!text) return null;
    const createdAt = normalizeText(value.createdAt ?? value.created_at) || new Date().toISOString();
    const updatedAt = normalizeText(value.updatedAt ?? value.updated_at);
    return {
      id: normalizeText(value.id) || crypto.randomUUID(),
      text,
      createdAt,
      updatedAt: updatedAt && updatedAt !== createdAt ? updatedAt : ""
    };
  }

  const text = truncateText(normalizeText(value), TEXT_LIMITS.comment.max);
  if (!text) return null;
  return {
    id: crypto.randomUUID(),
    text,
    createdAt: new Date().toISOString(),
    updatedAt: ""
  };
}

function normalizeComments(values) {
  if (typeof values === "string" && values.trim().startsWith("[")) {
    try {
      return normalizeComments(JSON.parse(values));
    } catch {
      return [];
    }
  }
  const list = Array.isArray(values) ? values : values ? [values] : [];
  return list
    .map(normalizeComment)
    .filter(Boolean)
    .sort((first, second) => new Date(second.createdAt || 0).getTime() - new Date(first.createdAt || 0).getTime());
}

function getTaskCommentText(task) {
  return normalizeComments(task.comments)
    .map(comment => `${comment.text} (${formatDateTime(comment.updatedAt || comment.createdAt)})`)
    .join(" | ");
}

function getTaskShareText(task) {
  const subtasks = normalizeSubtasks(task.subtasks);
  const comments = normalizeComments(task.comments);
  return [
    `${task.taskCode}: ${task.task}`,
    normalizeText(task.beschreibung) ? `Description: ${task.beschreibung}` : "",
    comments.length > 0 ? `Comments: ${comments.map(comment => comment.text).join("; ")}` : "",
    subtasks.length > 0 ? `Subtasks: ${subtasks.map(formatSubtaskForDisplay).join("; ")}` : "",
    normalizeTags(task.tags).length > 0 ? `Tags: ${normalizeTags(task.tags).map(tag => `#${tag}`).join(", ")}` : "",
    `Prio: ${getDisplayValue(getEffectivePrio(task.prio))}`,
    `Status: ${getDisplayValue(getDisplayStatus(task))}`,
    task.faellig ? `Due: ${formatDate(task.faellig)}` : "",
    task.completedAt ? `Done on: ${formatDate(task.completedAt)}` : ""
  ].filter(Boolean).join("\n");
}

function getTaskShareUrl(task) {
  const url = new URL(`${window.location.origin}${window.location.pathname}`);
  url.searchParams.set("task-id", task.taskCode || task.id);
  return url.toString();
}

function getTaskSharePayloadText(task) {
  return `${getTaskShareText(task)}\n${getTaskShareUrl(task)}`;
}

function resizeTextareaToContent(textarea, maxRows = 4) {
  if (!textarea) return;
  const style = window.getComputedStyle(textarea);
  const lineHeight = Number.parseFloat(style.lineHeight) || 18;
  const paddingTop = Number.parseFloat(style.paddingTop) || 0;
  const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
  const borderTop = Number.parseFloat(style.borderTopWidth) || 0;
  const borderBottom = Number.parseFloat(style.borderBottomWidth) || 0;
  const maxHeight = Math.ceil((lineHeight * maxRows) + paddingTop + paddingBottom + borderTop + borderBottom);
  textarea.style.height = "auto";
  const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
  textarea.style.height = `${nextHeight}px`;
  textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
}

const AutoGrowTextarea = forwardRef(function AutoGrowTextarea({ className = "", maxRows = 4, onInput, value, ...props }, forwardedRef) {
  const localRef = useRef(null);
  const setTextareaRef = useCallback(node => {
    localRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }, [forwardedRef]);

  useLayoutEffect(() => {
    resizeTextareaToContent(localRef.current, maxRows);
  }, [value, maxRows]);

  return (
    <textarea
      {...props}
      ref={setTextareaRef}
      className={["autoGrowTextarea", className].filter(Boolean).join(" ")}
      value={value}
      rows={1}
      onInput={event => {
        resizeTextareaToContent(event.currentTarget, maxRows);
        onInput?.(event);
      }}
    />
  );
});
function parseDescriptionBlocks(value) {
  const lines = String(value || "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let paragraphLines = [];
  let bulletItems = [];

  function flushParagraph() {
    if (paragraphLines.length === 0) return;
    blocks.push({ type: "paragraph", text: paragraphLines.join("\n") });
    paragraphLines = [];
  }

  function flushBullets() {
    if (bulletItems.length === 0) return;
    blocks.push({ type: "bullets", items: bulletItems });
    bulletItems = [];
  }

  lines.forEach(line => {
    const trimmed = line.trim();
    const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);

    if (!trimmed) {
      flushParagraph();
      flushBullets();
      return;
    }

    if (bulletMatch) {
      flushParagraph();
      bulletItems.push(bulletMatch[1]);
      return;
    }

    flushBullets();
    paragraphLines.push(line);
  });

  flushParagraph();
  flushBullets();
  return blocks;
}

function getDescriptionLinkHref(value) {
  const text = String(value || "");
  return text.toLowerCase().startsWith("www.") ? `https://${text}` : text;
}

function renderDescriptionText(text) {
  const parts = String(text || "").split(/((?:https?:\/\/|www\.)[^\s<>"']+)/gi);
  return parts.map((part, index) => {
    if (!part) return null;
    if (!/^(?:https?:\/\/|www\.)/i.test(part)) return part;

    const trailingMatch = part.match(/[),.;:!?]+$/);
    const trailing = trailingMatch?.[0] || "";
    const urlText = trailing ? part.slice(0, -trailing.length) : part;
    if (!urlText) return part;

    return (
      <Fragment key={`description-link-${index}`}>
        <a href={getDescriptionLinkHref(urlText)} target="_blank" rel="noreferrer">
          {urlText}
        </a>
        {trailing}
      </Fragment>
    );
  });
}

function DescriptionBlock({ text }) {
  const blocks = parseDescriptionBlocks(text);
  if (blocks.length === 0) return null;

  return (
    <div className="descriptionBlock">
      {blocks.map((block, blockIndex) =>
        block.type === "bullets" ? (
          <ul key={`description-bullets-${blockIndex}`}>
            {block.items.map((item, itemIndex) => (
              <li key={`description-bullet-${blockIndex}-${itemIndex}`}>{renderDescriptionText(item)}</li>
            ))}
          </ul>
        ) : (
          <p key={`description-paragraph-${blockIndex}`}>{renderDescriptionText(block.text)}</p>
        )
      )}
    </div>
  );
}

function DescriptionPreview({ text }) {
  const [isOpen, setIsOpen] = useState(false);
  const popupRef = useRef(null);
  const triggerRef = useRef(null);
  const normalizedText = normalizeText(text);
  const isTruncated = normalizedText.length > DESCRIPTION_PREVIEW_LIMIT;
  const previewText = isTruncated
    ? normalizedText.slice(0, DESCRIPTION_PREVIEW_LIMIT).trimEnd()
    : normalizedText;

  useCloseOnOutsidePointer(isOpen, [popupRef, triggerRef], () => setIsOpen(false));

  useEffect(() => {
    if (!isOpen) return undefined;

    function closeOnEscape(event) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  if (!normalizedText) return null;

  return (
    <div className="descriptionPreview">
      <DescriptionBlock text={previewText} />
      {isTruncated && (
        <button
          ref={triggerRef}
          type="button"
          className="descriptionMoreButton"
          onClick={() => setIsOpen(current => !current)}
          aria-expanded={isOpen}
          title="Show full description"
        >
          ...
        </button>
      )}
      {isOpen && (
        <div ref={popupRef} className="descriptionPreviewPopup" role="dialog" aria-label="Full description">
          <header>
            <strong>Description</strong>
            <button type="button" className="iconButton" onClick={() => setIsOpen(false)} title="Close">
              <X size={16} />
            </button>
          </header>
          <DescriptionBlock text={normalizedText} />
        </div>
      )}
    </div>
  );
}

function DisketteIcon({ size = 16 }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 3h12l2 2v16H5z" />
      <path d="M8 3v6h8V3" />
      <path d="M8 21v-7h8v7" />
      <path d="M10 17h4" />
    </svg>
  );
}

function SortToggle({ value, onChange, ariaLabel = "Sorting" }) {
  const Icon = value === "Aufsteigend" ? ArrowUp : value === "Absteigend" ? ArrowDown : ArrowUpDown;
  const nextValue = value === "Standard" ? "Aufsteigend" : value === "Aufsteigend" ? "Absteigend" : "Standard";
  const title =
    value === "Aufsteigend"
      ? `${ariaLabel}: aufsteigend`
      : value === "Absteigend"
        ? `${ariaLabel}: absteigend`
        : `${ariaLabel}: Standard`;

  return (
    <button
      type="button"
      className={`sortToggle ${value !== "Standard" ? "active" : ""}`}
      onClick={() => onChange(nextValue)}
      aria-label={title}
      title={title}
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  );
}

function FilterSortField({ label, sortValue, onSortChange, sortAriaLabel, children }) {
  return (
    <label className="filterSortField">
      <span>{label}</span>
      <div className="filterSortControls">
        {children}
        <SortToggle value={sortValue} onChange={onSortChange} ariaLabel={sortAriaLabel || `Sort ${label}`} />
      </div>
    </label>
  );
}

function LocalUnsavedChangesPrompt({ message, onDiscard, onSave }) {
  return (
    <div className="modalBackdrop saveChangesBackdrop" role="presentation" data-edit-exit-prompt="true" onMouseDown={event => event.stopPropagation()}>
      <section className="confirmModal" role="dialog" aria-modal="true" aria-labelledby="local-save-prompt-title">
        <header className="popupHeader">
          <h2 id="local-save-prompt-title">Save changes?</h2>
        </header>
        <p>{message}</p>
        <div className="confirmActions">
          <button type="button" className="secondaryButton" onClick={onDiscard}>Discard</button>
          <button type="button" className="primaryButton" onClick={onSave}>Save</button>
        </div>
      </section>
    </div>
  );
}
function DescriptionEditor({ value, onSave, draftKey = "", onLocalDraftChange = null }) {
  const [draftValue, setDraftValue] = useState(value || "");
  const [isDiscardPromptOpen, setIsDiscardPromptOpen] = useState(false);
  const hasUnsavedDescriptionChanges = String(draftValue || "") !== String(value || "");

  useEffect(() => {
    setDraftValue(value || "");
    setIsDiscardPromptOpen(false);
  }, [value]);

  function updateDraftValue(nextValue) {
    setDraftValue(nextValue);
  }

  function discardDescriptionChanges() {
    setDraftValue(value || "");
    setIsDiscardPromptOpen(false);
  }

  function requestDiscardDescriptionChanges() {
    if (!hasUnsavedDescriptionChanges) return;
    setIsDiscardPromptOpen(true);
  }

  function saveDescription() {
    const didSave = onSave?.(draftValue) !== false;
    if (didSave) setIsDiscardPromptOpen(false);
    return didSave;
  }

  useEffect(() => {
    if (!draftKey || !onLocalDraftChange) return undefined;
    onLocalDraftChange(draftKey, hasUnsavedDescriptionChanges ? {
      hasChanges: true,
      save: saveDescription,
      discard: discardDescriptionChanges
    } : null);
    return () => onLocalDraftChange(draftKey, null);
  }, [draftKey, hasUnsavedDescriptionChanges, draftValue, value, onLocalDraftChange]);

  return (
    <div className="descriptionEditor descriptionInlineItem">
      <AutoGrowTextarea
        className="descriptionEditorTextarea"
        value={draftValue}
        onChange={event => updateDraftValue(truncateText(event.target.value, TEXT_LIMITS.description.max))}
        maxRows={10}
        maxLength={TEXT_LIMITS.description.max}
        placeholder="Write a new description"
        title="Edit description"
      />
      <InputGuidance value={draftValue} limits={TEXT_LIMITS.description} label="Description" />
      <button
        type="button"
        className={`iconButton saveEditButton ${hasUnsavedDescriptionChanges ? "hasChanges" : ""}`}
        onClick={saveDescription}
        disabled={!hasUnsavedDescriptionChanges}
        title={hasUnsavedDescriptionChanges ? "Save description" : "No unsaved description changes"}
      >
        <DisketteIcon size={16} />
      </button>
      <button
        type="button"
        className="iconButton danger"
        onClick={requestDiscardDescriptionChanges}
        disabled={!hasUnsavedDescriptionChanges}
        title={hasUnsavedDescriptionChanges ? "Discard description changes" : "No unsaved description changes"}
      >
        <X size={16} />
      </button>
      {isDiscardPromptOpen && (
        <LocalUnsavedChangesPrompt
          message="This description has unsaved changes."
          onDiscard={discardDescriptionChanges}
          onSave={saveDescription}
        />
      )}
    </div>
  );
}
function includesFilter(value, filter) {
  const normalizedFilter = String(filter || "").trim().toLowerCase();
  if (!normalizedFilter) return true;
  return String(value || "").toLowerCase().includes(normalizedFilter);
}

function applyCriteriaChange(task, field, value) {
  const nextValue = normalizeEditableFieldValue(field, value);
  const wasStarted = task?.googleStatus === "Gestartet";
  const next = field === "googleStatus" && value === "Gelöscht"
    ? { ...task, googleStatus: task.googleStatus === "Erledigt" ? "Erledigt" : "Offen", deletedAt: normalizeDateValue(task.deletedAt) || getTodayDateValue() }
    : { ...task, [field]: nextValue };

  if (field === "googleStatus") {
    if (value !== "Gelöscht") next.deletedAt = "";
    next.completedAt = value === "Erledigt" ? normalizeDateValue(next.completedAt) || getTodayDateValue() : "";
  }

  if (field === "risiko" || field === "impact") {
    next.prio = derivePrio(next.risiko, next.impact);
  }

  if (next.googleStatus === "Gestartet" && !wasStarted && !normalizeDateValue(next.startdatum)) {
    next.startdatum = getTodayDateValue();
  }

  return next;
}

function getTaskOptions(tasks, excludedTaskId = "") {
  return sortTasks(tasks)
    .filter(task => task.id !== excludedTaskId && !isDone(task) && !isDeleted(task) && normalizeText(task.task))
    .map(task => ({ id: task.id, label: `${task.taskCode}: ${task.task}` }));
}

function getDependencyTask(taskId, tasks) {
  if (!taskId) return null;
  return tasks.find(task => task.id === taskId) || null;
}

function getDependencyTasks(taskIds, tasksById) {
  return normalizeTaskIds(taskIds).map(taskId => tasksById.get(taskId)).filter(Boolean);
}

function getTaskRelation(task, childIdsByParent, tasksById) {
  const predecessorIds = getPredecessorIds(task);
  const childIds = childIdsByParent.get(task.id) || [];
  const parentTasks = predecessorIds.map(id => tasksById.get(id)).filter(task => task && !isDone(task) && !isDeleted(task));
  const parentTask = parentTasks[0] || null;
  const childTasks = childIds.map(id => tasksById.get(id)).filter(task => task && !isDone(task) && !isDeleted(task));
  const hasParent = parentTasks.length > 0;
  const hasChildren = childTasks.length > 0;
  const parentTargets = parentTasks.map(parent => ({
    id: parent.id,
    code: parent.taskCode,
    title: parent.task,
    type: "Blockiert durch"
  }));
  const childTargets = childTasks.map(childTask => ({
    id: childTask.id,
    code: childTask.taskCode,
    title: childTask.task,
    type: "Blockiert"
  }));

  if (hasParent && hasChildren) {
    return {
      symbol: "↕",
      label: `Blockiert durch ${parentTargets.length}, blockiert ${childTargets.length}`,
      targetId: parentTask?.id || "",
      targetCode: parentTask?.taskCode || "",
      targets: [...parentTargets, ...childTargets]
    };
  }

  if (hasParent) {
    return {
      symbol: "↑",
      label: parentTargets.length === 1 ? `Blockiert durch ${parentTask.taskCode}` : `Blockiert durch ${parentTargets.length} Tasks`,
      targetId: parentTask?.id || "",
      targetCode: parentTask?.taskCode || "",
      targets: parentTargets
    };
  }

  if (hasChildren) {
    const firstChildTask = childTasks[0];
    return {
      symbol: "↓",
      label: childTargets.length === 1 && firstChildTask ? `Blockiert ${firstChildTask.taskCode}` : `Blockiert ${childTargets.length} Tasks`,
      targetId: childIds[0],
      targetCode: firstChildTask?.taskCode || "",
      targets: childTargets
    };
  }

  return null;
}

function getOpenPredecessorTasks(task, tasksById) {
  return getPredecessorIds(task)
    .map(taskId => tasksById.get(taskId))
    .filter(predecessor => predecessor && !isDone(predecessor) && !isDeleted(predecessor));
}

function getPredecessorCompletionBlockMessage(task, tasksById) {
  const openPredecessors = getOpenPredecessorTasks(task, tasksById);
  if (openPredecessors.length === 0) return "";

  const predecessorCodes = openPredecessors.map(predecessor => predecessor.taskCode).filter(Boolean).join(", ");
  return `Task can only be completed after these predecessors are done: ${predecessorCodes}`;
}

function getSubtaskCompletionBlockMessage(task) {
  return hasOpenSubtasks(task) ? "Task can only be completed after all subtasks are done." : "";
}

function getSubtaskDateValidationMessage(task) {
  const parentStartTime = getDateDayTime(task.startdatum);
  const parentDueTime = getDateDayTime(task.faellig);
  const invalidMessages = [];

  normalizeSubtasks(task.subtasks).forEach((subtask, index) => {
    const label = `Subtask ${index + 1}`;
    const subtaskStartTime = getDateDayTime(subtask.startdatum);
    const subtaskDueTime = getDateDayTime(subtask.faellig);

    if (subtaskStartTime !== null && subtaskDueTime !== null && subtaskDueTime < subtaskStartTime) {
      invalidMessages.push(`${label}: Due date is before the start date`);
    }

    if (parentStartTime !== null && subtaskStartTime !== null && subtaskStartTime < parentStartTime) {
      invalidMessages.push(`${label}: Start date is before the task start date`);
    }

    if (parentDueTime !== null && subtaskDueTime !== null && subtaskDueTime > parentDueTime) {
      invalidMessages.push(`${label}: Due date is after the task due date`);
    }
  });

  return invalidMessages.length > 0
    ? `Subtask dates do not fit the parent task: ${invalidMessages.join("; ")}.`
    : "";
}

function getRelationTargets(taskIds, tasksById, type) {
  return taskIds
    .map(taskId => tasksById.get(taskId))
    .filter(task => task && !isDone(task) && !isDeleted(task))
    .map(task => ({ id: task.id, code: task.taskCode, title: task.task, type }));
}

function addPredecessorIds(task, ids) {
  const nextIds = normalizeTaskIds([...getPredecessorIds(task), ...ids]);
  return { ...task, dependsOnTaskIds: nextIds, dependsOnTaskId: nextIds[0] || "" };
}

function removePredecessorId(task, id) {
  const nextIds = getPredecessorIds(task).filter(taskId => taskId !== id);
  return { ...task, dependsOnTaskIds: nextIds, dependsOnTaskId: nextIds[0] || "" };
}

function updateSubtaskAt(subtasks, index, value) {
  return subtasks.map((subtask, subtaskIndex) => subtaskIndex === index ? value : subtask);
}

function removeSubtaskAt(subtasks, index) {
  return subtasks.filter((_, subtaskIndex) => subtaskIndex !== index);
}

function moveSubtask(subtasks, fromIndex, toIndex) {
  const nextSubtasks = [...subtasks];
  const [movedSubtask] = nextSubtasks.splice(fromIndex, 1);
  nextSubtasks.splice(toIndex, 0, movedSubtask);
  return nextSubtasks;
}

function updateCommentAt(comments, id, value) {
  return normalizeComments(comments).map(comment => comment.id === id ? value : comment);
}

function removeCommentAt(comments, id) {
  return normalizeComments(comments).filter(comment => comment.id !== id);
}

function getEditableTaskSnapshot(task) {
  if (!task) return null;
  return {
    risiko: task.risiko,
    impact: task.impact,
    prio: task.prio,
    task: normalizeText(task.task),
    beschreibung: normalizeText(task.beschreibung),
    comments: normalizeComments(task.comments),
    subtasks: normalizeSubtasks(task.subtasks),
    tags: normalizeTags(task.tags),
    dependsOnTaskIds: normalizeTaskIds(task.dependsOnTaskIds),
    successorTaskIds: normalizeTaskIds(task.successorTaskIds),
    googleStatus: task.googleStatus,
    startdatum: normalizeDateValue(task.startdatum),
    faellig: normalizeDateValue(task.faellig),
    completedAt: normalizeDateValue(task.completedAt),
    deletedAt: normalizeDateValue(task.deletedAt)
  };
}

function isSameEditableTask(firstTask, secondTask) {
  return JSON.stringify(getEditableTaskSnapshot(firstTask)) === JSON.stringify(getEditableTaskSnapshot(secondTask));
}

function useCloseOnOutsidePointer(isOpen, refs, onClose) {
  useEffect(() => {
    if (!isOpen) return undefined;

    function closeOnOutsidePointer(event) {
      if (refs.some(ref => ref.current?.contains(event.target))) return;
      onClose(event);
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
  }, [isOpen, refs, onClose]);
}

function isInsideEditExitPrompt(event) {
  return event?.target instanceof Element && Boolean(event.target.closest("[data-edit-exit-prompt='true']"));
}

function downloadFile(filename, type, content) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function createTaskBackup(tasks) {
  return {
    format: "task-001-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks: sortTasks(tasks)
  };
}

function readTasksFromImportPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload?.format === "task-001-backup" && Array.isArray(payload.tasks)) return payload.tasks;
  if (Array.isArray(payload?.tasks)) return payload.tasks;
  return null;
}

function escapeCsvValue(value) {
  const text = String(value ?? "");
  return /[",\r\n;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function tasksToCsv(tasks) {
  const sortedTasks = sortTasks(tasks);
  const rows = sortedTasks.map(task => {
    const dependencyTasks = getPredecessorIds(task).map(taskId => getDependencyTask(taskId, tasks)).filter(Boolean);
    const row = {
      ...task,
      comments: JSON.stringify(normalizeComments(task.comments)),
      subtasks: normalizeSubtasks(task.subtasks).map(formatSubtaskForText).join("|"),
      tags: normalizeTags(task.tags).join("|"),
      dependsOnTaskCode: dependencyTasks[0]?.taskCode || "",
      dependsOnTaskCodes: dependencyTasks.map(dependencyTask => dependencyTask.taskCode).join("|")
    };

    return CSV_COLUMNS.map(column => escapeCsvValue(row[column])).join(",");
  });

  return [CSV_COLUMNS.join(","), ...rows].join("\r\n");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let isQuoted = false;
  const delimiter = text.split(/\r?\n/, 1)[0]?.includes(";") ? ";" : ",";

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (isQuoted && nextChar === '"') {
        value += '"';
        index += 1;
      } else {
        isQuoted = !isQuoted;
      }
      continue;
    }

    if (!isQuoted && char === delimiter) {
      row.push(value);
      value = "";
      continue;
    }

    if (!isQuoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && nextChar === "\n") index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  row.push(value);
  if (row.some(cell => cell.trim())) rows.push(row);

  return rows;
}

function csvToTasks(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];

  const headers = rows[0].map(header => header.trim());
  const importedTasks = rows
    .slice(1)
    .map(row =>
      headers.reduce((task, header, index) => {
        task[header] = row[index] || "";
        return task;
      }, {})
    )
    .filter(task => normalizeText(task.task));

  const normalizedTasks = prepareTaskList(
    importedTasks.map(task => normalizeTask({ ...task, id: crypto.randomUUID() }))
  );
  const idsByTaskCode = new Map(normalizedTasks.map(task => [task.taskCode, task.id]));

  return normalizedTasks.map((task, index) => ({
    ...task,
    dependsOnTaskIds: normalizeTaskIds([
      idsByTaskCode.get(importedTasks[index].dependsOnTaskCode) || "",
      ...normalizeText(importedTasks[index].dependsOnTaskCodes)
        .split("|")
        .map(taskCode => idsByTaskCode.get(taskCode.trim()))
        .filter(Boolean)
    ]),
    dependsOnTaskId: normalizeTaskIds([
      idsByTaskCode.get(importedTasks[index].dependsOnTaskCode) || "",
      ...normalizeText(importedTasks[index].dependsOnTaskCodes)
        .split("|")
        .map(taskCode => idsByTaskCode.get(taskCode.trim()))
        .filter(Boolean)
    ])[0] || ""
  }));
}

export default function App() {
  const [tasks, setTasks] = useState(loadLocalTasks);
  const [isBrowserCompactView, setIsBrowserCompactView] = useState(loadBrowserCompactView);
  const hadDefaultViewModePreferenceOnStartRef = useRef(hasDefaultViewModePreference());
  const initialIsMobileViewport = isMobileViewportNow();
  const [defaultViewModes, setDefaultViewModes] = useState(loadDefaultViewModes);
  const [defaultStartTabs, setDefaultStartTabs] = useState(loadDefaultStartTabs);
  const initialDefaultViewSnapshot = createDefaultSessionViewSnapshot(initialIsMobileViewport, defaultViewModes, defaultStartTabs);
  const initialSessionViewSnapshot = loadSessionViewSnapshot(initialDefaultViewSnapshot);
  const initialAppTab = initialSessionViewSnapshot.activeAppTab;
  const hasSessionViewSnapshotOnStartRef = useRef(initialSessionViewSnapshot !== initialDefaultViewSnapshot);
  const hasAppliedRemoteStartTabRef = useRef(initialSessionViewSnapshot !== initialDefaultViewSnapshot);
  const [isKanbanView, setIsKanbanView] = useState(() => initialSessionViewSnapshot.isKanbanView);
  const [areTooltipsEnabled, setAreTooltipsEnabled] = useState(loadTooltipsEnabled);
  const [darkModeSettings, setDarkModeSettings] = useState(loadDarkModeSettings);
  const [isMobileViewport, setIsMobileViewport] = useState(initialIsMobileViewport);
  const [isKanbanMobileViewport, setIsKanbanMobileViewport] = useState(isKanbanMobileViewportNow);
  const [editSectionDefaults, setEditSectionDefaults] = useState(loadEditSectionDefaults);
  const activeEditSectionDefaults = normalizeEditSectionDefaults(editSectionDefaults)[isMobileViewport ? "mobile" : "browser"];
  const [cardBadgeColumns, setCardBadgeColumns] = useState(loadCardBadgeColumns);
  const [upcomingBadgeDefaults, setUpcomingBadgeDefaults] = useState(loadUpcomingBadgeDefaults);
  const [taskDetailsExpandedOverride, setTaskDetailsExpandedOverride] = useState(null);
  const [kanbanColumnKeys, setKanbanColumnKeys] = useState(loadKanbanColumnKeys);
  const [draft, setDraft] = useState(createEmptyTask);
  const [columnFilters, setColumnFilters] = useState(() => initialSessionViewSnapshot.columnFilters);
  const [activeAppTab, setActiveAppTab] = useState(initialAppTab);
  const [activeTagScope, setActiveTagScope] = useState(initialSessionViewSnapshot.activeTagScope);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const editDraftRef = useRef(null);
  const [editBaseline, setEditBaseline] = useState(null);
  const [editFocusField, setEditFocusField] = useState("");
  const lastEditDraftFieldRef = useRef("");
  const pendingEditExitActionRef = useRef(null);
  const localEditDraftsRef = useRef(new Map());
  const [localUnsavedEditCount, setLocalUnsavedEditCount] = useState(0);
  const [isEditExitPromptOpen, setIsEditExitPromptOpen] = useState(false);
  const [highlightedTaskId, setHighlightedTaskId] = useState(null);
  const [openDescriptionTaskId, setOpenDescriptionTaskId] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [isLoaded, setIsLoaded] = useState(!isSupabaseConfigured);
  const [storageError, setStorageError] = useState("");
  const [session, setSession] = useState(null);
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [allowedUserEmails, setAllowedUserEmails] = useState([ALLOWED_USER_EMAIL]);
  const [isAccessListLoaded, setIsAccessListLoaded] = useState(!isSupabaseConfigured);
  const [userAccessMessage, setUserAccessMessage] = useState("");
  const [newAllowedUserEmail, setNewAllowedUserEmail] = useState("");
  const [captureMessage, setCaptureMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [isUserDocOpen, setIsUserDocOpen] = useState(false);
  const [isReviewSummaryOpen, setIsReviewSummaryOpen] = useState(false);
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  const [isUserManagerOpen, setIsUserManagerOpen] = useState(false);
  const [selectedTagTabs, setSelectedTagTabs] = useState(loadSelectedTagTabs);
  const [tagCatalog, setTagCatalog] = useState(loadTagCatalog);
  const [tabLayout, setTabLayout] = useState(loadTabLayout);
  const kanbanDragRef = useRef({ active: false, pointerId: null, startX: 0, scrollLeft: 0, didDrag: false });
  const kanbanCardDragIdRef = useRef("");
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(!isSupabaseConfigured);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [kanbanScrollHint, setKanbanScrollHint] = useState({ left: false, right: false });
  const [isKanbanHorizontallyScrollable, setIsKanbanHorizontallyScrollable] = useState(false);
  const [dragOverKanbanColumn, setDragOverKanbanColumn] = useState("");
  const kanbanBoardRef = useRef(null);
  const kanbanTopScrollbarRef = useRef(null);
  const fileInputRef = useRef(null);
  const topbarActionsRef = useRef(null);
  const mobileBackToOverviewRef = useRef(null);
  const editReturnViewRef = useRef(null);
  const deepLinkTaskParamRef = useRef(readTaskDeepLinkParam());
  const handledDeepLinkTaskParamRef = useRef("");
  const importFormatRef = useRef("json");
  const draggedTagTabRef = useRef("");
  const isCurrentUserAllowed = !isSupabaseConfigured || Boolean(session?.user && isAccessListLoaded && isAllowedUser(session.user, allowedUserEmails));
  const isCurrentUserAdmin = Boolean(session?.user && isAdminUser(session.user));
  const getTooltip = (field, value) => areTooltipsEnabled ? getEditTooltip(field, value) : undefined;
  const getTooltipForTask = (task, field, value) => areTooltipsEnabled ? getTaskTooltip(task, field, value) : undefined;
  const activeSelectedTagTabs = useMemo(() => {
    const availableTags = normalizeTags(tagCatalog, 0);
    return normalizeTags(selectedTagTabs, 0).filter(selectedTag =>
      availableTags.some(tag => tag.toLowerCase() === selectedTag.toLowerCase())
    );
  }, [selectedTagTabs, tagCatalog]);
  const visibleTabLayout = useMemo(() => normalizeTabLayout(tabLayout, activeSelectedTagTabs), [tabLayout, activeSelectedTagTabs]);
  const activeDarkMode = isMobileViewport ? darkModeSettings.mobile : darkModeSettings.browser;
  const isOverviewSearchActive = Boolean(columnFilters.overviewSearch.trim());
  const updateLocalEditDraft = useCallback((key, entry) => {
    if (!key) return;
    const draftMap = localEditDraftsRef.current;
    if (entry?.hasChanges) draftMap.set(key, { ...entry, key });
    else draftMap.delete(key);
    setLocalUnsavedEditCount(draftMap.size);
  }, []);

  function clearLocalEditDrafts({ discard = false } = {}) {
    const entries = Array.from(localEditDraftsRef.current.values());
    if (discard) entries.forEach(entry => entry.discard?.());
    localEditDraftsRef.current.clear();
    setLocalUnsavedEditCount(0);
  }

  function saveLocalEditDrafts({ skipKey = "" } = {}) {
    const entries = Array.from(localEditDraftsRef.current.entries());
    for (const entry of entries) {
      const [key, draft] = entry;
      if (key === skipKey) continue;
      if (draft.save?.() === false) return false;
    }
    return true;
  }
  mobileBackToOverviewRef.current = () => {
    requestEditExit(() => {
      setActionMessage("");
      setActiveTagScope("all");
      setActiveAppTab("open");
      clearEdit();
      setColumnFilters(getDefaultColumnFilters("open"));
      setHighlightedTaskId(null);
      setIsActionMenuOpen(false);
      setIsMobileFilterOpen(false);
      setIsTagManagerOpen(false);
      setIsUserManagerOpen(false);
      setIsUserDocOpen(false);
      setIsReviewSummaryOpen(false);
    });
  };

  useEffect(() => {
    if (!isMobileViewport || !isLoaded || !isCurrentUserAllowed) return undefined;

    function pushMobileBackGuard() {
      window.history.pushState({ task001MobileGuard: true }, document.title, window.location.href);
    }

    pushMobileBackGuard();

    function handleMobilePopState() {
      pushMobileBackGuard();
      mobileBackToOverviewRef.current?.();
    }

    window.addEventListener("popstate", handleMobilePopState);
    return () => window.removeEventListener("popstate", handleMobilePopState);
  }, [isMobileViewport, isLoaded, isCurrentUserAllowed]);

  useEffect(() => {
    if (!isMobileViewport || !isLoaded || !isCurrentUserAllowed) return undefined;

    function warnBeforeLeaving(event) {
      event.preventDefault();
      event.returnValue = "";
      return "";
    }

    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [isMobileViewport, isLoaded, isCurrentUserAllowed]);

  useEffect(() => {
    const requestedTask = deepLinkTaskParamRef.current;
    if (!requestedTask || handledDeepLinkTaskParamRef.current === requestedTask || !isLoaded || !isCurrentUserAllowed || tasks.length === 0) return;

    const normalizedRequestedTask = requestedTask.toLowerCase();
    const task = tasks.find(candidate =>
      normalizeText(candidate.taskCode).toLowerCase() === normalizedRequestedTask ||
      normalizeText(candidate.id).toLowerCase() === normalizedRequestedTask
    );
    if (!task) return;

    handledDeepLinkTaskParamRef.current = requestedTask;
    setActionMessage("");
    showTaskDetails(task, { highlight: true, scroll: true, preserveView: false, forceListView: true });
  }, [isLoaded, isCurrentUserAllowed, tasks, activeSelectedTagTabs, defaultStartTabs, defaultViewModes]);


  useEffect(() => {
    saveBrowserCompactView(isBrowserCompactView);
  }, [isBrowserCompactView]);

  useEffect(() => {
    saveDefaultViewModes(defaultViewModes);
    if (!hasSessionViewSnapshotOnStartRef.current) {
      setIsKanbanView((isMobileViewport ? defaultViewModes.mobile : defaultViewModes.browser) === "kanban");
    }
  }, [defaultViewModes, isMobileViewport]);

  useEffect(() => {
    saveTooltipsEnabled(areTooltipsEnabled);
  }, [areTooltipsEnabled]);

  useEffect(() => {
    saveDefaultStartTabs(defaultStartTabs);
  }, [defaultStartTabs]);
  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 760px)");
    const kanbanMediaQuery = window.matchMedia("(max-width: 760px), (max-width: 900px) and (orientation: landscape)");
    const syncViewport = () => {
      setIsMobileViewport(mediaQuery.matches);
      setIsKanbanMobileViewport(kanbanMediaQuery.matches);
    };
    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    kanbanMediaQuery.addEventListener("change", syncViewport);
    return () => {
      mediaQuery.removeEventListener("change", syncViewport);
      kanbanMediaQuery.removeEventListener("change", syncViewport);
    };
  }, []);

  useEffect(() => {
    saveDarkModeSettings(darkModeSettings);
  }, [darkModeSettings]);

  useEffect(() => {
    document.documentElement.dataset.theme = activeDarkMode ? "dark" : "light";
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [activeDarkMode]);

  useEffect(() => {
    saveEditSectionDefaults(editSectionDefaults);
  }, [editSectionDefaults]);

  useEffect(() => {
    saveCardBadgeColumns(cardBadgeColumns);
  }, [cardBadgeColumns]);

  useEffect(() => {
    saveUpcomingBadgeDefaults(upcomingBadgeDefaults);
  }, [upcomingBadgeDefaults]);

  useEffect(() => {
    saveKanbanColumnKeys(kanbanColumnKeys);
  }, [kanbanColumnKeys]);

  useEffect(() => {
    saveSelectedTagTabs(selectedTagTabs);
    saveTagCatalog(tagCatalog);
    saveTabLayout(visibleTabLayout, activeSelectedTagTabs);

    if (!isSettingsLoaded || !isSupabaseConfigured || !session?.user?.id || !isCurrentUserAllowed) return undefined;

    const syncSettingsTimeout = window.setTimeout(() => {
      saveRemoteUserSettings(
        session.user.id,
        selectedTagTabs,
        tagCatalog,
        isBrowserCompactView,
        areTooltipsEnabled,
        darkModeSettings,
        editSectionDefaults,
        visibleTabLayout,
        cardBadgeColumns,
        defaultViewModes,
        defaultStartTabs,
        kanbanColumnKeys,
        upcomingBadgeDefaults
      ).catch(error => {
        setStorageError(`Supabase could not save settings: ${error.message}`);
      });
    }, 400);

    return () => window.clearTimeout(syncSettingsTimeout);
  }, [selectedTagTabs, tagCatalog, visibleTabLayout, activeSelectedTagTabs, isBrowserCompactView, areTooltipsEnabled, darkModeSettings, editSectionDefaults, cardBadgeColumns, defaultViewModes, defaultStartTabs, kanbanColumnKeys, upcomingBadgeDefaults, isSettingsLoaded, session, isCurrentUserAllowed]);

  useEffect(() => {
    if (!isLoaded || !isCurrentUserAllowed) return;
    saveSessionViewSnapshot({
      activeAppTab,
      activeTagScope,
      columnFilters,
      isKanbanView
    });
  }, [activeAppTab, activeTagScope, columnFilters, isKanbanView, isLoaded, isCurrentUserAllowed]);
  useEffect(() => {
    if (activeTagScope === "all") return;
    if (activeSelectedTagTabs.some(tag => tag.toLowerCase() === activeTagScope.toLowerCase())) return;
    setActiveTagScope("all");
  }, [activeTagScope, activeSelectedTagTabs]);

  useEffect(() => {
    const availableTags = normalizeTags(tagCatalog, 0);
    if (availableTags.length === 0) return;
    setSelectedTagTabs(current =>
      normalizeTags(current, 0).filter(selectedTag =>
        availableTags.some(tag => tag.toLowerCase() === selectedTag.toLowerCase())
      )
    );
  }, [tagCatalog]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let isCancelled = false;

    const callbackError = readOAuthCallbackError();
    const callbackTokens = readOAuthCallbackTokens();
    if (callbackError) {
      setAuthMessage(getFriendlyAuthMessage(callbackError));
      clearOAuthCallbackFromUrl();
    }
    const sessionPromise = callbackTokens
      ? supabase.auth.setSession(callbackTokens)
      : supabase.auth.getSession();

    sessionPromise.then(({ data, error }) => {
      if (isCancelled) return;
      if (error) {
        setAuthMessage(getFriendlyAuthMessage(error.message));
      } else {
        setSession(data.session);
        clearOAuthCallbackFromUrl();
      }
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === "TOKEN_REFRESHED") return;
      setUndoStack([]);
      setRedoStack([]);
      setStorageError("");
      setUserAccessMessage("");
      setIsLoaded(false);
      setIsSettingsLoaded(false);
      setIsAccessListLoaded(false);
    });

    return () => {
      isCancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsAccessListLoaded(true);
      return;
    }

    if (!session?.user?.id) {
      setAllowedUserEmails([ALLOWED_USER_EMAIL]);
      setIsAccessListLoaded(false);
      return;
    }

    let isCancelled = false;
    setIsAccessListLoaded(false);

    loadAllowedUserEmails()
      .then(({ emails, missingSchema }) => {
        if (isCancelled) return;
        setAllowedUserEmails(emails);
        setUserAccessMessage(missingSchema
          ? "The Supabase schema must first be extended with allowed_users so user management is available."
          : "");
        setIsAccessListLoaded(true);
      })
      .catch(error => {
        if (isCancelled) return;
        setAllowedUserEmails([ALLOWED_USER_EMAIL]);
        setUserAccessMessage(`User access entries could not be loaded: ${error.message}`);
        setIsAccessListLoaded(true);
      });

    return () => {
      isCancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!isSupabaseConfigured || !session?.user || !isAccessListLoaded || isAllowedUser(session.user, allowedUserEmails)) return;

    setAuthMessage(`No access: ${session.user.email || "this account"} is not allowed.`);
    setTasks([]);
    setIsLoaded(false);
    setIsSettingsLoaded(false);
    supabase.auth.signOut();
  }, [session, isAccessListLoaded, allowedUserEmails]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsSettingsLoaded(true);
      return;
    }

    if (!session?.user?.id || !isCurrentUserAllowed) {
      setIsSettingsLoaded(false);
      return;
    }

    let isCancelled = false;

    loadRemoteUserSettings(session.user.id)
      .then(remoteSettings => {
        if (isCancelled) return;
        if (remoteSettings) {
          // A remote value that still matches its own schema default may just mean "never actually
          // synced yet" for this account (e.g. Supabase was unreachable/misconfigured before), so it
          // must not silently overwrite real local customization - see preferLocalWhenRemoteIsDefault.
          setSelectedTagTabs(current => preferLocalWhenRemoteIsDefault(remoteSettings.selectedTagTabs, [], current));
          setTagCatalog(current => preferLocalWhenRemoteIsDefault(remoteSettings.tagCatalog, [], current));
          if (remoteSettings.browserCompactView !== null) {
            setIsBrowserCompactView(current =>
              preferLocalWhenRemoteIsDefault(Boolean(remoteSettings.browserCompactView), true, current));
          }
          if (remoteSettings.tooltipsEnabled !== null) {
            setAreTooltipsEnabled(current =>
              preferLocalWhenRemoteIsDefault(Boolean(remoteSettings.tooltipsEnabled), true, current));
          }
          if (remoteSettings.darkModeSettings !== null) {
            setDarkModeSettings(current =>
              preferLocalWhenRemoteIsDefault(remoteSettings.darkModeSettings, { browser: false, mobile: false }, current));
          }
          if (remoteSettings.editSectionDefaults !== null) {
            setEditSectionDefaults(current =>
              preferLocalWhenRemoteIsDefault(remoteSettings.editSectionDefaults, DEFAULT_EDIT_SECTION_DEFAULTS, current));
          }
          if (remoteSettings.cardBadgeColumns !== null) {
            setCardBadgeColumns(current =>
              preferLocalWhenRemoteIsDefault(remoteSettings.cardBadgeColumns, DEFAULT_CARD_BADGE_COLUMNS, current));
          }
          if (remoteSettings.defaultViewModes !== null) {
            const remoteViewModesAreDefault =
              valuesEqual(remoteSettings.defaultViewModes, { browser: DEFAULT_VIEW_MODE, mobile: DEFAULT_VIEW_MODE });
            setDefaultViewModes(current => remoteViewModesAreDefault ? current : ({
              browser: hadDefaultViewModePreferenceOnStartRef.current || remoteSettings.defaultViewModes.browser !== "list" ? remoteSettings.defaultViewModes.browser : current.browser,
              mobile: remoteSettings.defaultViewModes.mobile
            }));
          }
          if (remoteSettings.defaultStartTabs !== null) {
            const remoteStartTabsAreDefault =
              valuesEqual(remoteSettings.defaultStartTabs, { browser: DEFAULT_START_TAB, mobile: DEFAULT_START_TAB });
            if (!remoteStartTabsAreDefault) {
              setDefaultStartTabs(remoteSettings.defaultStartTabs);
              const nextStartTab = isMobileViewportNow() ? remoteSettings.defaultStartTabs.mobile : remoteSettings.defaultStartTabs.browser;
              if (!hasAppliedRemoteStartTabRef.current && !hasSessionViewSnapshotOnStartRef.current && activeAppTab === initialAppTab && !editingId) {
                setActiveAppTab(nextStartTab);
                setActiveTagScope("all");
                setColumnFilters(getDefaultColumnFilters(nextStartTab));
              }
            }
          }
          hasAppliedRemoteStartTabRef.current = true;
          if (remoteSettings.kanbanColumnKeys !== null) {
            setKanbanColumnKeys(current =>
              migrateKanbanColumnKeys(preferLocalWhenRemoteIsDefault(remoteSettings.kanbanColumnKeys, DEFAULT_KANBAN_COLUMN_KEYS, current)));
          }
          if (remoteSettings.upcomingBadgeDefaults !== null) {
            setUpcomingBadgeDefaults(current =>
              preferLocalWhenRemoteIsDefault(remoteSettings.upcomingBadgeDefaults, DEFAULT_UPCOMING_BADGE_DEFAULTS, current));
          }

          if (remoteSettings.tabLayout !== null) {
            setTabLayout(current =>
              preferLocalWhenRemoteIsDefault(remoteSettings.tabLayout, getDefaultTabLayout(remoteSettings.selectedTagTabs), current));
          }
        }
        setIsSettingsLoaded(true);
      })
      .catch(error => {
        if (isCancelled) return;
        setStorageError(`Supabase could not load settings: ${error.message}`);
        setIsSettingsLoaded(true);
      });

    return () => {
      isCancelled = true;
    };
  }, [session, isCurrentUserAllowed]);

  useEffect(() => {
    if (!isLoaded) return;

    saveLocalTasks(tasks);

    if (!isSupabaseConfigured) {
      return;
    }

    if (!session?.user?.id || !isCurrentUserAllowed) return;

    saveRemoteTasks(tasks, session.user.id).catch(error => {
      setStorageError(`Supabase could not save data: ${error.message}`);
    });
  }, [tasks, isLoaded, session, isCurrentUserAllowed]);

  useEffect(() => {
    if (!isLoaded || !isSettingsLoaded || tagCatalog.length > 0) return;
    const taskTags = normalizeTags(tasks.flatMap(task => normalizeTags(task.tags)), 0);
    if (taskTags.length > 0) setTagCatalog(normalizeTagCatalog(taskTags));
  }, [tasks, isLoaded, isSettingsLoaded, tagCatalog.length]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    if (!session?.user?.id || !isCurrentUserAllowed) {
      setTasks([]);
      setIsLoaded(false);
      return;
    }

    let isCancelled = false;

    loadRemoteTasks(session.user.id)
      .then(remoteTasks => {
        if (isCancelled) return;
        setTasks(currentTasks => mergeRemoteAndLocalTasks(remoteTasks, currentTasks));
        setIsLoaded(true);
        setStorageError("");
      })
      .catch(error => {
        if (isCancelled) return;
        setStorageError(`Supabase could not load data: ${error.message}`);
        setIsLoaded(true);
      });

    return () => {
      isCancelled = true;
    };
  }, [session, isCurrentUserAllowed]);

  useEffect(() => {
    const refreshedTasks = pruneExpiredDeletedTasks(tasks);
    if (refreshedTasks.length !== tasks.length || refreshedTasks.some((task, index) => task !== tasks[index])) {
      setTasks(refreshedTasks);
    }
  }, [tasks]);

  useEffect(() => {
    if (!isActionMenuOpen && !isMobileFilterOpen && !isTagManagerOpen && !isUserManagerOpen) return undefined;

    function closeMenusOnOutsidePointer(event) {
      if (topbarActionsRef.current?.contains(event.target)) return;
      setIsActionMenuOpen(false);
      setIsMobileFilterOpen(false);
      setIsTagManagerOpen(false);
      setIsUserManagerOpen(false);
    }

    document.addEventListener("pointerdown", closeMenusOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeMenusOnOutsidePointer);
  }, [isActionMenuOpen, isMobileFilterOpen, isTagManagerOpen, isUserManagerOpen]);

  useEffect(() => {
    function updateBackToTopVisibility() {
      setShowBackToTop(window.scrollY > 320);
    }

    updateBackToTopVisibility();
    window.addEventListener("scroll", updateBackToTopVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateBackToTopVisibility);
  }, []);

  useEffect(() => {
    if (!highlightedTaskId) return undefined;

    let cleanupHighlightDismiss = () => {};
    const enableDismissTimeout = window.setTimeout(() => {
      function dismissHighlight() {
        setHighlightedTaskId(null);
      }

      document.addEventListener("pointerdown", dismissHighlight);
      window.addEventListener("scroll", dismissHighlight, { passive: true });
      cleanupHighlightDismiss = () => {
        document.removeEventListener("pointerdown", dismissHighlight);
        window.removeEventListener("scroll", dismissHighlight);
      };
    }, 700);

    return () => {
      window.clearTimeout(enableDismissTimeout);
      cleanupHighlightDismiss();
    };
  }, [highlightedTaskId]);

  const childIdsByParent = useMemo(() => {
    const idsByParent = new Map();
    tasks.forEach(task => {
      getPredecessorIds(task).forEach(predecessorId => {
        idsByParent.set(predecessorId, [...(idsByParent.get(predecessorId) || []), task.id]);
      });
    });
    return idsByParent;
  }, [tasks]);
  const tasksById = useMemo(() => new Map(tasks.map(task => [task.id, task])), [tasks]);
  const taskFilterCacheById = useMemo(() => {
    const cacheById = new Map();
    tasks.forEach(task => {
      cacheById.set(task.id, getTaskFilterCache(task, tasksById, childIdsByParent));
    });
    return cacheById;
  }, [tasks, tasksById, childIdsByParent]);

  const visibleTasks = useMemo(() => {
    const sortedTasks = activeAppTab === NEWEST_TAB
      ? sortTasksByCreatedAt(tasks)
      : sortTasksWithFilters(tasks, columnFilters, tasksById, childIdsByParent);
    return sortedTasks.filter(task => {
      const cache = taskFilterCacheById.get(task.id) || getTaskFilterCache(task, tasksById, childIdsByParent);
      const matchesPrio =
        columnFilters.prio === "Alle" || getEffectivePrio(task.prio) === columnFilters.prio;
      const matchesViewStatus = activeAppTab === REVIEW_TAB
        ? shouldShowInReview(task)
        : activeAppTab === DONE_TAB
        ? isDone(task)
        : activeAppTab === DELETED_TAB
          ? true
          : activeAppTab === NEWEST_TAB
            ? !isDone(task)
            : activeAppTab === ACTIVE_TAB
              ? (isKanbanView ? true : !isDone(task))
              : matchesGoogleStatusFilter(task, columnFilters.googleStatus);
      const matchesDueStatus = matchesDueStatusFilter(task, columnFilters.dueStatus);
      const matchesTagScope = activeAppTab === REVIEW_TAB || activeTagScope === "all" || hasTag(task, activeTagScope);
      const matchesDeletedScope = activeAppTab === DELETED_TAB ? isDeleted(task) : !isDeleted(task);
      const tagText = cache.tagText;
      const matchesTagFilter = columnFilters.tagFilter === "-"
        ? !tagText
        : includesFilter(tagText, columnFilters.tagFilter);
      const predecessorText = cache.predecessorText;
      const successorText = cache.successorText;
      if (isOverviewSearchActive) {
        return matchesGlobalTaskSearch(cache.searchableTaskValues, columnFilters.overviewSearch, {
          deleted: isDeleted(task),
          deletedView: activeAppTab === DELETED_TAB,
          done: isDone(task),
          doneView: activeAppTab === DONE_TAB
        });
      }

      return (
        includesFilter(task.taskCode, columnFilters.taskCode) &&
        matchesPrio &&
        matchesDueStatus &&
        matchesTagFilter &&
        includesFilter(task.task, columnFilters.task) &&
        (includesFilter(task.beschreibung, columnFilters.beschreibung) || includesFilter(cache.commentText, columnFilters.beschreibung)) &&
        includesFilter(cache.subtaskText, columnFilters.subtaskFilter) &&
        includesFilter(predecessorText, columnFilters.predecessorFilter) &&
        includesFilter(successorText, columnFilters.successorFilter) &&
        (includesFilter(task.startdatum, columnFilters.startdatum) || includesFilter(cache.formattedStartDate, columnFilters.startdatum)) &&
        (includesFilter(task.faellig, columnFilters.faellig) || includesFilter(cache.formattedDueDate, columnFilters.faellig)) &&
        (includesFilter(task.completedAt, columnFilters.completedAt) || includesFilter(cache.formattedCompletedAt, columnFilters.completedAt)) &&
        (includesFilter(task.deletedAt, columnFilters.deletedAt) || includesFilter(cache.formattedDeletedAt, columnFilters.deletedAt)) &&
        matchesTagScope &&
        matchesViewStatus &&
        matchesDeletedScope
      );
    });
  }, [tasks, columnFilters, isOverviewSearchActive, activeTagScope, activeAppTab, isKanbanView, tasksById, childIdsByParent, taskFilterCacheById]);

  const visibleTasksWithEditingTask = useMemo(() => {
    if (!editingId) return visibleTasks;
    const editingTask = tasks.find(task => task.id === editingId);
    if (!editingTask || visibleTasks.some(task => task.id === editingId)) return visibleTasks;
    return [editingTask, ...visibleTasks];
  }, [editingId, tasks, visibleTasks]);

  const taskCardsToRender = useMemo(() => (
    editingId ? visibleTasksWithEditingTask.filter(task => task.id === editingId) : visibleTasksWithEditingTask
  ), [editingId, visibleTasksWithEditingTask]);

  const visibleKanbanColumns = useMemo(() => {
    const activeKeys = new Set(normalizeKanbanColumns(kanbanColumnKeys));
    return KANBAN_COLUMNS.filter(column => activeKeys.has(column.key));
  }, [kanbanColumnKeys]);

  const normalizedCardBadgeColumns = normalizeCardBadgeColumns(cardBadgeColumns);
  const kanbanBadgeColumnValue = normalizedCardBadgeColumns.kanban;
  const kanbanBadgeColumnCount = getCardBadgeColumnCount(kanbanBadgeColumnValue);
  const kanbanBadgeGridWidth = getCardBadgeGridWidth(kanbanBadgeColumnValue);
  const kanbanColumnWidth = kanbanBadgeGridWidth + KANBAN_COLUMN_EXTRA_WIDTH;
  const kanbanCardBadgeColumns = useMemo(() => ({ overview: kanbanBadgeColumnValue, edit: kanbanBadgeColumnValue }), [kanbanBadgeColumnValue]);

  const kanbanColumnGroups = useMemo(() => {
    const tasksByColumn = new Map(visibleKanbanColumns.map(column => [column.key, []]));
    sortTasks(taskCardsToRender).forEach(task => {
      const columnKey = getKanbanColumnKey(task);
      tasksByColumn.get(columnKey)?.push(task);
    });
    return visibleKanbanColumns.map(column => ({
      ...column,
      tasks: tasksByColumn.get(column.key) || []
    }));
  }, [taskCardsToRender, visibleKanbanColumns]);
  const kanbanScrollWidth = (kanbanColumnGroups.length * kanbanColumnWidth) + (Math.max(0, kanbanColumnGroups.length - 1) * 12);

  const updateKanbanScrollHint = useCallback(() => {
    const board = kanbanBoardRef.current;
    const topScrollbar = kanbanTopScrollbarRef.current;
    const hasMobileOverflowFallback = isKanbanMobileViewport && kanbanColumnGroups.length > 1;
    if (!board) {
      setIsKanbanHorizontallyScrollable(false);
      setKanbanScrollHint({ left: false, right: hasMobileOverflowFallback });
      return;
    }
    if (topScrollbar && Math.abs(topScrollbar.scrollLeft - board.scrollLeft) > 1) {
      topScrollbar.scrollLeft = board.scrollLeft;
    }
    const maxScrollLeft = Math.max(0, board.scrollWidth - board.clientWidth);
    const isHorizontallyScrollable = maxScrollLeft > 4;
    setIsKanbanHorizontallyScrollable(current => current === isHorizontallyScrollable ? current : isHorizontallyScrollable);
    const next = {
      left: board.scrollLeft > 4,
      right: isHorizontallyScrollable ? board.scrollLeft < maxScrollLeft - 4 : hasMobileOverflowFallback
    };
    setKanbanScrollHint(current => current.left === next.left && current.right === next.right ? current : next);
  }, [isKanbanMobileViewport, kanbanColumnGroups.length]);

  useEffect(() => {
    if (!isKanbanView) {
      setKanbanScrollHint({ left: false, right: false });
      setIsKanbanHorizontallyScrollable(false);
      return undefined;
    }
    updateKanbanScrollHint();
    const frameId = window.requestAnimationFrame(updateKanbanScrollHint);
    const board = kanbanBoardRef.current;
    const resizeObserver = typeof ResizeObserver !== "undefined" && board ? new ResizeObserver(updateKanbanScrollHint) : null;
    resizeObserver?.observe(board);
    window.addEventListener("resize", updateKanbanScrollHint);
    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateKanbanScrollHint);
    };
  }, [isKanbanView, isKanbanMobileViewport, kanbanColumnGroups.length, updateKanbanScrollHint]);

  function handleKanbanPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    if (event.target.closest?.("button, a, input, select, textarea, [role='button'], [draggable='true']")) return;
    const board = kanbanBoardRef.current;
    if (!board || board.scrollWidth <= board.clientWidth) return;
    kanbanDragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: board.scrollLeft,
      didDrag: false
    };
    board.setPointerCapture?.(event.pointerId);
    board.classList.add("isDragging");
  }

  function handleKanbanPointerMove(event) {
    const drag = kanbanDragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;
    const board = kanbanBoardRef.current;
    if (!board) return;
    const deltaX = event.clientX - drag.startX;
    if (Math.abs(deltaX) > 4) drag.didDrag = true;
    board.scrollLeft = drag.scrollLeft - deltaX;
    updateKanbanScrollHint();
  }

  function finishKanbanDrag(event) {
    const drag = kanbanDragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;
    const board = kanbanBoardRef.current;
    board?.releasePointerCapture?.(event.pointerId);
    board?.classList.remove("isDragging");
    kanbanDragRef.current = { active: false, pointerId: null, startX: 0, scrollLeft: 0, didDrag: drag.didDrag };
    window.setTimeout(() => {
      if (!kanbanDragRef.current.active) kanbanDragRef.current.didDrag = false;
    }, 0);
  }

  function handleKanbanClickCapture(event) {
    if (!kanbanDragRef.current.didDrag) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function moveTaskToKanbanColumn(taskId, columnKey) {
    const targetTask = tasks.find(task => task.id === taskId);
    if (!targetTask) return;
    if (getKanbanColumnKey(targetTask) === columnKey) return;
    const nextStatus = KANBAN_COLUMN_STATUS[columnKey];
    if (!nextStatus) return;
    updateTaskField(taskId, "googleStatus", nextStatus, { preserveView: true });
  }

  function handleKanbanCardDragStart(event, task) {
    event.stopPropagation();
    kanbanCardDragIdRef.current = task.id;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", task.id);
    event.currentTarget.classList.add("isDragging");
  }

  function handleKanbanCardDragEnd(event) {
    event.currentTarget.classList.remove("isDragging");
    kanbanCardDragIdRef.current = "";
    setDragOverKanbanColumn("");
  }

  function handleKanbanColumnDragOver(event, columnKey) {
    if (!kanbanCardDragIdRef.current) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverKanbanColumn(current => current === columnKey ? current : columnKey);
  }

  function handleKanbanColumnDragLeave(event, columnKey) {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setDragOverKanbanColumn(current => current === columnKey ? "" : current);
  }

  function handleKanbanColumnDrop(event, columnKey) {
    const taskId = kanbanCardDragIdRef.current || event.dataTransfer.getData("text/plain");
    event.preventDefault();
    setDragOverKanbanColumn("");
    kanbanCardDragIdRef.current = "";
    if (!taskId) return;
    moveTaskToKanbanColumn(taskId, columnKey);
  }

  function handleKanbanBoardScroll() {
    updateKanbanScrollHint();
    const board = kanbanBoardRef.current;
    const topScrollbar = kanbanTopScrollbarRef.current;
    if (board && topScrollbar && Math.abs(topScrollbar.scrollLeft - board.scrollLeft) > 1) {
      topScrollbar.scrollLeft = board.scrollLeft;
    }
  }

  function handleKanbanTopScroll() {
    const board = kanbanBoardRef.current;
    const topScrollbar = kanbanTopScrollbarRef.current;
    if (!board || !topScrollbar || Math.abs(board.scrollLeft - topScrollbar.scrollLeft) <= 1) return;
    board.scrollLeft = topScrollbar.scrollLeft;
    updateKanbanScrollHint();
  }

  const taskSummary = useMemo(() => {
    const tagCounts = new Map();
    const nextCounts = {
      open: 0,
      started: 0,
      newest: 0,
      done: 0,
      deleted: 0,
      startsToday: 0,
      dueToday: 0,
      overdue: 0,
      review: 0
    };

    tasks.forEach(task => {
      const deleted = isDeleted(task);
      const done = isDone(task);
      if (deleted) {
        nextCounts.deleted += 1;
        return;
      }

      if (shouldShowInReview(task)) nextCounts.review += 1;
      if (task.googleStatus === "Offen") nextCounts.open += 1;
      if (task.googleStatus === "Gestartet") nextCounts.started += 1;
      if (!done) nextCounts.newest += 1;
      if (done) nextCounts.done += 1;
      if (!done) {
        normalizeTags(task.tags).forEach(tag => {
          const key = tag.toLowerCase();
          tagCounts.set(key, (tagCounts.get(key) || 0) + 1);
        });
      }
      if (matchesDueStatusFilter(task, "heute starten")) nextCounts.startsToday += 1;
      if (matchesDueStatusFilter(task, "heute fällig")) nextCounts.dueToday += 1;
      if (matchesDueStatusFilter(task, "überfällig")) nextCounts.overdue += 1;
    });

    return { counts: nextCounts, tagTabCounts: tagCounts };
  }, [tasks]);

  const counts = taskSummary.counts;
  const tagTabCounts = taskSummary.tagTabCounts;

  const scopedStatusCounts = useMemo(() => {
    const scopedTasks = tasks.filter(task => activeTagScope === "all" || hasTag(task, activeTagScope));
    const activeScopedTasks = scopedTasks.filter(task => !isDeleted(task));
    return {
      open: activeScopedTasks.filter(task => task.googleStatus === "Offen").length,
      started: activeScopedTasks.filter(task => task.googleStatus === "Gestartet").length,
      newest: activeScopedTasks.filter(task => !isDone(task)).length,
      review: activeScopedTasks.filter(task => shouldShowInReview(task)).length,
      done: activeScopedTasks.filter(isDone).length,
      deleted: scopedTasks.filter(isDeleted).length
    };
  }, [tasks, activeTagScope]);

  const reviewSummary = useMemo(() => getTaskReviewSummary(tasks), [tasks]);
  const reviewTasks = useMemo(() => tasks.filter(task => shouldShowInReview(task)), [tasks]);

  const dependencyOptions = useMemo(() => getTaskOptions(tasks), [tasks]);
  const taskCodeOptions = useMemo(() => sortTasks(tasks).map(task => task.taskCode).filter(Boolean), [tasks]);
  const tagOptions = useMemo(() => {
    return normalizeTagCatalog(tagCatalog).sort((first, second) => first.localeCompare(second, "de", { sensitivity: "base" }));
  }, [tagCatalog]);
  const hasUnsavedEditChanges = Boolean(editingId && editDraft && editBaseline && !isSameEditableTask(editDraft, editBaseline));
  const hasUnsavedLocalEditChanges = localUnsavedEditCount > 0;
  const hasAnyUnsavedEditChanges = hasUnsavedEditChanges || hasUnsavedLocalEditChanges;
  const showCompletedAtColumn = activeAppTab === DONE_TAB;
  const isSingleTaskEditMode = Boolean(editingId);
  const isArchiveViewFilterActive = activeAppTab === DONE_TAB || activeAppTab === DELETED_TAB;
  const activeFilterCount = useMemo(() => {
    const tabDefaults = getDefaultColumnFilters(activeAppTab);
    const columnFilterCount = Object.entries(columnFilters).filter(([key, value]) => {
      const defaultValue = tabDefaults[key];
      return value !== defaultValue;
    }).length;
    return columnFilterCount + (isArchiveViewFilterActive ? 1 : 0);
  }, [activeAppTab, columnFilters, isArchiveViewFilterActive]);
  const activeFilterBadges = useMemo(() => {
    const defaults = getDefaultColumnFilters(activeAppTab);
    const labels = {
      overviewSearch: "Search",
      taskCode: "ID",
      prio: "Prio",
      tagFilter: "Tag",
      task: "Task",
      beschreibung: "Description",
      subtaskFilter: "Subtasks",
      predecessorFilter: "Predecessors",
      successorFilter: "Successors",
      googleStatus: "Status",
      startdatum: "Start",
      faellig: "Due",
      dueStatus: "Due status",
      completedAt: "Done on",
      deletedAt: "Deleted on",
      prioSort: "Priority sorted",
      tagSort: "Tag sorted",
      taskSort: "Task sorted",
      beschreibungSort: "Description sorted",
      subtaskSort: "Subtasks sorted",
      predecessorSort: "Predecessors sorted",
      successorSort: "Successors sorted",
      googleStatusSort: "Status sorted",
      startdatumSort: "Start sorted",
      faelligSort: "Due sorted",
      completedAtSort: "Done sorted",
      deletedAtSort: "Deleted sorted"
    };
    function formatFilterValue(key, value) {
      if (key === "tagFilter" && value === "-") return "No tag";
      return getDisplayValue(value);
    }

    const viewFilterBadges = isArchiveViewFilterActive
      ? [{ key: "viewFilter", label: "View", value: getViewLabel(activeAppTab) }]
      : [];
    return [
      ...viewFilterBadges,
      ...Object.entries(columnFilters)
      .filter(([key, value]) => value !== defaults[key])
      .map(([key, value]) => ({ key, label: labels[key] || key, value: formatFilterValue(key, value) }))
    ];
  }, [activeAppTab, columnFilters, isArchiveViewFilterActive]);
  const currentSelectionBadges = useMemo(() => {
    const scope = activeTagScope === "all" ? "All tags" : `#${activeTagScope}`;
    const mode = isKanbanView ? "Kanban" : "List";
    const search = normalizeText(columnFilters.overviewSearch);
    return [
      { key: "view", label: "View", value: getViewLabel(activeAppTab) },
      { key: "scope", label: "Scope", value: scope },
      { key: "mode", label: "Mode", value: mode },
      ...(search ? [{ key: "search", label: "Search", value: search }] : [])
    ];
  }, [activeAppTab, activeTagScope, columnFilters, isKanbanView]);
  const filterButtonTitle = useMemo(() => {
    if (!activeFilterBadges.length) return "Filter";
    return `Active filters/sorts (${activeFilterBadges.length}): ${activeFilterBadges.map(filter => `${filter.label}: ${filter.value}`).join("; ")}`;
  }, [activeFilterBadges]);

  const showDeletedAtColumn = activeAppTab === DELETED_TAB;
  const defaultTaskDetailMode = normalizeTaskDetailMode(isMobileViewport ? upcomingBadgeDefaults.mobile : upcomingBadgeDefaults.browser);
  const taskDetailDisplayMode = normalizeTaskDetailMode(typeof taskDetailsExpandedOverride === "string" ? taskDetailsExpandedOverride : defaultTaskDetailMode);
  const areTaskDetailsExpanded = taskDetailDisplayMode === "maximum";
  const shouldHideOverviewDetailsUntilOpen = taskDetailDisplayMode !== "maximum";

  function getMobileTaskCardProps(task, overrides = {}) {
    const isTaskDetailsOpen = openDescriptionTaskId === task.id;
    return {
      task,
      highlightedTaskId,
      isEditing: editingId === task.id,
      hasUnsavedChanges: editingId === task.id && hasAnyUnsavedEditChanges,
      getTooltip: (field, value) => getTooltipForTask(editingId === task.id ? editDraft : task, field, value),
      dueReminderTooltip: getDueReminderTooltip(editingId === task.id && editDraft ? editDraft : task),
      editDraft,
      editFocusField: editingId === task.id ? editFocusField : "",
      editSectionDefaults: activeEditSectionDefaults,
      dependencyTask: getDependencyTasks(getPredecessorIds(task), tasksById).filter(dependency => !isDone(dependency) && !isDeleted(dependency))[0] || null,
      predecessorTargets: getRelationTargets(getPredecessorIds(task), tasksById, "Predecessors"),
      successorTargets: getRelationTargets(childIdsByParent.get(task.id) || [], tasksById, "Successors"),
      relation: getTaskRelation(task, childIdsByParent, tasksById),
      dependencyOptions: getTaskOptions(tasks, task.id),
      tagOptions,
      onStartEdit: startEdit,
      onCancelEdit: cancelEditWithPrompt,
      onSaveEdit: saveEdit,
      onSaveEditField: saveEditField,
      onLocalEditDraftChange: updateLocalEditDraft,
      onRequestEditExit: requestEditExit,
      onDelete: deleteTask,
      onRestore: restoreTask,
      onToggleDone: toggleDone,
      onShareTask: shareTask,
      onQuickChange: updateTaskField,
      onShowTask: showTask,
      onChange: updateEditDraft,
      isDescriptionOpen: openDescriptionTaskId === task.id,
      onToggleDescription: () => setOpenDescriptionTaskId(current => current === task.id ? null : task.id),
      showCompletedAt: showCompletedAtColumn,
      showDeletedAt: showDeletedAtColumn,
      isMobileViewport,
      cardBadgeColumns,
      hideOverviewDetailsUntilDescriptionOpen: shouldHideOverviewDetailsUntilOpen && !isTaskDetailsOpen,
      alwaysExpandDetails: taskDetailDisplayMode === "maximum",
      showBadgeSection: false,
      badgeSectionDefaultOpen: false,
      ...overrides
    };
  }

  useEffect(() => {
    if (!editingId) return undefined;

    function closeOnEscape(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      window.requestAnimationFrame(() => requestEditExit(cancelEdit));
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [editingId, hasAnyUnsavedEditChanges, editDraft, editBaseline, tasks]);

  function updateDraft(field, value) {
    setCaptureMessage("");
    setActionMessage("");
    if (field === "tags") activateTagTabs(value);
    setDraft(current => applyCriteriaChange(current, field, value));
  }

  function updateEditDraft(field, value) {
    if (field === "tags") activateTagTabs(value);
    lastEditDraftFieldRef.current = field;
    const nextDraft = applyCriteriaChange(editDraftRef.current || editDraft, field, value);
    editDraftRef.current = nextDraft;
    setEditDraft(nextDraft);
  }

  function requestEditExit(action) {
    const isLocalEditorExitAction = action && typeof action === "object";
    const currentDraft = editDraftRef.current || editDraft;
    const hasPendingChanges = Boolean(isLocalEditorExitAction || (editingId && ((currentDraft && editBaseline && !isSameEditableTask(currentDraft, editBaseline)) || localEditDraftsRef.current.size > 0)));
    if (hasPendingChanges) {
      pendingEditExitActionRef.current = action;
      setIsEditExitPromptOpen(true);
      return;
    }
    action?.();
  }

  function closeEditExitPrompt() {
    pendingEditExitActionRef.current = null;
    setIsEditExitPromptOpen(false);
  }

  function getPendingEditExitAction(type) {
    const action = pendingEditExitActionRef.current;
    if (typeof action === "function") return action;
    if (type === "save") return action?.afterSave || action?.afterDiscard || null;
    if (type === "discard") return action?.afterDiscard || action?.afterSave || null;
    return null;
  }

  function continueEditExitAfterSave() {
    const pendingAction = pendingEditExitActionRef.current;
    const action = getPendingEditExitAction("save");
    if (pendingAction && typeof pendingAction === "object" && action?.() === false) return;
    if (!saveLocalEditDrafts({ skipKey: pendingAction?.draftKey || "" })) return;
    if (!saveEdit({ keepEditing: true, includeLocalDrafts: false })) return;
    closeEditExitPrompt();
    if (typeof pendingAction === "function") action?.();
  }

  function continueEditExitWithoutSave() {
    const action = getPendingEditExitAction("discard");
    clearLocalEditDrafts({ discard: true });
    closeEditExitPrompt();
    action?.();
  }

  function updateColumnFilter(field, value) {
    let nextTab = null;
    if (field === "googleStatus") {
      if (value === "Offen") nextTab = "open";
      if (value === "Gestartet") nextTab = "started";
      if (value === "Alle" && !STATUS_TABS.includes(activeAppTab)) nextTab = "open";
    }
    if (field === "dueStatus" && ["heute starten", "überfällig"].includes(value) && !STATUS_TABS.includes(activeAppTab)) {
      nextTab = "open";
    }
    if (nextTab) setActiveAppTab(nextTab);
    setColumnFilters(current => {
      const next = { ...current, [field]: value };
      if (nextTab) {
        const defaults = getDefaultColumnFilters(nextTab);
        if (field === "dueStatus" && !STATUS_TABS.includes(activeAppTab)) {
          next.googleStatus = defaults.googleStatus;
        }
        if (nextTab !== DONE_TAB) {
          next.completedAt = defaults.completedAt;
          next.completedAtSort = defaults.completedAtSort;
        }
        if (nextTab !== DELETED_TAB) {
          next.deletedAt = defaults.deletedAt;
          next.deletedAtSort = defaults.deletedAtSort;
        }
      }
      return next;
    });
  }

  function resetFilters() {
    if (isArchiveViewFilterActive) {
      setActiveAppTab(ACTIVE_TAB);
      setColumnFilters(getDefaultColumnFilters(ACTIVE_TAB));
    } else {
      setColumnFilters(getDefaultColumnFilters(activeAppTab));
    }
    setIsActionMenuOpen(false);
    setIsMobileFilterOpen(false);
  }

  function getNavigationTagScope(task) {
    if (activeTagScope !== "all" && hasTag(task, activeTagScope)) return activeTagScope;
    return activeSelectedTagTabs.find(tag => hasTag(task, tag)) || "all";
  }

  function closeHeaderMenus() {
    setIsActionMenuOpen(false);
    setIsMobileFilterOpen(false);
    setIsTagManagerOpen(false);
    setIsUserManagerOpen(false);
  }

  function isTaskInActiveViewScope(task) {
    return getTaskViewTab(task) === activeAppTab && (activeTagScope === "all" || hasTag(task, activeTagScope));
  }

  function showTaskView(task, { highlight = false, scroll = false, preserveView = false } = {}) {
    const nextTab = getTaskViewTab(task);
    if (!preserveView) {
      setActiveTagScope(getNavigationTagScope(task));
      setActiveAppTab(nextTab);
      setColumnFilters(getDefaultColumnFilters(nextTab));
    }
    clearEdit();
    closeHeaderMenus();
    setHighlightedTaskId(highlight ? task.id : null);

    if (scroll) {
      window.setTimeout(() => {
        findVisibleTaskElement(task.id)?.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
      }, 80);
    }
  }

  function showTaskDetails(task, { highlight = true, scroll = true, preserveView = true, forceListView = false, toggle = false } = {}) {
    const isOpenTaskDetails = openDescriptionTaskId === task.id;
    showTaskView(task, { highlight, scroll, preserveView });
    setOpenDescriptionTaskId(toggle && isOpenTaskDetails ? null : task.id);
    if (forceListView) setIsKanbanView(false);
  }

  async function loginWithGoogle() {
    setAuthLoading(true);
    setAuthMessage("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          prompt: "select_account"
        }
      }
    });

    if (error) {
      setAuthMessage(getFriendlyAuthMessage(error.message));
      setAuthLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setIsActionMenuOpen(false);
  }

  function updateTasksWithUndo(updater) {
    setTasks(current => {
      const next = typeof updater === "function" ? updater(current) : updater;
      if (next === current) return current;
      setUndoStack(stack => [...stack, current].slice(-20));
      setRedoStack([]);
      return next;
    });
  }

  function undoLastChange() {
    setUndoStack(stack => {
      if (stack.length === 0) return stack;

      const previousTasks = stack[stack.length - 1];
      editReturnViewRef.current = null;
      setTasks(current => {
        setRedoStack(redoItems => [...redoItems, current].slice(-20));
        return previousTasks;
      });
      setEditingId(null);
      setEditDraft(null);
      setEditBaseline(null);
      setEditFocusField("");
      setHighlightedTaskId(null);
      setIsActionMenuOpen(false);

      return stack.slice(0, -1);
    });
  }

  function redoLastChange() {
    setRedoStack(stack => {
      if (stack.length === 0) return stack;

      const nextTasks = stack[stack.length - 1];
      editReturnViewRef.current = null;
      setTasks(current => {
        setUndoStack(undoItems => [...undoItems, current].slice(-20));
        return nextTasks;
      });
      setEditingId(null);
      setEditDraft(null);
      setEditBaseline(null);
      setEditFocusField("");
      setHighlightedTaskId(null);
      setIsActionMenuOpen(false);

      return stack.slice(0, -1);
    });
  }

  function addTask(event) {
    event.preventDefault();
    if (!draft.task.trim()) return;
    const nextId = crypto.randomUUID();
    const nextTaskCode = getNextTaskCode(tasks);
    const openTaskIds = new Set(tasks.filter(task => !isDone(task) && !isDeleted(task)).map(task => task.id));
    const successorIds = normalizeTaskIds(draft.successorTaskIds).filter(id => openTaskIds.has(id));
    const predecessorIds = normalizeTaskIds(draft.dependsOnTaskIds).filter(id => openTaskIds.has(id));

    const nextTasks = assignMissingTaskCodes([
      ...tasks,
      normalizeTask({ ...draft, id: nextId, taskCode: nextTaskCode, task: draft.task.trim(), dependsOnTaskIds: predecessorIds, createdAt: new Date().toISOString() })
    ]).map(task => successorIds.includes(task.id) ? addPredecessorIds(task, [nextId]) : task);
    const cycleMessage = getDependencyCycleMessage(nextTasks);
    if (cycleMessage) {
      setActionMessage(cycleMessage);
      window.alert(cycleMessage);
      return;
    }

    updateTasksWithUndo(nextTasks);
    setDraft(createEmptyTask());
    setCaptureMessage({ id: nextId, code: nextTaskCode });
  }

  function addCatalogTag(tag) {
    const normalizedTag = normalizeTag(tag);
    if (!normalizedTag) return;
    const existingTags = normalizeTagCatalog(tagCatalog);
    if (existingTags.some(existingTag => existingTag.toLowerCase() === normalizedTag.toLowerCase())) return;
    if (existingTags.length >= MAX_TAG_CATALOG_SIZE) {
      setActionMessage(`Maximal ${MAX_TAG_CATALOG_SIZE} Tags moeglich.`);
      return;
    }

    setActionMessage("");
    setTagCatalog(normalizeTagCatalog([...existingTags, normalizedTag]));
  }

  function activateTagTabs(tags) {
    const normalizedTags = normalizeTags(tags, 0);
    if (normalizedTags.length === 0) return;

    setSelectedTagTabs(current => {
      const selectedTags = normalizeTags(current, 0);
      const missingTags = normalizedTags.filter(tag =>
        !selectedTags.some(selectedTag => selectedTag.toLowerCase() === tag.toLowerCase())
      );
      return missingTags.length === 0 ? selectedTags : normalizeTags([...selectedTags, ...missingTags], 0);
    });
  }

  function moveSelectedTagTab(sourceTag, targetTag) {
    const sourceKey = normalizeTag(sourceTag).toLowerCase();
    const targetKey = normalizeTag(targetTag).toLowerCase();
    if (!sourceKey || !targetKey || sourceKey === targetKey) return;

    setSelectedTagTabs(current => {
      const values = normalizeTags(current, 0);
      const sourceIndex = values.findIndex(tag => tag.toLowerCase() === sourceKey);
      const targetIndex = values.findIndex(tag => tag.toLowerCase() === targetKey);
      if (sourceIndex < 0 || targetIndex < 0) return values;
      const nextValues = [...values];
      const [movedTag] = nextValues.splice(sourceIndex, 1);
      nextValues.splice(targetIndex, 0, movedTag);
      return nextValues;
    });
    setTabLayout(current => moveTabInLayout(current, getTagTabId(sourceTag), getTagTabId(targetTag), 1, activeSelectedTagTabs));
  }

  function moveVisibleTab(sourceId, targetId, rowIndex) {
    setTabLayout(current => moveTabInLayout(current, sourceId, targetId, rowIndex, activeSelectedTagTabs));
  }

  function removeCatalogTag(tag) {
    const normalizedTag = normalizeTag(tag);
    if (!normalizedTag) return;
    const normalizedKey = normalizedTag.toLowerCase();

    setTagCatalog(current => normalizeTagCatalog(current).filter(existingTag => existingTag.toLowerCase() !== normalizedKey));
    setSelectedTagTabs(current => normalizeTags(current, 0).filter(selectedTag => selectedTag.toLowerCase() !== normalizedKey));
    setTabLayout(current => normalizeTabLayout(current, activeSelectedTagTabs.filter(tag => tag.toLowerCase() !== normalizedKey)));
    setDraft(current => ({ ...current, tags: normalizeTags(current.tags).filter(existingTag => existingTag.toLowerCase() !== normalizedKey) }));
    setEditDraft(current => current
      ? { ...current, tags: normalizeTags(current.tags).filter(existingTag => existingTag.toLowerCase() !== normalizedKey) }
      : current);
    setEditBaseline(current => current
      ? { ...current, tags: normalizeTags(current.tags).filter(existingTag => existingTag.toLowerCase() !== normalizedKey) }
      : current);
    updateTasksWithUndo(current => current.map(task => ({
      ...task,
      tags: normalizeTags(task.tags).filter(existingTag => existingTag.toLowerCase() !== normalizedKey)
    })));
  }

  function renameCatalogTag(oldTag, newTag) {
    const normalizedOldTag = normalizeTag(oldTag);
    const normalizedNewTag = normalizeTag(newTag);
    if (!normalizedOldTag || !normalizedNewTag) return;
    const oldKey = normalizedOldTag.toLowerCase();
    const newKey = normalizedNewTag.toLowerCase();
    if (oldKey === newKey) return;

    const replaceTags = tags => normalizeTags(tags, 0).map(tag => (
      tag.toLowerCase() === oldKey ? normalizedNewTag : tag
    ));

    setTagCatalog(current => normalizeTagCatalog(replaceTags(current)));
    setSelectedTagTabs(current => normalizeTags(replaceTags(current), 0));
    setTabLayout(current => normalizeTabLayout(current.map(row => row.map(id => (
      id === getTagTabId(normalizedOldTag) ? getTagTabId(normalizedNewTag) : id
    ))), replaceTags(activeSelectedTagTabs)));
    setDraft(current => ({ ...current, tags: normalizeTags(replaceTags(current.tags)) }));
    setEditDraft(current => current ? { ...current, tags: normalizeTags(replaceTags(current.tags)) } : current);
    setEditBaseline(current => current ? { ...current, tags: normalizeTags(replaceTags(current.tags)) } : current);
    setActiveTagScope(current => current.toLowerCase() === oldKey ? normalizedNewTag : current);
    updateTasksWithUndo(current => current.map(task => ({
      ...task,
      tags: normalizeTags(replaceTags(task.tags))
    })));
  }

  function getCurrentViewSnapshot() {
    return {
      activeAppTab,
      activeTagScope,
      columnFilters: { ...columnFilters },
      isKanbanView
    };
  }

  function getDefaultOverviewSnapshot() {
    return createDefaultSessionViewSnapshot(isMobileViewportNow(), defaultViewModes, defaultStartTabs);
  }

  function restoreEditReturnView() {
    const returnView = editReturnViewRef.current;
    editReturnViewRef.current = null;
    if (!returnView) return;

    setActiveAppTab(returnView.activeAppTab);
    setActiveTagScope(returnView.activeTagScope);
    setColumnFilters(returnView.columnFilters);
    setIsKanbanView(Boolean(returnView.isKanbanView));
  }

  function clearEdit() {
    clearLocalEditDrafts();
    editReturnViewRef.current = null;
    setEditingId(null);
    editDraftRef.current = null;
    setEditDraft(null);
    setEditBaseline(null);
    setEditFocusField("");
  }

  function enterEdit(task, focusField = "", returnView = null) {
    clearLocalEditDrafts();
    editReturnViewRef.current = returnView || editReturnViewRef.current || getCurrentViewSnapshot();
    const nextDraft = {
      ...task,
      dependsOnTaskIds: getPredecessorIds(task),
      successorTaskIds: tasks
        .filter(candidate => getPredecessorIds(candidate).includes(task.id))
        .map(candidate => candidate.id)
    };
    setEditingId(task.id);
    editDraftRef.current = nextDraft;
    setEditDraft(nextDraft);
    setEditBaseline(nextDraft);
    setEditFocusField(focusField);
  }

  function startEdit(task, focusField = "") {
    requestEditExit(() => {
      if (editingId === task.id) {
        if (focusField) {
          setEditFocusField(focusField);
          return;
        }
        cancelEdit();
        return;
      }

      enterEdit(task, focusField);
    });
  }

  function startKanbanEdit(task, focusField = "") {
    requestEditExit(() => {
      const returnView = getCurrentViewSnapshot();
      setIsKanbanView(false);
      closeHeaderMenus();
      setHighlightedTaskId(null);
      enterEdit(task, focusField, returnView);
    });
  }

  function cancelEdit() {
    clearLocalEditDrafts({ discard: true });
    lastEditDraftFieldRef.current = "";
    setEditingId(null);
    editDraftRef.current = null;
    setEditDraft(null);
    setEditBaseline(null);
    setEditFocusField("");
    restoreEditReturnView();
  }

  function cancelEditWithPrompt() {
    requestEditExit(cancelEdit);
  }

  function showListTab(tab) {
    requestEditExit(() => {
      setActionMessage("");
      const isActiveListTab = tab !== REVIEW_TAB && activeAppTab === tab && columnFilters.dueStatus === "Alle";
      const nextTab = isActiveListTab ? ACTIVE_TAB : tab;
      const nextDueStatus = isActiveListTab || tab === NEWEST_TAB || tab === REVIEW_TAB ? "Alle" : columnFilters.dueStatus;
      if (tab === REVIEW_TAB) setActiveTagScope("all");
      if (nextTab === DONE_TAB) setIsKanbanView(false);
      setActiveAppTab(nextTab);
      clearEdit();
      setColumnFilters({ ...getDefaultColumnFilters(nextTab), dueStatus: nextDueStatus });
      setIsActionMenuOpen(false);
      setIsMobileFilterOpen(false);
    });
  }

  function openReviewSummary() {
    setIsReviewSummaryOpen(true);
    setIsActionMenuOpen(false);
  }

  function showDeletedTab() {
    requestEditExit(() => {
      setActionMessage("");
      setActiveAppTab(DELETED_TAB);
      clearEdit();
      setColumnFilters(getDefaultColumnFilters(DELETED_TAB));
      setIsActionMenuOpen(false);
      setIsMobileFilterOpen(false);
    });
  }

  function showDoneTab() {
    requestEditExit(() => {
      setActionMessage("");
      setIsKanbanView(false);
      setActiveAppTab(DONE_TAB);
      clearEdit();
      setColumnFilters(getDefaultColumnFilters(DONE_TAB));
      setIsActionMenuOpen(false);
      setIsMobileFilterOpen(false);
    });
  }

  function showTagScope(tag) {
    requestEditExit(() => {
      setActionMessage("");
      setActiveTagScope(tag);
      const nextTab = activeAppTab === REVIEW_TAB
        ? ACTIVE_TAB
        : [...LIST_TABS, DELETED_TAB].includes(activeAppTab)
          ? activeAppTab
          : ACTIVE_TAB;
      setActiveAppTab(nextTab);
      clearEdit();
      setColumnFilters(getDefaultColumnFilters(nextTab));
      setIsActionMenuOpen(false);
      setIsMobileFilterOpen(false);
    });
  }

  function showCapture() {
    requestEditExit(() => {
      setActionMessage("");
      setCaptureMessage("");
      setActiveAppTab("capture");
      clearEdit();
      setIsActionMenuOpen(false);
      setIsMobileFilterOpen(false);
      setIsTagManagerOpen(false);
      setIsUserManagerOpen(false);
    });
  }

  function showAllOpen() {
    requestEditExit(() => {
      setActionMessage("");
      setActiveTagScope("all");
      setActiveAppTab(ACTIVE_TAB);
      clearEdit();
      setColumnFilters(getDefaultColumnFilters(ACTIVE_TAB));
      setIsActionMenuOpen(false);
      setIsMobileFilterOpen(false);
      setIsTagManagerOpen(false);
      setIsUserManagerOpen(false);
    });
  }

  function scrollToOverviewTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saveEditField(field, value) {
    const currentDraft = editDraftRef.current || editDraft;
    if (!currentDraft) return false;
    const nextDraft = applyCriteriaChange(currentDraft, field, value);
    editDraftRef.current = nextDraft;
    setEditDraft(nextDraft);
    return saveEdit({ keepEditing: true, draftOverride: nextDraft, includeLocalDrafts: false });
  }

  function saveEdit({ keepEditing = true, draftOverride = null, includeLocalDrafts = true } = {}) {
    if (includeLocalDrafts && !saveLocalEditDrafts()) return false;
    const currentDraft = draftOverride || editDraftRef.current || editDraft;
    if (!currentDraft?.task?.trim()) return false;
    const originalTask = tasks.find(task => task.id === editingId);
    const openTaskIds = new Set(tasks.filter(task => task.id !== editingId && !isDone(task) && !isDeleted(task)).map(task => task.id));
    const normalizedDraft = normalizeTask({
      ...currentDraft,
      task: currentDraft.task.trim(),
      comments: normalizeComments(currentDraft.comments),
      subtasks: normalizeSubtasks(currentDraft.subtasks),
      dependsOnTaskIds: normalizeTaskIds(currentDraft.dependsOnTaskIds).filter(id => openTaskIds.has(id))
    });
    const subtaskDateMessage = getSubtaskDateValidationMessage(normalizedDraft);
    if (subtaskDateMessage) {
      setActionMessage(subtaskDateMessage);
      window.alert(subtaskDateMessage);
      return false;
    }

    const isDeletingTask = originalTask && !isDeleted(originalTask) && isDeleted(normalizedDraft);

    if (originalTask && !isDone(originalTask) && isDone(normalizedDraft)) {
      const blockMessage = getPredecessorCompletionBlockMessage(normalizedDraft, tasksById);
      if (blockMessage) {
        setActionMessage(blockMessage);
        window.alert(blockMessage);
        return false;
      }

      const subtaskBlockMessage = getSubtaskCompletionBlockMessage(normalizedDraft);
      if (subtaskBlockMessage) {
        setActionMessage(subtaskBlockMessage);
        window.alert(subtaskBlockMessage);
        return false;
      }
    }

    const nextSuccessorIds = isDone(normalizedDraft)
      ? []
      : normalizeTaskIds(currentDraft.successorTaskIds).filter(id => openTaskIds.has(id));
    const isCompletingTask = originalTask && !isDone(originalTask) && isDone(normalizedDraft);
    const nextTasks = tasks.map(task => {
      if (task.id === editingId) return normalizedDraft;
      if (isCompletingTask) return removePredecessorId(task, editingId);
      if (nextSuccessorIds.includes(task.id)) return addPredecessorIds(task, [editingId]);

      return removePredecessorId(task, editingId);
    });
    const cycleMessage = getDependencyCycleMessage(nextTasks);
    if (cycleMessage) {
      setActionMessage(cycleMessage);
      window.alert(cycleMessage);
      return false;
    }

    updateTasksWithUndo(nextTasks);
    if (isDeletingTask || isCompletingTask) {
      setHighlightedTaskId(null);
      cancelEdit();
      return true;
    }
    if (keepEditing) {
      const nextDraft = {
        ...normalizedDraft,
        dependsOnTaskIds: getPredecessorIds(normalizedDraft),
        successorTaskIds: nextSuccessorIds
      };
      editDraftRef.current = nextDraft;
      setEditDraft(nextDraft);
      setEditBaseline(nextDraft);
      lastEditDraftFieldRef.current = "";
      return true;
    }
    lastEditDraftFieldRef.current = "";
    cancelEdit();
    return true;
  }

  function deleteTask(id, options = {}) {
    const targetTask = tasks.find(task => task.id === id);
    const label = targetTask?.taskCode ? `${targetTask.taskCode}: ${targetTask.task}` : "diesen Task";
    const shouldConfirm = !options.skipConfirm;
    const confirmed = !shouldConfirm || window.confirm(`Really delete ${label}?`);
    if (!confirmed || !targetTask) return;

    const deletedTask = normalizeTask({ ...targetTask, deletedAt: getTodayDateValue() });
    updateTasksWithUndo(current =>
      current
        .map(task => task.id === id ? deletedTask : task)
        .map(task => {
          const nextIds = getPredecessorIds(task).filter(taskId => taskId !== id);
          return { ...task, dependsOnTaskIds: nextIds, dependsOnTaskId: nextIds[0] || "" };
        })
    );
    setColumnFilters(getDefaultColumnFilters(activeAppTab));
    cancelEdit();
    setHighlightedTaskId(null);
  }

  function restoreTask(id) {
    const targetTask = tasks.find(task => task.id === id);
    const restoredTask = targetTask ? normalizeTask({ ...targetTask, deletedAt: "" }) : null;
    updateTasksWithUndo(current =>
      current.map(task => task.id === id && restoredTask ? restoredTask : task)
    );
    if (restoredTask) showTaskView(restoredTask);
  }

  function toggleDone(id) {
    const targetTask = tasks.find(task => task.id === id);
    if (targetTask && isDeleted(targetTask)) return;

    if (targetTask && !isDone(targetTask)) {
      const blockMessage = getPredecessorCompletionBlockMessage(targetTask, tasksById);
      if (blockMessage) {
        setActionMessage(blockMessage);
        window.alert(blockMessage);
        return;
      }

      const subtaskBlockMessage = getSubtaskCompletionBlockMessage(targetTask);
      if (subtaskBlockMessage) {
        setActionMessage(subtaskBlockMessage);
        window.alert(subtaskBlockMessage);
        return;
      }
    }

    const nextTargetTask = normalizeTask({
      ...targetTask,
      googleStatus: isDone(targetTask) ? "Offen" : "Erledigt",
      completedAt: isDone(targetTask) ? "" : getTodayDateValue()
    });

    updateTasksWithUndo(current =>
      current.map(task => {
        if (task.id === id) return nextTargetTask;
        return isDone(targetTask) ? task : removePredecessorId(task, id);
      })
    );
    if (isDone(targetTask)) {
      showTaskView(nextTargetTask);
    }
  }

  function updateTaskField(id, field, value, { preserveView = false } = {}) {
    const targetTask = tasks.find(task => task.id === id);
    if (!targetTask) return;
    if (isDeleted(targetTask) && field !== "googleStatus") return;

    const nextTask = normalizeTask(applyCriteriaChange(targetTask, field, value));
    const isCompletingTask = !isDone(targetTask) && isDone(nextTask);
    const subtaskDateMessage = getSubtaskDateValidationMessage(nextTask);
    if (subtaskDateMessage) {
      setActionMessage(subtaskDateMessage);
      window.alert(subtaskDateMessage);
      return;
    }

    if (isCompletingTask) {
      const blockMessage = getPredecessorCompletionBlockMessage(nextTask, tasksById);
      if (blockMessage) {
        setActionMessage(blockMessage);
        window.alert(blockMessage);
        return;
      }

      const subtaskBlockMessage = getSubtaskCompletionBlockMessage(nextTask);
      if (subtaskBlockMessage) {
        setActionMessage(subtaskBlockMessage);
        window.alert(subtaskBlockMessage);
        return;
      }
    }

    updateTasksWithUndo(current =>
      current.map(task => {
        if (task.id === id) return nextTask;
        return isCompletingTask ? removePredecessorId(task, id) : task;
      })
    );
    if (field === "googleStatus" && value === "Gelöscht") {
      setColumnFilters(getDefaultColumnFilters(activeAppTab));
      cancelEdit();
      setHighlightedTaskId(null);
      return;
    }

    if (!preserveView && !isCompletingTask && (field === "googleStatus" || field === "tags") && !isTaskInActiveViewScope(nextTask)) {
      showTaskView(nextTask);
    }
  }

  async function shareTask(task) {
    const shareText = getTaskSharePayloadText(task);
    const payload = {
      title: `${task.taskCode}: ${task.task}`,
      text: shareText
    };

    try {
      let copiedToClipboard = false;
      try {
        await navigator.clipboard?.writeText(shareText);
        copiedToClipboard = true;
      } catch {
        copiedToClipboard = false;
      }

      if (navigator.share) {
        await navigator.share(payload);
        setActionMessage(
          copiedToClipboard
            ? `Task ${task.taskCode} was shared and copied to the clipboard.`
            : `Task ${task.taskCode} was shared.`
        );
        return;
      }

      if (!copiedToClipboard) await navigator.clipboard.writeText(shareText);
      setActionMessage(`Task ${task.taskCode} was copied to the clipboard.`);
    } catch (error) {
      if (error?.name === "AbortError") return;

      try {
        await navigator.clipboard.writeText(shareText);
        setActionMessage(`Task ${task.taskCode} was copied to the clipboard.`);
      } catch {
        setActionMessage("Sharing is not available in this browser.");
        window.alert("Sharing is not available in this browser.");
      }
    }
  }

  function exportTasksJson() {
    downloadFile("tasks.json", "application/json", JSON.stringify(sortTasks(tasks), null, 2));
  }

  function exportTasksCsv() {
    downloadFile("tasks.csv", "text/csv;charset=utf-8", tasksToCsv(tasks));
  }

  function exportTasksBackup() {
    downloadFile("task-001-backup.json", "application/json", JSON.stringify(createTaskBackup(tasks), null, 2));
  }

  function handleExportFormat(format) {
    if (format === "backup") {
      exportTasksBackup();
      setActionMessage("Backup complete: backup file was created.");
      setIsActionMenuOpen(false);
    }
    if (format === "json") {
      exportTasksJson();
      setActionMessage("Export complete: JSON file was created.");
      setIsActionMenuOpen(false);
    }
    if (format === "csv") {
      exportTasksCsv();
      setActionMessage("Export complete: CSV file was created.");
      setIsActionMenuOpen(false);
    }
  }

  function chooseImportFile(format) {
    importFormatRef.current = format;
    setIsActionMenuOpen(false);
    fileInputRef.current?.click();
  }

  function importTasks(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const confirmed = window.confirm("Warning: existing data will be overwritten!");
    if (!confirmed) {
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const content = String(reader.result);
        const importFormat = importFormatRef.current;
        const importedTasks = importFormat === "csv" || file.name.toLowerCase().endsWith(".csv")
          ? csvToTasks(content)
          : readTasksFromImportPayload(JSON.parse(content));

        if (Array.isArray(importedTasks)) {
          const nextTasks = prepareTaskList(importedTasks.map(normalizeTask).filter(task => task.task));
          updateTasksWithUndo(
            nextTasks
          );
          setActionMessage(`Import abgeschlossen: ${nextTasks.length} Tasks importiert.`);
          setCaptureMessage("");
        } else {
          setActionMessage("Import failed: the file contains no tasks.");
          window.alert("The file contains no tasks.");
        }
      } catch {
        setActionMessage("Import failed: the file could not be imported.");
        window.alert("The file could not be imported.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function showTask(taskId) {
    requestEditExit(() => {
      setActionMessage("");
      const task = tasks.find(candidate => candidate.id === taskId);
      if (!task) return;

      showTaskDetails(task, { highlight: true, scroll: true, preserveView: true, toggle: true });
    });
  }


  function openCapturedTask(taskId) {
    requestEditExit(() => {
      setActionMessage("");
      const task = tasks.find(candidate => candidate.id === taskId);
      if (!task) return;

      showTaskDetails(task, { highlight: true, scroll: true, preserveView: false, forceListView: true });
    });
  }

  function updateEditSectionDefault(device, section, value) {
    setEditSectionDefaults(current => normalizeEditSectionDefaults({
      ...current,
      [device]: {
        ...normalizeEditSectionDefaults(current)[device],
        [section]: value === "open"
      }
    }));
  }

  function toggleKanbanColumn(key) {
    setKanbanColumnKeys(current => {
      const normalized = normalizeKanbanColumns(current);
      const next = normalized.includes(key)
        ? normalized.filter(columnKey => columnKey !== key)
        : [...normalized, key];
      return normalizeKanbanColumns(next);
    });
  }
  function updateCardBadgeColumnSetting(section, value) {
    setCardBadgeColumns(current => normalizeCardBadgeColumns({
      ...current,
      [section]: value === "default" ? "default" : Number(value)
    }));
  }

  function updateTaskDetailDefault(value) {
    const mode = normalizeTaskDetailMode(value);
    const expanded = mode !== "minimum";
    setTaskDetailsExpandedOverride(null);
    setUpcomingBadgeDefaults(current => normalizeUpcomingBadgeDefaults({
      ...current,
      version: TASK_DETAIL_DEFAULTS_VERSION,
      browser: mode,
      mobile: mode,
      dependenciesBrowser: expanded,
      dependenciesMobile: expanded
    }));
  }

  function renderCardBadgeColumnOptions() {
    return getCardBadgeColumnSelectOptions().map(option => (
      <option key={option} value={option}>
        {option === "default" ? `Default (${DEFAULT_CARD_BADGE_COLUMN_COUNT})` : option}
      </option>
    ));
  }
  function openUserDoc() {
    setIsUserDocOpen(true);
    setIsActionMenuOpen(false);
  }

  function openTagManager() {
    setIsTagManagerOpen(true);
    setIsActionMenuOpen(false);
  }

  function openUserManager() {
    setIsUserManagerOpen(true);
    setIsActionMenuOpen(false);
  }

  async function refreshAllowedUserEmails() {
    const { emails, missingSchema } = await loadAllowedUserEmails();
    setAllowedUserEmails(emails);
    setUserAccessMessage(missingSchema
      ? "The Supabase schema must first be extended with allowed_users so user management is available."
      : "");
  }

  async function handleAddAllowedUser() {
    const email = normalizeEmail(newAllowedUserEmail);
    if (!email) return;

    try {
      await addAllowedUserEmail(email);
      setNewAllowedUserEmail("");
      await refreshAllowedUserEmails();
      setActionMessage(`User ${email} allowed.`);
    } catch (error) {
      setUserAccessMessage(`User could not be added: ${error.message}`);
    }
  }

  async function handleRemoveAllowedUser(email) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || normalizedEmail === ALLOWED_USER_EMAIL) return;

    try {
      await removeAllowedUserEmail(normalizedEmail);
      await refreshAllowedUserEmails();
      setActionMessage(`User ${normalizedEmail} removed.`);
    } catch (error) {
      setUserAccessMessage(`User could not be removed: ${error.message}`);
    }
  }

  const actionMenu = (
    <div className="actionsMenu mainActionMenu">
      <button type="button" className="iconButton popupCloseButton" onClick={() => setIsActionMenuOpen(false)} title="Close">
        <X size={16} />
      </button>
      <div className="actionMenuRow settingsRow">
        <span className="menuGroupTitle">View</span>
        <label className="menuCheckbox" title="Switches the browser between compact cards and the wide table view.">
          <input
            type="checkbox"
            checked={isBrowserCompactView}
            onChange={event => setIsBrowserCompactView(event.target.checked)}
          />
          <span>Compact browser</span>
        </label>
        <label className="menuSetting defaultViewModeSetting" title="Sets whether task overviews open as list or Kanban by default in the browser. This setting is persistent.">
          <span>Default view browser</span>
          <select
            value={defaultViewModes.browser}
            onChange={event => setDefaultViewModes(current => ({ ...current, browser: normalizeViewMode(event.target.value) }))}
            title="Choose browser default view"
          >
            <option value="list">List</option>
            <option value="kanban">Kanban</option>
          </select>
        </label>
        <label className="menuSetting defaultViewModeSetting" title="Sets whether task overviews open as list or Kanban by default on the phone. This setting is persistent.">
          <span>Default view phone</span>
          <select
            value={defaultViewModes.mobile}
            onChange={event => setDefaultViewModes(current => ({ ...current, mobile: normalizeViewMode(event.target.value) }))}
            title="Choose phone default view"
          >
            <option value="list">List</option>
            <option value="kanban">Kanban</option>
          </select>
        </label>
        <label className="menuCheckbox" title="Shows help text for fields, card values, and derived values.">
          <input
            type="checkbox"
            checked={areTooltipsEnabled}
            onChange={event => setAreTooltipsEnabled(event.target.checked)}
          />
          <span>Show tooltips</span>
        </label>
        <span className="menuGroupTitle">Layout</span>
        <label className="menuSetting layoutSetting" title="Switches browser layout between light and dark mode.">
          <span>Layout Browser</span>
          <select
            value={darkModeSettings.browser ? "dark" : "normal"}
            onChange={event => setDarkModeSettings(current => ({ ...current, browser: event.target.value === "dark" }))}
            title="Choose browser layout"
          >
            <option value="normal">Light</option>
            <option value="dark">Dark Mode</option>
          </select>
        </label>
        <label className="menuSetting layoutSetting" title="Switches phone layout between light and dark mode.">
          <span>Layout phone</span>
          <select
            value={darkModeSettings.mobile ? "dark" : "normal"}
            onChange={event => setDarkModeSettings(current => ({ ...current, mobile: event.target.value === "dark" }))}
            title="Choose phone layout"
          >
            <option value="normal">Light</option>
            <option value="dark">Dark Mode</option>
          </select>
        </label>
        <span className="menuGroupTitle">Kanban</span>
        <span className="sectionDefaultsLabel" title="Sets which Kanban board columns are visible. This setting is persistent.">Kanban columns</span>
        {KANBAN_COLUMNS.map(column => (
          <label key={column.key} className="menuCheckbox kanbanColumnSetting" title={`${column.title} show or hide in Kanban.`}>
            <input
              type="checkbox"
              checked={kanbanColumnKeys.includes(column.key)}
              onChange={() => toggleKanbanColumn(column.key)}
            />
            <span>{column.title}</span>
          </label>
        ))}
        <label className="menuSetting cardBadgeColumnSetting" title="Sets how many badge columns browser Kanban cards show. Phone Kanban always stays at 3 columns.">
          <span>Kanban badge columns browser</span>
          <select
            value={cardBadgeColumns.kanban}
            onChange={event => updateCardBadgeColumnSetting("kanban", event.target.value)}
            title="Choose badge columns for browser Kanban cards"
          >
            {renderCardBadgeColumnOptions()}
          </select>
        </label>
        <span className="menuGroupTitle">Cards</span>

        <label className="menuSetting cardDetailSetting" title="Sets how task cards open by default. The header icon can temporarily switch the current view.">
          <span>Default task details</span>
          <select
            value={normalizeTaskDetailMode(upcomingBadgeDefaults.browser)}
            onChange={event => updateTaskDetailDefault(event.target.value)}
            title="Choose whether task cards open with minimum or maximum details by default"
          >
            <option value="minimum">Minimum</option>
            <option value="maximum">Maximum</option>
          </select>
        </label>
        <label className="menuSetting cardBadgeColumnSetting" title="Sets how many badge columns browser overview cards show. Phones always stay at 3 columns.">
          <span>Browser overview card columns</span>
          <select
            value={cardBadgeColumns.overview}
            onChange={event => updateCardBadgeColumnSetting("overview", event.target.value)}
            title="Choose badge columns for browser overview cards"
          >
            {renderCardBadgeColumnOptions()}
          </select>
        </label>
        <label className="menuSetting cardBadgeColumnSetting" title="Sets how many badge columns browser edit cards show. Phones always stay at 3 columns.">
          <span>Browser edit card columns</span>
          <select
            value={cardBadgeColumns.edit}
            onChange={event => updateCardBadgeColumnSetting("edit", event.target.value)}
            title="Choose badge columns for browser edit cards"
          >
            {renderCardBadgeColumnOptions()}
          </select>
        </label>
        <span className="menuGroupTitle">Editing</span>

        <span className="sectionDefaultsLabel" title="Sets which edit sections are visible when a task is opened.">Edit sections Browser</span>
        {[["parameters", "Parameter"], ["description", "Description"], ["subtasks", "Subtasks"], ["comments", "Comments"]].map(([key, label]) => (
          <label key={`browser-${key}`} className="menuSetting sectionDefaultSetting" title={`${label} defaults to expanded or collapsed when editing opens in the browser.`}>
            <span>{label}</span>
            <select
              value={editSectionDefaults.browser[key] ? "open" : "closed"}
              onChange={event => updateEditSectionDefault("browser", key, event.target.value)}
              title={`${label}: choose browser default state`}
            >
              <option value="open">Expanded</option>
              <option value="closed">Collapsed</option>
            </select>
          </label>
        ))}
        <span className="sectionDefaultsLabel" title="Sets which edit sections are visible when a task is opened on the phone.">Edit sections Phone</span>
        {[["parameters", "Parameter"], ["description", "Description"], ["subtasks", "Subtasks"], ["comments", "Comments"]].map(([key, label]) => (
          <label key={`mobile-${key}`} className="menuSetting sectionDefaultSetting" title={`${label} defaults to expanded or collapsed when editing opens on the phone.`}>
            <span>{label}</span>
            <select
              value={editSectionDefaults.mobile[key] ? "open" : "closed"}
              onChange={event => updateEditSectionDefault("mobile", key, event.target.value)}
              title={`${label}: choose phone default state`}
            >
              <option value="open">Expanded</option>
              <option value="closed">Collapsed</option>
            </select>
          </label>
        ))}
      </div>
      <span className="menuGroupTitle menuTaskViewsTitle">Task views</span>
      <button type="button" className="secondaryButton menuIconButton menuReviewButton" onClick={() => showListTab(REVIEW_TAB)} title="Review: show tasks that should be checked briefly">
        <Search size={16} />
        <span>Review</span>
        <span className="menuCount">{scopedStatusCounts.review}</span>
      </button>
      <button type="button" className="secondaryButton menuIconButton menuDoneButton" onClick={showDoneTab} title="Show done tasks in the current scope">
        <Check size={16} />
        <span>Done</span>
        <span className="menuCount">{scopedStatusCounts.done}</span>
      </button>
      <button type="button" className="secondaryButton menuIconButton menuDeletedButton" onClick={showDeletedTab} title="Show deleted tasks in the current scope and restore them if needed">
        <Trash2 size={16} />
        <span>Deleted</span>
        <span className="menuCount">{scopedStatusCounts.deleted}</span>
      </button>
      <button type="button" className="secondaryButton menuIconButton menuReviewSummaryButton" onClick={openReviewSummary} title="Show daily/weekly close-out with done, started, open, and overdue tasks">
        <FileText size={16} />
        <span>Close-out</span>
      </button>
      <span className="menuGroupTitle menuManagementTitle">Management</span>
      <button type="button" className="secondaryButton menuDocButton" onClick={openUserDoc} title="Open current user documentation in the app">
        Docs
      </button>
      <button type="button" className="secondaryButton menuTagsButton" onClick={openTagManager} title="Manage tags and choose or sort tag tabs">
        Tags
      </button>
      {isCurrentUserAdmin && (
        <button type="button" className="secondaryButton menuUserButton" onClick={openUserManager} title="Allow or remove Google users">
          Users
        </button>
      )}
      <span className="menuGroupTitle menuSessionTitle">Session</span>
      {isSupabaseConfigured && (
        <button type="button" className="secondaryButton menuLogoutButton" onClick={logout} title="Sign out from Supabase/Google">
          Logout
        </button>
      )}
      <span className="menuGroupTitle menuHistoryTitle">History</span>
      <button
        type="button"
        className="secondaryButton menuIconButton menuUndoButton"
        onClick={undoLastChange}
        disabled={undoStack.length === 0}
        title="Undo last change"
      >
        <Undo2 size={16} />
        <span>Undo</span>
      </button>
      <button
        type="button"
        className="secondaryButton menuIconButton menuRedoButton"
        onClick={redoLastChange}
        disabled={redoStack.length === 0}
        title="Redo reverted change"
      >
        <Redo2 size={16} />
        <span>Redo</span>
      </button>
      <span className="menuGroupTitle menuDataTitle">Data</span>
      <ActionSelect
        label="Export"
        className="menuExportSelect"
        placeholder="Export"
        options={[
          { value: "backup", label: "Backup .json" },
          { value: "json", label: ".json" },
          { value: "csv", label: ".csv" }
        ]}
        onSelect={handleExportFormat}
        title="Export tasks as backup, JSON, or CSV"
      />
      <ActionSelect
        label="Import"
        className="menuRestoreSelect"
        placeholder="Import"
        options={[
          { value: "json", label: ".json" },
          { value: "csv", label: ".csv" }
        ]}
        onSelect={chooseImportFile}
        title="Import tasks from backup, JSON, or CSV"
      />
    </div>
  );
  const filterMenu = (
    <section className="actionsMenu filterMenu" aria-label="Filter">
      <button type="button" className="iconButton popupCloseButton" onClick={() => setIsMobileFilterOpen(false)} title="Close">
        <X size={16} />
      </button>
      <FilterSortField label="ID" sortValue={columnFilters.taskCodeSort} onSortChange={value => updateColumnFilter("taskCodeSort", value)}>
        <ComboInput
          value={columnFilters.taskCode}
          options={taskCodeOptions}
          onChange={value => updateColumnFilter("taskCode", value)}
          placeholder="All"
          ariaLabel="Select ID"
        />
      </FilterSortField>
      <label>
        <span>Prio</span>
        <select value={columnFilters.prio} onChange={event => updateColumnFilter("prio", event.target.value)}>
          <option value="Alle">All</option>
          {PRIO_OPTIONS.map(option => (
            <option key={option} value={option}>{getDisplayValue(option)}</option>
          ))}
        </select>
        <SortToggle value={columnFilters.prioSort} onChange={value => updateColumnFilter("prioSort", value)} ariaLabel="Sort Prio" />
      </label>
      <label>
        <span>Tag</span>
        <select value={columnFilters.tagFilter} onChange={event => updateColumnFilter("tagFilter", event.target.value)}>
          <option value="">All</option>
          <option value="-">No tag</option>
          {tagOptions.map(option => (
            <option key={option} value={option}>{getDisplayValue(option)}</option>
          ))}
        </select>
        <SortToggle value={columnFilters.tagSort} onChange={value => updateColumnFilter("tagSort", value)} ariaLabel="Sort tag" />
      </label>
      <label>
        <span>Task</span>
        <input
          value={columnFilters.task}
          onChange={event => updateColumnFilter("task", event.target.value)}
          placeholder="All"
        />
        <SortToggle value={columnFilters.taskSort} onChange={value => updateColumnFilter("taskSort", value)} ariaLabel="Sort task" />
      </label>
      <label>
        <span>Description</span>
        <input
          value={columnFilters.beschreibung}
          onChange={event => updateColumnFilter("beschreibung", event.target.value)}
          placeholder="All"
        />
        <SortToggle value={columnFilters.beschreibungSort} onChange={value => updateColumnFilter("beschreibungSort", value)} ariaLabel="Sort description" />
      </label>
      <label>
        <span>Subtasks</span>
        <input
          value={columnFilters.subtaskFilter}
          onChange={event => updateColumnFilter("subtaskFilter", event.target.value)}
          placeholder="All"
        />
        <SortToggle value={columnFilters.subtaskSort} onChange={value => updateColumnFilter("subtaskSort", value)} ariaLabel="Sort subtasks" />
      </label>
      <label>
        <span>Predecessors</span>
        <input
          value={columnFilters.predecessorFilter}
          onChange={event => updateColumnFilter("predecessorFilter", event.target.value)}
          placeholder="All"
        />
        <SortToggle value={columnFilters.predecessorSort} onChange={value => updateColumnFilter("predecessorSort", value)} ariaLabel="Sort predecessors" />
      </label>
      <label>
        <span>Successors</span>
        <input
          value={columnFilters.successorFilter}
          onChange={event => updateColumnFilter("successorFilter", event.target.value)}
          placeholder="All"
        />
        <SortToggle value={columnFilters.successorSort} onChange={value => updateColumnFilter("successorSort", value)} ariaLabel="Sort successors" />
      </label>
      <label>
        <span>Status</span>
        <select value={columnFilters.googleStatus} onChange={event => updateColumnFilter("googleStatus", event.target.value)}>
          {STATUS_FILTER_OPTIONS.map(option => (
            <option key={option} value={option}>{getDisplayValue(option)}</option>
          ))}
        </select>
        <SortToggle value={columnFilters.googleStatusSort} onChange={value => updateColumnFilter("googleStatusSort", value)} ariaLabel="Sort status" />
      </label>
      <label>
        <span>Start date</span>
        <input
          value={columnFilters.startdatum}
          onChange={event => updateColumnFilter("startdatum", event.target.value)}
          placeholder="All"
        />
        <SortToggle value={columnFilters.startdatumSort} onChange={value => updateColumnFilter("startdatumSort", value)} ariaLabel="Sort start date" />
      </label>
      <label>
        <span>Due state</span>
        <select value={columnFilters.dueStatus} onChange={event => updateColumnFilter("dueStatus", event.target.value)}>
          {DUE_STATUS_OPTIONS.map(option => (
            <option key={option} value={option}>{getDisplayValue(option)}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Due date</span>
        <input
          value={columnFilters.faellig}
          onChange={event => updateColumnFilter("faellig", event.target.value)}
          placeholder="All"
        />
        <SortToggle value={columnFilters.faelligSort} onChange={value => updateColumnFilter("faelligSort", value)} ariaLabel="Sort due date" />
      </label>
      {showCompletedAtColumn && (
        <label>
          <span>Done on</span>
          <input
            value={columnFilters.completedAt}
            onChange={event => updateColumnFilter("completedAt", event.target.value)}
            placeholder="All"
          />
          <SortToggle value={columnFilters.completedAtSort} onChange={value => updateColumnFilter("completedAtSort", value)} ariaLabel="Sort done date" />
        </label>
      )}
      {showDeletedAtColumn && (
        <label>
          <span>Deleted on</span>
          <input
            value={columnFilters.deletedAt}
            onChange={event => updateColumnFilter("deletedAt", event.target.value)}
            placeholder="All"
          />
          <SortToggle value={columnFilters.deletedAtSort} onChange={value => updateColumnFilter("deletedAtSort", value)} ariaLabel="Sort deleted date" />
        </label>
      )}
      <button type="button" className="secondaryButton" onClick={resetFilters}>
        Reset filters
      </button>
    </section>
  );

  const tagManagerMenu = (
    <section className="actionsMenu tagManagerMenu" aria-label="Tags">
      <button type="button" className="iconButton popupCloseButton" onClick={() => setIsTagManagerOpen(false)} title="Close">
        <X size={16} />
      </button>
      <TagCatalogField tags={tagOptions} maxTags={MAX_TAG_CATALOG_SIZE} onAdd={addCatalogTag} onRemove={removeCatalogTag} onRename={renameCatalogTag} />
      <TagTabsField selectedTags={selectedTagTabs} options={tagOptions} onChange={setSelectedTagTabs} onMove={moveSelectedTagTab} />
    </section>
  );

  const userManagerMenu = (
    <section className="actionsMenu userManagerMenu" aria-label="Users">
      <button type="button" className="iconButton popupCloseButton" onClick={() => setIsUserManagerOpen(false)} title="Close">
        <X size={16} />
      </button>
      <fieldset className="userAccessField">
        <legend>Allow Google user</legend>
        <div className="userAccessList">
          {normalizeEmails(allowedUserEmails).map(email => (
            <span key={email} className="userAccessItem">
              <span>{email}{email === ALLOWED_USER_EMAIL ? " · Admin" : ""}</span>
              <button
                type="button"
                className="iconButton userAccessRemoveButton"
                onClick={() => handleRemoveAllowedUser(email)}
                disabled={email === ALLOWED_USER_EMAIL}
                title={email === ALLOWED_USER_EMAIL ? "Admin cannot be removed" : `${email} remove`}
              >
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
        <div className="userAccessNewRow">
          <input
            type="email"
            value={newAllowedUserEmail}
            onChange={event => setNewAllowedUserEmail(event.target.value)}
            onKeyDown={event => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              handleAddAllowedUser();
            }}
            placeholder="google.user@example.com"
          />
          <button type="button" className="iconButton" onClick={handleAddAllowedUser} disabled={!normalizeEmail(newAllowedUserEmail)} title="Add user">
            <Plus size={16} />
          </button>
        </div>
        {userAccessMessage && <p className="storageStatus storageError">{userAccessMessage}</p>}
      </fieldset>
    </section>
  );

  if (isSupabaseConfigured && (!session || !isAccessListLoaded || !isCurrentUserAllowed)) {
    return (
      <main className="authPage">
        <section className="authPanel">
          <div>
            <p className="eyebrow">task-001</p>
            <h1>Sign in</h1>
            <p>
              {!session
                ? "Online storage with Supabase is active. Please sign in with Google."
                : !isAccessListLoaded
                  ? "Checking access..."
                  : "This Google account is not allowed for task-001 yet."}
            </p>
          </div>

          {(authMessage || userAccessMessage) && <p className="authMessage">{authMessage || userAccessMessage}</p>}

          <button type="button" className="primaryButton" onClick={loginWithGoogle} disabled={authLoading || Boolean(session)}>
            {authLoading ? "Redirecting..." : "Sign in with Google"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbarTitle">
          <button type="button" className="topbarTitleButton" onClick={showAllOpen} title="Show all active tasks without additional filters">
            task-001
          </button>
          {storageError && <p className="storageStatus storageError">{storageError}</p>}
        </div>
        <div className="topbarActions" ref={topbarActionsRef}>
          <button
            type="button"
            className={`iconButton ${activeAppTab === "capture" ? "active" : ""}`}
            onClick={showCapture}
            aria-label="Create task"
            title="Create task"
          >
            <Plus size={18} />
          </button>
          {isListTab(activeAppTab) && !isSingleTaskEditMode && (
            <button
              type="button"
              className={`iconButton ${isKanbanView ? "active" : ""}`}
              onClick={() => setIsKanbanView(current => !current)}
              aria-label={isKanbanView ? "Show standard view" : "Show Kanban view"}
              title={isKanbanView ? "Show standard view" : "Show Kanban view"}
            >
              {isKanbanView ? <List size={18} /> : <Columns3 size={18} />}
            </button>
          )}
          {isListTab(activeAppTab) && !isSingleTaskEditMode && (
            <button
              type="button"
              className={`iconButton ${areTaskDetailsExpanded ? "active" : ""}`}
              onClick={() => setTaskDetailsExpandedOverride(current => getNextTaskDetailMode(typeof current === "string" ? current : defaultTaskDetailMode))}
              aria-label={`View: show ${getTaskDetailModeLabel(getNextTaskDetailMode(taskDetailDisplayMode))} task details`}
              title={`View: current ${getTaskDetailModeLabel(taskDetailDisplayMode)}. Click for ${getTaskDetailModeLabel(getNextTaskDetailMode(taskDetailDisplayMode))}.`}
            >
              {taskDetailDisplayMode === "maximum" ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          )}
          {isListTab(activeAppTab) && !isSingleTaskEditMode && (
            <>
              <button
                type="button"
                className="iconButton filterIconButton"
                onClick={() => {
                  setIsMobileFilterOpen(current => !current);
                  setIsActionMenuOpen(false);
                  setIsTagManagerOpen(false);
                  setIsUserManagerOpen(false);
                }}
                aria-expanded={isMobileFilterOpen}
                aria-label={`Filter${activeFilterBadges.length > 0 ? ` (${activeFilterBadges.length})` : ""}`}
                title={filterButtonTitle}
              >
                <SlidersHorizontal size={18} />
                {activeFilterBadges.length > 0 && <span className="iconBadgeCount">{activeFilterBadges.length}</span>}
              </button>
              <button
                type="button"
                className="iconButton"
                onClick={resetFilters}
                disabled={activeFilterCount === 0}
                aria-label="Reset filters"
                title="Reset filters"
              >
                <RotateCcw size={18} />
              </button>
            </>
          )}
          <button
            type="button"
            className="iconButton"
            onClick={() => {
              setIsActionMenuOpen(current => !current);
              setIsMobileFilterOpen(false);
              setIsTagManagerOpen(false);
              setIsUserManagerOpen(false);
            }}
            aria-expanded={isActionMenuOpen}
            aria-label="Options"
            title="Options"
          >
            <MoreHorizontal size={18} />
          </button>
          {isActionMenuOpen && actionMenu}
          {isTagManagerOpen && tagManagerMenu}
          {isUserManagerOpen && userManagerMenu}
          {isMobileFilterOpen && isListTab(activeAppTab) && filterMenu}
          <input
            ref={fileInputRef}
            className="hiddenFile"
            type="file"
            accept="application/json,.json,text/csv,.csv"
            onChange={importTasks}
          />
        </div>
      </header>
      <main>
        {!isSingleTaskEditMode && (
          <TaskScopeTabs
            activeAppTab={activeAppTab}
            activeTagScope={activeTagScope}
            counts={counts}
            statusCounts={scopedStatusCounts}
            activeGoogleStatus={columnFilters.googleStatus}
            tagTabCounts={tagTabCounts}
            tabLayout={visibleTabLayout}
            draggedTabRef={draggedTagTabRef}
            onShowTagScope={showTagScope}
            onShowListTab={showListTab}
            onMoveTab={moveVisibleTab}
            isSearchActive={isOverviewSearchActive}
            isKanbanView={isKanbanView}
          />
        )}

        {isListTab(activeAppTab) && !isSingleTaskEditMode && (
          <div className="activeFilterBadges currentSelectionBadges" aria-label="Current selection">
            {currentSelectionBadges.map(item => (
              <span key={item.key} className="activeFilterBadge" title={`${item.label}: ${item.value}`}>
                {item.label}: {item.value}
              </span>
            ))}
          </div>
        )}

        {isListTab(activeAppTab) && !isSingleTaskEditMode && activeFilterBadges.length > 0 && (
          <div className="activeFilterBadges" aria-label="Active filters">
            {activeFilterBadges.map(filter => (
              <span key={filter.key} className="activeFilterBadge" title={`${filter.label}: ${filter.value}`}>
                {filter.label}: {filter.value}
              </span>
            ))}
          </div>
        )}

        {activeAppTab === REVIEW_TAB && !isSingleTaskEditMode && (
          <div className="activeFilterBadges reviewInfoBadges" aria-label="Review includes">
            <span className="activeFilterBadge reviewInfoBadge">Review includes:</span>
            {REVIEW_INFO_ITEMS.map(item => (
              <span key={item} className="activeFilterBadge reviewInfoBadge" title={item}>
                {item}
              </span>
            ))}
          </div>
        )}

        {actionMessage && <p className="successMessage appMessage">{actionMessage}</p>}

        {(isListTab(activeAppTab) || activeAppTab === "capture") && (
          <div className="overviewSearchBox" role="search">
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              value={columnFilters.overviewSearch}
              onChange={event => updateColumnFilter("overviewSearch", event.target.value)}
              placeholder="Search all tasks"
              aria-label="Search all tasks"
            />
            {columnFilters.overviewSearch && (
              <button
                type="button"
                className="iconButton"
                onClick={() => updateColumnFilter("overviewSearch", "")}
                aria-label="Clear search"
                title="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}

        {activeAppTab === "capture" && (
          <form
            className="taskForm"
            onSubmit={addTask}
            onPointerDownCapture={event => {
              if (!captureMessage || event.target.closest?.(".successMessage")) return;
              setCaptureMessage("");
            }}
            onFocusCapture={event => {
              if (!captureMessage || event.target.closest?.(".successMessage")) return;
              setCaptureMessage("");
            }}
          >
            {captureMessage && (
              <p className="successMessage">
                Task{" "}
                {typeof captureMessage === "object" ? (
                  <button type="button" className="inlineLinkButton" onClick={() => openCapturedTask(captureMessage.id)}>
                    {captureMessage.code}
                  </button>
                ) : null}
                {" "}created
              </p>
            )}

            <label className="captureTaskField" title={getTooltip("task", draft.task)}>
              <span>Task <strong>required</strong></span>
              <textarea
                value={draft.task}
                onChange={event => updateDraft("task", event.target.value)}
                placeholder="Enter task"
                title={getTooltip("task", draft.task)}
                rows={2}
                maxLength={TEXT_LIMITS.task.max}
                required
              />
              <InputGuidance value={draft.task} limits={TEXT_LIMITS.task} label="Task name" />
            </label>

            <label className="captureDescriptionField" title={getTooltip("beschreibung", draft.beschreibung)}>
              <span>Description</span>
              <AutoGrowTextarea
                value={draft.beschreibung}
                onChange={event => updateDraft("beschreibung", event.target.value)}
                maxRows={10}
                maxLength={TEXT_LIMITS.description.max}
                title={getTooltip("beschreibung", draft.beschreibung)}
              />
            </label>

            <TagEditorField
              values={draft.tags}
              options={tagOptions}
              onChange={value => updateDraft("tags", value)}
              title={getTooltip("tags", normalizeTags(draft.tags)[0] || "-")}
            />

            <div className="formRow compact captureAdvancedFields">
              <SelectField
                label="Damage"
                value={draft.risiko}
                options={RISIKO_OPTIONS}
                onChange={value => updateDraft("risiko", value)}
                title={getTooltip("risiko", draft.risiko)}
                requiredChoice
              />
              <SelectField
                label="Impact"
                value={draft.impact}
                options={IMPACT_OPTIONS}
                onChange={value => updateDraft("impact", value)}
                title={getTooltip("impact", draft.impact)}
                requiredChoice
              />
            </div>

            <div className="formRow compact captureAdvancedFields">
              <TaskMultiDependencyField
                label="Predecessors"
                values={draft.dependsOnTaskIds}
                options={dependencyOptions}
                onChange={value => updateDraft("dependsOnTaskIds", value)}
                title={getTooltip("dependsOnTaskIds", normalizeTaskIds(draft.dependsOnTaskIds).length ? `${normalizeTaskIds(draft.dependsOnTaskIds).length} selected` : "-")}
              />
              <TaskMultiDependencyField
                label="Successors"
                values={draft.successorTaskIds}
                options={dependencyOptions}
                onChange={value => updateDraft("successorTaskIds", value)}
                title={getTooltip("successorTaskIds", normalizeTaskIds(draft.successorTaskIds).length ? `${normalizeTaskIds(draft.successorTaskIds).length} selected` : "-")}
              />
            </div>

            <div className="derivedValuesRow captureDerivedRow" aria-label="Derived values">
              <span>
                Prio: <strong className={`prio ${getPrioClass(getEffectivePrio(draft.prio))}`} data-prio={getEffectivePrio(draft.prio)} title={getTooltipForTask(draft, "prio", getEffectivePrio(draft.prio))}>{getDisplayValue(getEffectivePrio(draft.prio))}</strong>
              </span>
            </div>

            <div className="formRow dateRow captureAdvancedFields">
              <label title={getTooltip("startdatum", formatDate(draft.startdatum) || "-")}>
                <span>Start date</span>
                <input
                  type="date"
                  value={draft.startdatum}
                  onChange={event => updateDraft("startdatum", event.target.value)}
                  title={getTooltip("startdatum", formatDate(draft.startdatum) || "-")}
                />
              </label>
              <label title={getTooltip("faellig", formatDate(draft.faellig) || "-")}>
                <span>Due</span>
                <input
                  type="date"
                  value={draft.faellig}
                  onChange={event => updateDraft("faellig", event.target.value)}
                  title={getTooltip("faellig", formatDate(draft.faellig) || "-")}
                />
              </label>
            </div>

            <button type="submit" className="primaryButton">
              <Plus size={18} />
              Add task
            </button>
          </form>
        )}

        {isListTab(activeAppTab) && (
          <>
            <section className={`tableWrap ${isBrowserCompactView || isKanbanView || isSingleTaskEditMode ? "isCompactHidden" : ""} ${editingId ? "isEditingOnMobile" : ""}`}>
          <table>
            <thead>
              <tr>
                <th>Done</th>
                <th>ID</th>
                <th>
                  <span className="helpLabel" title={PRIO_HELP}>Prio</span>
                </th>
                <th>Tag</th>
                <th>Task</th>
                <th>Description</th>
                <th>Subtasks</th>
                <th>Predecessors</th>
                <th>Successors</th>
                <th>Status</th>
                <th>Start date</th>
                <th>Due</th>
                {showCompletedAtColumn && <th>Done on</th>}
                {showDeletedAtColumn && <th>Deleted on</th>}
                <th></th>
              </tr>
              <tr className="filterRow">
                <th></th>
                <th>
                  <ComboInput
                    value={columnFilters.taskCode}
                    options={taskCodeOptions}
                    onChange={value => updateColumnFilter("taskCode", value)}
                    placeholder="ID"
                    ariaLabel="Select ID"
                  />
                  <SortToggle value={columnFilters.taskCodeSort} onChange={value => updateColumnFilter("taskCodeSort", value)} ariaLabel="Sort ID" />
                </th>
                <th>
                  <select
                    value={columnFilters.prio}
                    onChange={event => updateColumnFilter("prio", event.target.value)}
                  >
                    <option value="Alle">All</option>
                    {PRIO_OPTIONS.map(option => (
                      <option key={option} value={option}>{getDisplayValue(option)}</option>
                    ))}
                  </select>
                  <SortToggle value={columnFilters.prioSort} onChange={value => updateColumnFilter("prioSort", value)} ariaLabel="Sort Prio" />
                </th>
                <th>
                  <select
                    value={columnFilters.tagFilter}
                    onChange={event => updateColumnFilter("tagFilter", event.target.value)}
                    aria-label="Tag"
                  >
                    <option value="">All</option>
                    <option value="-">No tag</option>
                    {tagOptions.map(option => (
                      <option key={option} value={option}>{getDisplayValue(option)}</option>
                    ))}
                  </select>
                  <SortToggle value={columnFilters.tagSort} onChange={value => updateColumnFilter("tagSort", value)} ariaLabel="Sort tag" />
                </th>
                <th>
                  <input
                    value={columnFilters.task}
                    onChange={event => updateColumnFilter("task", event.target.value)}
                    placeholder="All"
                  />
                  <SortToggle value={columnFilters.taskSort} onChange={value => updateColumnFilter("taskSort", value)} ariaLabel="Sort task" />
                </th>
                <th>
                  <input
                    value={columnFilters.beschreibung}
                    onChange={event => updateColumnFilter("beschreibung", event.target.value)}
                    placeholder="All"
                  />
                  <SortToggle value={columnFilters.beschreibungSort} onChange={value => updateColumnFilter("beschreibungSort", value)} ariaLabel="Sort description" />
                </th>
                <th>
                  <input
                    value={columnFilters.subtaskFilter}
                    onChange={event => updateColumnFilter("subtaskFilter", event.target.value)}
                    placeholder="All"
                  />
                  <SortToggle value={columnFilters.subtaskSort} onChange={value => updateColumnFilter("subtaskSort", value)} ariaLabel="Sort subtasks" />
                </th>
                <th>
                  <input
                    value={columnFilters.predecessorFilter}
                    onChange={event => updateColumnFilter("predecessorFilter", event.target.value)}
                    placeholder="All"
                  />
                  <SortToggle value={columnFilters.predecessorSort} onChange={value => updateColumnFilter("predecessorSort", value)} ariaLabel="Sort predecessors" />
                </th>
                <th>
                  <input
                    value={columnFilters.successorFilter}
                    onChange={event => updateColumnFilter("successorFilter", event.target.value)}
                    placeholder="All"
                  />
                  <SortToggle value={columnFilters.successorSort} onChange={value => updateColumnFilter("successorSort", value)} ariaLabel="Sort successors" />
                </th>
                <th>
                  <SortToggle value={columnFilters.googleStatusSort} onChange={value => updateColumnFilter("googleStatusSort", value)} ariaLabel="Sort status" />
                </th>
                <th>
                  <input
                    value={columnFilters.startdatum}
                    onChange={event => updateColumnFilter("startdatum", event.target.value)}
                    placeholder="All"
                  />
                  <SortToggle value={columnFilters.startdatumSort} onChange={value => updateColumnFilter("startdatumSort", value)} ariaLabel="Sort start date" />
                </th>
                <th>
                  <input
                    value={columnFilters.faellig}
                    onChange={event => updateColumnFilter("faellig", event.target.value)}
                    placeholder="All"
                  />
                  <select
                    value={columnFilters.dueStatus}
                    onChange={event => updateColumnFilter("dueStatus", event.target.value)}
                    aria-label="Due state"
                  >
                    {DUE_STATUS_OPTIONS.map(option => (
                      <option key={option} value={option}>{getDisplayValue(option)}</option>
                    ))}
                  </select>
                  <SortToggle value={columnFilters.faelligSort} onChange={value => updateColumnFilter("faelligSort", value)} ariaLabel="Sort due" />
                </th>
                {showCompletedAtColumn && (
                  <th>
                    <input
                      value={columnFilters.completedAt}
                      onChange={event => updateColumnFilter("completedAt", event.target.value)}
                      placeholder="All"
                    />
                    <SortToggle value={columnFilters.completedAtSort} onChange={value => updateColumnFilter("completedAtSort", value)} ariaLabel="Sort done date" />
                  </th>
                )}
                {showDeletedAtColumn && (
                  <th>
                    <input
                      value={columnFilters.deletedAt}
                      onChange={event => updateColumnFilter("deletedAt", event.target.value)}
                      placeholder="All"
                    />
                    <SortToggle value={columnFilters.deletedAtSort} onChange={value => updateColumnFilter("deletedAtSort", value)} ariaLabel="Sort deleted date" />
                  </th>
                )}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleTasksWithEditingTask.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  highlightedTaskId={highlightedTaskId}
                  isEditing={editingId === task.id}
                  hasUnsavedChanges={editingId === task.id && hasAnyUnsavedEditChanges}
                  getTooltip={(field, value) => getTooltipForTask(editingId === task.id ? editDraft : task, field, value)}
                  dueReminderTooltip={getDueReminderTooltip(editingId === task.id && editDraft ? editDraft : task)}
                  editDraft={editDraft}
                  editFocusField={editingId === task.id ? editFocusField : ""}
                  editSectionDefaults={activeEditSectionDefaults}
                  onStartEdit={startEdit}
                  onCancelEdit={cancelEditWithPrompt}
                  onSaveEdit={saveEdit}
                  onSaveEditField={saveEditField}
                  onLocalEditDraftChange={updateLocalEditDraft}
                  onRequestEditExit={requestEditExit}
                  onDelete={deleteTask}
                  onRestore={restoreTask}
                  onToggleDone={toggleDone}
                  onShareTask={shareTask}
                  onQuickChange={updateTaskField}
                  predecessorTargets={getRelationTargets(getPredecessorIds(task), tasksById, "Predecessors")}
                  successorTargets={getRelationTargets(childIdsByParent.get(task.id) || [], tasksById, "Successors")}
                  dependencyOptions={getTaskOptions(tasks, task.id)}
                  tagOptions={tagOptions}
                  onShowTask={showTask}
                  onChange={updateEditDraft}
                  showCompletedAt={showCompletedAtColumn}
                  showDeletedAt={showDeletedAtColumn}
                />
              ))}
            </tbody>
            </table>
            {visibleTasksWithEditingTask.length === 0 && <div className="emptyState">No tasks found.</div>}
          </section>

          <section className={`mobileTaskList ${isBrowserCompactView ? "browserCompactTaskList" : ""} ${isKanbanView && !isSingleTaskEditMode ? "isKanbanHidden" : ""} ${isSingleTaskEditMode ? "singleTaskEditList" : ""}`} aria-label="Tasks">
            {taskCardsToRender.map(task => (
              <MobileTaskCard
                key={task.id}
                {...getMobileTaskCardProps(task)}
              />
            ))}
            {!isSingleTaskEditMode && visibleTasksWithEditingTask.length === 0 && <div className="emptyState">No tasks found.</div>}
          </section>

          {isKanbanView && !isSingleTaskEditMode && (
            <div className={`kanbanBoardShell ${kanbanScrollHint.left ? "canScrollLeft" : ""} ${kanbanScrollHint.right ? "canScrollRight" : ""} ${isKanbanHorizontallyScrollable ? "canDragScroll" : ""}`}>
              <div
                ref={kanbanTopScrollbarRef}
                className="kanbanTopScrollbar"
                onScroll={handleKanbanTopScroll}
                aria-hidden="true"
                style={{ "--kanban-scroll-width": `${kanbanScrollWidth}px` }}
              >
                <div className="kanbanTopScrollbarContent" />
              </div>
              <section
                ref={kanbanBoardRef}
                className={`kanbanBoard ${isKanbanHorizontallyScrollable ? "canDragScroll" : ""}`}
                aria-label="Kanban-View"
                onScroll={handleKanbanBoardScroll}
                onPointerDown={handleKanbanPointerDown}
                onPointerMove={handleKanbanPointerMove}
                onPointerUp={finishKanbanDrag}
                onPointerCancel={finishKanbanDrag}
                onClickCapture={handleKanbanClickCapture}
                style={{ "--kanban-column-count": kanbanColumnGroups.length, "--kanban-badge-columns": kanbanBadgeColumnCount, "--kanban-badge-grid-width": `${kanbanBadgeGridWidth}px`, "--kanban-column-width": `${kanbanColumnWidth}px` }}
              >
                {kanbanColumnGroups.map(column => (
                  <article
                    key={column.key}
                    className={`kanbanColumn ${dragOverKanbanColumn === column.key ? "isDropTarget" : ""}`.trim()}
                    onDragOver={event => handleKanbanColumnDragOver(event, column.key)}
                    onDragLeave={event => handleKanbanColumnDragLeave(event, column.key)}
                    onDrop={event => handleKanbanColumnDrop(event, column.key)}
                  >
                    <header className="kanbanColumnHeader">
                      <h2>{column.title}</h2>
                      <span>{column.tasks.length}</span>
                    </header>
                    <div className="kanbanColumnTasks">
                      {column.tasks.map(task => (
                        <MobileTaskCard
                          key={task.id}
                          {...getMobileTaskCardProps(task, {
                            isMobileViewport: isKanbanMobileViewport,
                            cardBadgeColumns: isKanbanMobileViewport ? DEFAULT_CARD_BADGE_COLUMNS : kanbanCardBadgeColumns,
                            onStartEdit: startKanbanEdit,
                            dragProps: isKanbanMobileViewport ? {} : {
                              draggable: true,
                              onDragStart: event => handleKanbanCardDragStart(event, task),
                              onDragEnd: handleKanbanCardDragEnd
                            }
                          })}
                        />
                      ))}
                      {column.tasks.length === 0 && <div className="kanbanEmpty">No tasks</div>}
                    </div>
                  </article>
                ))}
              </section>
            </div>
          )}

          {showBackToTop && (
            <button type="button" className="backToTopButton" onClick={scrollToOverviewTop}>
              Back to top
            </button>
          )}
        </>
        )}
      </main>

      {isEditExitPromptOpen && (
        <div className="modalBackdrop saveChangesBackdrop" role="presentation" data-edit-exit-prompt="true" onMouseDown={event => event.stopPropagation()}>
          <section className="confirmModal" role="dialog" aria-modal="true" aria-labelledby="edit-exit-prompt-title">
            <header className="popupHeader">
              <h2 id="edit-exit-prompt-title">Save changes?</h2>
            </header>
            <p>This task has unsaved changes.</p>
            <div className="confirmActions">
              <button type="button" className="secondaryButton" onClick={continueEditExitWithoutSave}>Discard</button>
              <button type="button" className="primaryButton" onClick={continueEditExitAfterSave}>Save</button>
            </div>
          </section>
        </div>
      )}
      {isReviewSummaryOpen && (
        <div className="modalBackdrop" role="presentation" onMouseDown={() => setIsReviewSummaryOpen(false)}>
          <section className="userDocModal reviewSummaryModal" role="dialog" aria-modal="true" aria-labelledby="review-summary-title" onMouseDown={event => event.stopPropagation()}>
            <header>
              <h2 id="review-summary-title">Daily/weekly close-out</h2>
              <button type="button" className="iconButton" onClick={() => setIsReviewSummaryOpen(false)} title="Close close-out">
                <X size={18} />
              </button>
            </header>
            <div className="reviewSummaryContent">
              <div className="reviewSummaryGrid" aria-label="Close-out numbers">
                <span><strong>{reviewSummary.doneToday}</strong><small>done today</small></span>
                <span><strong>{reviewSummary.doneWeek}</strong><small>done in 7 days</small></span>
                <span><strong>{reviewSummary.started}</strong><small>started</small></span>
                <span><strong>{reviewSummary.open}</strong><small>still open</small></span>
                <span><strong>{reviewSummary.overdue}</strong><small>overdue</small></span>
              </div>
              <h3>Quick review today</h3>
              <ul className="reviewTaskList">
                {reviewTasks.length === 0 && <li>No review tasks.</li>}
                {reviewTasks.slice(0, 12).map(task => (
                  <li key={task.id}>
                    <button type="button" className="inlineLinkButton" onClick={() => { setIsReviewSummaryOpen(false); startEdit(task); }}>
                      {task.taskCode || "Task"}
                    </button>
                    <span>{task.task}</span>
                    <small>{getTaskReviewReasons(task).join(" · ")}</small>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      )}
      {isUserDocOpen && (
        <div className="modalBackdrop" role="presentation" onMouseDown={() => setIsUserDocOpen(false)}>
          <section
            className="userDocModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-doc-title"
            onMouseDown={event => event.stopPropagation()}
          >
            <header>
              <div>
                <p className="eyebrow">User docs</p>
                <h2 id="user-doc-title">Using task-001</h2>
              </div>
              <button type="button" className="iconButton" onClick={() => setIsUserDocOpen(false)} title="Close docs">
                <X size={18} />
              </button>
            </header>

            <div className="userDocContent">
              <section>
                <h3>Purpose</h3>
                <ul>
                  <li>task-001 is built for fast operational task triage: capture work, classify it, decide what is important, urgent, or unclear, and keep it visible until it is started or done.</li>
                  <li>The app is aimed at individuals and small operational teams that need lightweight action steering. It is intentionally focused on categorizing, prioritizing, and reviewing tasks.</li>
                </ul>
              </section>

              <section>
                <h3>Navigation</h3>
                <ul>
                  <li>The top title resets the session to All without status, due, tag, or column filters. Current view, scope, mode, and search are shown in the info line below the tabs; the filter icon shows the active filter/sort count and lists them on hover. Done and Deleted count as view filters and can be left with Reset filters.</li>
                  <li>All is the primary tab. Tasks that need immediate attention, such as clarification, reached start dates, due-today work, overdue work, and matching subtask reminders, are marked directly on the task with a red exclamation mark.</li>
                  <li>All and Done share the row above the tag row. Backlog and Doing can still be reached from the header filter's Status dropdown; Deleted, Review, and Close-out are available from Options.</li>
                  <li>The search field is session-only and searches across all active tasks regardless of the currently selected tab or filters. In Done, it searches done tasks only; in Deleted, it searches deleted tasks only.</li>
                </ul>
              </section>

              <section>
                <h3>Views</h3>
                <ul>
                  <li>The header view icon switches the current session between List and Kanban. That toggle is temporary; persistent defaults are changed only in Options.</li>
                  <li>Browser and phone can have separate default view modes and separate edit-section defaults. Edit sections default to expanded on both devices and are stored in user settings when the Supabase columns exist, with local storage as fallback.</li>
                  <li>Task details can be switched with the header icon for the current view. Options set only the default for fresh sessions: Minimum hides parameter badges and card content, including the Additional details label. Maximum shows parameter badges; cards with a description, subtasks, or comments show their labeled content panels directly below the badges, with no Additional details label or toggle to click.</li>
                  <li>Kanban groups tasks into the enabled columns Backlog, Doing, and Done; the Done column is the only place in the All tab and tag scopes where done tasks show up outside the dedicated Done tab/menu view.</li>
                  <li>On browser, dragging a card to another Kanban column changes its status (Backlog, Doing, or Done) directly, including the usual start-date auto-fill and completion checks; the current view stays put instead of jumping to that status.</li>
                  <li>On phones, Kanban scrolls horizontally by column, shows edge hints when more columns are available, and snaps to the next column while scrolling.</li>
                </ul>
              </section>

              <section>
                <h3>Task Values</h3>
                <ul>
                  <li>Priority answers: how important is this? It is derived from damage and impact. Default sort: Prioritize, P1, P2, P3.</li>
                  <li>When a task first becomes Doing and has no start date, the app sets the start date to today.</li>
                </ul>
              </section>

              <section>
                <h3>Cards</h3>
                <ul>
                  <li>Cards use fixed badge cells so values stay aligned across tasks. Phones always use three badge columns; browser list, browser edit, and browser Kanban badge columns can be configured separately in Options.</li>
                  <li>Empty values show a dash. Start and Due keep their labels visible and may wrap to two lines on phones after the colon so the date stays visible.</li>
                  <li>Reached start dates, due-today dates, and overdue due dates are shown by coloring the date value red instead of adding separate badges.</li>
                  <li>Predecessors and Successors are shown as labeled clickable text in the card details outside edit mode and can be clicked to jump to the related task while keeping the current view. In Minimum detail mode, card details and the Additional details label stay hidden; in Maximum detail mode, badges are visible and cards with description, subtasks, or comments show the labeled detail panels directly, with no Additional details label needed.</li>
                  <li>Adjacent icons use the same size. Share, delete, and completion are the card action icons; relation arrow icons are intentionally not shown. The Share icon includes a direct task URL such as ?task-id=T-123, which opens the task in Maximum detail view after login. Clicking a task ID while the session is in Minimum mode locally opens just that card's badges, without changing the global view mode or affecting any other card; its description/subtasks/comments still open through a collapsible Additional details label below the badges, unlike true Maximum mode where those panels show directly with no label to click. The save icon is a disk, completion uses a check, delete uses trash, close uses x, and a due-reminder warning uses a red exclamation mark near the task ID.</li>
                </ul>
              </section>

              <section>
                <h3>Editing</h3>
                <ul>
                  <li>Edit mode is a single-task surface divided into Parameter, Description, Subtasks, and Comments. Each section is collapsible and its default open/closed state can be configured separately for browser and phone in Options; the default is expanded. In Minimum overview mode, opening card details through Additional details opens only one task's panels at a time, closing any previously opened card; Maximum overview mode shows every card's labeled panels at once since there is no toggle to open/close.</li>
                  <li>Collapsed Parameter still shows the compact overview values. Tapping a compact value on touch devices shows its tooltip; tapping the section heading opens the editable controls.</li>
                  <li>Normal task changes are saved with the task-level disk icon. Description, comment, and subtask edits each use their own local disk icon where the edit happens; while any local text draft is unsaved, both the local disk and the task-level disk are highlighted, and saving either the local draft or all changes clears the relevant highlighted icons. The local description x asks whether to save or discard that description draft; clicking outside leaves the inline editor open.</li>
                  <li>If you leave an edit surface with unsaved changes, the app asks whether to save or discard. Completing and deleting tasks keep their explicit confirmation prompts.</li>
                  <li>Description supports paragraphs, bullet points, and clickable web links. Long descriptions are previewed and can be opened in a popup.</li>
                  <li>Predecessor and Successor fields use searchable checkbox dropdowns: type to narrow the task list, or keep selecting from the dropdown as usual.</li>
                  <li>Text fields guide length without blocking fast capture too early: task names wrap in a wider controlled, non-resizable field while capturing and editing, other multiline fields scroll internally when needed without manual resize handles, task names warn at 80/125 and stop at 250, subtasks warn at 250 and stop at 1000, comments warn at 500 and stop at 5000, descriptions stop at 20000, and tags stop at 24.</li>
                </ul>
              </section>

              <section>
                <h3>Subtasks And Comments</h3>
                <ul>
                  <li>Subtasks are an internal checklist inside a task. They remain visible when done, can be reopened, and all subtasks must be done before the parent task can be completed.</li>
                  <li>Subtasks use the same inline create/edit card pattern as comments: an empty input sits at the top, existing entries are visually separated, and save, trash/delete, and done icons sit on the right. Start and Due date fields remain available for subtasks.</li>
                  <li>Subtasks can have optional start and due dates. Those dates are included in the due/overdue reminders as long as the parent task and subtask are still open. New subtasks use a disk icon to save and an x icon to discard the pending input.</li>
                  <li>Comments appear below subtasks. New comments are inserted at the top and store creation and edit dates. Comment and subtask text fields use the same editor width as the description field.</li>
                </ul>
              </section>

              <section>
                <h3>Options</h3>
                <ul>
                  <li>Options contains persistent settings for layout, dark mode, tooltips, browser/phone edit section defaults, tab layout, badge columns, Kanban columns, default views, tags, users, import/export, and logout.</li>
                  <li>Only settings changed in Options persist across app restarts. Working selections such as active tab, tag scope, search text, filters, column sorts, the header List/Kanban toggle, and the header task-detail toggle remain session-only while the app is open. A fresh app session starts from the Options defaults.</li>
                  <li>Tags are managed in Options. Up to 10 tags can exist, selected tags can become top-row tag tabs, and tag order can be changed by drag-and-drop.</li>
                </ul>
              </section>
            </div>
          </section>
        </div>
      )}

    </div>
  );
}

function ActionSelect({ label, placeholder, options, onSelect, className = "", title = label }) {
  return (
    <select
      className={`actionSelect ${className}`.trim()}
      value=""
      onChange={event => {
        if (!event.target.value) return;
        onSelect(event.target.value);
        event.target.value = "";
      }}
      aria-label={label}
      title={title}
    >
      <option value="">{placeholder}</option>
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function CommentList({ comments }) {
  const items = normalizeComments(comments);
  if (items.length === 0) return null;

  return (
    <div className="commentReadBlock">
      <ol className="commentReadList">
        {items.map(comment => (
          <li key={comment.id}>
            <p>{comment.text}</p>
            <small>
              Created: {formatDateTime(comment.createdAt)}
              {comment.updatedAt ? ` · edited: ${formatDateTime(comment.updatedAt)}` : ""}
            </small>
          </li>
        ))}
      </ol>
    </div>
  );
}

function CommentEditor({ value, onSave, draftKey = "", onLocalDraftChange = null }) {
  const comments = useMemo(() => normalizeComments(value), [value]);
  const commentsKey = useMemo(() => JSON.stringify(comments), [comments]);
  const [draftComments, setDraftComments] = useState(() => comments);
  const [newComment, setNewComment] = useState("");
  const [isNewCommentDiscardPromptOpen, setIsNewCommentDiscardPromptOpen] = useState(false);
  const editorRef = useRef(null);
  const skipNewCommentBlurRef = useRef(false);

  useEffect(() => {
    setDraftComments(comments);
    setNewComment("");
    setIsNewCommentDiscardPromptOpen(false);
  }, [comments, commentsKey]);

  function getNextComments() {
    const text = normalizeText(newComment);
    if (!text) return normalizeComments(draftComments);
    const now = new Date().toISOString();
    return normalizeComments([
      {
        id: crypto.randomUUID(),
        text,
        createdAt: now,
        updatedAt: ""
      },
      ...draftComments
    ]);
  }

  function hasUnsavedComment(comment) {
    const savedComment = comments.find(candidate => candidate.id === comment.id);
    return JSON.stringify(normalizeComments([comment])[0] || null) !== JSON.stringify(savedComment || null);
  }

  function addComment() {
    const next = getNextComments();
    if (JSON.stringify(next) === JSON.stringify(draftComments)) return false;
    const didSave = onSave?.(next) !== false;
    if (didSave) {
      setDraftComments(next);
      setNewComment("");
    }
    return didSave;
  }

  function clearNewComment() {
    setNewComment("");
    setIsNewCommentDiscardPromptOpen(false);
  }

  function requestClearNewComment() {
    if (!normalizeText(newComment)) {
      clearNewComment();
      return;
    }
    setIsNewCommentDiscardPromptOpen(true);
  }

  function saveNewCommentFromPrompt() {
    if (addComment() !== false) setIsNewCommentDiscardPromptOpen(false);
  }

  function saveComment(comment) {
    const normalizedComment = normalizeComments([comment])[0];
    if (!normalizedComment) return false;
    const exists = comments.some(candidate => candidate.id === normalizedComment.id);
    const nextComments = exists
      ? comments.map(candidate => candidate.id === normalizedComment.id ? normalizedComment : candidate)
      : [normalizedComment, ...comments];
    const didSave = onSave?.(nextComments) !== false;
    if (didSave) {
      setDraftComments(nextComments);
      setNewComment("");
    }
    return didSave;
  }

  const hasUnsavedCommentChanges = draftComments.some(comment => hasUnsavedComment(comment)) || Boolean(normalizeText(newComment));

  function discardAllCommentChanges() {
    setDraftComments(comments);
    setNewComment("");
    setIsNewCommentDiscardPromptOpen(false);
  }

  function saveAllCommentChanges() {
    if (!hasUnsavedCommentChanges) return true;
    const normalizedDraftComments = getNextComments();
    const nextComments = normalizedDraftComments.reduce((nextItems, comment) => {
      const existingIndex = nextItems.findIndex(candidate => candidate.id === comment.id);
      if (existingIndex >= 0) {
        nextItems[existingIndex] = comment;
        return nextItems;
      }
      return [comment, ...nextItems];
    }, [...comments]);
    const didSave = onSave?.(normalizeComments(nextComments)) !== false;
    if (didSave) {
      setDraftComments(normalizeComments(nextComments));
      setNewComment("");
    }
    return didSave;
  }


  useEffect(() => {
    if (!draftKey || !onLocalDraftChange) return undefined;
    onLocalDraftChange(draftKey, hasUnsavedCommentChanges ? {
      hasChanges: true,
      save: saveAllCommentChanges,
      discard: discardAllCommentChanges
    } : null);
    return () => onLocalDraftChange(draftKey, null);
  }, [draftKey, hasUnsavedCommentChanges, draftComments, comments, newComment, onLocalDraftChange]);
  function handleNewCommentBlur() {
    if (skipNewCommentBlurRef.current) {
      skipNewCommentBlurRef.current = false;
    }
  }

  function updateComment(comment, text) {
    setDraftComments(current => updateCommentAt(current, comment.id, {
      ...comment,
      text,
      updatedAt: new Date().toISOString()
    }));
  }

  function deleteComment(id) {
    const exists = comments.some(comment => comment.id === id);
    if (!exists) {
      setDraftComments(current => removeCommentAt(current, id));
      return;
    }
    const nextComments = removeCommentAt(comments, id);
    const didSave = onSave?.(nextComments) !== false;
    if (didSave) setDraftComments(nextComments);
  }

  return (
    <div className="commentEditor" ref={editorRef}>
      <div className="commentNewItem">
        <AutoGrowTextarea
          value={newComment}
          onChange={event => setNewComment(truncateText(event.target.value, TEXT_LIMITS.comment.max))}
          onBlur={handleNewCommentBlur}
          placeholder="Write a new comment"
          maxRows={4}
          maxLength={TEXT_LIMITS.comment.max}
        />
        <InputGuidance value={newComment} limits={TEXT_LIMITS.comment} label="Comment" />
        <button
          type="button"
          className={`iconButton saveEditButton ${normalizeText(newComment) ? "hasChanges" : ""}`}
          onMouseDown={event => event.preventDefault()}
          onClick={addComment}
          disabled={!normalizeText(newComment)}
          title={normalizeText(newComment) ? "Save new comment" : "No new comment text"}
        >
          <DisketteIcon size={16} />
        </button>
        <button
          type="button"
          className="iconButton danger"
          onMouseDown={event => event.preventDefault()}
          onClick={requestClearNewComment}
          disabled={!normalizeText(newComment)}
          title="Discard new comment"
        >
          <X size={16} />
        </button>
      </div>
      {isNewCommentDiscardPromptOpen && (
        <LocalUnsavedChangesPrompt
          message="This comment has unsaved changes."
          onDiscard={clearNewComment}
          onSave={saveNewCommentFromPrompt}
        />
      )}
      <div className="commentList">
        {draftComments.map(comment => (
          <div key={comment.id} className="commentItem">
            <AutoGrowTextarea
              value={comment.text}
              onChange={event => updateComment(comment, truncateText(event.target.value, TEXT_LIMITS.comment.max))}
              maxRows={6}
              maxLength={TEXT_LIMITS.comment.max}
            />
            <InputGuidance value={comment.text} limits={TEXT_LIMITS.comment} label="Comment" />
            <small>
              Created: {formatDateTime(comment.createdAt)}
              {comment.updatedAt ? ` · edited: ${formatDateTime(comment.updatedAt)}` : ""}
            </small>
            <button
              type="button"
              className={`iconButton saveEditButton ${hasUnsavedComment(comment) ? "hasChanges" : ""}`}
              onClick={() => saveComment(comment)}
              disabled={!hasUnsavedComment(comment)}
              title={hasUnsavedComment(comment) ? "Save comment" : "No unsaved comment changes"}
            >
              <DisketteIcon size={16} />
            </button>
            <button type="button" className="iconButton danger" onClick={() => deleteComment(comment.id)} title="Delete comment">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
function SelectField({
  label,
  value,
  options,
  onChange,
  title = "",
  allowCustom = false,
  allowTypedValue = false,
  requiredChoice = false,
  showRequiredHint = false,
  extraOptions = []
}) {
  const isKnown = options.includes(value);
  const isPlaceholder = requiredChoice && value === CRITERIA_PLACEHOLDER;

  return (
    <label className={showRequiredHint ? "requiredField" : ""} title={title}>
      <span className={showRequiredHint && isPlaceholder ? "needsChoice" : ""}>
        {label}
        {showRequiredHint && isPlaceholder ? " · selection required" : ""}
      </span>
      {allowTypedValue ? (
        <>
          <input
            className={showRequiredHint && isPlaceholder ? "needsChoiceSelect" : ""}
            list={`${label}-options`}
            value={value}
            onChange={event => onChange(event.target.value)}
            title={title}
          />
          <datalist id={`${label}-options`}>
            {options.map(option => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </>
      ) : (
        <>
      <select
        className={showRequiredHint && isPlaceholder ? "needsChoiceSelect" : ""}
        value={isKnown || isPlaceholder ? value : "__custom"}
        onChange={event => {
          if (event.target.value !== "__custom") onChange(event.target.value);
        }}
        title={title}
      >
        {requiredChoice && (
          <option value={CRITERIA_PLACEHOLDER} disabled>
            {CRITERIA_PLACEHOLDER} select
          </option>
        )}
        {options.map(option => (
          <option key={option} value={option}>{getDisplayValue(option)}</option>
        ))}
        {extraOptions.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        {allowCustom && !isKnown && <option value="__custom">{value}</option>}
      </select>
      {allowCustom && (
        <input
          className="customInput"
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder="Custom value"
          title={title}
        />
      )}
        </>
      )}
    </label>
  );
}

function TaskDependencyField({ label, value, options, onChange }) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={event => onChange(event.target.value)}>
        <option value="">None</option>
        {options.map(option => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TaskMultiDependencyField({ label, values, options, onChange, title = "" }) {
  const selectedValues = normalizeTaskIds(values);
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const fieldRef = useRef(null);
  const selectedOptions = options.filter(option => selectedValues.includes(option.id));
  const normalizedSearchText = normalizeText(searchText).toLowerCase();
  const visibleOptions = normalizedSearchText
    ? options.filter(option => normalizeText(option.label).toLowerCase().includes(normalizedSearchText))
    : options;
  const triggerText =
    selectedOptions.length === 0
      ? "None"
      : selectedOptions.length === 1
        ? selectedOptions[0].label
        : `${selectedOptions.length} selected`;

  useCloseOnOutsidePointer(isOpen, [fieldRef], () => setIsOpen(false));

  function toggleValue(value) {
    onChange(selectedValues.includes(value)
      ? selectedValues.filter(selectedValue => selectedValue !== value)
      : [...selectedValues, value]);
  }

  return (
    <fieldset ref={fieldRef} className="multiDependencyField" title={title}>
      <legend>{label}</legend>
      <button
        type="button"
        className="multiDependencyTrigger"
        onClick={() => setIsOpen(current => !current)}
        aria-expanded={isOpen}
        title={title}
      >
        {triggerText}
      </button>
      {isOpen && (
        <div className="multiDependencyMenu">
          <input
            className="multiDependencySearch"
            type="search"
            value={searchText}
            onChange={event => setSearchText(event.target.value)}
            placeholder="Search"
            aria-label={`Search ${label.toLowerCase()}`}
            autoFocus
          />
          {visibleOptions.map(option => (
            <label key={option.id}>
              <input
                type="checkbox"
                checked={selectedValues.includes(option.id)}
                onChange={() => toggleValue(option.id)}
              />
              <span>{option.label}</span>
            </label>
          ))}
          {options.length === 0 && <span className="multiDependencyEmpty">No selection</span>}
          {options.length > 0 && visibleOptions.length === 0 && <span className="multiDependencyEmpty">No matches</span>}
        </div>
      )}
    </fieldset>
  );
}

function TagEditorField({ label = "Tag", values, options, onChange, maxTags = MAX_TASK_TAGS, title = "" }) {
  const selectedTags = normalizeTags(values, maxTags);
  const [isOpen, setIsOpen] = useState(false);
  const fieldRef = useRef(null);
  const fieldId = useId();
  const availableOptions = normalizeTags([...options, ...selectedTags], 0)
    .sort((first, second) => first.localeCompare(second, "de", { sensitivity: "base" }));
  const triggerText = selectedTags.length === 0 ? "-" : `#${selectedTags[0]}`;

  useCloseOnOutsidePointer(isOpen, [fieldRef], () => setIsOpen(false));

  function selectTag(tag) {
    const normalizedTag = normalizeTag(tag);
    onChange(normalizedTag ? [normalizedTag] : []);
    setIsOpen(false);
  }

  return (
    <fieldset ref={fieldRef} className="tagField tagSelectField" title={title}>
      <legend>{label}</legend>
      <button
        type="button"
        className={`tagSelectTrigger ${selectedTags.length === 0 ? "empty" : ""}`}
        onClick={() => setIsOpen(current => !current)}
        aria-expanded={isOpen}
        title={title}
      >
        {triggerText}
      </button>
      {isOpen && (
        <div className="tagSelectMenu">
          <label className="tagChoice">
            <input
              type="radio"
              name={`tag-${fieldId}`}
              checked={selectedTags.length === 0}
              onChange={() => selectTag("")}
            />
            <span>No tag</span>
          </label>
          {availableOptions.map(tag => (
            <label key={tag} className="tagChoice">
              <input
                type="radio"
                name={`tag-${fieldId}`}
                checked={selectedTags.some(selectedTag => selectedTag.toLowerCase() === tag.toLowerCase())}
                onChange={() => selectTag(tag)}
              />
              <span>#{tag}</span>
            </label>
          ))}
          {availableOptions.length === 0 && <span className="tagLimit">Create tags in Options first</span>}
        </div>
      )}
    </fieldset>
  );
}

function TagCatalogField({ tags, maxTags = MAX_TAG_CATALOG_SIZE, onAdd, onRemove, onRename }) {
  const [newTag, setNewTag] = useState("");
  const [editingTag, setEditingTag] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const availableOptions = normalizeTags(tags, 0)
    .sort((first, second) => first.localeCompare(second, "de", { sensitivity: "base" }));
  const isAtLimit = availableOptions.length >= maxTags;

  function addNewTag() {
    const normalizedTag = normalizeTag(newTag);
    if (!normalizedTag || isAtLimit) return;
    onAdd(normalizedTag);
    setNewTag("");
  }

  function startRename(tag) {
    setEditingTag(tag);
    setRenameValue(tag);
  }

  function submitRename() {
    const normalizedNewTag = normalizeTag(renameValue);
    if (!editingTag || !normalizedNewTag) return;
    onRename(editingTag, normalizedNewTag);
    setEditingTag("");
    setRenameValue("");
  }

  function cancelRename() {
    setEditingTag("");
    setRenameValue("");
  }

  return (
    <fieldset className="tagField tagCatalogField">
      <legend>
        <span>Tags verwalten</span>
        <span className="tagLimit">{availableOptions.length} von {maxTags}</span>
      </legend>
      <div className="tagChoices">
        {availableOptions.map(tag => (
          <span key={tag} className="tagChoice tagCatalogItem">
            {editingTag.toLowerCase() === tag.toLowerCase() ? (
              <>
                <input
                  className="tagRenameInput"
                  value={renameValue}
                  onChange={event => setRenameValue(truncateText(event.target.value, TEXT_LIMITS.tag.max))}
                  maxLength={TEXT_LIMITS.tag.max}
                  onKeyDown={event => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      submitRename();
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      cancelRename();
                    }
                  }}
                  autoFocus
                />
                <button type="button" className="iconButton tagSaveButton" onClick={submitRename} disabled={!normalizeTag(renameValue)} title="Rename tag">
                  <DisketteIcon size={13} />
                </button>
                <button type="button" className="iconButton tagRemoveButton" onClick={cancelRename} title="Cancel">
                  <X size={13} />
                </button>
              </>
            ) : (
              <>
                <span>#{tag}</span>
                <button type="button" className="iconButton tagEditButton" onClick={() => startRename(tag)} title={`Rename tag ${tag}`}>
                  <Pencil size={13} />
                </button>
                <button type="button" className="iconButton tagRemoveButton" onClick={() => onRemove(tag)} title={`Delete tag ${tag}`}>
                  <X size={13} />
                </button>
              </>
            )}
          </span>
        ))}
        {availableOptions.length === 0 && <span className="tagLimit">No tags yet</span>}
      </div>
      <div className="tagNewRow">
        <input
          value={newTag}
          onChange={event => setNewTag(truncateText(event.target.value, TEXT_LIMITS.tag.max))}
          maxLength={TEXT_LIMITS.tag.max}
          onKeyDown={event => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            addNewTag();
          }}
          placeholder={isAtLimit ? "Tag limit reached" : "New tag"}
          disabled={isAtLimit}
        />
        <InputGuidance value={newTag} limits={TEXT_LIMITS.tag} label="Tag" />
        <button type="button" className="iconButton" onClick={addNewTag} disabled={!normalizeTag(newTag) || isAtLimit} title={isAtLimit ? "Tag limit reached" : "Add tag"}>
          <Plus size={16} />
        </button>
      </div>
    </fieldset>
  );
}

function TagTabsField({ selectedTags, options, onChange, onMove }) {
  const values = normalizeTags(selectedTags, 0);
  const availableOptions = normalizeTags(options, 0)
    .sort((first, second) => first.localeCompare(second, "de", { sensitivity: "base" }));
  const dragTagRef = useRef("");

  function toggleTag(tag) {
    const normalizedTag = normalizeTag(tag);
    const exists = values.some(value => value.toLowerCase() === normalizedTag.toLowerCase());
    onChange(exists
      ? values.filter(value => value.toLowerCase() !== normalizedTag.toLowerCase())
      : [...values, normalizedTag]);
  }

  return (
    <fieldset className="tagField tagTabsField">
      <legend>Tag-Tabs</legend>
      {values.length > 1 && (
        <div className="tagOrderList" aria-label="Reihenfolge der Tag-Tabs">
          {values.map(tag => (
            <span
              key={tag}
              className="tagChoice tagOrderItem"
              draggable
              onDragStart={event => {
                event.currentTarget.classList.add("isDragging");
                dragTagRef.current = tag;
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", tag);
              }}
              onDragOver={event => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={event => {
                event.preventDefault();
                onMove(dragTagRef.current || event.dataTransfer.getData("text/plain"), tag);
                event.currentTarget.classList.remove("isDragging");
                dragTagRef.current = "";
              }}
              onDragEnd={event => {
                event.currentTarget.classList.remove("isDragging");
                dragTagRef.current = "";
              }}
              title="Drag to sort"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
      <div className="tagChoices">
        {availableOptions.map(tag => (
          <label key={tag} className="tagChoice">
            <input
              type="checkbox"
              checked={values.some(value => value.toLowerCase() === tag.toLowerCase())}
              onChange={() => toggleTag(tag)}
            />
            <span>#{tag}</span>
          </label>
        ))}
        {availableOptions.length === 0 && <span className="tagLimit">No tags yet</span>}
      </div>
    </fieldset>
  );
}

function SubtaskEditor({ value, onSave, parentStartDate = "", parentDueDate = "", draftKey = "", onLocalDraftChange = null }) {
  const [dragInfo, setDragInfo] = useState(null);
  const [newSubtask, setNewSubtask] = useState("");
  const [newSubtaskStartDate, setNewSubtaskStartDate] = useState("");
  const [newSubtaskDueDate, setNewSubtaskDueDate] = useState("");
  const [isNewSubtaskDiscardPromptOpen, setIsNewSubtaskDiscardPromptOpen] = useState(false);
  const [draftSubtasks, setDraftSubtasks] = useState(() => normalizeSubtasks(value));
  const editorRef = useRef(null);
  const newSubtaskInputRef = useRef(null);
  const draftSubtasksRef = useRef(normalizeSubtasks(value));
  const newSubtaskRef = useRef("");
  const newSubtaskStartDateRef = useRef("");
  const newSubtaskDueDateRef = useRef("");
  const subtasks = useMemo(() => normalizeSubtasks(value), [value]);
  const subtasksRef = useRef(subtasks);

  useEffect(() => {
    subtasksRef.current = subtasks;
  }, [subtasks]);

  useEffect(() => {
    draftSubtasksRef.current = draftSubtasks;
  }, [draftSubtasks]);

  useEffect(() => {
    newSubtaskRef.current = newSubtask;
  }, [newSubtask]);

  useEffect(() => {
    newSubtaskStartDateRef.current = newSubtaskStartDate;
  }, [newSubtaskStartDate]);

  useEffect(() => {
    newSubtaskDueDateRef.current = newSubtaskDueDate;
  }, [newSubtaskDueDate]);

  function getCurrentNextSubtasks() {
    const pendingSubtask = normalizeText(newSubtaskInputRef.current?.value ?? newSubtaskRef.current);
    return normalizeSubtasks(pendingSubtask
      ? [...draftSubtasksRef.current, {
          text: pendingSubtask,
          done: false,
          startdatum: normalizeDateValue(newSubtaskStartDateRef.current),
          faellig: normalizeDateValue(newSubtaskDueDateRef.current)
        }]
      : draftSubtasksRef.current);
  }

  function getNextSubtasks() {
    const pendingSubtask = normalizeText(newSubtask);
    return normalizeSubtasks(pendingSubtask
      ? [...draftSubtasks, {
          text: pendingSubtask,
          done: false,
          startdatum: normalizeDateValue(newSubtaskStartDate),
          faellig: normalizeDateValue(newSubtaskDueDate)
        }]
      : draftSubtasks);
  }

  const nextSubtasks = getNextSubtasks();
  const validationMessage = getSubtaskDateValidationMessage({
    startdatum: parentStartDate,
    faellig: parentDueDate,
    subtasks: nextSubtasks
  });
  const hasUnsavedSubtaskChanges = JSON.stringify(nextSubtasks) !== JSON.stringify(subtasks);

  useEffect(() => {
    if (!hasUnsavedSubtaskChanges) setDraftSubtasks(subtasks);
  }, [subtasks, hasUnsavedSubtaskChanges]);

  function saveAllSubtaskChanges() {
    const currentNextSubtasks = getCurrentNextSubtasks();
    if (JSON.stringify(currentNextSubtasks) === JSON.stringify(subtasksRef.current)) return true;
    const currentValidationMessage = getSubtaskDateValidationMessage({
      startdatum: parentStartDate,
      faellig: parentDueDate,
      subtasks: currentNextSubtasks
    });
    if (currentValidationMessage) {
      window.alert(currentValidationMessage);
      return false;
    }
    const normalizedNext = normalizeSubtasks(currentNextSubtasks);
    const didSave = onSave?.(normalizedNext) !== false;
    if (didSave) {
      subtasksRef.current = normalizedNext;
      draftSubtasksRef.current = normalizedNext;
      setDraftSubtasks(normalizedNext);
      newSubtaskRef.current = "";
      newSubtaskStartDateRef.current = "";
      newSubtaskDueDateRef.current = "";
      setNewSubtask("");
      setNewSubtaskStartDate("");
      setNewSubtaskDueDate("");
    }
    return didSave;
  }

  function discardAllSubtaskChanges() {
    const currentSubtasks = subtasksRef.current;
    draftSubtasksRef.current = currentSubtasks;
    newSubtaskRef.current = "";
    newSubtaskStartDateRef.current = "";
    newSubtaskDueDateRef.current = "";
    setDraftSubtasks(currentSubtasks);
    setNewSubtask("");
    setNewSubtaskStartDate("");
    setNewSubtaskDueDate("");
  }

  useEffect(() => {
    if (!draftKey || !onLocalDraftChange) return undefined;
    onLocalDraftChange(draftKey, hasUnsavedSubtaskChanges ? {
      hasChanges: true,
      save: saveAllSubtaskChanges,
      discard: discardAllSubtaskChanges
    } : null);
    return () => onLocalDraftChange(draftKey, null);
  }, [draftKey, hasUnsavedSubtaskChanges, draftSubtasks, subtasks, newSubtask, newSubtaskStartDate, newSubtaskDueDate, validationMessage, onLocalDraftChange]);

  function applySubtasks(nextItems) {
    const normalizedNext = normalizeSubtasks(nextItems);
    draftSubtasksRef.current = normalizedNext;
    setDraftSubtasks(normalizedNext);
  }

  function hasUnsavedSubtask(index) {
    return JSON.stringify(draftSubtasks[index] || null) !== JSON.stringify(subtasks[index] || null);
  }

  function saveSubtask(index) {
    if (validationMessage) {
      window.alert(validationMessage);
      return false;
    }
    const subtask = normalizeSubtask(draftSubtasks[index]);
    if (!subtask) return false;
    const next = [...subtasks];
    if (index < next.length) next[index] = subtask;
    else next.push(subtask);
    const normalizedNext = normalizeSubtasks(next);
    const didSave = onSave?.(normalizedNext) !== false;
    if (didSave) {
      subtasksRef.current = normalizedNext;
      draftSubtasksRef.current = normalizedNext;
      setDraftSubtasks(normalizedNext);
    }
    return didSave;
  }

  function addNewSubtask() {
    const nextSubtask = normalizeText(newSubtaskInputRef.current?.value ?? newSubtaskRef.current);
    if (!nextSubtask) return false;
    const newItem = {
      text: nextSubtask,
      done: false,
      startdatum: normalizeDateValue(newSubtaskStartDateRef.current),
      faellig: normalizeDateValue(newSubtaskDueDateRef.current)
    };
    const nextDraftSubtasks = normalizeSubtasks([...draftSubtasksRef.current, newItem]);
    const nextSavedSubtasks = normalizeSubtasks([...subtasksRef.current, newItem]);
    const addValidationMessage = getSubtaskDateValidationMessage({
      startdatum: parentStartDate,
      faellig: parentDueDate,
      subtasks: nextDraftSubtasks
    });
    if (addValidationMessage) {
      window.alert(addValidationMessage);
      return false;
    }
    const didSave = onSave?.(nextSavedSubtasks) !== false;
    if (didSave) {
      subtasksRef.current = nextSavedSubtasks;
      draftSubtasksRef.current = nextDraftSubtasks;
      newSubtaskRef.current = "";
      newSubtaskStartDateRef.current = "";
      newSubtaskDueDateRef.current = "";
      setDraftSubtasks(nextDraftSubtasks);
      setNewSubtask("");
      setNewSubtaskStartDate("");
      setNewSubtaskDueDate("");
      setIsNewSubtaskDiscardPromptOpen(false);
    }
    return didSave;
  }

  function clearNewSubtask() {
    newSubtaskRef.current = "";
    newSubtaskStartDateRef.current = "";
    newSubtaskDueDateRef.current = "";
    setNewSubtask("");
    setNewSubtaskStartDate("");
    setNewSubtaskDueDate("");
    setIsNewSubtaskDiscardPromptOpen(false);
  }

  function requestClearNewSubtask() {
    if (!normalizeText(newSubtask) && !newSubtaskStartDate && !newSubtaskDueDate) {
      clearNewSubtask();
      return;
    }
    setIsNewSubtaskDiscardPromptOpen(true);
  }

  function saveNewSubtaskFromPrompt() {
    if (addNewSubtask() !== false) setIsNewSubtaskDiscardPromptOpen(false);
  }

  function updateAt(index, nextValue) {
    const currentSubtask = draftSubtasks[index];
    applySubtasks(updateSubtaskAt(draftSubtasks, index, { ...currentSubtask, text: nextValue }));
  }

  function toggleDoneAt(index) {
    const currentSubtask = draftSubtasks[index];
    applySubtasks(updateSubtaskAt(draftSubtasks, index, { ...currentSubtask, done: !currentSubtask.done }));
  }

  function updateDateAt(index, field, nextValue) {
    const currentSubtask = draftSubtasks[index];
    applySubtasks(updateSubtaskAt(draftSubtasks, index, { ...currentSubtask, [field]: normalizeDateValue(nextValue) }));
  }

  function deleteAt(index) {
    if (index >= subtasks.length) {
      applySubtasks(removeSubtaskAt(draftSubtasks, index));
      return;
    }
    const next = removeSubtaskAt(subtasks, index);
    const didSave = onSave?.(next) !== false;
    if (didSave) {
      subtasksRef.current = next;
      draftSubtasksRef.current = next;
      setDraftSubtasks(next);
    }
  }

  return (
    <div className="subtaskEditor" ref={editorRef}>
      <div className="subtaskList">
        <div className="subtaskItem subtaskNewItem">
          <AutoGrowTextarea
            ref={newSubtaskInputRef}
            maxRows={4}
            value={newSubtask}
            onChange={event => {
              const nextValue = truncateText(event.target.value, TEXT_LIMITS.subtask.max);
              newSubtaskRef.current = nextValue;
              setNewSubtask(nextValue);
            }}
            placeholder="Write a new subtask"
            maxLength={TEXT_LIMITS.subtask.max}
          />
          <InputGuidance value={newSubtask} limits={TEXT_LIMITS.subtask} label="Subtask" />
          <button
            type="button"
            className={`iconButton saveEditButton ${normalizeText(newSubtask) ? "hasChanges" : ""}`}
            onMouseDown={event => event.preventDefault()}
            onClick={addNewSubtask}
            disabled={!normalizeText(newSubtask)}
            title={normalizeText(newSubtask) ? "Save new subtask" : "No new subtask text"}
          >
            <DisketteIcon size={16} />
          </button>
          <button
            type="button"
            className="iconButton danger"
            onMouseDown={event => event.preventDefault()}
            onClick={requestClearNewSubtask}
            disabled={!normalizeText(newSubtask) && !newSubtaskStartDate && !newSubtaskDueDate}
            title="Discard new subtask"
          >
            <X size={16} />
          </button>
          <div className="subtaskDateFields">
            <label>
              <span>Start</span>
              <input
                type="date"
                value={newSubtaskStartDate}
                min={parentStartDate || undefined}
                max={parentDueDate || undefined}
                onChange={event => {
                  newSubtaskStartDateRef.current = event.target.value;
                  setNewSubtaskStartDate(event.target.value);
                }}
              />
            </label>
            <label>
              <span>Due</span>
              <input
                type="date"
                value={newSubtaskDueDate}
                min={newSubtaskStartDate || parentStartDate || undefined}
                max={parentDueDate || undefined}
                onChange={event => {
                  newSubtaskDueDateRef.current = event.target.value;
                  setNewSubtaskDueDate(event.target.value);
                }}
              />
            </label>
          </div>
        </div>
        {isNewSubtaskDiscardPromptOpen && (
          <LocalUnsavedChangesPrompt
            message="This subtask has unsaved changes."
            onDiscard={clearNewSubtask}
            onSave={saveNewSubtaskFromPrompt}
          />
        )}
        {draftSubtasks.map((subtask, index) => (
          <div
            key={`subtask-${index}`}
            className={`subtaskItem ${subtask.done ? "doneSubtask" : ""}`}
            draggable
            data-dragging={dragInfo?.index === index ? "true" : undefined}
            onDragStart={event => {
              setDragInfo({ index, startX: event.clientX });
              event.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={event => event.preventDefault()}
            onDrop={event => {
              event.preventDefault();
              if (!dragInfo || dragInfo.index === index) return;
              applySubtasks(moveSubtask(draftSubtasks, dragInfo.index, index));
              setDragInfo(null);
            }}
            onDragEnd={event => {
              if (event.clientX > 0 && dragInfo?.index === index && Math.abs(event.clientX - dragInfo.startX) > 100) {
                deleteAt(index);
              }
              setDragInfo(null);
            }}
          >
            <span className="subtaskDragHandle" title="Drag to sort or drag sideways to delete">
              ::
            </span>
            <AutoGrowTextarea
              maxRows={6}
              value={subtask.text}
              onChange={event => updateAt(index, truncateText(event.target.value, TEXT_LIMITS.subtask.max))}
              onKeyDown={event => {
                if (event.key === "Enter") event.stopPropagation();
              }}
              placeholder="Subtask"
              maxLength={TEXT_LIMITS.subtask.max}
            />
            <InputGuidance value={subtask.text} limits={TEXT_LIMITS.subtask} label="Subtask" />
            <button
              type="button"
              className={`iconButton saveEditButton ${hasUnsavedSubtask(index) ? "hasChanges" : ""}`}
              onClick={() => saveSubtask(index)}
              disabled={!hasUnsavedSubtask(index) || Boolean(validationMessage)}
              title={validationMessage || (hasUnsavedSubtask(index) ? "Save subtask" : "No unsaved subtask changes")}
            >
              <DisketteIcon size={16} />
            </button>
            <button type="button" className="iconButton danger" onClick={() => deleteAt(index)} title="Delete subtask">
              <Trash2 size={16} />
            </button>
            <button
              type="button"
              className={`iconButton statusToggle ${subtask.done ? "done" : ""}`}
              onClick={() => toggleDoneAt(index)}
              title={subtask.done ? "Reopen subtask" : "Mark subtask done"}
            >
              <Check size={16} />
            </button>
            <div className="subtaskDateFields">
              <label>
                <span>Start</span>
                <input
                  type="date"
                  value={subtask.startdatum || ""}
                  min={parentStartDate || undefined}
                  max={subtask.faellig || parentDueDate || undefined}
                  onChange={event => updateDateAt(index, "startdatum", event.target.value)}
                />
              </label>
              <label>
                <span>Due</span>
                <input
                  type="date"
                  value={subtask.faellig || ""}
                  min={subtask.startdatum || parentStartDate || undefined}
                  max={parentDueDate || undefined}
                  onChange={event => updateDateAt(index, "faellig", event.target.value)}
                />
              </label>
            </div>
          </div>
        ))}
        {validationMessage && <p className="subtaskValidation">{validationMessage}</p>}
      </div>
    </div>
  );
}

function SubtaskList({ subtasks }) {
  const items = normalizeSubtasks(subtasks);
  if (items.length === 0) return null;

  return (
    <div className="subtaskReadBlock">
      <ol className="subtaskReadList">
        {items.map((subtask, index) => (
          <li key={`${index}-${subtask.text}-${subtask.done}`} className={subtask.done ? "doneSubtaskReadItem" : ""}>
            <p>
              <span className="subtaskReadIndex">{index + 1}.</span>
              {subtask.done && <Check size={13} aria-hidden="true" />}
              <span>{subtask.text}</span>
            </p>
            {(subtask.startdatum || subtask.faellig) && (
              <small>
                {subtask.startdatum ? `Start: ${formatDate(subtask.startdatum)}` : ""}
                {subtask.startdatum && subtask.faellig ? " · " : ""}
                {subtask.faellig ? `Due: ${formatDate(subtask.faellig)}` : ""}
              </small>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function TagList({ tags }) {
  const items = normalizeTags(tags);
  if (items.length === 0) return <span className="emptyTagList">-</span>;

  return (
    <div className="tagList">
      {items.map(tag => (
        <span key={tag} className="tagPill">#{tag}</span>
      ))}
    </div>
  );
}

function RelationTargetPicker({ targets, emptyLabel = "None", onShowTask }) {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef(null);
  useCloseOnOutsidePointer(isOpen, [pickerRef], () => setIsOpen(false));

  if (targets.length === 0) {
    return <span>{emptyLabel}</span>;
  }

  const firstTarget = targets[0];
  const label = targets.length === 1 ? firstTarget.code : `${targets.length} Tasks`;
  const title = targets.length === 1 ? `${firstTarget.type}: ${firstTarget.code}` : `${targets.length} ${firstTarget.type}`;

  function handlePrimaryClick() {
    if (targets.length === 1) {
      onShowTask(firstTarget.id);
      return;
    }

    setIsOpen(current => !current);
  }

  return (
    <span ref={pickerRef} className="relationPicker">
      <span className="dependencyDisplay">
        <button type="button" className="dependencyLink" onClick={handlePrimaryClick} title={title}>
          {label}
        </button>
      </span>
      {isOpen && targets.length > 1 && (
        <div className="relationMenu">
          {targets.map(target => (
            <button
              key={target.id}
              type="button"
              onClick={() => {
                setIsOpen(false);
                onShowTask(target.id);
              }}
              title={target.title}
            >
              <strong>{target.code}</strong>
              <span>{target.title}</span>
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

function TaskRow({
  task,
  dragProps = {},
  highlightedTaskId,
  isEditing,
  hasUnsavedChanges,
  editDraft,
  editFocusField,
  editSectionDefaults,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onSaveEditField,
  onLocalEditDraftChange,
  onRequestEditExit,
  onDelete,
  onRestore,
  onToggleDone,
  onShareTask,
  onQuickChange,
  predecessorTargets,
  successorTargets,
  dependencyOptions,
  tagOptions,
  onShowTask,
  onChange,
  getTooltip = getEditTooltip,
  dueReminderTooltip = "",
  showCompletedAt,
  showDeletedAt
}) {
  const data = isEditing ? editDraft : task;
  const done = isDone(task);
  const deleted = isDeleted(task);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const rowRef = useRef(null);
  const deleteConfirmRef = useRef(null);
  const deleteToggleRef = useRef(null);
  const lastFocusedFieldRef = useRef("");
  const rowClassName = [done ? "doneRow" : "", deleted ? "deletedRow" : "", highlightedTaskId === task.id ? "highlightRow" : ""]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    if (!isDeleteConfirmOpen) return undefined;

    function closeOnOutsidePointer(event) {
      if (
        deleteConfirmRef.current?.contains(event.target) ||
        deleteToggleRef.current?.contains(event.target)
      ) return;
      setIsDeleteConfirmOpen(false);
    }

    function closeOnScroll() {
      setIsDeleteConfirmOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    window.addEventListener("scroll", closeOnScroll, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      window.removeEventListener("scroll", closeOnScroll);
    };
  }, [isDeleteConfirmOpen]);

  useEffect(() => {
    if (!isDeleteConfirmOpen) return undefined;
    const frame = window.requestAnimationFrame(() => ensureElementVisible(deleteConfirmRef.current, null, 12));
    return () => window.cancelAnimationFrame(frame);
  }, [isDeleteConfirmOpen]);

  useEffect(() => {
    if (!isEditing) {
      lastFocusedFieldRef.current = "";
      return;
    }
    if (!editFocusField || lastFocusedFieldRef.current === editFocusField) return;
    lastFocusedFieldRef.current = editFocusField;
    window.requestAnimationFrame(() => {
      const field = rowRef.current?.querySelector(`[data-edit-field="${editFocusField}"]`);
      const target = field?.matches("input, select, textarea, button, [role='button']")
        ? field
        : field?.querySelector("input, select, textarea, button, [role='button']");
      target?.focus();
      if (target?.tagName === "INPUT" && target.type !== "date") target.select();
      if (field?.dataset.autoOpen === "true") {
        target?.click();
        return;
      }
      if ((target?.tagName === "SELECT" || target?.type === "date") && typeof target.showPicker === "function") {
        try {
          target.showPicker();
        } catch {
          // Some browsers only allow showPicker during the original pointer event.
        }
      }
    });
  }, [isEditing, editFocusField]);

  function editCell(field) {
    if (isEditing) return undefined;
    return event => {
      if (event.button !== 0) return;
      if (event.target.closest("button, a, input, select, textarea, [role='button']")) return;
      event.preventDefault();
      onStartEdit(task, field);
    };
  }

  return (
    <tr ref={rowRef} id={`task-row-${task.id}`} className={rowClassName} data-edit-surface={isEditing ? "true" : undefined} {...dragProps}>
      <td>
        <button
          type="button"
          className={`iconButton statusToggle ${done ? "done" : ""}`}
          onClick={() => onToggleDone(task.id)}
          disabled={deleted}
          title={done ? "Mark open" : "Mark done"}
        >
          <Check size={17} />
        </button>
      </td>
      <td className="taskIdCell">
        {isEditing ? (
          <span className="taskIdStatic" title="Task ID">{task.taskCode}</span>
        ) : (
          <button
            type="button"
            className="taskIdButton"
            onMouseDown={event => {
              if (event.button !== 0) return;
              event.preventDefault();
              onShowTask(task.id);
            }}
            title="Show/hide task details"
          >
            {task.taskCode}
          </button>
        )}
      </td>
      <td>
        {isEditing ? (
          <div className="stackedControls">
            <span className="tableEditParameterLabel">Parameter</span>
            <select value={data.risiko} onChange={event => onChange("risiko", event.target.value)} title={getTooltip("risiko", data.risiko)}>
              <option value={CRITERIA_PLACEHOLDER} disabled>
                {CRITERIA_PLACEHOLDER} select
              </option>
              {RISIKO_OPTIONS.map(option => (
                <option key={option} value={option}>{getDisplayValue(option)}</option>
              ))}
            </select>
            <select value={data.impact} onChange={event => onChange("impact", event.target.value)} title={getTooltip("impact", data.impact)}>
              <option value={CRITERIA_PLACEHOLDER} disabled>
                {CRITERIA_PLACEHOLDER} select
              </option>
              {IMPACT_OPTIONS.map(option => (
                <option key={option} value={option}>{getDisplayValue(option)}</option>
              ))}
            </select>
            <span className={`prio ${getPrioClass(getEffectivePrio(data.prio))}`} data-prio={getEffectivePrio(data.prio)} title={getTooltip("prio", getEffectivePrio(data.prio))}>{getDisplayValue(getEffectivePrio(data.prio))}</span>
          </div>
        ) : (
          <span className={`prio ${getPrioClass(getEffectivePrio(task.prio))}`} data-prio={getEffectivePrio(task.prio)} title={getTooltip("prio", getEffectivePrio(task.prio))}>
            {getDisplayValue(getEffectivePrio(task.prio))}
          </span>
        )}
      </td>
      <td className={`tagCell ${!isEditing ? "editableTableCell" : ""}`} onMouseDown={editCell("tags")}>
        {isEditing ? (
          <div data-edit-field="tags" data-auto-open="true" title={getTooltip("tags", normalizeTags(data.tags)[0] || "-")}>
            <TagEditorField values={data.tags} options={tagOptions} onChange={value => onChange("tags", value)} />
          </div>
        ) : (
          <TagList tags={task.tags} />
        )}
      </td>
      <td className={`taskCell ${!isEditing ? "editableTableCell" : ""}`} onMouseDown={editCell("task")}>
        {isEditing ? (
          <>
            <textarea
              className="tableTaskTitleInput"
              data-edit-field="task"
              value={data.task}
              onChange={event => onChange("task", event.target.value)}
              title={getTooltip("task", data.task)}
              rows={2}
              maxLength={TEXT_LIMITS.task.max}
            />
            <InputGuidance value={data.task} limits={TEXT_LIMITS.task} label="Task name" />
          </>
        ) : task.task}
      </td>
      <td className={`descriptionCell ${!isEditing ? "editableTableCell" : ""}`} onMouseDown={editCell("beschreibung")}>
        {isEditing ? (
          <div data-edit-field="beschreibung" data-auto-open="true" title={getTooltip("beschreibung", data.beschreibung)}>
            <details key={`${task.id}-description-${editSectionDefaults.description}`} className="tableEditSection" open={editSectionDefaults.description}>
              <summary>Description</summary>
              <DescriptionEditor
                value={data.beschreibung}
                onSave={value => onSaveEditField("beschreibung", value)}
                draftKey={`${task.id}:beschreibung`}
                onLocalDraftChange={onLocalEditDraftChange}
              />
            </details>
            <details key={`${task.id}-comments-${editSectionDefaults.comments}`} className="tableEditSection tableEditSectionComments" open={editSectionDefaults.comments}>
              <summary>Comments</summary>
              <CommentEditor
                value={data.comments}
                onSave={value => onSaveEditField("comments", value)}
                draftKey={`${task.id}:comments`}
                onLocalDraftChange={onLocalEditDraftChange}
              />
            </details>
          </div>
        ) : (
          <div className="descriptionWithComments">
            <DescriptionPreview text={task.beschreibung} />
            <CommentList comments={task.comments} />
          </div>
        )}
      </td>
      <td className={`subtaskCell ${!isEditing ? "editableTableCell" : ""}`} onMouseDown={editCell("subtasks")}>
        {isEditing ? (
          <details key={`${task.id}-subtasks-${editSectionDefaults.subtasks}`} className="tableEditSection" open={editSectionDefaults.subtasks} data-edit-field="subtasks" data-auto-open="true" title={getTooltip("subtasks", `${normalizeSubtasks(data.subtasks).length} Subtasks`)}>
            <summary>Subtasks</summary>
            <SubtaskEditor
              value={data.subtasks}
              parentStartDate={data.startdatum}
              parentDueDate={data.faellig}
              onSave={value => onSaveEditField("subtasks", value)}
              draftKey={`${task.id}:subtasks`}
              onLocalDraftChange={onLocalEditDraftChange}
            />
          </details>
        ) : (
          <SubtaskList subtasks={task.subtasks} />
        )}
      </td>
      <td className={`dependencyCell ${!isEditing ? "editableTableCell" : ""}`} onMouseDown={editCell("dependsOnTaskIds")}>
        {isEditing ? (
          <div data-edit-field="dependsOnTaskIds" data-auto-open="true" title={getTooltip("dependsOnTaskIds", normalizeTaskIds(data.dependsOnTaskIds).length ? `${normalizeTaskIds(data.dependsOnTaskIds).length} selected` : "-")}>
            <TaskMultiDependencyField
              label="Predecessors"
              values={data.dependsOnTaskIds}
              options={dependencyOptions}
              onChange={value => onChange("dependsOnTaskIds", value)}
            />
          </div>
        ) : (
          <RelationTargetPicker targets={predecessorTargets} onShowTask={onShowTask} />
        )}
      </td>
      <td className={`dependencyCell ${!isEditing ? "editableTableCell" : ""}`} onMouseDown={editCell("successorTaskIds")}>
        {isEditing ? (
          <div data-edit-field="successorTaskIds" data-auto-open="true" title={getTooltip("successorTaskIds", normalizeTaskIds(data.successorTaskIds).length ? `${normalizeTaskIds(data.successorTaskIds).length} selected` : "-")}>
            <TaskMultiDependencyField
              label="Successors"
              values={data.successorTaskIds}
              options={dependencyOptions}
              onChange={value => onChange("successorTaskIds", value)}
            />
          </div>
        ) : (
          <RelationTargetPicker targets={successorTargets} onShowTask={onShowTask} />
        )}
      </td>
      <td>
        {isEditing ? (
          <select data-edit-field="googleStatus" value={getDisplayStatus(data)} onChange={event => onChange("googleStatus", event.target.value)} title={getTooltip("googleStatus", getDisplayStatus(data))}>
            {TASK_STATUS_OPTIONS.map(option => (
              <option key={option} value={option}>{getDisplayValue(option)}</option>
            ))}
          </select>
        ) : (
          <HoverSelectField
            value={getDisplayStatus(task)}
            options={TASK_STATUS_OPTIONS}
            onChange={value => onQuickChange(task.id, "googleStatus", value)}
            ariaLabel="Change status"
            display={<span className={`statusBadge ${getStatusClass(getDisplayStatus(task))}`}>{getDisplayValue(getDisplayStatus(task))}</span>}
          />
        )}
      </td>
      <td className={isTaskOrSubtaskStartAttention(task) ? "overdue" : ""}>
        {isEditing ? (
          <input
            data-edit-field="startdatum"
            type="date"
            value={data.startdatum}
            onChange={event => onChange("startdatum", event.target.value)}
            title={getTooltip("startdatum", formatDate(data.startdatum) || "-")}
          />
        ) : (
          <HoverDateField
            value={task.startdatum}
            display={formatDate(task.startdatum)}
            onChange={value => onQuickChange(task.id, "startdatum", value)}
            ariaLabel="Change start date"
            title={getTooltip("startdatum", `${formatDate(task.startdatum) || "-"}${getStartDateStateText(task) ? ` (${getStartDateStateText(task)})` : ""}`)}
          />
        )}
      </td>
      <td className={isTaskOrSubtaskDueAttention(task) ? "overdue" : ""}>
        {isEditing ? (
          <input data-edit-field="faellig" type="date" value={data.faellig} onChange={event => onChange("faellig", event.target.value)} title={getTooltip("faellig", formatDate(data.faellig) || "-")} />
        ) : (
          <HoverDateField
            value={task.faellig}
            display={formatDate(task.faellig)}
            onChange={value => onQuickChange(task.id, "faellig", value)}
            ariaLabel="Change due"
            title={getTooltip("faellig", `${formatDate(task.faellig) || "-"}${getDueDateStateText(task) ? ` (${getDueDateStateText(task)})` : ""}`)}
          />
        )}
      </td>
      {showCompletedAt && <td>{formatDate(task.completedAt) || "-"}</td>}
      {showDeletedAt && <td>{formatDate(task.deletedAt) || "-"}</td>}
      <td className="rowActions">
        {isEditing ? (
          <div className="inlineEditSaveBar">
            {dueReminderTooltip && (
              <span className="iconButton dueReminderEditIcon" title={dueReminderTooltip} aria-label={dueReminderTooltip}>
                !
              </span>
            )}
            <button
              type="button"
              className={`iconButton saveEditButton ${hasUnsavedChanges ? "hasChanges" : ""}`}
              onClick={() => onSaveEdit({ keepEditing: true })}
              disabled={!hasUnsavedChanges}
              title={hasUnsavedChanges ? "Save changes" : "No unsaved changes"}
            >
              <DisketteIcon size={17} />
            </button>
            <button type="button" className="iconButton" onClick={onCancelEdit} title="Cancel">
              <X size={17} />
            </button>
          </div>
        ) : (
          <>
            {deleted ? (
              <>
                <button type="button" className="iconButton" onClick={() => onRestore(task.id)} title="Restore">
                  <Undo2 size={17} />
                </button>
                <button type="button" className="iconButton" onClick={() => onStartEdit(task)} title="Edit">
                  <Pencil size={17} />
                </button>
              </>
            ) : (
              <>
                <button type="button" className="iconButton" onClick={() => onStartEdit(task)} title="Edit">
                  <Pencil size={17} />
                </button>
                <button type="button" className="iconButton" onClick={() => onShareTask(task)} title="Share">
                  <Share2 size={17} />
                </button>
                <button
                  ref={deleteToggleRef}
                  type="button"
                  className="iconButton danger"
                  onClick={() => setIsDeleteConfirmOpen(current => !current)}
                  title="Delete"
                >
                  <Trash2 size={17} />
                </button>
                {isDeleteConfirmOpen && (
                  <div ref={deleteConfirmRef} className="mobileDoneConfirm taskConfirmDialog" role="group" aria-label="Confirm task delete">
                    <span>Delete?</span>
                    <button
                      type="button"
                      onClick={() => {
                        onDelete(task.id, { skipConfirm: true });
                        setIsDeleteConfirmOpen(false);
                      }}
                    >
                      Yes
                    </button>
                    <button type="button" onClick={() => setIsDeleteConfirmOpen(false)}>
                      No
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </td>
    </tr>
  );
}

function HoverSelectField({ value, options, display, onChange, ariaLabel }) {
  return (
    <span className="hoverEditField">
      <span className="hoverEditDisplay">{display || value}</span>
      <select
        className="hoverEditControl"
        value={value}
        onChange={event => onChange(event.target.value)}
        aria-label={ariaLabel}
      >
        {options.map(option => (
          <option key={option} value={option}>{getDisplayValue(option)}</option>
        ))}
      </select>
    </span>
  );
}

function HoverDateField({ value, display, max, onChange, ariaLabel, title }) {
  return (
    <span className="hoverEditField hoverDateField" title={title}>
      <span className="hoverEditDisplay">{display || "-"}</span>
      <input
        className="hoverEditControl"
        type="date"
        value={value || ""}
        max={max}
        onChange={event => onChange(event.target.value)}
        aria-label={ariaLabel}
        title={title}
      />
    </span>
  );
}

function getMetaTooltipIntro(label) {
  if (label === "When") return "When answers: when should we act?";
  if (label === "Prio" || label === "Priority") return "Priority answers: how important is this?";
  return "";
}

function renderMobileMetaPaddingSlots(count, keyPrefix) {
  return Array.from({ length: count }, (_, index) => (
    <span key={`${keyPrefix}-${index}`} className="mobileMetaPlaceholder" aria-hidden="true">-</span>
  ));
}

function renderMobileMetaPlaceholder(key) {
  return <span key={key} className="mobileMetaPlaceholder" aria-hidden="true">-</span>;
}

function MobileMetaValue({ label, value, className = "", children, showTooltip = true, tooltipNote = "", tooltipOverride = "", showInlineLabel = true, alwaysShowInlineLabel = false, ...restProps }) {
  const chipRef = useRef(null);
  const [tooltipPosition, setTooltipPosition] = useState(null);
  const displayValue = getDisplayValue(value);
  const hasDefinedValue = Boolean(normalizeText(value));
  const shouldShowInlineLabel = showInlineLabel && (alwaysShowInlineLabel || !hasDefinedValue);
  const tooltip = showTooltip
    ? (tooltipOverride || [`${label}: ${displayValue}`, getMetaTooltipIntro(label), tooltipNote].filter(Boolean).join("\n"))
    : "";
  const content = children || displayValue;

  function showValueTooltip() {
    if (!showTooltip) return;
    const chip = chipRef.current;
    if (!chip) return;
    const rect = chip.getBoundingClientRect();
    const maxWidth = Math.min(240, window.innerWidth - 24);
    const estimatedWidth = Math.min(maxWidth, Math.max(92, tooltip.length * 7 + 18));
    const left = Math.min(
      window.innerWidth - estimatedWidth - 12,
      Math.max(12, rect.left + rect.width / 2 - estimatedWidth / 2)
    );
    const top = rect.top >= 42 ? rect.top - 8 : rect.bottom + 8;
    setTooltipPosition({ left, top, width: estimatedWidth, placeBelow: rect.top < 42 });
  }

  function hideTooltip() {
    setTooltipPosition(null);
  }

  useEffect(() => {
    if (!tooltipPosition) return undefined;

    function hideOnOutsidePointer(event) {
      if (chipRef.current?.contains(event.target)) return;
      hideTooltip();
    }

    window.addEventListener("scroll", hideTooltip, { passive: true });
    window.addEventListener("resize", hideTooltip);
    document.addEventListener("pointerdown", hideOnOutsidePointer);
    return () => {
      window.removeEventListener("scroll", hideTooltip);
      window.removeEventListener("resize", hideTooltip);
      document.removeEventListener("pointerdown", hideOnOutsidePointer);
    };
  }, [tooltipPosition]);

  return (
    <span
      ref={chipRef}
      className={className}
      title={tooltip || undefined}
      aria-label={tooltip || undefined}
      data-has-tooltip={showTooltip ? "true" : undefined}
      tabIndex={showTooltip ? 0 : undefined}
      onMouseEnter={showValueTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showValueTooltip}
      onBlur={hideTooltip}
      onPointerDown={showValueTooltip}
      {...restProps}
    >
      {shouldShowInlineLabel ? <span className="mobileMetaInlineLabel">{label}: </span> : null}
      {content}
      {showTooltip && tooltipPosition && (
        <span
          className={`mobileMetaTooltip ${tooltipPosition.placeBelow ? "below" : ""}`}
          style={{
            left: `${tooltipPosition.left}px`,
            top: `${tooltipPosition.top}px`,
            width: `${tooltipPosition.width}px`
          }}
          role="tooltip"
        >
          {tooltip}
        </span>
      )}
    </span>
  );
}

function MobileTaskCard({
  task,
  dragProps = {},
  highlightedTaskId,
  isEditing,
  hasUnsavedChanges,
  editDraft,
  editSectionDefaults,
  dependencyTask,
  predecessorTargets = [],
  successorTargets = [],
  dependencyOptions,
  tagOptions,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onSaveEditField,
  onLocalEditDraftChange,
  onRequestEditExit,
  onDelete,
  onRestore,
  onToggleDone,
  onShareTask,
  onShowTask,
  onChange,
  isDescriptionOpen = false,
  onToggleDescription = () => {},
  getTooltip = getEditTooltip,
  dueReminderTooltip = "",
  showCompletedAt,
  showDeletedAt,
  isMobileViewport = false,
  cardBadgeColumns = DEFAULT_CARD_BADGE_COLUMNS,
  hideOverviewDetailsUntilDescriptionOpen = false,
  alwaysExpandDetails = false,
  showBadgeSection = false,
  badgeSectionDefaultOpen = true
}) {
  const data = isEditing ? editDraft : task;
  const done = isDone(task);
  const deleted = isDeleted(task);
  const [isDoneConfirmOpen, setIsDoneConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isParametersOpen, setIsParametersOpen] = useState(editSectionDefaults.parameters);
  const doneConfirmRef = useRef(null);
  const deleteConfirmRef = useRef(null);
  const statusToggleRef = useRef(null);
  const deleteToggleRef = useRef(null);
  const hasDescription = Boolean(normalizeText(task.beschreibung));
  const commentCount = normalizeComments(task.comments).length;
  const subtaskCount = normalizeSubtasks(task.subtasks).length;
  const predecessorCount = predecessorTargets.length;
  const successorCount = successorTargets.length;
  const hasComments = commentCount > 0;
  const hasSubtasks = subtaskCount > 0;
  const hasDependencyDetails = predecessorCount > 0 || successorCount > 0;
  const hasContentDetails = hasDescription || hasComments || hasSubtasks;
  const showMetaTooltips = Boolean(getTooltip("task", task.task));
  const MobileValue = props => <MobileMetaValue showTooltip={showMetaTooltips} {...props} />;
  const taskTags = normalizeTags(task.tags);
  const firstTag = taskTags[0] || "";
  const startDateText = formatDate(data.startdatum);
  const dueDateText = formatDate(data.faellig);
  const createdDateText = formatDate(data.createdAt);
  const normalizedCardBadgeColumns = normalizeCardBadgeColumns(cardBadgeColumns);
  const effectiveOverviewBadgeColumnValue = isMobileViewport ? "default" : normalizedCardBadgeColumns.overview;
  const effectiveEditBadgeColumnValue = isMobileViewport ? "default" : normalizedCardBadgeColumns.edit;
  const visibleMetaItemCount = 6;
  const overviewMetaPaddingCount = getCardBadgePaddingCount(visibleMetaItemCount, effectiveOverviewBadgeColumnValue);
  const editMetaPaddingCount = getCardBadgePaddingCount(visibleMetaItemCount, effectiveEditBadgeColumnValue);
  const shouldShowOverviewBadgeSection = Boolean(showBadgeSection && !isEditing);
  const cardClassName = [
    "mobileTaskCard",
    getCardBadgeColumnClass("badgeOverviewColumns-", effectiveOverviewBadgeColumnValue),
    getCardBadgeColumnClass("badgeEditColumns-", effectiveEditBadgeColumnValue),
    done ? "doneRow" : "",
    deleted ? "deletedRow" : "",
    highlightedTaskId === task.id ? "highlightRow" : "",
    dragProps.draggable ? "isDraggableCard" : ""
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    if (isEditing) setIsParametersOpen(editSectionDefaults.parameters);
  }, [isEditing, task.id, editSectionDefaults.parameters]);

  useEffect(() => {
    if (!isDoneConfirmOpen && !isDeleteConfirmOpen) return undefined;

    function closeOnOutsidePointer(event) {
      if (
        doneConfirmRef.current?.contains(event.target) ||
        deleteConfirmRef.current?.contains(event.target) ||
        statusToggleRef.current?.contains(event.target) ||
        deleteToggleRef.current?.contains(event.target)
      ) return;
      setIsDoneConfirmOpen(false);
      setIsDeleteConfirmOpen(false);
    }

    function closeOnScroll() {
      setIsDoneConfirmOpen(false);
      setIsDeleteConfirmOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    window.addEventListener("scroll", closeOnScroll, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      window.removeEventListener("scroll", closeOnScroll);
    };
  }, [isDoneConfirmOpen, isDeleteConfirmOpen]);

  useEffect(() => {
    if (!isDoneConfirmOpen && !isDeleteConfirmOpen) return undefined;
    const frame = window.requestAnimationFrame(() => ensureElementVisible(deleteConfirmRef.current || doneConfirmRef.current, null, 12));
    return () => window.cancelAnimationFrame(frame);
  }, [isDoneConfirmOpen, isDeleteConfirmOpen]);

  if (isEditing) {
    return (
      <article
        id={`mobile-task-row-${task.id}`}
        className={`${cardClassName} mobileEditCard`}
        data-edit-surface="true"
      >
        <div className="mobileTaskHeader">
          <div className="mobileEditTitleRow">
            <div className="mobileTaskTitleBlock">
              <div className="mobileEditIdGroup">
                {dueReminderTooltip && (
                  <MobileMetaValue
                    label="Upcoming"
                    value="!"
                    className="iconButton dueReminderEditIcon taskTitleReminderIcon"
                    showTooltip={showMetaTooltips}
                    tooltipOverride={dueReminderTooltip}
                    showInlineLabel={false}
                  >
                    !
                  </MobileMetaValue>
                )}
                <span className="taskIdStatic" title="Task ID">{task.taskCode}</span>
              </div>
            </div>
            <div className="mobileTaskHeaderActions mobileEditHeaderActions" aria-label="Task actions">
            <button
              type="button"
              className={`iconButton saveEditButton ${hasUnsavedChanges ? "hasChanges" : ""}`}
              onClick={() => onSaveEdit({ keepEditing: true })}
              disabled={!hasUnsavedChanges}
              title={hasUnsavedChanges ? "Save changes" : "No unsaved changes"}
            >
              <DisketteIcon size={17} />
            </button>
            <button
              ref={deleteToggleRef}
              type="button"
              className="iconButton danger"
              onClick={() => {
                setIsDeleteConfirmOpen(current => !current);
                setIsDoneConfirmOpen(false);
              }}
              title="Delete"
            >
              <Trash2 size={17} />
            </button>
            <button
              ref={statusToggleRef}
              type="button"
              className={`iconButton statusToggle ${done ? "done" : ""}`}
              onClick={() => {
                if (done) {
                  onChange("googleStatus", "Offen");
                  window.requestAnimationFrame(() => onSaveEdit());
                  return;
                }
                setIsDeleteConfirmOpen(false);
                setIsDoneConfirmOpen(current => !current);
              }}
              disabled={deleted}
              title={done ? "Mark open" : "Mark done"}
            >
              <Check size={17} />
            </button>
            <button type="button" className="iconButton" onClick={onCancelEdit} title="Close">
              <X size={17} />
            </button>
          </div>
          </div>
          <textarea
            className="mobileTaskTitleInput"
            value={data.task}
            onChange={event => onChange("task", event.target.value)}
            aria-label="Task"
            title={getTooltip("task", data.task)}
            rows={2}
            maxLength={TEXT_LIMITS.task.max}
          />
          <InputGuidance value={data.task} limits={TEXT_LIMITS.task} label="Task name" />
        </div>

        {(isDeleteConfirmOpen || isDoneConfirmOpen) && (
          <div className="mobileEditConfirmRow">
            {isDeleteConfirmOpen && (
              <div ref={deleteConfirmRef} className="mobileDoneConfirm mobileEditDoneConfirm taskConfirmDialog" role="group" aria-label="Confirm task delete">
                <span>Delete?</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteConfirmOpen(false);
                    onDelete(task.id, { skipConfirm: true });
                  }}
                >
                  Yes
                </button>
                <button type="button" onClick={() => setIsDeleteConfirmOpen(false)}>
                  No
                </button>
              </div>
            )}
            {isDoneConfirmOpen && (
              <div ref={doneConfirmRef} className="mobileDoneConfirm mobileEditDoneConfirm taskConfirmDialog" role="group" aria-label="Confirm task completion">
                <span>Complete?</span>
                <button
                  type="button"
                  onClick={() => {
                    onChange("googleStatus", "Erledigt");
                    window.requestAnimationFrame(() => {
                      if (onSaveEdit()) setIsDoneConfirmOpen(false);
                    });
                  }}
                >
                  Yes
                </button>
                <button type="button" onClick={() => setIsDoneConfirmOpen(false)}>
                  No
                </button>
              </div>
            )}
          </div>
        )}

        <details key={`${task.id}-parameters-${editSectionDefaults.parameters}`} className="taskEditSection taskEditSectionParameters" open={isParametersOpen} onToggle={event => setIsParametersOpen(event.currentTarget.open)}>
          <summary>
            <span className="taskEditSectionTitle">Parameter</span>
            {!isParametersOpen && (
              <div
                className="mobileMeta collapsedParameterMeta"
                aria-label="Parameter overview"
                onClick={event => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onKeyDown={event => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  event.stopPropagation();
                }}
              >
                <MobileValue label="Prio" value={getDisplayValue(getEffectivePrio(data.prio))} className={`prio ${getPrioClass(getEffectivePrio(data.prio))}`} tooltipNote={getDerivedCriteriaTooltip(data, "prio")} data-prio={getEffectivePrio(data.prio)}>
                  {getDisplayValue(getEffectivePrio(data.prio))}
                </MobileValue>
                <MobileValue label="Tag" value={normalizeTags(data.tags)[0] || ""} className="tagPill">
                  {normalizeTags(data.tags)[0] ? `#${normalizeTags(data.tags)[0]}` : "-"}
                </MobileValue>
                <MobileValue label="Status" value={getDisplayValue(getDisplayStatus(data))} className={`statusBadge ${getStatusClass(getDisplayStatus(data))}`}>
                  {getDisplayValue(getDisplayStatus(data))}
                </MobileValue>
                <MobileValue label="Created" value={createdDateText} className="mobileDateBadge" alwaysShowInlineLabel>
                  {createdDateText || "-"}
                </MobileValue>
                <MobileValue label="Start" value={startDateText} className={`mobileDateBadge ${isTaskOrSubtaskStartAttention(data) ? "overdue" : ""}`} tooltipNote={getStartDateStateText(data)} alwaysShowInlineLabel>
                  {startDateText || "-"}
                </MobileValue>
                <MobileValue label="Due" value={dueDateText} className={`mobileDateBadge ${isTaskOrSubtaskDueAttention(data) ? "overdue" : ""}`} tooltipNote={getDueDateStateText(data)} alwaysShowInlineLabel>
                  {dueDateText || "-"}
                </MobileValue>
                {renderMobileMetaPaddingSlots(editMetaPaddingCount, `edit-meta-padding-${task.id}`)}
              </div>
            )}
          </summary>
          <div className="mobileEditGrid">
          <label className="mobileEditCriterionField" title={getTooltip("risiko", data.risiko)}>
            <span>Damage</span>
            <select value={data.risiko} onChange={event => onChange("risiko", event.target.value)} title={getTooltip("risiko", data.risiko)}>
              <option value={CRITERIA_PLACEHOLDER} disabled>
                {CRITERIA_PLACEHOLDER} select
              </option>
              {RISIKO_OPTIONS.map(option => (
                <option key={option} value={option}>{getDisplayValue(option)}</option>
              ))}
            </select>
          </label>
          <label className="mobileEditCriterionField" title={getTooltip("impact", data.impact)}>
            <span>Impact</span>
            <select value={data.impact} onChange={event => onChange("impact", event.target.value)} title={getTooltip("impact", data.impact)}>
              <option value={CRITERIA_PLACEHOLDER} disabled>
                {CRITERIA_PLACEHOLDER} select
              </option>
              {IMPACT_OPTIONS.map(option => (
                <option key={option} value={option}>{getDisplayValue(option)}</option>
              ))}
            </select>
          </label>
          <div className="derivedValuesRow mobileEditDerived mobileEditFull" aria-label="Derived values">
            <span>
              Prio: <strong className={`prio ${getPrioClass(getEffectivePrio(data.prio))}`} data-prio={getEffectivePrio(data.prio)} title={getTooltip("prio", getEffectivePrio(data.prio))}>{getDisplayValue(getEffectivePrio(data.prio))}</strong>
            </span>
          </div>
          <div className="mobileEditTagField" title={getTooltip("tags", normalizeTags(data.tags)[0] || "-")}>
            <TagEditorField values={data.tags} options={tagOptions} onChange={value => onChange("tags", value)} />
          </div>
          <label className="mobileEditStatusField" title={getTooltip("googleStatus", getDisplayStatus(data))}>
            <span>Status</span>
            <select value={getDisplayStatus(data)} onChange={event => onChange("googleStatus", event.target.value)} title={getTooltip("googleStatus", getDisplayStatus(data))}>
              {TASK_STATUS_OPTIONS.map(option => (
                <option key={option} value={option}>{getDisplayValue(option)}</option>
              ))}
            </select>
          </label>
          <label className="mobileEditDateField mobileEditStartDateField" title={getTooltip("startdatum", formatDate(data.startdatum) || "-")}>
            <span>Start date</span>
            <input
              type="date"
              value={data.startdatum}
              onChange={event => onChange("startdatum", event.target.value)}
              title={getTooltip("startdatum", formatDate(data.startdatum) || "-")}
            />
          </label>
          <label className="mobileEditDateField mobileEditDueDateField" title={getTooltip("faellig", formatDate(data.faellig) || "-")}>
            <span>Due</span>
            <input type="date" value={data.faellig} onChange={event => onChange("faellig", event.target.value)} title={getTooltip("faellig", formatDate(data.faellig) || "-")} />
          </label>
          <div className="mobileEditFull mobileEditDependencyField" title={getTooltip("dependsOnTaskIds", normalizeTaskIds(data.dependsOnTaskIds).length ? `${normalizeTaskIds(data.dependsOnTaskIds).length} selected` : "-")}>
            <TaskMultiDependencyField
              label="Predecessors"
              values={data.dependsOnTaskIds}
              options={dependencyOptions}
              onChange={value => onChange("dependsOnTaskIds", value)}
            />
          </div>
          <div className="mobileEditFull mobileEditDependencyField" title={getTooltip("successorTaskIds", normalizeTaskIds(data.successorTaskIds).length ? `${normalizeTaskIds(data.successorTaskIds).length} selected` : "-")}>
            <TaskMultiDependencyField
              label="Successors"
              values={data.successorTaskIds}
              options={dependencyOptions}
              onChange={value => onChange("successorTaskIds", value)}
            />
          </div>
          </div>
        </details>

        <details key={`${task.id}-description-${editSectionDefaults.description}`} className="taskEditSection taskEditSectionDescription" open={editSectionDefaults.description}>
          <summary>Description</summary>
          <div className="taskEditSectionContent" title={getTooltip("beschreibung", data.beschreibung)}>
            <DescriptionEditor
              value={data.beschreibung}
              onSave={value => onSaveEditField("beschreibung", value)}
              draftKey={`${task.id}:beschreibung`}
              onLocalDraftChange={onLocalEditDraftChange}
            />
          </div>
        </details>

        <details key={`${task.id}-subtasks-${editSectionDefaults.subtasks}`} className="taskEditSection taskEditSectionSubtasks" open={editSectionDefaults.subtasks}>
          <summary>Subtasks</summary>
          <div className="taskEditSectionContent" title={getTooltip("subtasks", `${normalizeSubtasks(data.subtasks).length} Subtasks`)}>
            <SubtaskEditor
              value={data.subtasks}
              parentStartDate={data.startdatum}
              parentDueDate={data.faellig}
              onSave={value => onSaveEditField("subtasks", value)}
              draftKey={`${task.id}:subtasks`}
              onLocalDraftChange={onLocalEditDraftChange}
            />
          </div>
        </details>

        <details key={`${task.id}-comments-${editSectionDefaults.comments}`} className="taskEditSection taskEditSectionComments" open={editSectionDefaults.comments}>
          <summary>Comments</summary>
          <div className="taskEditSectionContent" title={getTooltip("comments", `${normalizeComments(data.comments).length} Comments`)}>
            <CommentEditor
              value={data.comments}
              onSave={value => onSaveEditField("comments", value)}
              draftKey={`${task.id}:comments`}
              onLocalDraftChange={onLocalEditDraftChange}
            />
          </div>
        </details>
      </article>
    );
  }

  return (
    <article id={`mobile-task-row-${task.id}`} className={cardClassName} {...dragProps}>
      <div className="mobileTaskHeader">
        <div className="mobileTaskTitleBlock">
          <div className="mobileTaskTitleLine">
            {dueReminderTooltip && (
              <MobileMetaValue
                label="Upcoming"
                value="!"
                className="iconButton dueReminderEditIcon taskTitleReminderIcon"
                showTooltip={showMetaTooltips}
                tooltipOverride={dueReminderTooltip}
                showInlineLabel={false}
              >
                !
              </MobileMetaValue>
            )}
            <button
              type="button"
              className="taskIdButton"
              onClick={() => onShowTask(task.id)}
              title="Show/hide task details"
            >
              {task.taskCode}
            </button>
            <span className="mobileTaskIdSeparator">:</span>
            <h2>{task.task}</h2>
          </div>
        </div>
        <div className="mobileTaskHeaderActions">
          <button
            type="button"
            className="iconButton"
            onClick={() => onStartEdit(task)}
            aria-label="Edit task"
            title="Edit task"
          >
            <Pencil size={17} />
          </button>
          <button
            type="button"
            className="iconButton"
            onClick={() => onShareTask(task)}
            aria-label="Share task"
            title="Share task"
          >
            <Share2 size={16} />
          </button>
          {!deleted && (
            <button
              ref={deleteToggleRef}
              type="button"
              className="iconButton danger"
              onClick={() => {
                setIsDeleteConfirmOpen(current => !current);
                setIsDoneConfirmOpen(false);
              }}
              title="Delete"
            >
              <Trash2 size={17} />
            </button>
          )}
          <button
            ref={statusToggleRef}
            type="button"
            className={`iconButton statusToggle ${done ? "done" : ""}`}
            onClick={() => (done ? onToggleDone(task.id) : setIsDoneConfirmOpen(current => !current))}
            disabled={deleted}
            title={done ? "Mark open" : "Mark done"}
          >
            <Check size={17} />
          </button>
        </div>
      </div>

      {!hideOverviewDetailsUntilDescriptionOpen && (shouldShowOverviewBadgeSection ? (
        <details className="mobileBadgeSection" open={badgeSectionDefaultOpen}>
          <summary>Badges</summary>
          <div className="mobileMeta">
            <MobileValue label="Prio" value={getDisplayValue(getEffectivePrio(task.prio))} className={`prio ${getPrioClass(getEffectivePrio(task.prio))}`} tooltipNote={getDerivedCriteriaTooltip(task, "prio")} data-prio={getEffectivePrio(task.prio)}>
              {getDisplayValue(getEffectivePrio(task.prio))}
            </MobileValue>
            <MobileValue label="Tag" value={firstTag} className="tagPill">
              {firstTag ? `#${firstTag}` : "-"}
            </MobileValue>
            <MobileValue label="Status" value={getDisplayStatus(task)} className={`statusBadge ${getStatusClass(getDisplayStatus(task))}`}>
              {getDisplayValue(getDisplayStatus(task))}
            </MobileValue>
            <MobileValue label="Created" value={createdDateText} className="mobileDateBadge" alwaysShowInlineLabel>
              {createdDateText || "-"}
            </MobileValue>
            <MobileValue label="Start" value={startDateText} className={`mobileDateBadge ${isTaskOrSubtaskStartAttention(task) ? "overdue" : ""}`} tooltipNote={getStartDateStateText(task)} alwaysShowInlineLabel>
              {startDateText || "-"}
            </MobileValue>
            <MobileValue label="Due" value={dueDateText} className={`mobileDateBadge ${isTaskOrSubtaskDueAttention(task) ? "overdue" : ""}`} tooltipNote={getDueDateStateText(task)} alwaysShowInlineLabel>
              {dueDateText || "-"}
            </MobileValue>
            {renderMobileMetaPaddingSlots(overviewMetaPaddingCount, `overview-meta-padding-${task.id}`)}
          </div>
        </details>
      ) : (
        <div className="mobileMeta">
          <MobileValue label="Prio" value={getDisplayValue(getEffectivePrio(task.prio))} className={`prio ${getPrioClass(getEffectivePrio(task.prio))}`} tooltipNote={getDerivedCriteriaTooltip(task, "prio")} data-prio={getEffectivePrio(task.prio)}>
            {getDisplayValue(getEffectivePrio(task.prio))}
          </MobileValue>
          <MobileValue label="Tag" value={firstTag} className="tagPill">
            {firstTag ? `#${firstTag}` : "-"}
          </MobileValue>
          <MobileValue label="Status" value={getDisplayStatus(task)} className={`statusBadge ${getStatusClass(getDisplayStatus(task))}`}>
            {getDisplayValue(getDisplayStatus(task))}
          </MobileValue>
          <MobileValue label="Created" value={createdDateText} className="mobileDateBadge" alwaysShowInlineLabel>
            {createdDateText || "-"}
          </MobileValue>
          <MobileValue label="Start" value={startDateText} className={`mobileDateBadge ${isTaskOrSubtaskStartAttention(task) ? "overdue" : ""}`} tooltipNote={getStartDateStateText(task)} alwaysShowInlineLabel>
            {startDateText || "-"}
          </MobileValue>
          <MobileValue label="Due" value={dueDateText} className={`mobileDateBadge ${isTaskOrSubtaskDueAttention(task) ? "overdue" : ""}`} tooltipNote={getDueDateStateText(task)} alwaysShowInlineLabel>
            {dueDateText || "-"}
          </MobileValue>
          {renderMobileMetaPaddingSlots(overviewMetaPaddingCount, `overview-meta-padding-${task.id}`)}
        </div>
      ))}

      {(isDeleteConfirmOpen || isDoneConfirmOpen) && (
        <>
          {isDeleteConfirmOpen && (
            <div ref={deleteConfirmRef} className="mobileDoneConfirm taskConfirmDialog" role="group" aria-label="Confirm task delete">
              <span>Delete?</span>
              <button
                type="button"
                onClick={() => {
                  onDelete(task.id, { skipConfirm: true });
                  setIsDeleteConfirmOpen(false);
                }}
              >
                Yes
              </button>
              <button type="button" onClick={() => setIsDeleteConfirmOpen(false)}>
                No
              </button>
            </div>
          )}
          {isDoneConfirmOpen && (
            <div ref={doneConfirmRef} className="mobileDoneConfirm taskConfirmDialog" role="group" aria-label="Confirm task completion">
              <span>Complete?</span>
              <button
                type="button"
                onClick={() => {
                  onToggleDone(task.id);
                  setIsDoneConfirmOpen(false);
                }}
              >
                Yes
              </button>
              <button type="button" onClick={() => setIsDoneConfirmOpen(false)}>
                No
              </button>
            </div>
          )}
        </>
      )}
      {hasContentDetails && !hideOverviewDetailsUntilDescriptionOpen && (
        alwaysExpandDetails ? (
          <div className="mobileDescriptionBlock mobileDetailsExpanded">
            {hasDependencyDetails && (
              <MobileDescriptionPanel title="Dependencies">
                <MobileDependencyRelations
                  predecessorTargets={predecessorTargets}
                  successorTargets={successorTargets}
                  onShowTask={onShowTask}
                />
              </MobileDescriptionPanel>
            )}
            {hasDescription && (
              <MobileDescriptionPanel title="Description">
                <DescriptionBlock text={task.beschreibung} />
              </MobileDescriptionPanel>
            )}
            {hasSubtasks && (
              <MobileDescriptionPanel title="Subtasks">
                <SubtaskList subtasks={task.subtasks} />
              </MobileDescriptionPanel>
            )}
            {hasComments && (
              <MobileDescriptionPanel title="Comments">
                <CommentList comments={task.comments} />
              </MobileDescriptionPanel>
            )}
          </div>
        ) : (
          <details key={`${task.id}-details-${isDescriptionOpen ? "open" : "closed"}`} className="mobileDescriptionBlock mobileDetailsDisclosure" open={isDescriptionOpen}>
            <summary
              onClick={event => {
                event.preventDefault();
                onToggleDescription();
              }}
            >
              Additional details
            </summary>
            {isDescriptionOpen && (
              <>
                {hideOverviewDetailsUntilDescriptionOpen && (
                  <>
                    <MobileDescriptionPanel title="Parameter">
                  <div className="mobileMeta">
                    <MobileValue label="Prio" value={getDisplayValue(getEffectivePrio(task.prio))} className={`prio ${getPrioClass(getEffectivePrio(task.prio))}`} tooltipNote={getDerivedCriteriaTooltip(task, "prio")} data-prio={getEffectivePrio(task.prio)}>
                      {getDisplayValue(getEffectivePrio(task.prio))}
                    </MobileValue>
                    <MobileValue label="Tag" value={firstTag} className="tagPill">
                      {firstTag ? `#${firstTag}` : "-"}
                    </MobileValue>
                    <MobileValue label="Status" value={getDisplayStatus(task)} className={`statusBadge ${getStatusClass(getDisplayStatus(task))}`}>
                      {getDisplayValue(getDisplayStatus(task))}
                    </MobileValue>
                    <MobileValue label="Created" value={createdDateText} className="mobileDateBadge" alwaysShowInlineLabel>
                      {createdDateText || "-"}
                    </MobileValue>
                    <MobileValue label="Start" value={startDateText} className={`mobileDateBadge ${isTaskOrSubtaskStartAttention(task) ? "overdue" : ""}`} tooltipNote={getStartDateStateText(task)} alwaysShowInlineLabel>
                      {startDateText || "-"}
                    </MobileValue>
                    <MobileValue label="Due" value={dueDateText} className={`mobileDateBadge ${isTaskOrSubtaskDueAttention(task) ? "overdue" : ""}`} tooltipNote={getDueDateStateText(task)} alwaysShowInlineLabel>
                      {dueDateText || "-"}
                    </MobileValue>
                    {renderMobileMetaPaddingSlots(overviewMetaPaddingCount, `overview-meta-padding-${task.id}`)}
                  </div>
                    </MobileDescriptionPanel>
                  </>
                )}
                {hasDependencyDetails && (
              <MobileDescriptionPanel title="Dependencies">
                <MobileDependencyRelations
                  predecessorTargets={predecessorTargets}
                  successorTargets={successorTargets}
                  onShowTask={onShowTask}
                />
              </MobileDescriptionPanel>
            )}
            {hasDescription && (
              <MobileDescriptionPanel title="Description">
                <DescriptionBlock text={task.beschreibung} />
              </MobileDescriptionPanel>
            )}
            {hasSubtasks && (
              <MobileDescriptionPanel title="Subtasks">
                <SubtaskList subtasks={task.subtasks} />
              </MobileDescriptionPanel>
            )}
                {hasComments && (
                  <MobileDescriptionPanel title="Comments">
                    <CommentList comments={task.comments} />
                  </MobileDescriptionPanel>
                )}
              </>
            )}
          </details>
        )
      )}

      <dl className="mobileDetails">
        <div>
          <dt>Start date</dt>
          <dd className={isTaskOrSubtaskStartAttention(task) ? "overdue" : ""} title={getStartDateStateText(task) || undefined}>{formatDate(task.startdatum) || "-"}</dd>
        </div>
        <div>
          <dt>Due</dt>
          <dd className={isTaskOrSubtaskDueAttention(task) ? "overdue" : ""} title={getDueDateStateText(task) || undefined}>
            {formatDate(task.faellig) || "-"}
          </dd>
        </div>
        {showCompletedAt && (
          <div>
            <dt>Done on</dt>
            <dd>{formatDate(task.completedAt) || "-"}</dd>
          </div>
        )}
        {showDeletedAt && (
          <div>
            <dt>Deleted on</dt>
            <dd>{formatDate(task.deletedAt) || "-"}</dd>
          </div>
        )}
        <div>
          <dt>Predecessors</dt>
          <dd>
            {dependencyTask ? (
              <button
                type="button"
                className="dependencyLink"
                onClick={() => onShowTask(dependencyTask.id)}
                title={dependencyTask.task}
              >
                {dependencyTask.taskCode}
              </button>
            ) : (
              "None"
            )}
          </dd>
        </div>
      </dl>

      <div className="mobileActions">
        {deleted ? (
          <>
            <button type="button" className="secondaryButton" onClick={() => onStartEdit(task)}>
              Edit
            </button>
            <button type="button" className="secondaryButton" onClick={() => onRestore(task.id)}>
              Restore
            </button>
          </>
        ) : (
          <>
            <button type="button" className="secondaryButton" onClick={() => onStartEdit(task)}>
              Edit
            </button>
            <button type="button" className="secondaryButton dangerText" onClick={() => onDelete(task.id)}>
              Delete
            </button>
          </>
        )}
      </div>
    </article>
  );
}

function MobileDescriptionPanel({ title, children }) {
  return (
    <section className="mobileDescriptionPanel">
      <h3>{title}</h3>
      <div className="mobileDescriptionPanelContent">
        {children}
      </div>
    </section>
  );
}

function MobileDependencyRelations({ predecessorTargets, successorTargets, onShowTask }) {
  if (predecessorTargets.length === 0 && successorTargets.length === 0) return null;

  return (
    <div className="mobileDependencyRelations" aria-label="Task dependencies">
      {predecessorTargets.length > 0 && (
        <div className="mobileDependencyRelationGroup">
          <span>Predecessors</span>
          <RelationTargetPicker targets={predecessorTargets} onShowTask={onShowTask} />
        </div>
      )}
      {successorTargets.length > 0 && (
        <div className="mobileDependencyRelationGroup">
          <span>Successors</span>
          <RelationTargetPicker targets={successorTargets} onShowTask={onShowTask} />
        </div>
      )}
    </div>
  );
}

function ComboInput({ value, options, onChange, placeholder, ariaLabel, maxLength = 0, guidance = null, guidanceLabel = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  const visibleOptions = options.filter(option => option !== value);

  return (
    <div className="comboBox">
      <input
        value={value}
        onClick={() => setIsOpen(true)}
        onChange={event => {
          onChange(truncateText(event.target.value, maxLength));
          setIsOpen(false);
        }}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
        placeholder={placeholder}
        maxLength={maxLength || undefined}
      />
      <button
        type="button"
        className="comboArrow"
        onPointerDown={event => {
          event.preventDefault();
          setIsOpen(current => !current);
        }}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
      />
      {isOpen && visibleOptions.length > 0 && (
        <div className="comboMenu" role="listbox">
          {visibleOptions.map(option => (
            <button
              key={option}
              type="button"
              role="option"
              onMouseDown={event => {
                event.preventDefault();
                onChange(option);
                setIsOpen(false);
              }}
            >
              {option}
            </button>
          ))}
        </div>
      )}
      {guidance && <InputGuidance value={value} limits={guidance} label={guidanceLabel || ariaLabel || "Value"} />}
    </div>
  );
}

function getPrioClass(prio) {
  return `prio-${String(prio).toLowerCase()}`;
}

