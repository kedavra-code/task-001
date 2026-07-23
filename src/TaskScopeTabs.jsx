function getTagFromTabId(id) {
  return typeof id === "string" && id.startsWith("tag:") ? id.slice(4) : "";
}

export default function TaskScopeTabs({
  activeAppTab,
  activeTagScope,
  counts,
  upcomingCount,
  statusCounts,
  activeGoogleStatus,
  tagTabCounts,
  tabLayout,
  draggedTabRef,
  onShowUpcoming,
  onShowTagScope,
  onShowListTab,
  onMoveTab,
  isSearchActive = false,
  isKanbanView = false
}) {
  function getTabConfig(id) {
    if (isKanbanView && ["newest", "open", "started"].includes(id)) return null;

    if (id === "upcoming") {
      return {
        label: "Upcoming",
        count: upcomingCount,
        countClassName: upcomingCount > 0 ? "alert" : "",
        isActive: activeAppTab === "upcoming",
        onClick: onShowUpcoming,
        title: "Upcoming: everything that needs immediate attention"
      };
    }

    if (id === "all") {
      return {
        label: "All",
        count: counts.open + counts.started,
        isActive: activeAppTab !== "capture" && activeAppTab !== "upcoming" && activeAppTab !== "review" && activeTagScope === "all",
        onClick: () => onShowTagScope("all"),
        title: "Show all active tasks in the current status or due tab"
      };
    }

    if (id === "newest") {
      return {
        label: "Newest",
        count: statusCounts.newest,
        isActive: activeAppTab === "newest",
        onClick: () => onShowListTab("newest"),
        title: "Newest: active unfinished tasks by latest creation date"
      };
    }

    if (id === "open") {
      return {
        label: "Open",
        count: statusCounts.open,
        isActive: activeAppTab !== "capture" && activeAppTab !== "upcoming" && activeAppTab !== "newest" && activeGoogleStatus === "Offen",
        onClick: () => onShowListTab("open"),
        title: "Open: tasks in the current scope that are not started or done"
      };
    }

    if (id === "started") {
      return {
        label: "Started",
        count: statusCounts.started,
        isActive: activeAppTab !== "capture" && activeAppTab !== "upcoming" && activeGoogleStatus === "Gestartet",
        onClick: () => onShowListTab("started"),
        title: "Show started tasks in the current scope"
      };
    }

    const tag = getTagFromTabId(id);
    if (tag) {
      return {
        label: `#${tag}`,
        count: tagTabCounts.get(tag.toLowerCase()) || 0,
        isActive: activeAppTab !== "capture" && activeAppTab !== "upcoming" && activeTagScope.toLowerCase() === tag.toLowerCase(),
        onClick: () => onShowTagScope(tag),
        title: ""
      };
    }

    return null;
  }

  function getRowClassName(rowIndex) {
    return ["primaryScopeTabs", "tagScopeTabs", "statusTabs"][rowIndex] || "scopeTabs";
  }

  return (
    <>
      {tabLayout.map((row, rowIndex) => (
        <nav
          key={rowIndex}
          className={`appTabs scopeTabs tabLayoutRow ${getRowClassName(rowIndex)}`}
          aria-label={`Tab row ${rowIndex + 1}`}
          onDragOver={event => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }}
          onDrop={event => {
            event.preventDefault();
            onMoveTab(draggedTabRef.current || event.dataTransfer.getData("text/plain"), "", rowIndex);
            draggedTabRef.current = "";
          }}
        >
          {row.map(id => {
            const tab = getTabConfig(id);
            if (!tab) return null;
            return (
              <button
                key={id}
                type="button"
                className={`${id.startsWith("tag:") ? "tagTabButton " : ""}${!isSearchActive && tab.isActive ? "active" : ""}`.trim()}
                draggable
                onDragStart={event => {
                  event.currentTarget.classList.add("isDragging");
                  draggedTabRef.current = id;
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", id);
                }}
                onDragOver={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDrop={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  onMoveTab(draggedTabRef.current || event.dataTransfer.getData("text/plain"), id, rowIndex);
                  event.currentTarget.classList.remove("isDragging");
                  draggedTabRef.current = "";
                }}
                onDragEnd={event => {
                  event.currentTarget.classList.remove("isDragging");
                  draggedTabRef.current = "";
                }}
                onClick={tab.onClick}
                title={tab.title}
              >
                {tab.label}
                <span className={`tabCount ${tab.countClassName || ""}`.trim()}>{tab.count}</span>
              </button>
            );
          })}
          {row.length === 0 && <span className="emptyTabDropTarget">Drop tabs here</span>}
        </nav>
      ))}
    </>
  );
}
