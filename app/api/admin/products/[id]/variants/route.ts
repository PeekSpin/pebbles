import { NextResponse } from "next/server";

import { findProduct, ProductVariantInput, updateProductVariants } from "../../../../../../server/repositories/product.repository";
import { requireVendor } from "../../../../../../server/services/vendor.service";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  await requireVendor();
  if (!await findProduct(params.id)) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  const body = await request.json() as { variants?: ProductVariantInput[] };
  const variants = body.variants;
  if (!Array.isArray(variants) || variants.some((variant) => !variant.size || !variant.sku || !Number.isInteger(variant.stockQuantity) || variant.stockQuantity < 0) || new Set(variants.map((variant) => variant.size)).size !== variants.length) {
    return NextResponse.json({ error: "Invalid product variants" }, { status: 400 });
  }
  return NextResponse.json(await updateProductVariants(params.id, variants));
}
