export const STATUS_OPTIONS = [
  { value: "new", label: "New", color: "#64748b" },
  { value: "practicing", label: "Practicing", color: "#f59e0b" },
  { value: "polishing", label: "Polishing", color: "#3b82f6" },
  { value: "performance_ready", label: "Performance Ready", color: "#10b981" },
] as const;

export type SongStatus = (typeof STATUS_OPTIONS)[number]["value"];

export const statusLabel = (value?: string | null): string =>
  STATUS_OPTIONS.find((s) => s.value === value)?.label ?? "New";

export const statusColor = (value?: string | null): string =>
  STATUS_OPTIONS.find((s) => s.value === value)?.color ?? "#64748b";

export const TAG_PALETTE = [
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#64748b",
];

export interface SongFilterValues {
  ratingMin: number | null;
  ratingMax: number | null;
  statuses: string[];
}

export const emptyFilters: SongFilterValues = {
  ratingMin: null,
  ratingMax: null,
  statuses: [],
};

export const activeFilterCount = (f: SongFilterValues): number =>
  (f.ratingMin != null || f.ratingMax != null ? 1 : 0) +
  (f.statuses.length > 0 ? 1 : 0);

export function songMatchesFilters(
  song: { rating?: number | null; status?: string | null },
  f: SongFilterValues,
): boolean {
  const hasRating = f.ratingMin != null || f.ratingMax != null;
  if (hasRating) {
    if (song.rating == null) return false;
    const lo = f.ratingMin ?? 1;
    const hi = f.ratingMax ?? 5;
    const min = Math.min(lo, hi);
    const max = Math.max(lo, hi);
    if (song.rating < min || song.rating > max) return false;
  }
  if (f.statuses.length > 0 && !f.statuses.includes(song.status ?? "new")) {
    return false;
  }
  return true;
}
