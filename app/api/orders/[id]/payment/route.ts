import { NextResponse } from "next/server";
import Razorpay from "razorpay";

import { findUserOrder, hasOrderItemsInStock } from "../../../../../server/repositories/product.repository";
import { ensureUserProfile } from "../../../../../server/services/user.service";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const profile = await ensureUserProfile();
    const order = await findUserOrder(params.id, profile.id);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.status !== "pending_payment") return NextResponse.json({ error: "This order does not need payment" }, { status: 409 });
    if (!(await hasOrderItemsInStock(order.id))) {
      return NextResponse.json({ error: "One or more items in this order are no longer available" }, { status: 409 });
    }
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.error("Razorpay credentials are not configured.");
      return NextResponse.json({ error: "Payment service is not configured" }, { status: 500 });
    }
    const amount = Math.round(Number(order.totalAmount) * 100);
    if (amount < 100) return NextResponse.json({ error: "Order amount must be at least ₹1" }, { status: 400 });
    const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
    const paymentOrder = await razorpay.orders.create({ amount, currency: "INR", receipt: order.id });
    return NextResponse.json({ order_id: paymentOrder.id, amount, currency: "INR" });
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("Unable to create retry payment order.", error);
    return NextResponse.json({ error: "Unable to create payment order" }, { status: 502 });
  }
}
