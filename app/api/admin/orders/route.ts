import { NextResponse } from "next/server";

import { listAdminOrders, type AdminOrderStatus } from "../../../../server/repositories/product.repository";
import { requireVendor } from "../../../../server/services/vendor.service";

export const dynamic = "force-dynamic";

const statuses: AdminOrderStatus[] = ["confirmed", "shipped", "delivered", "pending_payment", "cancelled"];

export async function GET(request: Request) {
  try {
    await requireVendor();
    const params = new URL(request.url).searchParams;
    const status = params.get("status");
    const page = Math.max(1, Number(params.get("page")) || 1);
    return NextResponse.json(await listAdminOrders({
      status: status && statuses.includes(status as AdminOrderStatus) ? status as AdminOrderStatus : undefined,
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
      page
    }));
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error instanceof Error && error.message === "Vendor access required") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Unable to load admin orders.", error);
    return NextResponse.json({ error: "Unable to load orders" }, { status: 500 });
  }
}
