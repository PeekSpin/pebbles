import { NextResponse } from "next/server";

import { deleteProduct, findProduct, updateProduct, ProductVariantInput } from "../../../../../server/repositories/product.repository";
import { deleteProductImage, uploadProductImage } from "../../../../../server/storage";
import { requireVendor } from "../../../../../server/services/vendor.service";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await requireVendor();
  const product = await findProduct(params.id);
  return product ? NextResponse.json(product) : NextResponse.json({ error: "Product not found" }, { status: 404 });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  await requireVendor();
  const form = await request.formData();
  const product = await findProduct(params.id);
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  const input = {
    sku: String(form.get("sku") ?? "").trim(),
    name: String(form.get("name") ?? "").trim(),
    description: String(form.get("description") ?? "").trim(),
    category: String(form.get("category") ?? "").trim(),
    price: String(form.get("price") ?? "").trim(),
  };
  if (!input.sku || !input.name || !input.description || !input.category || !/^\d+(\.\d{1,2})?$/.test(input.price)) {
    return NextResponse.json({ error: "Invalid product fields" }, { status: 400 });
  }
  let variants: ProductVariantInput[];
  try {
    const parsed = JSON.parse(String(form.get("variants") ?? "[]")) as unknown;
    if (!Array.isArray(parsed)) throw new Error();
    variants = parsed.map((variant) => {
      if (!variant || typeof variant !== "object") throw new Error();
      const value = variant as Record<string, unknown>;
      if (typeof value.size !== "string" || typeof value.sku !== "string" || !Number.isInteger(value.stockQuantity) || Number(value.stockQuantity) < 0) throw new Error();
      return { size: value.size.trim(), sku: value.sku.trim(), stockQuantity: Number(value.stockQuantity) };
    });
    if (variants.some((variant) => !variant.size || !variant.sku) || new Set(variants.map((variant) => variant.size)).size !== variants.length) throw new Error();
  } catch {
    return NextResponse.json({ error: "Invalid product variants" }, { status: 400 });
  }
  const files = form.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);
  const images = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Images must be image files smaller than 5MB" }, { status: 400 });
    const key = `${params.id}/${index}-${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    await uploadProductImage(key, Buffer.from(await file.arrayBuffer()), file.type);
    images.push({ imageUrl: key, altText: file.name, sortOrder: index });
  }
  if (!images.length) {
    images.push(...product.images.map(({ imageUrl, altText, sortOrder }) => ({ imageUrl, altText: altText ?? "", sortOrder })));
  } else {
    for (const image of product.images) await deleteProductImage(image.imageUrl);
  }
  return NextResponse.json(await updateProduct(params.id, input, images, variants));
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await requireVendor();
  const product = await findProduct(params.id);
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  for (const image of product.images) await deleteProductImage(image.imageUrl);
  await deleteProduct(params.id);
  return new Response(null, { status: 204 });
}
