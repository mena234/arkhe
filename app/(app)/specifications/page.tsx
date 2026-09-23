"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Clock3, Search, SlidersHorizontal, X, Plus } from "lucide-react";
import { NumberCell } from "@/components/number-cell";
import { useArkhe } from "@/components/arkhe-provider";
import { ErrorState, LoadingState } from "@/components/loading-state";
import { ItemDrawer } from "@/components/item-drawer";
import { PageHeader } from "@/components/page-header";
import { calculateRollups, filterItems, formatCurrency, itemTotal, sortItems } from "@/lib/calculations";
import { ITEM_STATUSES, type SortKey, type SpecificationFilters, type SpecificationItem } from "@/lib/types";

const initialFilters: SpecificationFilters = { query: "", spaceId: "", category: "", status: "" };

function SortButton({
  field,
  activeSort,
  onSort,
  children,
}: {
  field: SortKey;
  activeSort: { key: SortKey; direction: "asc" | "desc" };
  onSort: (key: SortKey) => void;
  children: React.ReactNode;
}) {
  return (
    <button className="sort-button" onClick={() => onSort(field)}>
      {children}
      {activeSort.key === field
        ? activeSort.direction === "asc"
          ? <ArrowUp size={13} />
          : <ArrowDown size={13} />
        : <ArrowUpDown size={13} />}
    </button>
  );
}

export default function SpecificationsPage() {
  const { data, loading, error, savingIds, updateItem } = useArkhe();
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "sortOrder" as SortKey, direction: "asc" });
  const [selected, setSelected] = useState<SpecificationItem | null>(null);
  const [adding, setAdding] = useState(false);

  const visibleItems = useMemo(() => {
    if (!data) return [];
    const filtered = filterItems(data.items, filters);
    if (sort.key === ("sortOrder" as SortKey)) return filtered.sort((a, b) => a.sortOrder - b.sortOrder);
    return sortItems(filtered, data.spaces, sort.key, sort.direction);
  }, [data, filters, sort]);

  if (loading) return <div className="page-wrap"><LoadingState rows={6} /></div>;
  if (error || !data) return <div className="page-wrap"><ErrorState message={error ?? "No project data was found."} /></div>;

  const categories = [...new Set(data.items.map((item) => item.category))].sort();
  const rollups = calculateRollups(data.items);
  const hasFilters = Object.values(filters).some(Boolean);
  const changeSort = (key: SortKey) => setSort((current) => current.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" });

  return (
    <div className="page-wrap specifications-page">
      <PageHeader title="Specification schedule" description={`Quantities, pricing, lead times, and approvals for ${data.project.name}.`} aside={<button className="button button-primary" onClick={() => setAdding(true)}><Plus size={16} /> Add item</button>} />
      <section className="rollup-strip" data-tour="schedule-totals" aria-label="Schedule totals">
        <div><span>Total project value</span><strong>{formatCurrency(rollups.totalValue)}</strong></div>
        <div><span>Approved value</span><strong>{formatCurrency(rollups.approvedValue)}</strong><small><Check size={13} /> approved + ordered</small></div>
        <div><span>Specification items</span><strong>{rollups.itemCount}</strong><small>{visibleItems.length} shown</small></div>
        <div><span>Average lead time</span><strong>{rollups.averageLeadTime.toFixed(1)} weeks</strong><small><Clock3 size={13} /> {rollups.longLeadCount} long-lead items</small></div>
      </section>
      <section className="schedule-panel">
        <div className="schedule-filters" data-tour="schedule-filters">
          <label className="search-field"><Search size={16} /><span className="sr-only">Search specifications</span><input value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder="Search item, supplier, category" /></label>
          <div className="filter-selects"><SlidersHorizontal size={16} aria-hidden="true" />
            <label><span className="sr-only">Filter by space</span><select value={filters.spaceId} onChange={(event) => setFilters({ ...filters, spaceId: event.target.value })}><option value="">All spaces</option>{data.spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}</select></label>
            <label><span className="sr-only">Filter by category</span><select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option value="">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
            <label><span className="sr-only">Filter by status</span><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{ITEM_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
          </div>
          {hasFilters && <button className="clear-filters" onClick={() => setFilters(initialFilters)}><X size={14} /> Clear</button>}
        </div>
        <div className="table-scroll">
          <table className="spec-table">
            <thead><tr><th><SortButton field="name" activeSort={sort} onSort={changeSort}>Item</SortButton></th><th><SortButton field="space" activeSort={sort} onSort={changeSort}>Space</SortButton></th><th><SortButton field="category" activeSort={sort} onSort={changeSort}>Category</SortButton></th><th><SortButton field="supplier" activeSort={sort} onSort={changeSort}>Supplier</SortButton></th><th><SortButton field="quantity" activeSort={sort} onSort={changeSort}>Qty</SortButton></th><th><SortButton field="unitPrice" activeSort={sort} onSort={changeSort}>Unit price</SortButton></th><th><SortButton field="total" activeSort={sort} onSort={changeSort}>Total</SortButton></th><th><SortButton field="leadTimeWeeks" activeSort={sort} onSort={changeSort}>Lead time</SortButton></th><th><SortButton field="status" activeSort={sort} onSort={changeSort}>Status</SortButton></th></tr></thead>
            <tbody>
              {visibleItems.map((item, index) => {
                const space = data.spaces.find((candidate) => candidate.id === item.spaceId)?.name;
                return <tr key={item.id} className={savingIds.has(item.id) ? "is-saving" : ""} onDoubleClick={() => setSelected(item)}>
                  <td data-label="Item"><button className="table-item-button" onClick={() => setSelected(item)}><span className="table-item-index">{String(item.sortOrder + 1).padStart(2, "0")}</span><strong>{item.name}</strong></button></td>
                  <td data-label="Space">{space}</td><td data-label="Category">{item.category}</td><td data-label="Supplier">{item.supplier}</td>
                  <td data-label="Quantity" data-tour={index === 0 ? "schedule-quantity" : undefined}><NumberCell className="cell-input quantity-input" label={`${item.name} quantity`} value={item.quantity} max={100000} onChange={(quantity) => updateItem(item.id, { quantity })} /></td>
                  <td data-label="Unit price"><div className="currency-input"><span>$</span><NumberCell label={`${item.name} unit price`} value={item.unitPrice} max={10000000} onChange={(unitPrice) => updateItem(item.id, { unitPrice })} /></div></td>
                  <td data-label="Total" className="total-cell">{formatCurrency(itemTotal(item))}</td>
                  <td data-label="Lead time"><span className={item.leadTimeWeeks >= 16 ? "lead-time long" : "lead-time"}>{item.leadTimeWeeks} wks</span></td>
                  <td data-label="Status"><select className={`status-select status-${item.status.toLowerCase()}`} aria-label={`${item.name} status`} value={item.status} onChange={(event) => void updateItem(item.id, { status: event.target.value as SpecificationItem["status"] }).catch(() => {})}>{ITEM_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        {visibleItems.length === 0 && <div className="table-empty"><Search size={22} /><h2>No matching specifications</h2><p>Adjust the room, category, status, or search term to see more items.</p><button className="button button-secondary" onClick={() => setFilters(initialFilters)}>Reset filters</button></div>}
        <footer className="table-footer"><span>{visibleItems.length} of {data.items.length} items · {formatCurrency(calculateRollups(visibleItems).totalValue)} shown</span><span>Click an item for full details · Prices in USD</span></footer>
      </section>
      <ItemDrawer item={selected ? data.items.find((item) => item.id === selected.id) ?? selected : null} open={Boolean(selected) || adding} onClose={() => { setSelected(null); setAdding(false); }} />
    </div>
  );
}
