export function toProjectIdSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function suggestProjectId(title: string, fallback = "new-project"): string {
  return toProjectIdSlug(title) || toProjectIdSlug(fallback) || "new-project";
}
