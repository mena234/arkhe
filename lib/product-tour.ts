export const TOUR_STEPS = [
  {
    route: "/dashboard", target: "project-summary", section: "Dashboard",
    title: "Your project, at a glance",
    description: "Arkhe brings your material selections, costs, and approvals into one project. The dashboard shows the full specification value, room count, and items with long lead times.",
    tip: "Use the project name in the sidebar to edit the client, location, and project details.",
  },
  {
    route: "/workspace", target: "add-material", section: "Workspace",
    title: "Build your material collection",
    description: "Collect the finishes, furniture, lighting, and fixtures that shape a space. Add item creates a selection with its room, supplier, price, and image.",
    tip: "Your account starts with a Soho Residence sample project. You can edit these selections or add your own.",
  },
  {
    route: "/workspace", target: "material-details", fallback: "add-material", section: "Workspace",
    title: "Every selection has a home",
    description: "Open a material card to edit its description, quantity, lead time, status, and notes. Attach product images or PDF specification sheets in the details panel, then save your changes.",
    tip: "Drag cards to arrange the board, or focus a card and use Alt + Left / Right. This board and the schedule use the same items.",
  },
  {
    route: "/specifications", target: "schedule-quantity", fallback: "schedule-filters", section: "Specifications",
    title: "Turn selections into a budget",
    description: "Edit a quantity or unit price directly in the schedule. Each line total is quantity × unit price, and the project totals update immediately. Valid edits save automatically to your private cloud workspace.",
    tip: "Click an item’s name for its full details. You don’t need to edit anything during this tour.",
  },
  {
    route: "/specifications", target: "schedule-totals", section: "Specifications",
    title: "Keep the whole budget in view",
    description: "These live totals summarize the full project: overall value, approved and ordered value, item count, and average lead time. The save indicator at the top confirms when your changes have been saved.",
    tip: "Filtering never changes these project-wide totals. The table footer shows the value of just the visible items.",
  },
  {
    route: "/specifications", target: "schedule-filters", section: "Specifications",
    title: "Find what needs a decision",
    description: "Search by item or supplier, combine space, category, and status filters, or click a column heading to sort. Move selections from Draft to Reviewing, then Approved and Ordered as decisions progress.",
    tip: "Approved and Ordered items are eligible for the client preview. Draft and Reviewing items stay private.",
  },
  {
    route: "/exports", target: "schedule-exports", section: "Exports",
    title: "Prepare the right handoff",
    description: "Download a CSV for spreadsheet work or a polished PDF for your client. Choose the full schedule or only approved and ordered items before downloading a dated snapshot.",
    tip: "CSV includes internal notes. The client-facing PDF excludes internal notes and attachments.",
  },
  {
    route: "/exports", target: "share-project", section: "Client sharing",
    title: "Share a view, not your workspace",
    description: "Share project creates a public, read-only link to approved and ordered selections, their images, pricing, and total. Clients don’t need to sign in, and the preview reflects your saved changes.",
    tip: "Anyone with the link can view it. Internal notes and attached documents stay private, and you can revoke the link at any time.",
  },
] as const;

export const TOUR_LAST_STEP = TOUR_STEPS.length + 1;
export const TOUR_QUERY = "arkhe-tour";

export function parseTourStep(value: string | null): number | null {
  if (value === null || !/^(0|[1-9]\d*)$/.test(value)) return null;
  const step = Number(value);
  return Number.isSafeInteger(step) && step <= TOUR_LAST_STEP ? step : null;
}

export function tourKeys(projectId: string) {
  return { seen: `arkhe.tour.v1.${projectId}.seen`, active: `arkhe.tour.v1.${projectId}.active` };
}

export type TourRect = { top: number; left: number; width: number; height: number };

/** Keep the callout inside the viewport, with a centered fallback on small screens. */
export function positionTourCard(target: TourRect | null, viewport: { width: number; height: number }, card: { width: number; height: number }) {
  const gutter = 16;
  const width = Math.min(card.width, viewport.width - gutter * 2);
  const height = Math.min(card.height, viewport.height - gutter * 2);
  const clampX = (left: number) => Math.max(gutter, Math.min(left, viewport.width - width - gutter));
  const clampY = (top: number) => Math.max(gutter, Math.min(top, viewport.height - height - gutter));
  if (target) {
    const left = clampX(target.left + target.width / 2 - width / 2);
    if (target.top + target.height + gutter + height <= viewport.height - gutter) return { left, top: target.top + target.height + gutter };
    if (target.top - gutter - height >= gutter) return { left, top: target.top - gutter - height };
    if (target.left + target.width + gutter + width <= viewport.width - gutter) return { left: target.left + target.width + gutter, top: clampY(target.top) };
    if (target.left - gutter - width >= gutter) return { left: target.left - gutter - width, top: clampY(target.top) };
  }
  return { left: clampX((viewport.width - width) / 2), top: clampY((viewport.height - height) / 2) };
}
