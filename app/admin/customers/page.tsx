import { AdminShell } from "../../components/store";
import { money } from "../../lib/format";
import { listAdminCustomers } from "../../../server/repositories/user.repository";
import { requireVendor } from "../../../server/services/vendor.service";
import { Pagination } from "../../components/Pagination";

export const dynamic = "force-dynamic";

export default async function CustomersPage({ searchParams }: { searchParams: { page?: string } }) {
  await requireVendor();
  const result = await listAdminCustomers({ page: Math.max(1, Number(searchParams.page) || 1) });
  const customers = result.customers;
  return <AdminShell><div className="admin-content"><div className="admin-title"><div><p className="eyebrow">Manage</p><h1>Customers</h1><p className="admin-subtitle">{result.total} registered {result.total === 1 ? "customer" : "customers"}</p></div></div><div className="admin-table-wrap"><table><thead><tr><th>Customer</th><th>Email</th><th>Orders</th><th>Spent</th><th>Joined</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.id}><td>{customer.name ?? "Unnamed customer"}</td><td>{customer.email ?? "—"}</td><td>{customer.orderCount}</td><td>{money(customer.totalSpent)}</td><td>{new Date(customer.createdAt).toLocaleDateString("en-IN")}</td></tr>)}</tbody></table>{!customers.length && <p className="empty-state">No customers yet.</p>}{customers.length > 0 && <Pagination page={result.page} totalPages={result.totalPages} href={(page) => `/admin/customers?page=${page}`} />}</div></div></AdminShell>;
}
