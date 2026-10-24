import Link from "next/link";

import { AdminShell } from "../../components/store";
import { listAdminOrders, type AdminOrderStatus } from "../../../server/repositories/product.repository";
import { requireVendor } from "../../../server/services/vendor.service";
import { Pagination } from "../../components/Pagination";

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
  const result = await listAdminOrders({ status, from: searchParams.from, to: searchParams.to, page });
  const orders = result.orders;
  const filterQuery = (nextPage: number) => {
    const params = new URLSearchParams();
    if (searchParams.status) params.set("status", searchParams.status);
    if (searchParams.from) params.set("from", searchParams.from);
    if (searchParams.to) params.set("to", searchParams.to);
    if (nextPage > 1) params.set("page", String(nextPage));
    return `/admin/orders?${params}`;
  };
  return <AdminShell><div className="admin-content"><div className="admin-title"><div><p className="eyebrow">Manage</p><h1>Orders</h1><p className="admin-subtitle">{result.total} {result.total === 1 ? "order" : "orders"} found</p></div></div><form className="order-filters" method="get"><label><span>Status</span><select name="status" defaultValue={status ?? ""}>{statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label><span>From date</span><input type="date" name="from" defaultValue={searchParams.from} /></label><label><span>To date</span><input type="date" name="to" defaultValue={searchParams.to} /></label><button className="admin-button" type="submit">Apply filters</button><Link className="table-action" href="/admin/orders">Clear</Link></form><div className="admin-table-wrap"><table className="admin-orders-table"><thead><tr><th>Order</th><th>Items</th><th>Total</th><th>Status</th><th>Action</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td>#{order.id.slice(0, 8).toUpperCase()}<small className="admin-order-date">{new Date(order.createdAt).toLocaleDateString("en-IN")}</small></td><td>{order.items.map((item) => `${item.productName} · Size ${item.size} ×${item.quantity}`).join(", ")}</td><td>₹{Number(order.totalAmount).toLocaleString("en-IN")}</td><td><span className={`status ${order.status}`}>{order.status.replace("_", " ")}</span></td><td><Link className="table-action" href={`/admin/orders/${order.id}`}>View details →</Link></td></tr>)}  </tbody></table>{!orders.length && <p className="empty-state">No orders match these filters.</p>}{orders.length > 0 && <Pagination page={result.page} totalPages={result.totalPages} href={filterQuery} />}</div></div></AdminShell>;
}
