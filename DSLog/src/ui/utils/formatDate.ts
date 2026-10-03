export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
