# Pebbles Storefront Technical Documentation

## 1. Document purpose

This document describes the current Pebbles storefront implementation, its
runtime architecture, domain model, request flows, configuration, and
operational procedures. It is intended for developers who maintain the
application or deploy it to a new environment.

The application is an Indian fashion storefront. The supported product
taxonomy is:

- Kurtas
- Sarees
- Tops

The database stores the category as a string, so these values are application
conventions rather than database-enforced enum values.

## 2. System overview

Pebbles is a private Next.js 14 application using the App Router.

```text
Browser
  |
  | Next.js pages and client components
  v
Next.js server routes and server components
  |             |                 |
  |             |                 +--> Razorpay Orders API
  |             +--> Neon Object Storage (S3-compatible)
  +--> Neon PostgreSQL through Drizzle ORM
  |
  +--> Clerk authentication and user webhooks
```

### Primary responsibilities

| Area | Implementation |
|---|---|
| Web framework | Next.js 14 App Router |
| Language | TypeScript |
| UI | React 18 |
| Authentication | Clerk |
| Database | Neon PostgreSQL |
| ORM and migrations | Drizzle ORM and Drizzle Kit |
| Payments | Razorpay |
| Product image storage | Neon Object Storage through the AWS S3 SDK |
| User synchronization | Clerk Svix webhooks |
| Runtime | Node.js-compatible Next.js server runtime |

## 3. Repository structure

```text
app/
  page.tsx                         Storefront home page
  products/                        Product listing and product details
  cart/                            Cart page
  checkout/                        Checkout page
  orders/                          Customer order history and details
  profile/                         Customer profile
  admin/                           Vendor dashboard and management pages
  api/                             HTTP route handlers
server/
  auth/                            Authentication helpers
  db/                              Drizzle database connection and schema
  repositories/                    Database access and domain queries
  services/                        User and vendor business rules
  storage/                         Object Storage integration
  validators/                      Shared validation helpers
drizzle/
  *.sql                            Generated database migrations
scripts/
  backfill-clerk-users.ts          Existing Clerk user synchronization
public/
  images/                          Static brand and carousel assets
```

## 4. Local development

### Prerequisites

- Node.js compatible with the installed Next.js and TypeScript versions
- npm
- A Clerk application
- A Neon PostgreSQL database
- A Neon Object Storage S3 credential and bucket
- A Razorpay account for payment testing or production payments

### Install and run

```bash
npm install
npm run dev
```

The development server is normally available at
`http://localhost:3000`.

### Available npm scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Create a production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run the configured Next.js lint command |
| `npm run db:generate` | Generate a Drizzle migration from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:backfill-users` | Synchronize existing Clerk users into Neon |

## 5. Environment configuration

Create `.env.local` for local development. Do not commit this file.

### Required authentication variables

```dotenv
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
```

`CLERK_WEBHOOK_SIGNING_SECRET` must match the signing secret configured for
the Clerk webhook endpoint.

### Required database variable

```dotenv
Postgres_URL=postgresql://...
```

The variable name is case-sensitive and must remain `Postgres_URL`.

### Required object storage variables

```dotenv
S3_BUCKET_NAME=products
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_ENDPOINT_URL_S3=https://...
AWS_REGION=...
```

The storage adapter uses path-style S3 requests and validates that the
endpoint is a URL. Product images are stored under a product-specific key and
served with one-hour signed URLs.

### Required payment variables

```dotenv
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
```

The key secret is server-only and must never be exposed to browser code.

## 6. Authentication and authorization

Clerk is registered in the root layout and applied through
[middleware.ts](/Users/alenpaji/Documents/pebbles/middleware.ts). Authentication
is still checked at each protected server boundary; middleware alone is not an
authorization decision.

### Customer authentication

- `requireUser()` calls Clerk `auth()` and throws `Authentication required`
  when no signed-in user exists.
- `ensureUserProfile()` resolves the Clerk user, creates or updates the local
  profile when necessary, and returns the local user record.
- The storefront, product browsing, cart, and contact pages are publicly
  accessible.
- Checkout, profile, order history, payment, and payment verification require
  an authenticated customer.

### Vendor authorization

Vendor operations call `requireVendor()`, which checks the local `users.role`
value. The admin layout also redirects non-vendors to `/profile` and
unauthenticated visitors to `/login`.

To grant vendor access to an existing Clerk user:

```sql
UPDATE users
SET role = 'vendor', updated_at = now()
WHERE external_user_id = 'user_...';
```

Changing client-side navigation or hiding a link does not grant vendor access.

## 7. Data model

The canonical schema is in
[server/db/schema.ts](/Users/alenpaji/Documents/pebbles/server/db/schema.ts).
See [DATABASE_DOCUMENTATION.md](./DATABASE_DOCUMENTATION.md) for the complete
table reference, relationship map, constraints, indexes, migration history,
and database operations.

### Enumerations

| Enum | Values |
|---|---|
| `user_role` | `vendor`, `customer` |
| `order_status` | `confirmed`, `shipped`, `delivered`, `pending_payment`, `cancelled` |
| `payment_status` | `failed`, `succeeded` |

### Tables

#### `users`

Stores the local profile associated with a Clerk user.

- `external_user_id` is the unique Clerk user ID.
- New profiles default to `customer`.
- Deleted Clerk users are anonymized rather than physically removed so
  historical orders remain available.

#### `products`

Stores the catalog record, including SKU, name, description, category, and
decimal price.

#### `product_variants`

Stores purchasable size-level inventory.

- Each variant belongs to one product.
- A product cannot contain the same size twice.
- `stock_quantity` cannot be negative.
- The variant SKU is stored independently from the parent product SKU.

#### `product_images`

Stores object-storage keys and display metadata.

- Images are associated with a product.
- `sort_order` controls display order.
- `(product_id, sort_order)` is unique.

#### `orders`

Stores the customer, order status, subtotal, shipping amount, total, and
timestamps. New orders created during checkout start as `pending_payment`.

#### `order_items`

Stores a purchase-time snapshot of product name, SKU, size, quantity, and unit
price. This preserves order history when the catalog changes.

#### `order_addresses`

Stores the delivery address snapshot for an order. Each order has at most one
address record.

#### `payments`

Stores the payment provider, provider payment ID, amount, and payment status.
The provider and provider payment ID combination is unique.

## 8. User and data synchronization

Configure Clerk to send these events to
`/api/webhooks/clerk`:

- `user.created`
- `user.updated`
- `user.deleted`

The webhook handler:

1. Reads the raw request body.
2. Verifies the Svix signature using `CLERK_WEBHOOK_SIGNING_SECRET`.
3. Validates the event shape.
4. Upserts the local profile for create/update events.
5. Anonymizes the local profile for delete events.

After enabling the webhook for an existing Clerk application, run:

```bash
npm run db:backfill-users
```

The protected `/api/profile` route also creates the local profile on demand,
which provides resilience when webhook delivery is delayed.

## 9. Product management

Vendors manage products from `/admin/products`.

### Create and edit behavior

Product forms accept:

- SKU
- Name
- Description
- Category
- Decimal price with up to two fractional digits
- One or more size variants
- Optional product images

Images must be image MIME types and smaller than 5 MB. They are uploaded to
the configured object-storage bucket using a generated key:

```text
<product-id>/<index>-<uuid>-<sanitized-file-name>
```

Product listing and detail queries resolve stored keys to signed URLs. The
browser does not receive object-storage credentials.

### Product API

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/admin/products?page=1` | Vendor | Paginated product list |
| `POST` | `/api/admin/products` | Vendor | Create a product using `multipart/form-data` |
| `GET` | `/api/admin/products/:id` | Vendor | Read a product |
| `PATCH` | `/api/admin/products/:id` | Vendor | Update product fields and images |
| `DELETE` | `/api/admin/products/:id` | Vendor | Delete a product |
| `PATCH` | `/api/admin/products/:id/variants` | Vendor | Update variant inventory |

The `variants` form field is a JSON array containing `size`, `sku`, and
non-negative integer `stockQuantity`.

## 10. Customer shopping and checkout flow

### Storefront flow

1. A visitor opens `/` or `/products`.
2. Products can be filtered by category or search query.
3. A product detail page is available at `/products/:slug`.
4. The visitor selects a size variant and quantity.
5. Cart state is maintained in the storefront client state.
6. `/checkout` collects recipient and delivery information.
7. The client calls `POST /api/create-order`.

### Order creation

`POST /api/create-order` requires:

- `productId`
- `variantId`
- Positive integer `quantity`
- `recipientName`
- `phone`
- `addressLine1`
- `city`
- `pincode`

The server re-reads the product and variant from the database, verifies stock,
creates a local pending order, and creates a Razorpay order in INR. Shipping is
currently zero-valued. The response includes the Razorpay order ID, amount in
paise, currency, and local order ID.

The server never trusts a client-supplied price.

### Payment verification

After Razorpay completes payment, the client calls
`POST /api/verify-payment` with:

- `razorpay_order_id`
- `razorpay_payment_id`
- `razorpay_signature`
- `local_order_id`

The server:

1. Computes the HMAC-SHA256 signature with `RAZORPAY_KEY_SECRET`.
2. Compares signatures using a timing-safe comparison.
3. Confirms the local order belongs to the authenticated user.
4. Fetches the Razorpay order and matches its receipt and amount.
5. Records the payment and confirms the local order.

Pending orders can request a new Razorpay payment order through:

```text
POST /api/orders/:id/payment
```

That route verifies ownership, status, and current stock before creating the
retry payment order.

## 11. HTTP API reference

### Customer endpoints

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/profile` | Authenticated | Return the local profile |
| `POST` | `/api/create-order` | Authenticated | Create a pending order and Razorpay order |
| `POST` | `/api/verify-payment` | Authenticated | Verify and confirm a payment |
| `POST` | `/api/orders/:id/payment` | Authenticated | Retry payment for a pending order |
| `GET` | `/api/example` | Authenticated | Example protected endpoint |

### Vendor endpoints

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/admin/orders` | Vendor | Filtered, paginated order list |
| `GET` | `/api/admin/orders/:id` | Vendor | Read an order |
| `PATCH` | `/api/admin/orders/:id` | Vendor | Update order status |
| `GET` | `/api/admin/products` | Vendor | Paginated product list |
| `POST` | `/api/admin/products` | Vendor | Create a product |
| `GET` | `/api/admin/products/:id` | Vendor | Read a product |
| `PATCH` | `/api/admin/products/:id` | Vendor | Update a product |
| `DELETE` | `/api/admin/products/:id` | Vendor | Delete a product |
| `PATCH` | `/api/admin/products/:id/variants` | Vendor | Update inventory |

### Integration endpoint

| Method | Path | Caller | Purpose |
|---|---|---|---|
| `POST` | `/api/webhooks/clerk` | Clerk | Synchronize user lifecycle events |

Protected endpoint responses use `401` for missing authentication and `403`
for authenticated users without vendor access. Validation failures generally
return `400`, missing resources return `404`, conflicts such as insufficient
stock return `409`, and upstream payment or storage failures return `5xx`.

## 12. Vendor dashboard

The vendor interface is available below `/admin`:

- `/admin` — dashboard
- `/admin/products` — product list
- `/admin/products/new` — product creation
- `/admin/products/:id/edit` — product editing
- `/admin/orders` — order list with status and date filters
- `/admin/orders/:id` — order details and status management
- `/admin/customers` — customer list
- `/admin/categories` — category view

All admin pages are protected by the server-side admin layout and all admin
API routes repeat the vendor check.

## 13. Database migration workflow

1. Update the schema in
   [server/db/schema.ts](/Users/alenpaji/Documents/pebbles/server/db/schema.ts).
2. Generate a migration:

   ```bash
   npm run db:generate
   ```

3. Review the generated SQL in `drizzle/`.
4. Apply it to the configured database:

   ```bash
   npm run db:migrate
   ```

5. Test the affected customer and vendor flows.

Never edit an already-applied migration to change production history. Add a
new migration instead.

## 14. Security requirements

- Keep Clerk secret keys, Razorpay secrets, database URLs, and storage
  credentials server-side.
- Verify Clerk webhook signatures before parsing trusted event data.
- Verify Razorpay signatures and server-side order amounts before confirming
  payment.
- Keep authorization checks in server layouts, route handlers, services, and
  repositories as appropriate; do not rely on UI visibility.
- Use signed image URLs rather than exposing object-storage credentials.
- Validate product prices, variants, quantities, upload MIME types, and upload
  sizes on the server.
- Preserve order snapshots so historical records do not depend on mutable
  catalog fields.
- Log operational failures without logging credentials, payment secrets, or
  unnecessary personal data.

## 15. Deployment checklist

Before deploying:

- [ ] Install dependencies with `npm install`.
- [ ] Configure all Clerk, Neon, Razorpay, and storage environment variables.
- [ ] Confirm `S3_BUCKET_NAME` points to the intended bucket.
- [ ] Run `npm run db:migrate` against the deployment database.
- [ ] Configure Clerk webhook events and verify the signing secret.
- [ ] Run `npm run db:backfill-users` for an existing Clerk tenant.
- [ ] Promote at least one trusted Clerk user to `vendor`.
- [ ] Run `npm run build`.
- [ ] Test sign-in, product browsing, product creation, image upload,
  checkout, successful payment, failed payment, and order status updates.
- [ ] Confirm production payment credentials and webhook configuration are not
  mixed with test credentials.

## 16. Known implementation boundaries

- Shipping is currently hard-coded to zero in order creation.
- Payment confirmation is initiated by the client through signature
  verification; a separate Razorpay webhook reconciliation path is not
  currently implemented.
- Product categories are stored as free-form strings rather than a dedicated
  category table or enum.
- The current package scripts do not define a dedicated automated test
  command; use the build, lint, and targeted manual/API verification available
  in the project when validating changes.
- Order creation is currently shaped around a product variant and quantity
  submitted by the checkout flow. Any future multi-item cart checkout should
  extend the repository transaction and API contract together.

## 17. Change guidelines

When modifying the application:

1. Keep database access in repositories or services rather than page
   components.
2. Keep authentication and authorization checks at every server entry point.
3. Treat prices, stock, ownership, and payment state as server-owned values.
4. Add schema migrations for persistent model changes.
5. Update this document when adding routes, integrations, environment
   variables, or operational procedures.
6. Run the smallest relevant validation command, then run `npm run build` for
   changes that affect routing, types, configuration, or server behavior.
