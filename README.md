# Pebbles

Pebbles is a full-stack fashion storefront for browsing and purchasing
**kurtas, sarees, and tops**. Customers can browse products, select size and
quantity, manage a cart, place orders, pay through Razorpay, and track their
orders. Vendors have a protected dashboard for managing products, inventory,
customers, and order status.

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
Postgres_URL=postgresql://...
```

`Postgres_URL` is case-sensitive and must use this exact spelling.

### Neon Object Storage

```dotenv
S3_BUCKET_NAME=products
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_ENDPOINT_URL_S3=https://...
AWS_REGION=...
```

Create a Neon storage credential with read/write access and use a bucket named
`products`. Uploaded images must be valid image files smaller than 5 MB.
Credentials stay on the server; the application generates signed URLs for
displaying stored images.

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
