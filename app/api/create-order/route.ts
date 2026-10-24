import { NextResponse } from "next/server";
import Razorpay from "razorpay";

import { createPendingOrder, findProduct } from "../../../server/repositories/product.repository";
import { ensureUserProfile } from "../../../server/services/user.service";

export async function POST(request: Request) {
  try {
    const profile = await ensureUserProfile();
    const body = await request.json() as {
      productId?: string;
      variantId?: string;
      quantity?: number;
      address?: { recipientName?: string; phone?: string; addressLine1?: string; city?: string; pincode?: string };
    };
    const quantity = body.quantity ?? 1;
    if (!body.productId || !body.variantId || !Number.isInteger(quantity) || quantity < 1 || !body.address?.recipientName || !body.address.phone || !body.address.addressLine1 || !body.address.city || !body.address.pincode) {
      return NextResponse.json({ error: "Missing or invalid order details" }, { status: 400 });
    }
    const product = await findProduct(body.productId);
    const variant = product?.variants.find((item) => item.id === body.variantId);
    if (!product || !variant) return NextResponse.json({ error: "Product variant not found" }, { status: 400 });
    if (variant.stockQuantity < quantity) return NextResponse.json({ error: "Insufficient stock for selected size" }, { status: 409 });

    const shippingAmount = 0;
    const amount = Math.round(Number(product.price) * quantity * 100);
    if (amount < 100) return NextResponse.json({ error: "Order amount must be at least ₹1" }, { status: 400 });
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.error("Razorpay credentials are not configured.");
      return NextResponse.json({ error: "Payment service is not configured" }, { status: 500 });
    }
    const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
    const order = await createPendingOrder({
      userId: profile.id,
      productId: product.id,
      productName: product.name,
      variantId: variant.id,
      size: variant.size,
      sku: variant.sku,
      quantity,
      unitPrice: product.price,
      shippingAmount: shippingAmount.toFixed(2),
      address: {
        recipientName: body.address.recipientName,
        phone: body.address.phone,
        addressLine1: body.address.addressLine1,
        city: body.address.city,
        pincode: body.address.pincode
      }
    });
    try {
      const razorpayOrder = await razorpay.orders.create({
        amount,
        currency: "INR",
        receipt: order.id
      });
      return NextResponse.json({ order_id: razorpayOrder.id, amount, currency: "INR", local_order_id: order.id });
    } catch (error) {
      console.error("Unable to create Razorpay order.", error);
      return NextResponse.json({ error: "Unable to create payment order" }, { status: 502 });
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error instanceof Error && error.message === "Insufficient stock for selected size") return NextResponse.json({ error: error.message }, { status: 409 });
    console.error("Unable to create order.", error);
    return NextResponse.json({ error: "Unable to create order" }, { status: 500 });
  }
}
