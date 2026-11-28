# Pebbles

Pebbles is a full-stack fashion storefront for browsing and purchasing
**tops, sarees, kurtis, 2 Pcs Kurti Set, 3 Pcs Kurti Set, Mul Chanderi,
Mul cotton, Short Kurti, and Chikankari kurtis**. Customers can browse products,
select size and quantity, manage a cart, place orders, pay through Razorpay,
and track their orders. Vendors have a protected dashboard for managing
products, inventory, customers, and order status.

## Features

### Customer experience

- Public storefront and product catalog
- Product search and category filtering
- Product detail pages with image galleries, sizes, prices, and stock
- Client-side shopping cart
- Authenticated checkout and delivery details
- Razorpay payment flow with server-side signature verification
- Order history, order details, and pending-payment retry
- Customer profile management

### Vendor experience

- Protected vendor dashboard at `/admin`
- Product create, edit, list, and delete operations
- Product image uploads to Neon Object Storage
- Size-level SKU and inventory management
- Customer and category views
- Order filtering and order-status management

## Technology stack

| Area | Technology |
| --- | --- |
| Framework | Next.js 14 App Router |
| Language | TypeScript |
| UI | React 18 |
| Authentication | Clerk |
| Database | Neon PostgreSQL |
| ORM and migrations | Drizzle ORM and Drizzle Kit |
| Payments | Razorpay |
| Image storage | Neon Object Storage via the AWS S3 SDK |
| Webhook verification | Svix |

## Project structure

```text
app/
  page.tsx                 Storefront home page
  products/                Product listing and product details
  cart/                    Shopping cart
  checkout/                Checkout and payment initiation
  orders/                  Customer order history and details
  profile/                 Customer profile
  admin/                   Vendor dashboard and management pages
  api/                     Customer, vendor, payment, and webhook routes
server/
  auth/                    Authentication and vendor authorization
  db/                      Database connection and Drizzle schema
  repositories/            Database queries
  services/                User and vendor business logic
  storage/                 Neon Object Storage integration
  validators/              Request validation helpers
drizzle/                   Generated database migrations
scripts/                   Maintenance scripts
public/images/             Brand and storefront assets
```

## Prerequisites

- Node.js compatible with the versions in `package.json`
- npm
- A Clerk application
- A Neon PostgreSQL database
- A Neon Object Storage S3 credential and bucket
- A Razorpay account for payment testing or production payments

## Local development

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in a browser.

### Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run the Next.js lint command |
| `npm run db:generate` | Generate a Drizzle migration from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:backfill-users` | Synchronize existing Clerk users to Neon |

## Environment configuration

Create a `.env.local` file in the project root. Never commit this file or
expose server-only secrets in browser code.

For the hosted application, configure these variables in the app dashboard's
Secrets panel, then redeploy. `.env.local` is for local development; it does not
configure the hosted runtime.

### Clerk

```dotenv
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
```

Configure Clerk to send `user.created`, `user.updated`, and `user.deleted`
events to `/api/webhooks/clerk`. The webhook signing secret must match the
secret configured for that endpoint.

### Database

```dotenv
POSTGRES_URL=postgresql://...
```

`POSTGRES_URL` is case-sensitive and must use this exact spelling.

### Neon Object Storage

```dotenv
S3_BUCKET_NAME=products
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_ENDPOINT_URL_S3=https://...
AWS_REGION=...
```

Create a bucket named `products` on the target Neon branch, or set
`S3_BUCKET_NAME` to the exact name of another bucket you create there. Database
migrations do not create storage buckets. Use storage credentials with write
access valid for that branch, and copy the endpoint and region from Neon's
storage connection settings. Set all five variables in the hosting Secrets
panel and redeploy after changing them.

Uploaded images must be valid image files smaller than 5 MB.
Credentials stay on the server; the application generates signed URLs for
displaying stored images.

Product images are uploaded before the product row is inserted. A storage
failure therefore prevents product creation and returns HTTP 502. The error
identifies missing variable names or the storage/network error code and HTTP
status, without including access keys or secret values.

### Razorpay

```dotenv
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
```

The secret key is server-only. Use Razorpay test credentials during local
development.

## Authentication and vendor access

Clerk provides the signed-in identity. Protected server routes still verify
authentication themselves; middleware alone is not an authorization decision.
The storefront, product pages, cart, and contact page are publicly accessible.
Checkout, profile, orders, payments, and payment verification require a signed
in user.

New local profiles default to the `customer` role. To grant a trusted Clerk
user vendor access, update the role in Neon using their Clerk user ID:

```sql
UPDATE users
SET role = 'vendor', updated_at = now()
WHERE external_user_id = 'user_...';
```

Vendor authorization is checked on the server. Hiding an admin link or
changing client-side navigation does not grant access.

## Main routes

### Customer routes

| Route | Purpose |
| --- | --- |
| `/` | Storefront home page |
| `/products` | Product listing, search, and category filtering |
| `/products/:slug` | Product details and variant selection |
| `/cart` | Current shopping cart |
| `/checkout` | Delivery details and payment |
| `/orders` | Customer order history |
| `/orders/:id` | Order details and pending-payment retry |
| `/profile` | Customer profile |
| `/contact` | Contact page |

### Vendor routes

| Route | Purpose |
| --- | --- |
| `/admin` | Vendor dashboard |
| `/admin/products` | Product and inventory list |
| `/admin/products/new` | Create a product |
| `/admin/products/:id/edit` | Edit a product |
| `/admin/orders` | View and filter orders |
| `/admin/orders/:id` | View and update an order |
| `/admin/customers` | Customer list |
| `/admin/categories` | Category view |

## Database and migrations

The canonical schema is in `server/db/schema.ts`. The database contains
users, products, product variants, product images, orders, order items, order
addresses, and payments.

### Setting up a new deployment database

Creating a Neon database and setting `POSTGRES_URL` does not create the app's
tables. Apply the existing migrations before serving requests on GoDaddy,
Vercel, or any other host.

From the directory containing `package.json` and `drizzle.config.ts`, with
`POSTGRES_URL` set to the new deployment database in that same shell:

```bash
npm ci --include=dev
npm run db:migrate
npm run build
```

Drizzle Kit is a development dependency, so it must be installed in the
environment where migrations run. Include the `drizzle/` directory and its
`meta/_journal.json` file. Drizzle Kit also loads `.env.local` if present;
an existing shell variable takes precedence. Confirm the target is the new
deployment database rather than the Vercel test database.

After migrations succeed, restart the hosted application in production mode
using `npm run start` (or the hosting provider's configured production startup).
If the hosting shell cannot run migrations, run them from a local or CI checkout
of the same release with `POSTGRES_URL` explicitly set to the deployment database.

To verify in the Neon SQL Editor, select the same branch and database used by
the app and run:

```sql
SELECT current_database(), to_regclass('public.products');
SELECT count(*) FROM public.products WHERE deleted_at IS NULL;
```

An empty products table returns `0` without an error. Migrations create the
schema; they do not copy products, users, orders, or images from the test setup.

If a page reports `Failed query: select count(*) from "products" ...`, inspect
the nested `cause` in the server log. PostgreSQL code `42P01` means a missing
table, while `42703` means a missing column. The `products.deleted_at` column
is added by migration `0006`; apply all pending migrations. If the schema is
present, use the underlying error to check credentials or connectivity. Object
Storage credentials do not affect this count query.

### Changing the schema

When changing the schema:

1. Update `server/db/schema.ts`.
2. Generate a migration:

   ```bash
   npm run db:generate
   ```

3. Review the generated SQL in `drizzle/`.
4. Apply it to the configured database:

   ```bash
   npm run db:migrate
   ```

Do not edit an already-applied migration. Create a new migration for each
subsequent change.

After enabling Clerk webhooks for an existing application, synchronize users
that predate the webhook:

```bash
npm run db:backfill-users
```

## Order and payment flow

1. The customer selects a product variant and adds it to the cart.
2. Checkout collects recipient and delivery information.
3. The server re-checks product, variant, price, and stock before creating a
   pending order.
4. A Razorpay order is created in INR.
5. Razorpay returns payment details to the client.
6. The server verifies the Razorpay signature and confirms the local order.

Prices and stock are always read from the database on the server. The client
cannot choose the final order total. Pending orders can request a new payment
order from the order details page.

## Deployment checklist

Before deploying:

1. Configure all Clerk, Neon, Object Storage, and Razorpay environment
   variables in the hosting provider.
2. Set the Clerk webhook URL to
   `https://<your-domain>/api/webhooks/clerk`.
3. Apply all pending Drizzle migrations.
4. Run the Clerk user backfill if migrating an existing Clerk application.
5. Confirm the Object Storage bucket is named `products`.
6. Use Razorpay live credentials only after testing checkout and payment
   verification with test credentials.
7. Build and start the application:

   ```bash
   npm run build
   npm run start
   ```

For deeper architecture, data-model, API, and operational details, see
[TECHNICAL_DOCUMENTATION.md](./TECHNICAL_DOCUMENTATION.md). For the dedicated
database reference, see
[DATABASE_DOCUMENTATION.md](./DATABASE_DOCUMENTATION.md).

### GoDaddy managed Node.js hosting

Use the project root containing `package.json` and the lockfile. The managed
build command is `npm run build` and the serve command is
`NODE_ENV=production npm start`. GoDaddy supplies `PORT` and Next reads it
directly. The build dependencies include the tools imported by the repository's
TypeScript configuration, scripts and tests because GoDaddy installs production
dependencies before building.

1. In the app dashboard, keep the source on `PeekSpin/pebbles`, branch `main`.
   Configure the intended `NEXT_PUBLIC_*` values before building. Next embeds
   these values in browser bundles. Configure server secrets for the **Published**
   environment as well as **Preview**. Once the intended commit is on `main`,
   select **Update Preview**.
2. In **Deployment Info → Preview**, check the commit and open the preview.
   The source ZIP or Git checkout supplies `public/`. The built release needs
   `.next/BUILD_ID`, `.next/server/`, `.next/static/`, Next's generated
   manifests, `public/`, `node_modules/`, and the project files including
   `scripts/check-production-build.cjs`. GoDaddy's runtime logs should show
   that the preview dependencies and build output were carried into the release.
3. When ready to release, use **Publish to Live** and open **Deployment Info →
   Published → View logs**. Look for `[startup]`, the Next build ID, the assigned
   port and `Ready`. Check the homepage, `/images/pebbles-mark-black-transparent.svg`
   and a `/_next/static/` asset referenced by that page. A later **Restart
   Published App** should report the same build ID without compiling. If the
   release is missing build output, inspect preview build and archive promotion.
4. If a published static asset still returns 503 after `Ready`, record the UTC
   time and the response's `x-airo-supervisor-request-id`. Ask GoDaddy to check
   the routed instance, target port, health probe result and any process exit
   or memory-limit event for that request.

[GoDaddy Node.js app requirements](https://developer.godaddy.com/en/docs/api-users/hosting/app-requirements)
