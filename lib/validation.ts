import { ITEM_STATUSES, type ItemDraft } from "./types";

export function validateItem(input: unknown): ItemDraft {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid specification.");
  const row = input as Record<string, unknown>;
  const string = (key: string, max: number, required = false) => {
    if (typeof row[key] !== "string") throw new Error(`Invalid ${key}.`);
    const value = (row[key] as string).trim();
    if ((required && !value) || value.length > max) throw new Error(`${key} must contain ${required ? "1" : "0"}–${max} characters.`);
    return value;
  };
  const number = (key: string, max: number, integer = false) => {
    const value = row[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max || (integer && !Number.isInteger(value))) throw new Error(`Enter a valid ${key} between 0 and ${max}.`);
    return integer ? value : Math.round(value * 100) / 100;
  };
  const imageUrl = string("imageUrl", 2048);
  if (imageUrl && !imageUrl.startsWith("/api/assets/") && !/^https:\/\/[^\s]+$/i.test(imageUrl)) throw new Error("Use a secure HTTPS image URL or upload an image.");
  if (!ITEM_STATUSES.includes(row.status as ItemDraft["status"])) throw new Error("Choose a valid status.");
  return {
    name: string("name", 160, true), supplier: string("supplier", 160, true),
    category: string("category", 80, true), spaceId: string("spaceId", 100, true),
    description: string("description", 5000), notes: string("notes", 5000),
    quantity: number("quantity", 100000), unitPrice: number("unitPrice", 10000000),
    leadTimeWeeks: number("leadTimeWeeks", 520, true), status: row.status as ItemDraft["status"], imageUrl,
  };
}

export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
export const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export function validateUpload(file: Pick<File, "size" | "type" | "name">) {
  if (!UPLOAD_TYPES.includes(file.type)) throw new Error("Choose a JPG, PNG, WebP, or PDF file.");
  if (!file.size || file.size > MAX_UPLOAD_SIZE) throw new Error("Choose a file smaller than 10 MB.");
  if (!file.name || file.name.length > 200) throw new Error("Use a file name shorter than 200 characters.");
}
