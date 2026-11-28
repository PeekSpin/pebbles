import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import { NextResponse } from "next/server";
import { bindProviderOrder, recordCapture } from "../repositories/checkout";
import { Conflict } from "../repositories/inventory";
import { InputError, uuidPattern } from "../validators/catalog";
import { paise } from "../validators/checkout";

export function gateway() {
  const key_id = process.env.RAZORPAY_KEY_ID,
    key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret)
    throw new Error("Payment service credentials missing");
  return new Razorpay({ key_id, key_secret });
}
export function validSignature(
  body: string,
  signature: string,
  secret: string,
) {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  return timingSafeEqual(
    createHmac("sha256", secret).update(body).digest(),
    Buffer.from(signature, "hex"),
  );
}
export async function paymentSession(
  order: { id: string; totalAmount: string; providerOrderId: string | null },
  api = gateway().orders,
) {
  const amount = paise(order.totalAmount);
  let providerId = order.providerOrderId;
  if (!providerId) {
    // Receipt lookup recovers a provider order created before a process crash.
    const find = async () =>
      (await api.all({ receipt: order.id })).items.find(
        (o) =>
          o.receipt === order.id &&
          Number(o.amount) === amount &&
          o.currency === "INR",
      );
    let remote = await find();
    if (!remote) {
      try {
        remote = await api.create({
          amount,
          currency: "INR",
          receipt: order.id,
        });
      } catch (error) {
        remote = await find();
        if (!remote) throw error;
      }
    }
    providerId = await bindProviderOrder(order.id, remote.id);
  }
  return {
    order_id: providerId,
    key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
    amount,
    currency: "INR",
    local_order_id: order.id,
  };
}
export async function processCapture(
  providerId: string,
  paymentId: string,
  expectedId?: string,
  client = gateway(),
) {
  const [remote, payment] = await Promise.all([
    client.orders.fetch(providerId),
    client.payments.fetch(paymentId),
  ]);
  if (
    !remote.receipt ||
    !uuidPattern.test(remote.receipt) ||
    (expectedId && remote.receipt !== expectedId) ||
    payment.order_id !== providerId ||
    payment.id !== paymentId ||
    remote.id !== providerId ||
    remote.currency !== "INR" ||
    payment.currency !== "INR" ||
    Number(payment.amount) !== Number(remote.amount)
  )
    throw new InputError("Payment details do not match the order");
  if (payment.status !== "captured")
    throw new Conflict(
      "Payment is awaiting capture. Check your orders before paying again.",
    );
  return recordCapture(
    remote.receipt,
    providerId,
    paymentId,
    Number(payment.amount),
  );
}
export function paymentError(error: unknown) {
  if (error instanceof InputError || error instanceof SyntaxError)
    return NextResponse.json({ error: error.message }, { status: 400 });
  if (error instanceof Conflict)
    return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof Error && error.message === "Authentication required")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  console.error(
    "Payment operation failed",
    (error as { code?: string })?.code ?? "upstream or database error",
  );
  return NextResponse.json(
    {
      error: "Unable to process payment. Check your order before trying again.",
    },
    { status: 502 },
  );
}
