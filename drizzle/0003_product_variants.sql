CREATE TABLE "product_variants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL,
  "size" varchar(10) NOT NULL,
  "sku" varchar(100) NOT NULL,
  "stock_quantity" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "product_variants_product_id_size_unique" UNIQUE("product_id","size"),
  CONSTRAINT "product_variants_stock_quantity_nonnegative" CHECK ("stock_quantity" >= 0)
);
--> statement-breakpoint
INSERT INTO "product_variants" ("product_id", "size", "sku", "stock_quantity")
SELECT "id", 'M', "sku", "stock_quantity" FROM "products";
--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "product_variants_product_id_idx" ON "product_variants" USING btree ("product_id");
--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_stock_quantity_nonnegative";
--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "stock_quantity";
