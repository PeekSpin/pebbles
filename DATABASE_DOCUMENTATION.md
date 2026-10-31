# Pebbles Database Documentation

## 1. Purpose and scope

This document is the database-focused reference for the Pebbles storefront. It
describes the PostgreSQL data model, relationships, constraints, indexes,
application ownership rules, migration workflow, and common operational
queries.

The database is a Neon PostgreSQL database accessed from server-side Next.js
code through Drizzle ORM. The canonical schema is defined in
[`server/db/schema.ts`](./server/db/schema.ts), while the SQL files in
[`drizzle/`](./drizzle/) are the migration history.

The application must never expose the database connection string or allow the
browser to connect directly to PostgreSQL.

## 2. Database stack

| Concern | Implementation |
|---|---|
| Database engine | PostgreSQL on Neon |
| Connection driver | `@neondatabase/serverless` |
| ORM | Drizzle ORM |
| Migration tool | Drizzle Kit |
| Schema source | `server/db/schema.ts` |
| Migration directory | `drizzle/` |
| Environment variable | `Postgres_URL` |

The database client is initialized in
[`server/db/index.ts`](./server/db/index.ts). It is marked server-only and
throws an error during startup when `Postgres_URL` is missing.

## 3. Entity relationship overview

```text
users
  1 ────────< orders
                 1 ────────< order_items >──────── 1 products
                 1 ────────  order_addresses
                 1 ────────< payments

products
  1 ────────< product_variants
  1 ────────< product_images
```

An order belongs to one local user and can contain multiple order items. Each
order has at most one delivery-address snapshot and can have one or more
payment records. A product owns its size-level variants and product images.

## 4. Enumerations

### `user_role`

| Value | Meaning |
|---|---|
| `customer` | Standard storefront user |
| `vendor` | User authorized to access the admin dashboard |

New local profiles default to `customer`.

### `order_status`

| Value | Meaning |
|---|---|
| `pending_payment` | Order exists but payment has not been confirmed |
| `confirmed` | Payment was verified |
| `shipped` | Order has been dispatched |
| `delivered` | Order was delivered |
| `cancelled` | Order was cancelled |

### `payment_status`

| Value | Meaning |
|---|---|
| `succeeded` | Payment was verified successfully |
| `failed` | Payment attempt failed |

## 5. Tables

### 5.1 `users`

Stores the local profile associated with a Clerk identity.

| Column | Type | Rules | Purpose |
|---|---|---|---|
| `id` | `uuid` | Primary key, generated | Internal user identifier |
| `name` | `varchar(255)` | Nullable | Display name |
| `email` | `varchar(255)` | Nullable, unique | Profile email |
| `role` | `user_role` | Required, default `customer` | Authorization role |
| `external_user_id` | `varchar(255)` | Required, unique | Clerk user ID |
| `deleted_at` | `timestamptz` | Nullable | Soft-delete/anonymization marker |
| `created_at` | `timestamptz` | Required, default `now()` | Creation time |
| `updated_at` | `timestamptz` | Required, default `now()` | Last update time |

Clerk webhooks create and update this record. When a Clerk user is deleted,
the local record is retained so historical orders remain linked to a stable
user ID.

### 5.2 `products`

Stores catalog-level product information for kurtas, sarees, and tops.

| Column | Type | Rules | Purpose |
|---|---|---|---|
| `id` | `uuid` | Primary key, generated | Product identifier |
| `sku` | `varchar(100)` | Required, unique | Parent product SKU |
| `name` | `varchar(255)` | Required | Product name |
| `description` | `text` | Required | Product description |
| `category` | `varchar(100)` | Nullable | `kurta`, `saree`, or `top` convention |
| `price` | `numeric(12,2)` | Required | Base catalog price |
| `created_at` | `timestamptz` | Required, default `now()` | Creation time |
| `updated_at` | `timestamptz` | Required, default `now()` | Last update time |

The category is currently a free-form string. The application uses kurtas,
sarees, and tops as its supported product categories, but PostgreSQL does not
enforce those values.

### 5.3 `product_variants`

Stores the purchasable size and inventory record for a product.

| Column | Type | Rules | Purpose |
|---|---|---|---|
| `id` | `uuid` | Primary key, generated | Variant identifier |
| `product_id` | `uuid` | Required, foreign key to `products` | Parent product |
| `size` | `varchar(10)` | Required | Size selected at checkout |
| `sku` | `varchar(100)` | Required | Variant SKU |
| `stock_quantity` | `integer` | Required, default `0`, non-negative | Available stock |

`(product_id, size)` is unique, so one product cannot have duplicate sizes.
Deleting a product cascades to its variants.

### 5.4 `product_images`

Stores product-image metadata. `image_url` contains the object-storage key or
URL managed by the storage integration; image binaries are not stored in
PostgreSQL.

| Column | Type | Rules | Purpose |
|---|---|---|---|
| `id` | `uuid` | Primary key, generated | Image identifier |
| `product_id` | `uuid` | Required, foreign key to `products` | Parent product |
| `image_url` | `text` | Required | Storage reference |
| `alt_text` | `text` | Nullable | Accessibility text |
| `sort_order` | `integer` | Required, default `0` | Display order |

`(product_id, sort_order)` is unique. Deleting a product cascades to its image
records.

### 5.5 `orders`

Stores the customer order and its payment-independent lifecycle state.

| Column | Type | Rules | Purpose |
|---|---|---|---|
| `id` | `uuid` | Primary key, generated | Order identifier |
| `user_id` | `uuid` | Required, foreign key to `users` | Customer |
| `status` | `order_status` | Required, default `pending_payment` | Order state |
| `subtotal` | `numeric(12,2)` | Required | Product total |
| `shipping_amount` | `numeric(12,2)` | Required | Shipping charge |
| `total_amount` | `numeric(12,2)` | Required | Subtotal plus shipping |
| `created_at` | `timestamptz` | Required, default `now()` | Creation time |
| `updated_at` | `timestamptz` | Required, default `now()` | Last update time |

Orders reference users with `NO ACTION`, preventing accidental deletion of a
user who has order history.

### 5.6 `order_items`

Stores a purchase-time snapshot of catalog information. `product_name`, `sku`,
`size`, and `unit_price` are intentionally copied into the order item so
historical orders do not change when a product is edited.

| Column | Type | Rules | Purpose |
|---|---|---|---|
| `id` | `uuid` | Primary key, generated | Item identifier |
| `order_id` | `uuid` | Required, foreign key to `orders` | Parent order |
| `product_id` | `uuid` | Required, foreign key to `products` | Catalog reference |
| `product_name` | `varchar(255)` | Required | Purchased-name snapshot |
| `sku` | `varchar(100)` | Required | Purchased-SKU snapshot |
| `size` | `varchar(20)` | Required | Purchased-size snapshot |
| `quantity` | `integer` | Required, greater than `0` | Units purchased |
| `unit_price` | `numeric(12,2)` | Required | Price per unit at purchase |

Deleting an order cascades to its items. Products use `NO ACTION` so a
referenced product cannot be removed without first addressing its order
history.

### 5.7 `order_addresses`

Stores the delivery address snapshot submitted for an order.

| Column | Type | Rules | Purpose |
|---|---|---|---|
| `id` | `uuid` | Primary key, generated | Address identifier |
| `order_id` | `uuid` | Required, unique foreign key to `orders` | One address per order |
| `recipient_name` | `varchar(255)` | Required | Delivery recipient |
| `phone` | `varchar(30)` | Required | Contact number |
| `address_line1` | `text` | Required | Primary address |
| `address_line2` | `text` | Nullable | Additional address details |
| `city` | `varchar(150)` | Required | City |
| `pincode` | `varchar(20)` | Required | Postal code |

Deleting an order cascades to its address.

### 5.8 `payments`

Stores payment attempts and provider identifiers.

| Column | Type | Rules | Purpose |
|---|---|---|---|
| `id` | `uuid` | Primary key, generated | Payment identifier |
| `order_id` | `uuid` | Required, foreign key to `orders` | Related order |
| `provider` | `varchar(100)` | Required | Payment provider, currently Razorpay |
| `provider_payment_id` | `varchar(255)` | Required | Provider payment identifier |
| `amount` | `numeric(12,2)` | Required | Verified payment amount |
| `status` | `payment_status` | Required | Payment result |
| `created_at` | `timestamptz` | Required, default `now()` | Creation time |
| `updated_at` | `timestamptz` | Required, default `now()` | Last update time |

`(provider, provider_payment_id)` is unique to prevent the same provider
payment from being recorded more than once. Deleting an order cascades to its
payments.

## 6. Constraints and indexes

The schema protects important invariants at the database layer:

- Primary keys are UUIDs generated by PostgreSQL.
- User external IDs, user emails, and product SKUs are unique.
- Product size combinations are unique per product.
- Product image positions are unique per product.
- An order has at most one address.
- Payment provider IDs are unique per provider.
- Variant stock cannot be negative.
- Order-item quantity must be greater than zero.
- Product and order relationships use explicit foreign keys.

Indexes currently support the most common relationship lookups:

| Index | Columns | Use |
|---|---|---|
| `product_variants_product_id_idx` | `product_variants.product_id` | Load variants for a product |
| `product_images_product_id_idx` | `product_images.product_id` | Load images for a product |
| `orders_user_id_idx` | `orders.user_id` | Load a customer's orders |
| `order_items_order_id_idx` | `order_items.order_id` | Load items for an order |
| `order_items_product_id_idx` | `order_items.product_id` | Find order history for a product |
| `payments_order_id_idx` | `payments.order_id` | Load payments for an order |

Add indexes only after checking the query pattern and its effect on writes.

## 7. Data ownership and transaction rules

The server is authoritative for values that affect money or inventory:

1. Read the product and selected variant from PostgreSQL.
2. Verify that the requested stock is available.
3. Calculate the subtotal and total on the server.
4. Create the pending order and its snapshots.
5. Create the external Razorpay order.
6. Confirm the local order only after server-side payment verification.

The client must not be trusted for product prices, stock, user ownership,
payment amount, or order status. Database reads and writes should remain in
repositories or services rather than UI components.

## 8. Migration workflow

For every schema change:

1. Update [`server/db/schema.ts`](./server/db/schema.ts).
2. Generate a migration:

   ```bash
   npm run db:generate
   ```

3. Review the generated SQL in [`drizzle/`](./drizzle/).
4. Apply migrations to the configured database:

   ```bash
   npm run db:migrate
   ```

5. Validate the affected flow with the application build and targeted
   verification.

Never edit a migration that has already been applied to a shared or production
database. Create a new migration instead. Drizzle tracks applied migrations in
its migration metadata table.

### Migration history

| Migration | Change |
|---|---|
| `0000_spotty_jack_flag` | Initial tables, enums, foreign keys, and core constraints |
| `0001_groovy_the_initiative` | Added relationship indexes and quantity/stock checks |
| `0002_stormy_colossus` | Added unique email constraint |
| `0003_product_variants` | Replaced product-level stock with size-level variants |
| `0004_order_item_size` | Added purchased size to order-item snapshots |

## 9. Environment and access

Set the connection string in `.env.local` for local work:

```dotenv
Postgres_URL=postgresql://...
```

`Postgres_URL` is case-sensitive. Keep it server-side and do not commit
`.env.local`. Drizzle Kit loads this file through
[`drizzle.config.ts`](./drizzle.config.ts), while the application loads the
same variable through [`server/db/index.ts`](./server/db/index.ts).

Use separate Neon databases or branches for development, staging, and
production where possible. Do not run destructive or experimental SQL against
production.

## 10. Operational queries

The following queries are intended for an authorized operator. Replace
placeholder values before running them.

### Grant vendor access

```sql
UPDATE users
SET role = 'vendor', updated_at = now()
WHERE external_user_id = 'user_...';
```

### Inspect a customer's orders

```sql
SELECT id, status, subtotal, shipping_amount, total_amount, created_at
FROM orders
WHERE user_id = '00000000-0000-0000-0000-000000000000'
ORDER BY created_at DESC;
```

### Inspect low-stock variants

```sql
SELECT p.name, pv.size, pv.sku, pv.stock_quantity
FROM product_variants AS pv
JOIN products AS p ON p.id = pv.product_id
WHERE pv.stock_quantity <= 5
ORDER BY pv.stock_quantity ASC, p.name ASC;
```

### Find pending-payment orders

```sql
SELECT id, user_id, total_amount, created_at
FROM orders
WHERE status = 'pending_payment'
ORDER BY created_at ASC;
```

Do not use ad-hoc SQL to change payment status, order ownership, or inventory
unless the operational procedure has been reviewed. Prefer the application
service that enforces the related business rules.

## 11. Backup, recovery, and monitoring

Neon provides the database availability and branching features, but the
application team remains responsible for confirming the retention and recovery
settings appropriate for the deployment.

At minimum:

- Confirm Neon backups and point-in-time recovery for production.
- Restrict database credentials to the required operators and deployment
  environment.
- Monitor migration failures, connection errors, payment/order mismatches, and
  unexpected stock values.
- Test restoring a non-production branch periodically.
- Never log `Postgres_URL`, payment secrets, or complete customer addresses.

## 12. Known database limitations

- Product categories are free-form text rather than a category table or enum.
- Shipping is currently stored as a required amount but the checkout flow
  currently uses zero shipping.
- There is no separate database-side reservation or expiration mechanism for
  pending orders.
- Payment reconciliation currently starts from the application payment
  verification route; a provider webhook reconciliation workflow is not yet
  implemented.
- `updated_at` is defined with a default but is not automatically maintained
  by a PostgreSQL trigger. Application updates must set it when appropriate.

Review this document whenever the schema, migration process, payment flow, or
inventory model changes.
