import "server-only";

import { and, asc, count, desc, eq, sql } from "drizzle-orm";

import { db } from "../db";
import { productImages, products, productVariants } from "../db/schema";
import { getProductImageUrl } from "../storage";

export type ProductInput = {
  sku: string;
  name: string;
  description: string;
  category: string;
  price: string;
};

export type StoreProduct = {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  image: string;
  images: Array<{ imageUrl: string; altText: string | null; sortOrder: number }>;
  variants: Array<{ id: string; size: string; sku: string; stockQuantity: number }>;
};

async function withImageUrls(product: typeof products.$inferSelect): Promise<StoreProduct> {
  const images = await db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, product.id))
    .orderBy(asc(productImages.sortOrder));
  const imagesWithUrls = await Promise.all(images.map(async (image) => ({
    ...image,
    imageUrl: await getProductImageUrl(image.imageUrl)
  })));
  const variants = await db.select().from(productVariants).where(eq(productVariants.productId, product.id)).orderBy(asc(productVariants.size));
  return {
    id: product.id,
    name: product.name,
    category: product.category ?? "Uncategorized",
    price: Number(product.price),
    description: product.description,
    image: imagesWithUrls[0]?.imageUrl ?? "",
    images: imagesWithUrls,
    variants
  };
}

export async function listStoreProducts(options: { category?: string; query?: string; page?: number; pageSize?: number } = {}) {
  const pageSize = options.pageSize ?? 9;
  const page = Math.max(1, options.page ?? 1);
  const filters = [];
  const category = options.category?.trim().toLowerCase();
  if (category) filters.push(sql`lower(trim(${products.category})) = ${category}`);
  if (options.query) filters.push(sql`lower(${products.name}) like ${`%${options.query.toLowerCase()}%`}`);
  const where = filters.length ? and(...filters) : undefined;
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(products).where(where).orderBy(desc(products.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ total: count() }).from(products).where(where)
  ]);
  return {
    products: await Promise.all(rows.map(withImageUrls)),
    total: Number(total),
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(Number(total) / pageSize))
  };
}

export async function findStoreProduct(id: string) {
  const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return product ? withImageUrls(product) : null;
}

export async function listProducts() {
  const productRows = await db.select().from(products).orderBy(asc(products.createdAt));
  return Promise.all(productRows.map(async (product) => {
    const [image] = await db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, product.id))
      .orderBy(asc(productImages.sortOrder))
      .limit(1);
    return {
      ...product,
      variants: await db.select().from(productVariants).where(eq(productVariants.productId, product.id)).orderBy(asc(productVariants.size)),
      primaryImageUrl: image ? await getProductImageUrl(image.imageUrl) : null
    };
  }));
}

export async function listProductCategories() {
  const rows = await db
    .select({ category: products.category })
    .from(products)
    .where(sql`${products.category} is not null and trim(${products.category}) <> ''`);
  const categoryCounts = new Map<string, number>();
  for (const row of rows) {
    const category = row.category?.trim();
    if (!category) continue;
    const key = category.toLowerCase();
    categoryCounts.set(key, (categoryCounts.get(key) ?? 0) + 1);
  }
  return Array.from(categoryCounts.entries())
    .map(([category, productCount]) => ({
      name: category.replace(/\b\w/g, (letter) => letter.toUpperCase()),
      productCount
    }))
    .sort((first, second) => first.name.localeCompare(second.name));
}

export async function findProduct(id: string) {
  const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!product) return null;
  const images = await db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, id))
    .orderBy(asc(productImages.sortOrder));
  const variants = await db.select().from(productVariants).where(eq(productVariants.productId, id)).orderBy(asc(productVariants.size));
  return { ...product, images, variants };
}

export type ProductVariantInput = { size: string; sku: string; stockQuantity: number };

export async function createProduct(input: ProductInput, images: Array<{ imageUrl: string; altText: string; sortOrder: number }>, variants: ProductVariantInput[]) {
  const [product] = await db.insert(products).values(input).returning();
  if (images.length) {
    await db.insert(productImages).values(images.map((image) => ({ ...image, productId: product.id })));
  }
  if (variants.length) await db.insert(productVariants).values(variants.map((variant) => ({ ...variant, productId: product.id })));
  return product;
}

export async function updateProduct(id: string, input: ProductInput, images: Array<{ imageUrl: string; altText: string; sortOrder: number }>, variants: ProductVariantInput[]) {
  const [product] = await db.update(products).set({ ...input, updatedAt: new Date() }).where(eq(products.id, id)).returning();
  if (!product) return null;
  await db.delete(productImages).where(eq(productImages.productId, id));
  if (images.length) {
    await db.insert(productImages).values(images.map((image) => ({ ...image, productId: id })));
  }
  await db.delete(productVariants).where(eq(productVariants.productId, id));
  if (variants.length) await db.insert(productVariants).values(variants.map((variant) => ({ ...variant, productId: id })));
  return product;
}

export async function updateProductVariants(id: string, variants: ProductVariantInput[]) {
  await db.delete(productVariants).where(eq(productVariants.productId, id));
  if (variants.length) await db.insert(productVariants).values(variants.map((variant) => ({ ...variant, productId: id })));
  return db.select().from(productVariants).where(eq(productVariants.productId, id)).orderBy(asc(productVariants.size));
}

export async function deleteProduct(id: string) {
  const [product] = await db.delete(products).where(eq(products.id, id)).returning();
  return product ?? null;
}
