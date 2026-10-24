import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { createProduct, listProducts, ProductVariantInput } from "../../../../server/repositories/product.repository";
import { uploadProductImage } from "../../../../server/storage";
import { requireVendor } from "../../../../server/services/vendor.service";

function text(form: FormData, key: string) {
  const value = form.get(key);
  if (typeof value !== "string" || !value.trim()) throw new Error(`${key} is required`);
  return value.trim();
}

function productInput(form: FormData) {
  const price = text(form, "price");
  if (!/^\d+(\.\d{1,2})?$/.test(price)) {
    throw new Error("Invalid price");
  }
  return {
    sku: text(form, "sku"),
    name: text(form, "name"),
    description: text(form, "description"),
    category: text(form, "category"),
    price
  };
}

function variantsInput(form: FormData): ProductVariantInput[] {
  const raw = String(form.get("variants") ?? "[]");
  const variants = JSON.parse(raw) as unknown;
  if (!Array.isArray(variants)) throw new Error("Invalid product variants");
  const result = variants.map((variant) => {
    if (!variant || typeof variant !== "object") throw new Error("Invalid product variants");
    const value = variant as Record<string, unknown>;
    const size = typeof value.size === "string" ? value.size.trim() : "";
    const sku = typeof value.sku === "string" ? value.sku.trim() : "";
    const stockQuantity = value.stockQuantity;
    if (!size || !sku || !Number.isInteger(stockQuantity) || Number(stockQuantity) < 0) throw new Error("Invalid product variants");
    return { size, sku, stockQuantity: Number(stockQuantity) };
  });
  if (new Set(result.map((variant) => variant.size)).size !== result.length) throw new Error("Each size can only be added once");
  return result;
}

async function uploadImages(form: FormData, productId: string) {
  const files = form.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);
  const images = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) throw new Error("Images must be image files smaller than 5MB");
    const key = `${productId}/${index}-${randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    await uploadProductImage(key, Buffer.from(await file.arrayBuffer()), file.type);
    images.push({ imageUrl: key, altText: file.name, sortOrder: index });
  }
  return images;
}

export async function GET(request: Request) {
  try {
    await requireVendor();
    const page = Math.max(1, Number(new URL(request.url).searchParams.get("page")) || 1);
    return NextResponse.json(await listProducts({ page }));
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error instanceof Error && error.message === "Vendor access required") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    await requireVendor();
    const form = await request.formData();
    const input = productInput(form);
    const variants = variantsInput(form);
    const temporaryId = randomUUID();
    const images = await uploadImages(form, temporaryId);
    return NextResponse.json(await createProduct(input, images, variants), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error instanceof Error && error.message === "Vendor access required") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error instanceof Error && error.message.startsWith("Neon Object Storage")) {
      console.error(error.message);
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error("Unable to create product.", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create product" }, { status: 400 });
  }
}
