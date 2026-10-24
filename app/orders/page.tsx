import Link from "next/link";

import { StoreShell } from "../components/store";
import { money } from "../lib/format";
import { listUserOrders } from "../../server/repositories/product.repository";
import { ensureUserProfile } from "../../server/services/user.service";
import { Pagination } from "../components/Pagination";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  pending_payment: "Payment pending",
  confirmed: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled"
};

export default async function OrdersPage({ searchParams }: { searchParams: { page?: string } }) {
  const profile = await ensureUserProfile();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const result = await listUserOrders(profile.id, { page });
  const orders = result.orders;
  return <StoreShell><div className="account-page"><div className="account-page-heading"><div><p className="eyebrow">Your account</p><h1>My <em>orders.</em></h1></div><Link href="/profile" className="text-link">Back to profile</Link></div>{!orders.length ? <div className="empty-cart"><h2>No orders yet.</h2><p>Your purchases and delivery updates will appear here.</p><Link href="/products" className="button dark-button">Continue shopping <span>↗</span></Link></div> : <><div className="order-list"><div className="order-list-heading"><span>Order</span><span>Item / size</span><span>Total</span><span>Status</span></div>{orders.map((order) => <Link href={`/orders/${order.id}`} key={order.id}><span>#{order.id.slice(0, 8).toUpperCase()}<small>{new Date(order.createdAt).toLocaleDateString("en-IN")}</small></span><strong>{order.items[0]?.productName ?? "Pebbles order"}{order.items[0]?.size && <small>Size {order.items[0].size}</small>}{order.items.length > 1 && <small>+ {order.items.length - 1} more item{order.items.length > 2 ? "s" : ""}</small>}</strong><span>{money(Number(order.totalAmount))}</span><b className={`status ${order.status}`}>{statusLabels[order.status] ?? order.status}</b><span>→</span></Link>)}</div><Pagination page={result.page} totalPages={result.totalPages} href={(nextPage) => `/orders?page=${nextPage}`} /></>}</div></StoreShell>;
}
