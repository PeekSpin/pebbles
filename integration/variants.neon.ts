import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import { eq, sql } from "drizzle-orm";
import * as tables from "../server/db/schema";
import type { WriteTransaction } from "../server/db/transaction";
import { parseVariants } from "../server/validators/catalog";

test("Neon variant migration, catalogue, reservations and captures", async (t) => {
  const connection =
    process.env.PEBBLES_DEV_DATABASE_URL ||
    parse(readFileSync(".env.local")).POSTGRES_URL;
  const host = new URL(connection).hostname;
  assert.match(host, /^ep-[a-z0-9.-]+\.neon\.tech$/);
  assert.equal(
    host,
    process.env.PEBBLES_VERIFIED_DEV_HOST,
    "Set the exact separately verified development endpoint",
  );
  process.env.POSTGRES_URL = connection;
  const { writeDb } = await import("../server/db/transaction");
  const { processCapture, paymentSession } = await import(
    "../server/services/razorpay"
  );
  const { saveProduct, setColorInventory, archiveOrStockOut } = await import(
    "../server/repositories/catalog-write"
  );
  const {
    startCheckout,
    retryCheckout,
    bindProviderOrder,
    recordCapture,
    changeOrderStatus,
  } = await import("../server/repositories/checkout");
  const scratch = "variant_test_" + randomUUID().replaceAll("-", "");
  const realTransaction = writeDb.transaction.bind(writeDb);
  // No fallback to public: even a missing fixture table must fail inside the test schema.
  const isolated = <T>(fn: (tx: WriteTransaction) => Promise<T>) =>
    realTransaction(async (tx) => {
      await tx.execute(sql.raw('set local search_path to "' + scratch + '"'));
      const result = await tx.execute(sql`select current_schema() as name`);
      assert.equal(result.rows[0].name, scratch);
      return fn(tx);
    });
  await writeDb.execute(sql.raw('create schema "' + scratch + '"'));
  t.after(async () => {
    await writeDb.execute(sql.raw('drop schema "' + scratch + '" cascade'));
  });
  t.mock.method(writeDb, "transaction", isolated);
  const migration = (path: string) =>
    readFileSync(path, "utf8")
      .replaceAll('"public".', '"' + scratch + '".')
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
  const journal = JSON.parse(
    readFileSync("drizzle/meta/_journal.json", "utf8"),
  );
  const legacy = {
    product: randomUUID(),
    variant: randomUUID(),
    image: randomUUID(),
    user: randomUUID(),
    order: randomUUID(),
    item: randomUUID(),
  };
  const upgrade = migration("drizzle/0008_colour_inventory.sql");
  await isolated(async (tx) => {
    for (const entry of journal.entries.filter(
      (e: { idx: number }) => e.idx < 8,
    )) {
      for (const stmt of migration("drizzle/" + entry.tag + ".sql"))
        await tx.execute(sql.raw(stmt));
    }
    await tx.execute(
      sql`insert into products (id,name,description,sku,price,color_name) values (${legacy.product},'legacy','old','P',10,'Red')`,
    );
    await tx.execute(
      sql`insert into product_variants (id,product_id,size,sku,stock_quantity) values (${legacy.variant},${legacy.product},'M','red-M',4)`,
    );
    await tx.execute(
      sql`insert into product_images (id,product_id,image_url) values (${legacy.image},${legacy.product},'unchanged/private/key')`,
    );
    await tx.execute(
      sql`insert into users (id,external_user_id) values (${legacy.user},'fixture')`,
    );
    await tx.execute(
      sql`insert into orders (id,user_id,status,subtotal,shipping_amount,total_amount) values (${legacy.order},${legacy.user},'confirmed',10,0,10)`,
    );
    await tx.execute(
      sql`insert into order_items (id,order_id,product_id,product_name,sku,size,quantity,unit_price) values (${legacy.item},${legacy.order},${legacy.product},'historic name','old SKU','L',1,10)`,
    );
    await tx.execute(
      sql`insert into payments (order_id,provider,provider_payment_id,amount,status) values (${legacy.order},'razorpay','old-payment',10,'succeeded')`,
    );
  });
  await t.test(
    "duplicate legacy SKU aborts upgrade before any backfill",
    async () => {
      await assert.rejects(
        isolated(async (tx) => {
          await tx.execute(
            sql`insert into product_variants(product_id,size,sku,stock_quantity) values (${legacy.product},'XL',' RED-m ',2)`,
          );
          for (const stmt of upgrade) await tx.execute(sql.raw(stmt));
        }),
        (err: Error & { cause?: Error }) =>
          !!err.cause?.message.includes("migration blocked"),
      );
    },
  );
  await isolated(async (tx) => {
    for (const stmt of upgrade) await tx.execute(sql.raw(stmt));
  });
  const [red] = await isolated((tx) => tx.select().from(tables.productColors));
  const [original] = await isolated((tx) =>
    tx.select().from(tables.productVariants),
  );
  await t.test(
    "legacy variant, image key and historical line survive",
    async () => {
      assert.equal(original.id, legacy.variant);
      assert.equal(original.productId, legacy.product);
      assert.equal(original.stockQuantity, 4);
      assert.equal(original.productColorId, red.id);
      const [image] = await isolated((tx) =>
        tx.select().from(tables.productImages),
      );
      assert.deepEqual(
        [image.id, image.imageUrl, image.productColorId],
        [legacy.image, "unchanged/private/key", red.id],
      );
      const [line] = await isolated((tx) =>
        tx.select().from(tables.orderItems),
      );
      assert.deepEqual(
        [
          line.id,
          line.productName,
          line.sku,
          line.size,
          line.unitPrice,
          line.variantId,
        ],
        [legacy.item, "historic name", "old SKU", "L", "10.00", null],
      );
    },
  );
  const base = {
    name: "Edited",
    description: "new",
    category: "Tops",
    sku: "P",
    price: "10.00",
    isPreorder: false,
  };
  const redInput = {
    ...red,
    images: [
      { id: legacy.image, imageUrl: "unchanged/private/key", altText: null },
    ],
    variants: parseVariants([original]),
  };
  const blueInput = {
    code: "blue",
    name: "Blue",
    hex: "#0011FF",
    images: [],
    variants: parseVariants([
      { size: "M", sku: "blue-M", priceOverride: "17.55", stockQuantity: 1 },
    ]),
  };
  await t.test(
    "edit retains IDs, adds second colour with same size, and rejects stale edits",
    async () => {
      await saveProduct(legacy.product, base, [redInput, blueInput], false, 0);
      const [v] = await isolated((tx) =>
        tx
          .select()
          .from(tables.productVariants)
          .where(eq(tables.productVariants.id, legacy.variant)),
      );
      assert.equal(v.sku, "red-M");
      await assert.rejects(
        saveProduct(legacy.product, base, [redInput], false, 0),
        /changed/,
      );
    },
  );
  const [blue] = await isolated((tx) =>
    tx
      .select()
      .from(tables.productVariants)
      .where(eq(tables.productVariants.sku, "blue-M")),
  );
  const address = {
    recipientName: "Test",
    phone: "123",
    addressLine1: "Test lane",
    city: "Test",
    pincode: "000000",
  };
  const redLine = {
      productId: legacy.product,
      variantId: original.id,
      quantity: 2,
    },
    blueLine = { productId: legacy.product, variantId: blue.id, quantity: 1 };
  let winner = "";
  await t.test(
    "two simultaneous carts compete for the last unit; losing order and all its holds roll back",
    async () => {
      const keys = [randomUUID(), randomUUID()];
      const result = await Promise.allSettled(
        keys.map((key) =>
          startCheckout(legacy.user, key, [redLine, blueLine], address),
        ),
      );
      assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
      const idx = result.findIndex((r) => r.status === "fulfilled");
      const order = (
        result[idx] as PromiseFulfilledResult<{
          id: string;
          totalAmount: string;
        }>
      ).value;
      winner = order.id;
      assert.equal(order.totalAmount, "37.55");
      const retry = await startCheckout(
        legacy.user,
        keys[idx],
        [redLine, blueLine],
        address,
      );
      assert.equal(retry.id, winner);
      const holds = await isolated((tx) =>
        tx.select().from(tables.inventoryReservations),
      );
      assert.equal(holds.length, 2);
      const all = await isolated((tx) => tx.select().from(tables.orders));
      assert.equal(all.length, 2);
      await assert.rejects(archiveOrStockOut(legacy.product, true), /reserved/);
      await assert.rejects(
        setColorInventory(legacy.product, blue.productColorId, [], 1),
        /reserved/,
      );
    },
  );
  await t.test(
    "parallel callback and webhook consume both lines exactly once, including after shipment",
    async () => {
      const remote = {
        id: "order_mock",
        receipt: winner,
        currency: "INR",
        amount: 3755,
      };
      const gateway = {
        orders: {
          all: async () => ({ items: [] }),
          create: async () => remote,
          fetch: async () => remote,
        },
        payments: {
          fetch: async () => ({
            id: "pay_mock",
            order_id: remote.id,
            amount: 3755,
            status: "captured",
            currency: "INR",
          }),
        },
      };
      const client = gateway as unknown as ReturnType<
        typeof import("../server/services/razorpay").gateway
      >;
      const session = await paymentSession(
        { id: winner, totalAmount: "37.55", providerOrderId: null },
        client.orders,
      );
      assert.equal(session.order_id, remote.id);
      const capture = () =>
        processCapture(remote.id, "pay_mock", winner, client);
      assert.deepEqual(await Promise.all([capture(), capture()]), [
        "confirmed",
        "confirmed",
      ]);
      const stock = await isolated((tx) =>
        tx.select().from(tables.productVariants),
      );
      assert.equal(stock.find((v) => v.id === original.id)?.stockQuantity, 2);
      assert.equal(stock.find((v) => v.id === blue.id)?.stockQuantity, 0);
      const items = await isolated((tx) =>
        tx
          .select()
          .from(tables.orderItems)
          .where(eq(tables.orderItems.orderId, winner)),
      );
      assert.deepEqual(items.map((i) => i.colorName).sort(), ["Blue", "Red"]);
      await changeOrderStatus(winner, { status: "shipped" });
      assert.equal(await capture(), "confirmed");
      const paid = await isolated((tx) =>
        tx
          .select()
          .from(tables.payments)
          .where(eq(tables.payments.orderId, winner)),
      );
      assert.equal(paid.length, 1);
    },
  );
  await t.test(
    "legacy pending multi-line retry resolves exact variants and preserves sale prices",
    async () => {
      const order = await isolated(async (tx) => {
        const [o] = await tx
          .insert(tables.orders)
          .values({
            userId: legacy.user,
            subtotal: "3.00",
            shippingAmount: "0",
            totalAmount: "3.00",
          })
          .returning();
        await tx
          .insert(tables.orderItems)
          .values(
            [1, 2].map((n) => ({
              orderId: o.id,
              productId: legacy.product,
              productName: "At purchase",
              sku: "red-M",
              size: "M",
              quantity: 1,
              unitPrice: n + ".00",
            })),
          );
        return o;
      });
      await retryCheckout(order.id, legacy.user);
      const lines = await isolated((tx) =>
        tx
          .select()
          .from(tables.orderItems)
          .where(eq(tables.orderItems.orderId, order.id)),
      );
      assert.deepEqual(lines.map((l) => l.unitPrice).sort(), ["1.00", "2.00"]);
      assert(
        lines.every(
          (l) =>
            l.variantId === legacy.variant && l.productName === "At purchase",
        ),
      );
      await changeOrderStatus(order.id, { status: "cancelled" });
    },
  );
  await t.test(
    "expired holds release capacity and late capture creates just one review",
    async () => {
      const expired = await startCheckout(
        legacy.user,
        randomUUID(),
        [redLine],
        address,
      );
      await bindProviderOrder(expired.id, "order_late");
      await isolated((tx) =>
        tx
          .update(tables.inventoryReservations)
          .set({ expiresAt: new Date(0) })
          .where(eq(tables.inventoryReservations.orderId, expired.id)),
      );
      const next = await startCheckout(
        legacy.user,
        randomUUID(),
        [redLine],
        address,
      );
      assert.equal(
        await recordCapture(expired.id, "order_late", "pay_late", 2000),
        "review",
      );
      assert.equal(
        await recordCapture(expired.id, "order_late", "pay_late", 2000),
        "review",
      );
      await assert.rejects(retryCheckout(expired.id, legacy.user), /review/);
      await changeOrderStatus(next.id, { status: "cancelled" });
      const reviews = await isolated((tx) =>
        tx.select().from(tables.paymentReviews),
      );
      assert.equal(reviews.length, 1);
      const [v] = await isolated((tx) =>
        tx
          .select()
          .from(tables.productVariants)
          .where(eq(tables.productVariants.id, original.id)),
      );
      assert.equal(v.stockQuantity, 2);
    },
  );
  await t.test("creating a product saves stock and separate galleries; reordering preserves keys and IDs", async () => {
    const id = randomUUID();
    const newBase = { ...base, sku: "NEW" };
    const input = ["cyan", "green"].map(code => ({
      code, name: code, hex: null,
      images: ["front", "back"].map(side => ({imageUrl: code+"/"+side, altText: side})),
      variants: parseVariants([{size:"M", sku:code+"-M", stockQuantity:3}])
    }));
    await saveProduct(id, newBase, input, true);
    const read = () => isolated(async tx => ({
      colors: await tx.select().from(tables.productColors).where(eq(tables.productColors.productId,id)).orderBy(tables.productColors.sortOrder),
      variants: await tx.select().from(tables.productVariants).where(eq(tables.productVariants.productId,id)),
      images: await tx.select().from(tables.productImages).where(eq(tables.productImages.productId,id)).orderBy(tables.productImages.sortOrder)
    }));
    const before = await read();
    assert.equal(before.colors.length, 2);
    assert.equal(before.variants.length, 2);
    assert(before.variants.every(v => v.size==="M" && v.stockQuantity===3));
    const edit = before.colors.map(c => ({
      ...c, variants: parseVariants(before.variants.filter(v => v.productColorId === c.id)),
      images: before.images.filter(i => i.productColorId === c.id).reverse()
    }));
    await saveProduct(id, newBase, edit, false, 1);
    const after = await read();
    for (const color of edit) {
      assert.deepEqual(after.images.filter(i=>i.productColorId===color.id).map(i=>[i.id,i.imageUrl]),
        color.images.map(i=>[i.id,i.imageUrl]));
    }
    const bad = [{ ...edit[0], images: edit[1].images }, edit[1]];
    await assert.rejects(saveProduct(id,newBase,bad,false,2),/retained image/);
    assert.deepEqual((await read()).images,after.images);
  });
});
