/**
 * Preserve explorer URL hash (#x=…&y=…&z=…) when opening `/references` in a full
 * navigation, so "Back to Explorer" can restore the same view.
 */
export const REFERENCES_EXPLORER_RETURN_QUERY = "return";

/** `/references?return=…` with the fragment body (everything after `#`), URL-encoded. */
export function referencesHrefWithExplorerFragment(
  hashWithoutPound: string,
): string {
  const trimmed = hashWithoutPound.trim();
  if (!trimmed) {
    return "/references";
  }
  return `/references?${REFERENCES_EXPLORER_RETURN_QUERY}=${encodeURIComponent(trimmed)}`;
}

/** `/` plus hash to restore explorer state from `searchParams.get(REFERENCES_EXPLORER_RETURN_QUERY)`. */
export function explorerHrefFromReferencesReturn(
  returnParam: string | null,
): string {
  const trimmed = returnParam?.trim() ?? "";
  if (!trimmed) {
    return "/";
  }
  return `/#${trimmed}`;
}
