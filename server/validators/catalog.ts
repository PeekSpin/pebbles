import { normalizeProductCategory } from "../../app/lib/product-categories";

export class InputError extends Error {}
export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function field(value: unknown, label: string, max: number) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new InputError("Invalid " + label);
  return value.trim();
}
export function amount(value: unknown) {
  const text = field(value, "price", 13);
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(text))
    throw new InputError("Invalid price");
  return text;
}
export function optionalId(value: unknown) {
  if (value == null) return undefined;
  if (typeof value !== "string" || !uuidPattern.test(value))
    throw new InputError("Invalid ID");
  return value;
}
export function quantity(value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 2147483647
  )
    throw new InputError("Invalid stock quantity");
  return value;
}
export function distinct(values: string[], label: string) {
  if (new Set(values.map((v) => v.trim().toLowerCase())).size !== values.length)
    throw new InputError("Duplicate " + label);
}
export function parseVariants(raw: unknown) {
  if (!Array.isArray(raw))
    throw new InputError("Expected an array of variants");
  const variants = raw.map((v) => {
    if (!v || typeof v !== "object") throw new InputError("Invalid variant");
    return {
      id: optionalId(v.id),
      size: field(v.size, "size", 10),
      sku: field(v.sku, "variant SKU", 200),
      stockQuantity: quantity(v.stockQuantity),
      originalStock:
        v.originalStock == null ? undefined : quantity(v.originalStock),
      priceOverride:
        v.priceOverride == null || v.priceOverride === ""
          ? null
          : amount(v.priceOverride),
    };
  });
  distinct(
    variants.map((v) => v.size),
    "size",
  );
  distinct(
    variants.map((v) => v.sku),
    "variant SKU",
  );
  distinct(
    variants.flatMap((v) => (v.id ? [v.id] : [])),
    "variant ID",
  );
  return variants;
}
export function parseBase(form: FormData) {
  const isPreorder = form.get("isPreorder");
  if (isPreorder !== null && isPreorder !== "true" && isPreorder !== "false")
    throw new InputError("Invalid preorder option");
  return {
    sku: field(form.get("sku"), "product SKU", 100),
    name: field(form.get("name"), "product name", 255),
    description: field(form.get("description"), "description", 100000),
    category: normalizeProductCategory(
      field(form.get("category"), "category", 100),
    ),
    price: amount(form.get("price")),
    isPreorder: isPreorder === "true",
  };
}
export type BaseInput = ReturnType<typeof parseBase>;
export type VariantInput = ReturnType<typeof parseVariants>[number];
export type GalleryInput = {
  id?: string;
  imageUrl: string;
  altText: string | null;
};
export type ColorInput = {
  id?: string;
  code: string;
  name: string;
  hex: string | null;
  variants: VariantInput[];
  images: GalleryInput[];
};

// Multipart uploads arrive separately from retained image IDs.
export function orderGallery<T>(images: T[], order: unknown): T[] {
  if (order === undefined) return images;
  if (!Array.isArray(order) || order.length !== images.length ||
      !order.every(index => Number.isInteger(index) && index >= 0 && index < images.length) ||
      new Set(order).size !== images.length) {
    throw new InputError("Invalid gallery image order");
  }
  return order.map(index => images[index]);
}

export function validateColors(colors: ColorInput[], category: string) {
  if (!colors.length) throw new InputError("Add at least one colour");
  distinct(
    colors.map((c) => c.code),
    "colour code",
  );
  distinct(
    colors.flatMap((c) => (c.id ? [c.id] : [])),
    "colour ID",
  );
  distinct(
    colors.flatMap((c) => c.variants.map((v) => v.sku)),
    "variant SKU",
  );
  distinct(
    colors.flatMap((c) => c.variants.flatMap((v) => (v.id ? [v.id] : []))),
    "variant ID",
  );
  distinct(
    colors.flatMap((c) => c.images.flatMap((i) => (i.id ? [i.id] : []))),
    "image ID",
  );
  for (const c of colors) {
    if (c.hex && !/^#[0-9a-f]{6}$/i.test(c.hex))
      throw new InputError("Invalid colour hex code");
    if (
      category === "Sarees" &&
      (c.variants.length !== 1 || c.variants[0].size !== "One Size")
    )
      throw new InputError("Each saree colour needs one One Size variant");
  }
}
