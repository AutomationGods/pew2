/**
 * Project search, shared so the daemon (searching every known project) and the
 * app (narrowing the list it already has, and an older daemon's 40) agree.
 * Every whitespace-separated term must appear in the name or path, any case.
 */
export interface SearchableWorkspace {
  path: string;
  name: string;
}

export function workspaceQueryTerms(query: string | undefined): string[] {
  return (query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
}

export function matchesWorkspaceQuery(
  entry: SearchableWorkspace,
  query: string | undefined,
): boolean {
  const terms = workspaceQueryTerms(query);
  if (terms.length === 0) return true;
  const name = entry.name.toLowerCase();
  const path = entry.path.toLowerCase();
  return terms.every((term) => name.includes(term) || path.includes(term));
}

/** Matches only, name hits before path-only hits; the input's order (recency) is kept within each. */
export function searchWorkspaces<T extends SearchableWorkspace>(
  entries: readonly T[],
  query: string | undefined,
): T[] {
  const terms = workspaceQueryTerms(query);
  if (terms.length === 0) return [...entries];
  const matches = entries.filter((entry) => matchesWorkspaceQuery(entry, query));
  const byName = (entry: T) => terms.every((term) => entry.name.toLowerCase().includes(term));
  return [...matches.filter(byName), ...matches.filter((entry) => !byName(entry))];
}
