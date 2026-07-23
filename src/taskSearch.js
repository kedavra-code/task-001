export function matchesFreeTextSearch(values, query) {
  const terms = String(query || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (terms.length === 0) return true;

  const searchText = (Array.isArray(values) ? values : [values])
    .map(value => String(value || "").toLowerCase())
    .join(" ");
  return terms.every(term => searchText.includes(term));
}

export function matchesGlobalTaskSearch(values, query, { deleted = false, deletedView = false, done = false, doneView = false } = {}) {
  if (!String(query || "").trim()) return false;
  if (deletedView ? !deleted : deleted) return false;
  if (!deletedView && (doneView ? !done : done)) return false;
  return matchesFreeTextSearch(values, query);
}
