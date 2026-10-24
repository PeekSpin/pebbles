import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import Razorpay from "razorpay";

import { confirmOrderPayment, findOrderForUser } from "../../../server/repositories/product.repository";
import { ensureUserProfile } from "../../../server/services/user.service";

export async function POST(request: Request) {
  try {
    const profile = await ensureUserProfile();
    const body = await request.json() as {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
      local_order_id?: string;
    };
    if (!body.razorpay_order_id || !body.razorpay_payment_id || !body.razorpay_signature || !body.local_order_id || !process.env.RAZORPAY_KEY_SECRET) {
      return NextResponse.json({ error: "Missing payment verification fields" }, { status: 400 });
    }
    const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${body.razorpay_order_id}|${body.razorpay_payment_id}`)
      .digest("hex");
    const expectedBuffer = Buffer.from(expected, "utf8");
    const receivedBuffer = Buffer.from(body.razorpay_signature, "utf8");
    if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
      return NextResponse.json({ error: "Payment signature verification failed" }, { status: 400 });
    }
    const pendingOrder = await findOrderForUser(body.local_order_id, profile.id);
    if (!pendingOrder) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return NextResponse.json({ error: "Payment service is not configured" }, { status: 500 });
    }
    const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
    const razorpayOrder = await razorpay.orders.fetch(body.razorpay_order_id);
    if (razorpayOrder.receipt !== body.local_order_id || Number(razorpayOrder.amount) !== Math.round(Number(pendingOrder.totalAmount) * 100)) {
      return NextResponse.json({ error: "Payment order does not match this purchase" }, { status: 400 });
    }
    const result = await confirmOrderPayment({
      orderId: body.local_order_id,
      paymentId: body.razorpay_payment_id,
      amount: pendingOrder.totalAmount
    });
    return NextResponse.json({ success: true, order_id: result.order.id });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error instanceof Error && error.message === "Insufficient stock for selected size") return NextResponse.json({ error: error.message }, { status: 409 });
    console.error("Unable to verify payment.", error);
    return NextResponse.json({ error: "Unable to verify payment" }, { status: 500 });
  }
}
