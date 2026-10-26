import "server-only";

import { and, asc, count, desc, eq, gte, inArray, isNull, lte, sql, sum } from "drizzle-orm";

import { db } from "../db";
import { orderAddresses, orderItems, orders, payments, productImages, products, productVariants, users } from "../db/schema";
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

export async function listProducts(options: { page?: number; pageSize?: number } = {}) {
  const pageSize = options.pageSize ?? 10;
  const page = Math.max(1, options.page ?? 1);
  const [productRows, [{ total }]] = await Promise.all([
    db.select().from(products).orderBy(desc(products.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ total: count() }).from(products)
  ]);
  return {
    products: await Promise.all(productRows.map(async (product) => {
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
    })),
    total: Number(total),
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(Number(total) / pageSize))
  };
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

export async function createPendingOrder(input: {
  userId: string;
  productId: string;
  productName: string;
  variantId: string;
  size: string;
  sku: string;
  quantity: number;
  unitPrice: string;
  shippingAmount: string;
  address: { recipientName: string; phone: string; addressLine1: string; city: string; pincode: string };
}) {
  const subtotal = (Number(input.unitPrice) * input.quantity).toFixed(2);
  const totalAmount = (Number(subtotal) + Number(input.shippingAmount)).toFixed(2);
  const [order] = await db.insert(orders).values({
    userId: input.userId,
    subtotal,
    shippingAmount: input.shippingAmount,
    totalAmount
  }).returning();
  await db.insert(orderItems).values({
    orderId: order.id,
    productId: input.productId,
    productName: input.productName,
    size: input.size,
    sku: input.sku,
    quantity: input.quantity,
    unitPrice: input.unitPrice
  });
  await db.insert(orderAddresses).values({
    orderId: order.id,
    recipientName: input.address.recipientName,
    phone: input.address.phone,
    addressLine1: input.address.addressLine1,
    city: input.address.city,
    pincode: input.address.pincode
  });
  return order;
}

export async function findOrderForUser(orderId: string, userId: string) {
  const [order] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, userId))).limit(1);
  return order ?? null;
}

export async function confirmOrderPayment(input: {
  orderId: string;
  paymentId: string;
  amount: string;
}) {
  const [existingOrder] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
  if (!existingOrder) throw new Error("Order not found");
  if (existingOrder.status === "confirmed") return { payment: null, order: existingOrder };
  const [existingPayment] = await db.select().from(payments).where(eq(payments.orderId, input.orderId)).limit(1);
  if (existingPayment) {
    const [confirmedOrder] = await db.update(orders)
      .set({ status: "confirmed", updatedAt: new Date() })
      .where(eq(orders.id, input.orderId))
      .returning();
    return { payment: existingPayment, order: confirmedOrder };
  }

  const [item] = await db.select().from(orderItems).where(eq(orderItems.orderId, input.orderId)).limit(1);
  if (!item) throw new Error("Order items not found");
  const [updatedVariant] = await db.update(productVariants)
    .set({ stockQuantity: sql`${productVariants.stockQuantity} - ${item.quantity}` })
    .where(and(
      eq(productVariants.productId, item.productId),
      eq(productVariants.sku, item.sku),
      sql`${productVariants.stockQuantity} >= ${item.quantity}`
    ))
    .returning();
  if (!updatedVariant) throw new Error("Insufficient stock for selected size");

  const [payment] = await db.insert(payments).values({
    orderId: input.orderId,
    provider: "razorpay",
    providerPaymentId: input.paymentId,
    amount: input.amount,
    status: "succeeded"
  }).returning();
  const [order] = await db.update(orders)
    .set({ status: "confirmed", updatedAt: new Date() })
    .where(eq(orders.id, input.orderId))
    .returning();
  return { payment, order };
}

export async function listUserOrders(userId: string, options: { page?: number; pageSize?: number } = {}) {
  const pageSize = options.pageSize ?? 10;
  const page = Math.max(1, options.page ?? 1);
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ total: count() }).from(orders).where(eq(orders.userId, userId))
  ]);
  return {
    orders: await Promise.all(rows.map(async (order) => ({
    ...order,
    items: await db.select().from(orderItems).where(eq(orderItems.orderId, order.id))
    }))),
    total: Number(total),
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(Number(total) / pageSize))
  };
}

export async function findUserOrder(orderId: string, userId: string) {
  const order = await findOrderForUser(orderId, userId);
  if (!order) return null;
  const [items] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id))
  ]);
  const [address] = await db.select().from(orderAddresses).where(eq(orderAddresses.orderId, order.id)).limit(1);
  return { ...order, items, address: address ?? null };
}

export async function hasOrderItemsInStock(orderId: string) {
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  if (!items.length) return false;
  const availability = await Promise.all(items.map(async (item) => {
    const [variant] = await db
      .select({ stockQuantity: productVariants.stockQuantity })
      .from(productVariants)
      .where(and(
        eq(productVariants.productId, item.productId),
        eq(productVariants.sku, item.sku)
      ))
      .limit(1);
    return variant !== undefined && variant.stockQuantity >= item.quantity;
  }));
  return availability.every(Boolean);
}

export async function listAllOrders() {
  const rows = await db.select().from(orders).orderBy(desc(orders.createdAt));
  return Promise.all(rows.map(async (order) => ({
    ...order,
    items: await db.select().from(orderItems).where(eq(orderItems.orderId, order.id))
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
    db.select().from(orders).where(where).orderBy(desc(orders.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ total: count() }).from(orders).where(where)
  ]);
  return {
    orders: await Promise.all(rows.map(async (order) => ({
    ...order,
    items: await db.select().from(orderItems).where(eq(orderItems.orderId, order.id))
    }))),
    total: Number(total),
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(Number(total) / pageSize))
  };
}

export async function findAdminOrder(orderId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return null;
  const [items, address, user] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
    db.select().from(orderAddresses).where(eq(orderAddresses.orderId, order.id)).limit(1),
    db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, order.userId)).limit(1)
  ]);
  return { ...order, items, address: address[0] ?? null, customer: user[0] ?? null };
}

export async function updateOrderStatus(orderId: string, status: AdminOrderStatus) {
  const [order] = await db.update(orders)
    .set({ status, updatedAt: new Date() })
    .where(eq(orders.id, orderId))
    .returning();
  return order ?? null;
}

export async function getAdminDashboard() {
  const [sales, orderCount, productCount, customerCount, lowStockCount] = await Promise.all([
    db.select({ total: sum(orders.totalAmount) }).from(orders).where(inArray(orders.status, ["confirmed", "shipped", "delivered"])),
    db.select({ total: count() }).from(orders),
    db.select({ total: count() }).from(products),
    db.select({ total: count() }).from(users).where(and(eq(users.role, "customer"), isNull(users.deletedAt))),
    db.select({ total: count() }).from(productVariants).where(sql`${productVariants.stockQuantity} <= 5`)
  ]);
  const recentOrders = await listAdminOrders({ page: 1, pageSize: 5 });
  const topProducts = await db
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
