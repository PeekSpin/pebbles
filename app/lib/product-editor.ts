import { initializeProductVariants } from "./product-variants";

export type VariantDraft = {
  id?: string;
  size: string;
  sku: string;
  stockQuantity: number;
  originalStock?: number;
  priceOverride?: string | null;
};
type SavedImage = { id: string; imageUrl: string; altText: string | null };
type SavedColor = {
  id: string; code: string; name: string; hex: string | null;
  images: SavedImage[]; variants: VariantDraft[];
};
export type BaseFields = { name: string; sku: string; price: string; category: string; description: string };
export type EditableProduct = Omit<BaseFields, "category"> & {
  id: string; revision: number; category: string | null; isPreorder: boolean; colors: SavedColor[];
};
export type GalleryItem =
  | { key: string; saved: SavedImage; file?: never }
  | { key: string; file: File; saved?: never };
export type EditorColor = {
  key: string; id?: string; code: string; name: string; hex: string;
  active: boolean; gallery: GalleryItem[]; variants: VariantDraft[];
};

export function editorColor(key: string, saved?: SavedColor): EditorColor {
  return {
    key, id: saved?.id, code: saved?.code ?? "", name: saved?.name ?? "",
    hex: saved?.hex ?? "", active: true,
    gallery: saved?.images.map(image => ({ key: image.id, saved: image })) ?? [],
    variants: saved?.variants.map(v => ({ ...v, originalStock: v.stockQuantity })) ?? [],
  };
}

export function sizeRows(color: EditorColor, saree: boolean): VariantDraft[] {
  if (saree && color.variants.length === 1) return [{ ...color.variants[0], size: "One Size" }];
  if (saree && color.variants.length > 1) return color.variants;
  if (saree) return initializeProductVariants([], true);
  const rows = initializeProductVariants(color.variants).map(v => color.variants.find(row => row.size === v.size) ?? v);
  return [...rows, ...color.variants.filter(v => !rows.some(row => row.size === v.size))];
}

export function sizeFieldId(key: string, size: string) {
  return key + "-size-" + encodeURIComponent(size);
}

export function saleVariants(color: EditorColor, fields: BaseFields) {
  const saree = fields.category === "Sarees";
  const code = color.code || color.name.trim();
  return sizeRows(color, saree)
    .filter(v => v.id || v.sku.trim() || v.stockQuantity || v.priceOverride || saree)
    .map(v => ({ ...v, sku: v.sku.trim() || [fields.sku.trim(), code, v.size === "One Size" ? "ONE" : v.size].join("-") }));
}

const pricePattern = /^\d{1,10}(\.\d{1,2})?$/;
export const hexPattern = /^#[0-9a-f]{6}$/i;

export function editorErrors(fields: BaseFields, colors: EditorColor[]) {
  const errors: Record<string, string> = {};
  if (!fields.name.trim()) errors.name = "Enter a product name.";
  if (!fields.sku.trim()) errors.sku = "Enter a product SKU.";
  if (!pricePattern.test(fields.price.trim())) errors.price = "Enter a price of ₹0 or more with up to two decimal places.";
  if (!fields.category) errors.category = "Choose a category.";
  if (!fields.description.trim()) errors.description = "Add a description.";
  const codes = new Set<string>();
  const skus = new Set<string>();
  for (const c of colors.filter(c => c.active)) {
    const code = (c.code || c.name).trim().toLowerCase();
    if (!c.name.trim()) errors[c.key+"-name"] = "Enter a colour name or choose a palette colour.";
    else if (codes.has(code)) errors[c.key+"-name"] = "This colour code is already in use.";
    codes.add(code);
    if (c.hex && !hexPattern.test(c.hex)) errors[c.key+"-hex"] = "Enter a six-digit HEX value, such as #A7B694.";
    const variants = saleVariants(c, fields);
    if (fields.category === "Sarees" && variants.length !== 1) errors[c.key+"-sizes"] = "Keep one size row for this saree colour.";
    for (const v of variants) {
      const id = sizeFieldId(c.key, v.size);
      if (!Number.isInteger(v.stockQuantity) || v.stockQuantity < 0 || v.stockQuantity > 2147483647)
        errors[id+"-stock"] = "Enter a whole quantity of zero or more.";
      if (v.priceOverride && !pricePattern.test(v.priceOverride)) errors[id+"-price"] = "Use a positive price or zero, with up to two decimal places.";
      if (skus.has(v.sku.toLowerCase()) || v.sku.length > 200) errors[id+"-sku"] = "Choose a unique SKU of up to 200 characters.";
      skus.add(v.sku.toLowerCase());
    }
  }
  return errors;
}

export function productRequest(fields: BaseFields, colors: EditorColor[], revision: number | undefined, isPreorder: boolean) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value.trim());
  form.set("isPreorder", String(isPreorder));
  const payload = colors.filter(c => c.active).map((color, index) => {
    const retained = color.gallery.flatMap(item => item.saved ? [{ id: item.saved.id }] : []);
    let savedIndex = 0;
    let fileIndex = retained.length;
    const imageOrder = color.gallery.map(item => {
      if (item.saved) return savedIndex++;
      form.append("images."+index, item.file);
      return fileIndex++;
    });
    return {
      id: color.id, code: color.code || color.name.trim(), name: color.name.trim(),
      hex: color.hex || null, variants: saleVariants(color, fields), images: retained, imageOrder,
    };
  });
  form.set("colors", JSON.stringify(payload));
  if (revision !== undefined) form.set("revision", String(revision));
  return form;
}
