import { NextResponse } from "next/server";

import { findAdminOrder, updateOrderStatus, type AdminOrderStatus } from "../../../../../server/repositories/product.repository";
import { requireVendor } from "../../../../../server/services/vendor.service";

const statuses: AdminOrderStatus[] = ["pending_payment", "confirmed", "shipped", "delivered", "cancelled"];

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  await requireVendor();
  const body = await request.json() as { status?: string };
  if (!body.status || !statuses.includes(body.status as AdminOrderStatus)) {
    return NextResponse.json({ error: "Invalid order status" }, { status: 400 });
  }
  const order = await updateOrderStatus(params.id, body.status as AdminOrderStatus);
  return order ? NextResponse.json(order) : NextResponse.json({ error: "Order not found" }, { status: 404 });
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await requireVendor();
  const order = await findAdminOrder(params.id);
  return order ? NextResponse.json(order) : NextResponse.json({ error: "Order not found" }, { status: 404 });
}
