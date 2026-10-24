import { AdminShell } from "../../components/store";
import Link from "next/link";
import { listProductCategories } from "../../../server/repositories/product.repository";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await listProductCategories();
  return <AdminShell><div className="admin-content"><div className="admin-title"><div><p className="eyebrow">Manage</p><h1>Categories</h1></div></div><div className="category-admin-list">{categories.map((category) => <div key={category.name}><b>{category.name}</b><span>{category.productCount} {category.productCount === 1 ? "product" : "products"}</span><Link href={`/products?category=${encodeURIComponent(category.name)}`}>View products →</Link></div>)}{!categories.length && <p className="empty-state">No product categories yet.</p>}</div></div></AdminShell>;
}
