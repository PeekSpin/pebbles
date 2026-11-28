import { sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  uniqueIndex,
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["vendor", "customer"]);
export const orderStatus = pgEnum("order_status", [
  "confirmed",
  "shipped",
  "delivered",
  "pending_payment",
  "cancelled"
]);
export const paymentStatus = pgEnum("payment_status", ["failed", "succeeded"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
};

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).unique(),
  role: userRole("role").default("customer").notNull(),
  externalUserId: varchar("external_user_id", { length: 255 }).notNull().unique(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...timestamps
});

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sku: varchar("sku", { length: 100 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description").notNull(),
    category: varchar("category", { length: 100 }),
    colorName: varchar("color_name", { length: 100 }),
    colorHex: varchar("color_hex", { length: 7 }),
    isPreorder: boolean("is_preorder").default(false).notNull(),
    revision: integer("revision").default(0).notNull(),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps
  }
);

export const productColors = pgTable("product_colors", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").notNull().references(() => products.id),
  code: varchar("code", { length: 100 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  hex: varchar("hex", { length: 7 }),
  sortOrder: integer("sort_order").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...timestamps
}, (t) => [
  unique("colors_product_id_id").on(t.productId, t.id),
  uniqueIndex("colors_code").on(t.productId, sql`lower(btrim(${t.code}))`),
  uniqueIndex("colors_default").on(t.productId).where(sql`${t.isDefault} and ${t.deletedAt} is null`),
  check("colors_valid", sql`btrim(${t.code}) <> '' and btrim(${t.name}) <> '' and (${t.hex} is null or ${t.hex} ~ '^#[0-9A-Fa-f]{6}$')`)
]);

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    productColorId: uuid("product_color_id").notNull(),
    priceOverride: numeric("price_override", { precision: 12, scale: 2 }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    size: varchar("size", { length: 10 }).notNull(),
    sku: varchar("sku", { length: 200 }).notNull(),
    stockQuantity: integer("stock_quantity").notNull().default(0)
  },
  (table) => ({
    colorOwner: foreignKey({name: "variants_color_owner", columns: [table.productId, table.productColorId], foreignColumns: [productColors.productId, productColors.id]}),
    variantOwner: unique("variants_product_id_id").on(table.productId, table.id),
    variantSku: uniqueIndex("variants_sku").on(sql`lower(btrim(${table.sku}))`),
    colorSize: uniqueIndex("variants_color_size").on(table.productColorId, sql`lower(btrim(${table.size}))`).where(sql`${table.deletedAt} is null`),
    valid: check("variants_valid", sql`btrim(${table.size}) <> '' and btrim(${table.sku}) <> '' and ${table.priceOverride} >= 0`),
    stockQuantityNonnegative: check("product_variants_stock_quantity_nonnegative", sql`${table.stockQuantity} >= 0`),
    productIdIndex: index("product_variants_product_id_idx").on(table.productId)
  })
);

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    productColorId: uuid("product_color_id").notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    imageUrl: text("image_url").notNull(),
    altText: text("alt_text"),
    sortOrder: integer("sort_order").notNull().default(0)
  },
  (table) => ({
    productIdIndex: index("product_images_product_id_idx").on(table.productId),
    colorOwner: foreignKey({name: "images_color_owner", columns: [table.productId, table.productColorId], foreignColumns: [productColors.productId, productColors.id]}),
    galleryOrder: uniqueIndex("images_color_order").on(table.productColorId, table.sortOrder).where(sql`${table.deletedAt} is null`)
  })
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    status: orderStatus("status").default("pending_payment").notNull(),
    checkoutKey: uuid("checkout_key"),
    requestHash: varchar("request_hash", { length: 64 }),
    providerOrderId: varchar("provider_order_id", { length: 255 }).unique(),
    shippingCarrier: varchar("shipping_carrier", { length: 100 }),
    trackingNumber: varchar("tracking_number", { length: 255 }),
    trackingUrl: text("tracking_url"),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    shippingAmount: numeric("shipping_amount", { precision: 12, scale: 2 }).notNull(),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
    ...timestamps
  },
  (table) => ({
    checkoutUnique: unique("orders_checkout_key").on(table.userId, table.checkoutKey),
    userIdIndex: index("orders_user_id_idx").on(table.userId)
  })
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    variantId: uuid("variant_id"),
    colorName: varchar("color_name", { length: 100 }),
    colorHex: varchar("color_hex", { length: 7 }),
    productName: varchar("product_name", { length: 255 }).notNull(),
    sku: varchar("sku", { length: 200 }).notNull(),
    size: varchar("size", { length: 20 }).notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull()
  },
  (table) => ({
    orderIdIndex: index("order_items_order_id_idx").on(table.orderId),
    productIdIndex: index("order_items_product_id_idx").on(table.productId),
    variantOwner: foreignKey({name: "items_variant_owner", columns: [table.productId, table.variantId], foreignColumns: [productVariants.productId, productVariants.id]}),
    variantIndex: index("items_variant_idx").on(table.variantId),
    quantityPositive: check("order_items_quantity_positive", sql`${table.quantity} > 0`)
  })
);

export const orderAddresses = pgTable("order_addresses", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" })
    .unique(),
  recipientName: varchar("recipient_name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 30 }).notNull(),
  addressLine1: text("address_line1").notNull(),
  addressLine2: text("address_line2"),
  city: varchar("city", { length: 150 }).notNull(),
  pincode: varchar("pincode", { length: 20 }).notNull()
});

export const inventoryReservations = pgTable("inventory_reservations", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  variantId: uuid("variant_id").notNull().references(() => productVariants.id),
  quantity: integer("quantity").notNull(),
  status: varchar("status", { length: 16 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull()
}, (t) => [
  unique("reservations_order_variant").on(t.orderId, t.variantId),
  index("reservations_active").on(t.variantId, t.expiresAt).where(sql`${t.status} = 'reserved'`),
  check("reservations_valid", sql`${t.quantity} > 0 and ${t.status} in ('reserved','released','consumed')`)
]);

export const paymentReviews = pgTable("payment_reviews", {
  paymentId: varchar("payment_id", { length: 255 }).primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  providerOrderId: varchar("provider_order_id", { length: 255 }).notNull(),
  amount: numeric("amount", {precision: 12, scale: 2}).notNull(),
  reason: text("reason").notNull(),
  ...timestamps
}, t => [index("reviews_order").on(t.orderId)]);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 100 }).notNull(),
    providerPaymentId: varchar("provider_payment_id", { length: 255 }).notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    status: paymentStatus("status").notNull(),
    ...timestamps
  },
  (table) => ({
    orderIdIndex: index("payments_order_id_idx").on(table.orderId),
    providerPaymentUnique: unique().on(table.provider, table.providerPaymentId)
  })
);
