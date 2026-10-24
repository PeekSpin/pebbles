import Link from "next/link";

import { StoreShell } from "../../components/store";
import { money } from "../../lib/format";
import PayPendingOrder from "./PayPendingOrder";
import { findUserOrder } from "../../../server/repositories/product.repository";
import { ensureUserProfile } from "../../../server/services/user.service";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  pending_payment: "Payment pending",
  confirmed: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled"
};

const statusSteps = ["confirmed", "shipped", "delivered"];

export default async function OrderDetailsPage({ params }: { params: { id: string } }) {
  const profile = await ensureUserProfile();
  const order = await findUserOrder(params.id, profile.id);
  if (!order) return <StoreShell><div className="account-page"><p className="empty-state">Order not found.</p></div></StoreShell>;
  const activeStep = statusSteps.indexOf(order.status);
  const statusMessage = order.status === "pending_payment" ? "Complete payment to confirm this order." : order.status === "confirmed" ? "Your payment was confirmed and your order is being prepared." : order.status === "shipped" ? "Your order is on its way." : order.status === "delivered" ? "Your order has been delivered." : "This order has been cancelled.";
  return <StoreShell><div className="account-page order-detail-page"><Link href="/orders" className="back-link">← All orders</Link><p className="eyebrow">Order details</p><h1>Order <em>#{order.id.slice(0, 8).toUpperCase()}</em></h1><div className="order-status"><span className={`status ${order.status}`}>{statusLabels[order.status] ?? order.status}</span><p>{statusMessage}</p>{order.status === "pending_payment" && <PayPendingOrder orderId={order.id} amount={Number(order.totalAmount)} description={order.items[0] ? `${order.items[0].productName} · Size ${order.items[0].sku}` : "Pebbles order"} />}{order.status !== "cancelled" && <div className="timeline">{statusSteps.map((step, index) => <span className={index <= activeStep ? "done" : ""} key={step}>{statusLabels[step]}</span>)}</div>}</div><div className="order-detail-grid"><div><h2>Items</h2>{order.items.map((item) => <p key={item.id}><b>{item.productName}</b><br />Size {item.size} · SKU {item.sku} · Quantity {item.quantity}<br />{money(Number(item.unitPrice) * item.quantity)}</p>)}</div><div><h2>Delivery address</h2><p>{order.address?.recipientName}<br />{order.address?.addressLine1}<br />{order.address?.city}, {order.address?.pincode}<br />Phone: {order.address?.phone}</p><p><b>Total</b><br />{money(Number(order.totalAmount))}</p></div></div></div></StoreShell>;
}
