import type { Rollups, SortKey, Space, SpecificationFilters, SpecificationItem } from "@/lib/types";

export const itemTotal = (item: Pick<SpecificationItem, "quantity" | "unitPrice">) =>
  Math.round(item.quantity * item.unitPrice * 100) / 100;

export function calculateRollups(items: SpecificationItem[]): Rollups {
  const totalValue = items.reduce((sum, item) => sum + itemTotal(item), 0);
  const approvedValue = items
    .filter((item) => item.status === "Approved" || item.status === "Ordered")
    .reduce((sum, item) => sum + itemTotal(item), 0);
  const averageLeadTime = items.length
    ? items.reduce((sum, item) => sum + item.leadTimeWeeks, 0) / items.length
    : 0;

  return {
    totalValue: Math.round(totalValue * 100) / 100,
    approvedValue: Math.round(approvedValue * 100) / 100,
    itemCount: items.length,
    averageLeadTime,
    longLeadCount: items.filter((item) => item.leadTimeWeeks >= 16).length,
  };
}

export function filterItems(items: SpecificationItem[], filters: SpecificationFilters) {
  const query = filters.query.trim().toLocaleLowerCase();
  return items.filter((item) => {
    const matchesQuery = !query || [item.name, item.supplier, item.category].some((value) => value.toLocaleLowerCase().includes(query));
    return (
      matchesQuery &&
      (!filters.spaceId || item.spaceId === filters.spaceId) &&
      (!filters.category || item.category === filters.category) &&
      (!filters.status || item.status === filters.status)
    );
  });
}

export function sortItems(
  items: SpecificationItem[],
  spaces: Space[],
  key: SortKey,
  direction: "asc" | "desc",
) {
  const spaceName = new Map(spaces.map((space) => [space.id, space.name]));
  const value = (item: SpecificationItem): string | number => {
    if (key === "space") return spaceName.get(item.spaceId) ?? "";
    if (key === "total") return itemTotal(item);
    return item[key];
  };
  return [...items].sort((a, b) => {
    const av = value(a);
    const bv = value(b);
    const comparison = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
    return direction === "asc" ? comparison : -comparison;
  });
}

export function formatCurrency(value: number, compact = false) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: compact ? 0 : 2,
    notation: compact ? "compact" : "standard",
  }).format(value);
}

export function buildCsv(items: SpecificationItem[], spaces: Space[]) {
  const names = new Map(spaces.map((space) => [space.id, space.name]));
  const escape = (value: string | number) => {
    // Quoting alone does not prevent spreadsheet formula execution.
    const safe = typeof value === "string" && /^[\s]*[=+@\-\t\r]/.test(value) ? `'${value}` : String(value);
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const header = ["Item", "Space", "Category", "Supplier", "Quantity", "Unit price", "Total", "Lead time (weeks)", "Status", "Description", "Notes"];
  const rows = items.map((item) => [
    item.name,
    names.get(item.spaceId) ?? "",
    item.category,
    item.supplier,
    item.quantity,
    item.unitPrice.toFixed(2),
    itemTotal(item).toFixed(2),
    item.leadTimeWeeks,
    item.status,
    item.description,
    item.notes,
  ]);
  return [header, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
}
