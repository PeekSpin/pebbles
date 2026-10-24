import Link from "next/link";

import { AdminShell } from "../components/store";
import { money } from "../lib/format";
import { getAdminDashboard } from "../../server/repositories/product.repository";
import { requireVendor } from "../../server/services/vendor.service";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireVendor();
  const dashboard = await getAdminDashboard();
  return <AdminShell><div className="admin-content"><div className="admin-title"><div><p className="eyebrow">Overview</p><h1>Good morning, <em>studio.</em></h1><p className="admin-subtitle">A live view of your store performance.</p></div><Link className="admin-button" href="/admin/products/new">+ Add product</Link></div><div className="metric-grid"><div><span>Total sales</span><strong>{money(dashboard.totalSales)}</strong><small>Confirmed orders</small></div><div><span>Orders</span><strong>{dashboard.orderCount}</strong><small>{dashboard.recentOrders.filter((order) => order.status === "pending_payment").length} awaiting payment</small></div><div><span>Products</span><strong>{dashboard.productCount}</strong><small>{dashboard.lowStockCount} sizes low in stock</small></div><div><span>Customers</span><strong>{dashboard.customerCount}</strong><small>Registered customers</small></div></div><div className="dashboard-grid"><section className="admin-panel"><div className="panel-heading"><h2>Recent orders</h2><Link href="/admin/orders">View all →</Link></div>{dashboard.recentOrders.length ? <div className="mini-orders">{dashboard.recentOrders.map((order) => <p key={order.id}><span>#{order.id.slice(0, 8).toUpperCase()}</span><b>{order.items[0]?.productName ?? "Pebbles order"}</b><i className={`status ${order.status}`}>{order.status.replace("_", " ")}</i></p>)}</div> : <p className="empty-state">No orders yet.</p>}</section><section className="admin-panel"><div className="panel-heading"><h2>Top products</h2><Link href="/admin/products">View all →</Link></div>{dashboard.topProducts.length ? dashboard.topProducts.map((product, index) => <div className="top-product" key={product.name}><span>{String(index + 1).padStart(2, "0")}</span><b>{product.name}</b><strong>{product.sold} sold</strong></div>) : <p className="empty-state">No completed sales yet.</p>}</section></div></div></AdminShell>;
}
