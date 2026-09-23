export const ITEM_STATUSES = ["Draft", "Reviewing", "Approved", "Ordered"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export type ProjectStatus = "In progress" | "On hold" | "Complete";

export interface Project {
  id: string;
  ownerId: string;
  name: string;
  client: string;
  status: ProjectStatus;
  location: string;
  updatedAt: string;
  createdAt: string;
}

export interface Space {
  id: string;
  projectId: string;
  name: string;
  sortOrder: number;
}

export interface SpecificationItem {
  version?: number;
  id: string;
  projectId: string;
  spaceId: string;
  name: string;
  category: string;
  supplier: string;
  description: string;
  quantity: number;
  unitPrice: number;
  leadTimeWeeks: number;
  status: ItemStatus;
  notes: string;
  imageUrl: string;
  sortOrder: number;
  updatedAt: string;
  createdAt: string;
}

export interface Attachment {
  id: string;
  itemId: string;
  projectId: string;
  name: string;
  path: string;
  url: string;
  type: string;
  size: number;
  createdAt: string;
}

export interface ShareLink {
  id: string;
  projectId: string;
  token: string;
  createdAt: string;
}

export interface ArkheData {
  activity?: { id: string; message: string; createdAt: string }[];
  account?: { name: string; email: string };
  project: Project;
  spaces: Space[];
  items: SpecificationItem[];
  attachments: Attachment[];
  shareLinks: ShareLink[];
}

export interface ItemDraft {
  name: string;
  spaceId: string;
  category: string;
  supplier: string;
  description: string;
  quantity: number;
  unitPrice: number;
  leadTimeWeeks: number;
  status: ItemStatus;
  notes: string;
  imageUrl: string;
}

export type SortKey =
  | "sortOrder"
  | "name"
  | "space"
  | "category"
  | "supplier"
  | "quantity"
  | "unitPrice"
  | "total"
  | "leadTimeWeeks"
  | "status";

export interface SpecificationFilters {
  query: string;
  spaceId: string;
  category: string;
  status: string;
}

export interface Rollups {
  totalValue: number;
  approvedValue: number;
  itemCount: number;
  averageLeadTime: number;
  longLeadCount: number;
}
