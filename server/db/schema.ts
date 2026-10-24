import { sql } from "drizzle-orm";
import {
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
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    ...timestamps
  }
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    size: varchar("size", { length: 10 }).notNull(),
    sku: varchar("sku", { length: 100 }).notNull(),
    stockQuantity: integer("stock_quantity").notNull().default(0)
  },
  (table) => ({
    productSizeUnique: unique().on(table.productId, table.size),
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
    imageUrl: text("image_url").notNull(),
    altText: text("alt_text"),
    sortOrder: integer("sort_order").notNull().default(0)
  },
  (table) => ({
    productIdIndex: index("product_images_product_id_idx").on(table.productId),
    productSortOrderUnique: unique().on(table.productId, table.sortOrder)
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
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    shippingAmount: numeric("shipping_amount", { precision: 12, scale: 2 }).notNull(),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
    ...timestamps
  },
  (table) => ({
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
    productName: varchar("product_name", { length: 255 }).notNull(),
    sku: varchar("sku", { length: 100 }).notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull()
  },
  (table) => ({
    orderIdIndex: index("order_items_order_id_idx").on(table.orderId),
    productIdIndex: index("order_items_product_id_idx").on(table.productId),
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
