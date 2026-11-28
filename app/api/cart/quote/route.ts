import { NextResponse } from "next/server";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "../../../../server/db";
import {
  products,
  productColors,
  productVariants as v,
} from "../../../../server/db/schema";
import { availableStock } from "../../../../server/repositories/inventory";
import { checkoutLines } from "../../../../server/validators/checkout";
import { InputError } from "../../../../server/validators/catalog";
export async function POST(request: Request) {
  try {
    const lines = checkoutLines((await request.json()).items);
    const rows = await getDb()
      .select({
        variantId: v.id,
        productId: products.id,
        name: products.name,
        colorName: productColors.name,
        size: v.size,
        sku: v.sku,
        price: sql<string>`coalesce(${v.priceOverride},${products.price})`,
        available: availableStock,
      })
      .from(v)
      .innerJoin(products, eq(v.productId, products.id))
      .innerJoin(productColors, eq(v.productColorId, productColors.id))
      .where(
        and(
          inArray(
            v.id,
            lines.map((l) => l.variantId),
          ),
          isNull(v.deletedAt),
          isNull(products.deletedAt),
          isNull(productColors.deletedAt),
        ),
      );
    return NextResponse.json(
      rows
        .filter((r) =>
          lines.some(
            (l) => l.productId === r.productId && l.variantId === r.variantId,
          ),
        )
        .map((row) => ({ ...row, price: Number(row.price) })),
    );
  } catch (e) {
    if (e instanceof InputError || e instanceof SyntaxError)
      return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
