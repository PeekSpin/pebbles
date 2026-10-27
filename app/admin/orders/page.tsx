import Link from "next/link";

import { AdminShell, OrderAdminTable } from "../../components/store";
import { type AdminOrderStatus } from "../../../server/repositories/product.repository";
import { requireVendor } from "../../../server/services/vendor.service";

export const dynamic = "force-dynamic";

const statuses: Array<{ value: AdminOrderStatus | ""; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "pending_payment", label: "Pending payment" },
  { value: "confirmed", label: "Confirmed" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" }
];

export default async function AdminOrdersPage({ searchParams }: { searchParams: { status?: string; from?: string; to?: string; page?: string } }) {
  await requireVendor();
  const status = statuses.some((item) => item.value === searchParams.status) ? searchParams.status as AdminOrderStatus : undefined;
  const page = Math.max(1, Number(searchParams.page) || 1);
  return <AdminShell><div className="admin-content"><div className="admin-title"><div><p className="eyebrow">Manage</p><h1>Orders</h1><p className="admin-subtitle">Manage customer orders</p></div></div><form className="order-filters" method="get"><label><span>Status</span><select className="admin-select" name="status" defaultValue={status ?? ""}>{statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label><span>From date</span><input type="date" name="from" defaultValue={searchParams.from} /></label><label><span>To date</span><input type="date" name="to" defaultValue={searchParams.to} /></label><div className="filter-actions"><button className="admin-button" type="submit">Apply filters <span>→</span></button><Link className="filter-clear" href="/admin/orders">Clear all</Link></div></form><OrderAdminTable page={page} status={status} from={searchParams.from} to={searchParams.to} /></div></AdminShell>;
}
