import "server-only";

import { and, asc, count, getTableColumns, desc, eq, gte, inArray, isNull, lte, sql, sum } from "drizzle-orm";
import { unstable_noStore as noStore } from "next/cache";

import { availableStock } from "./inventory";
import { getDb } from "../db";
import { orderAddresses, orderItems, orders, paymentReviews, productColors, productImages, products, productVariants, users } from "../db/schema";
import { getProductImageUrl } from "../storage";
import { countProductCategories, normalizeProductCategory, productCategoryFilterValues } from "../../app/lib/product-categories";

async function previewImageUrl(image: typeof productImages.$inferSelect) {
  try {
    return await getProductImageUrl(image.imageUrl);
  } catch {
    console.error("Unable to sign product image", image.id);
    return null;
  }
}

async function catalogDetails(productId: string, storefront: boolean) {
  const [colors, variants, images] = await Promise.all([
    getDb().select().from(productColors).where(and(eq(productColors.productId, productId), isNull(productColors.deletedAt)))
      .orderBy(desc(productColors.isDefault), asc(productColors.sortOrder)),
    getDb().select({ ...getTableColumns(productVariants), ...(storefront ? { stockQuantity: availableStock } : {}) })
      .from(productVariants).where(and(eq(productVariants.productId, productId), isNull(productVariants.deletedAt))).orderBy(asc(productVariants.size)),
    getDb().select().from(productImages).where(and(eq(productImages.productId, productId), isNull(productImages.deletedAt))).orderBy(asc(productImages.sortOrder))
  ]);
  const gallery = await Promise.all(images.map(async image => {
    if (!storefront) return image;
    const imageUrl = await previewImageUrl(image);
    return imageUrl ? { ...image, imageUrl } : null;
  }));
  return colors.map(color => ({
    ...color,
    variants: variants.filter(v => v.productColorId === color.id),
    images: gallery.filter((i): i is typeof images[number] => i !== null && i.productColorId === color.id)
  }));
}

async function withImageUrls(product: typeof products.$inferSelect) {
  const colors = await catalogDetails(product.id, true);
  const primary = colors[0];
  return { ...product, category: normalizeProductCategory(product.category) || "Uncategorized",
    price: Number(product.price), image: primary?.images[0]?.imageUrl ?? "",
    images: primary?.images ?? [], variants: primary?.variants ?? [], colors };
}

export type StoreProduct = Awaited<ReturnType<typeof withImageUrls>>;

export async function listStoreProducts(options: { category?: string; color?: string; size?: string; query?: string; page?: number; pageSize?: number } = {}) {
  noStore();
  const pageSize = options.pageSize ?? 9;
  const page = Math.max(1, options.page ?? 1);
  const filters = [isNull(products.deletedAt)];
  const category = options.category?.trim().toLowerCase();
  if (category) filters.push(inArray(sql`lower(trim(${products.category}))`, productCategoryFilterValues(category)));
  const color = options.color?.trim().toLowerCase();
  const size = options.size?.trim().toLowerCase();
  if (color || size) filters.push(sql`exists (select 1 from ${productColors}
    where ${productColors.productId} = ${products.id} and ${productColors.deletedAt} is null
      ${color ? sql`and lower(trim(${productColors.name})) = ${color}` : sql``}
      ${size ? sql`and exists (select 1 from ${productVariants}
        where ${productVariants.productColorId} = ${productColors.id} and ${productVariants.deletedAt} is null
        and lower(trim(${productVariants.size})) = ${size} and ${availableStock} > 0)` : sql``})`);
  if (options.query) filters.push(sql`lower(${products.name}) like ${`%${options.query.toLowerCase()}%`}`);
  const where = filters.length ? and(...filters) : undefined;
  const [rows, [{ total }]] = await Promise.all([
    getDb().select().from(products).where(where).orderBy(desc(products.createdAt), desc(products.updatedAt), desc(products.id)).limit(pageSize).offset((page - 1) * pageSize),
    getDb().select({ total: count() }).from(products).where(where)
  ]);
  return {
    products: await Promise.all(rows.map(withImageUrls)),
    total: Number(total),
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(Number(total) / pageSize))
  };
}

export async function listProductColors() {
  return getDb().select({ name: productColors.name, hex: productColors.hex }).from(productColors)
    .innerJoin(products, eq(productColors.productId, products.id))
    .where(and(isNull(products.deletedAt), isNull(productColors.deletedAt)))
    .groupBy(productColors.name, productColors.hex).orderBy(asc(productColors.name));
}

export async function findStoreProduct(id: string) {
  noStore();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return null;
  const [product] = await getDb().select().from(products).where(and(eq(products.id, id), isNull(products.deletedAt))).limit(1);
  return product ? withImageUrls(product) : null;
}

export async function listProducts(options: { page?: number; pageSize?: number; query?: string } = {}) {
  noStore();
  const pageSize = options.pageSize ?? 10;
  const page = Math.max(1, options.page ?? 1);
  const query = options.query?.trim().toLowerCase();
  const where = and(
    isNull(products.deletedAt),
    query
      ? sql`(
          lower(${products.name}) like ${`%${query}%`}
          or lower(${products.sku}) like ${`%${query}%`}
          or exists (
            select 1
            from ${productVariants}
            where ${productVariants.productId} = ${products.id}
              and ${productVariants.deletedAt} is null and lower(${productVariants.sku}) like ${`%${query}%`}
          )
        )`
      : undefined
  );
  const [productRows, [{ total }]] = await Promise.all([
    getDb().select().from(products).where(where).orderBy(desc(products.createdAt), desc(products.updatedAt), desc(products.id)).limit(pageSize).offset((page - 1) * pageSize),
    getDb().select({ total: count() }).from(products).where(where)
  ]);
  return {
    products: await Promise.all(productRows.map(async (product) => {
      const colors = await catalogDetails(product.id, false);
      const image = colors[0]?.images[0];
      return { ...product, category: normalizeProductCategory(product.category) || null, colors,
        variants: colors.flatMap(c => c.variants.map(v => ({ ...v, colorName: c.name }))),
        primaryImageUrl: image ? await previewImageUrl(image) : null };
    })),
    total: Number(total),
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(Number(total) / pageSize))
  };
}

export async function listProductCategories() {
  const rows = await getDb()
    .select({ category: products.category })
    .from(products)
    .where(and(isNull(products.deletedAt), sql`${products.category} is not null and trim(${products.category}) <> ''`));
  return countProductCategories(rows.map((row) => row.category));
}

export async function findProduct(id: string) {
  const [product] = await getDb().select().from(products).where(and(eq(products.id, id), isNull(products.deletedAt))).limit(1);
  if (!product) return null;
  const colors = await catalogDetails(id, false);
  return { ...product, category: normalizeProductCategory(product.category) || null, colors,
    images: colors[0]?.images ?? [], variants: colors[0]?.variants ?? [] };
}

export async function findOrderForUser(orderId: string, userId: string) {
  const [order] = await getDb().select().from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, userId))).limit(1);
  return order ?? null;
}

export async function listUserOrders(userId: string, options: { page?: number; pageSize?: number } = {}) {
  const pageSize = options.pageSize ?? 10;
  const requestedPage = Math.max(1, options.page ?? 1);
  const [{ total }] = await getDb().select({ total: count() }).from(orders).where(eq(orders.userId, userId));
  const totalPages = Math.max(1, Math.ceil(Number(total) / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const rows = await getDb()
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return {
    orders: await Promise.all(rows.map(async (order) => ({
    ...order,
    items: await getDb().select().from(orderItems).where(eq(orderItems.orderId, order.id))
    }))),
    total: Number(total),
    page,
    pageSize,
    totalPages
  };
}

export async function findUserOrder(orderId: string, userId: string) {
  const order = await findOrderForUser(orderId, userId);
  if (!order) return null;
  const [items] = await Promise.all([
    getDb().select().from(orderItems).where(eq(orderItems.orderId, order.id))
  ]);
  const [address] = await getDb().select().from(orderAddresses).where(eq(orderAddresses.orderId, order.id)).limit(1);
  const reviews = await getDb().select({ reason: paymentReviews.reason }).from(paymentReviews).where(eq(paymentReviews.orderId, order.id));
  return { ...order, items, reviews, address: address ?? null };
}

export async function listAllOrders() {
  const rows = await getDb().select().from(orders).orderBy(desc(orders.createdAt));
  return Promise.all(rows.map(async (order) => ({
    ...order,
    items: await getDb().select().from(orderItems).where(eq(orderItems.orderId, order.id))
  })));
}

export type AdminOrderStatus = "confirmed" | "shipped" | "delivered" | "pending_payment" | "cancelled";

export async function listAdminOrders(filters: { status?: AdminOrderStatus; from?: string; to?: string; page?: number; pageSize?: number } = {}) {
  const pageSize = filters.pageSize ?? 10;
  const page = Math.max(1, filters.page ?? 1);
  const conditions = [];
  if (filters.status) conditions.push(eq(orders.status, filters.status));
  if (filters.from) conditions.push(gte(orders.createdAt, new Date(`${filters.from}T00:00:00.000Z`)));
  if (filters.to) conditions.push(lte(orders.createdAt, new Date(`${filters.to}T23:59:59.999Z`)));
  const where = conditions.length ? and(...conditions) : undefined;
  const [rows, [{ total }]] = await Promise.all([
    getDb().select().from(orders).where(where).orderBy(desc(orders.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
    getDb().select({ total: count() }).from(orders).where(where)
  ]);
  return {
    orders: await Promise.all(rows.map(async (order) => ({
    ...order,
    items: await getDb().select().from(orderItems).where(eq(orderItems.orderId, order.id))
    }))),
    total: Number(total),
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(Number(total) / pageSize))
  };
}

export async function findAdminOrder(orderId: string) {
  const [order] = await getDb().select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return null;
  const [items, address, user] = await Promise.all([
    getDb().select().from(orderItems).where(eq(orderItems.orderId, order.id)),
    getDb().select().from(orderAddresses).where(eq(orderAddresses.orderId, order.id)).limit(1),
    getDb().select({ name: users.name, email: users.email }).from(users).where(eq(users.id, order.userId)).limit(1)
  ]);
  const reviews = await getDb().select().from(paymentReviews).where(eq(paymentReviews.orderId, order.id));
  return { ...order, items, reviews, address: address[0] ?? null, customer: user[0] ?? null };
}

export async function getAdminDashboard() {
  const [sales, orderCount, productCount, customerCount, lowStockCount] = await Promise.all([
    getDb().select({ total: sum(orders.totalAmount) }).from(orders).where(inArray(orders.status, ["confirmed", "shipped", "delivered"])),
    getDb().select({ total: count() }).from(orders),
    getDb().select({ total: count() }).from(products).where(isNull(products.deletedAt)),
    getDb().select({ total: count() }).from(users).where(and(eq(users.role, "customer"), isNull(users.deletedAt))),
    getDb().select({ total: count() }).from(productVariants).innerJoin(products, eq(products.id, productVariants.productId)).where(and(isNull(products.deletedAt), isNull(productVariants.deletedAt), sql`${availableStock} <= 5`))
  ]);
  const recentOrders = await listAdminOrders({ page: 1, pageSize: 5 });
  const topProducts = await getDb()
    .select({ name: orderItems.productName, sold: sum(orderItems.quantity) })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(inArray(orders.status, ["confirmed", "shipped", "delivered"]))
    .groupBy(orderItems.productName)
    .orderBy(desc(sum(orderItems.quantity)))
    .limit(3);
  return {
    totalSales: Number(sales[0]?.total ?? 0),
    orderCount: Number(orderCount[0]?.total ?? 0),
    productCount: Number(productCount[0]?.total ?? 0),
    customerCount: Number(customerCount[0]?.total ?? 0),
    lowStockCount: Number(lowStockCount[0]?.total ?? 0),
    recentOrders: recentOrders.orders,
    topProducts: topProducts.map((product) => ({ name: product.name, sold: Number(product.sold ?? 0) }))
  };
}
