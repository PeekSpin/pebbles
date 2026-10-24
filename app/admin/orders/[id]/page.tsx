import Link from "next/link";

import { AdminShell } from "../../../components/store";
import { OrderStatusForm } from "../OrderStatusForm";
import { findAdminOrder } from "../../../../server/repositories/product.repository";
import { requireVendor } from "../../../../server/services/vendor.service";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailsPage({ params }: { params: { id: string } }) {
  await requireVendor();
  const order = await findAdminOrder(params.id);
  if (!order) return <AdminShell><div className="admin-content"><p className="empty-state">Order not found.</p></div></AdminShell>;
  return <AdminShell><div className="admin-content order-detail-layout"><Link href="/admin/orders" className="back-link">← Back to all orders</Link><p className="eyebrow">Order details</p><h1>#{order.id.slice(0, 8).toUpperCase()}</h1><div className="admin-order-card"><div><span>Customer</span><b>{order.customer?.name ?? "Customer"}</b><small>{order.customer?.email ?? "No email available"}</small></div><div><span>Total</span><b>₹{Number(order.totalAmount).toLocaleString("en-IN")}</b><small>Placed {new Date(order.createdAt).toLocaleString("en-IN")}</small></div><div><span>Current status</span><b className={`status ${order.status}`}>{order.status.replace("_", " ")}</b></div></div><div className="order-detail-grid"><div className="admin-detail-panel"><h2>Items</h2>{order.items.map((item) => <p key={item.id}><b>{item.productName}</b>  <br />Size {item.size} · SKU {item.sku} · Quantity {item.quantity}<br />₹{(Number(item.unitPrice) * item.quantity).toLocaleString("en-IN")}</p>)}</div><div className="admin-detail-panel"><h2>Delivery address</h2><p>{order.address?.recipientName}<br />{order.address?.addressLine1}<br />{order.address?.city}, {order.address?.pincode}<br />Phone: {order.address?.phone}</p></div></div><OrderStatusForm orderId={order.id} initialStatus={order.status} /></div></AdminShell>;
}
