import assert from "node:assert/strict";
import { test } from "node:test";

import { productRequest } from "../app/lib/product-editor";
import { parseBase } from "../server/validators/catalog";

function baseForm(isPreorder?: string) {
  const form = new FormData();
  form.set("sku", "PB-TEST-1");
  form.set("name", "Test saree");
  form.set("description", "Handwoven test saree");
  form.set("category", "Sarees");
  form.set("price", "4890");
  if (isPreorder !== undefined) form.set("isPreorder", isPreorder);
  return form;
}

test("product form persists the preorder option in its request", () => {
  assert.equal(productRequest(
    { sku: "PB-TEST-1", name: "Test saree", description: "Handwoven test saree", category: "Sarees", price: "4890" },
    [],
    undefined,
    true,
  ).get("isPreorder"), "true");
});

test("catalog parsing defaults omitted preorder flags to false", () => {
  assert.equal(parseBase(baseForm()).isPreorder, false);
  assert.equal(parseBase(baseForm("true")).isPreorder, true);
  assert.equal(parseBase(baseForm("false")).isPreorder, false);
});

test("catalog parsing rejects malformed preorder flags", () => {
  assert.throws(() => parseBase(baseForm("yes")), /Invalid preorder option/);
});
