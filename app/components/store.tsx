"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth, useClerk } from "@clerk/nextjs";
import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import { money } from "../lib/format";

export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string;
  description: string;
  images?: Array<{ imageUrl: string; altText: string | null; sortOrder: number }>;
  variants?: Array<{ id?: string; size: string; sku: string; stockQuantity: number }>;
  badge?: string;
};

export type HomeOrder = {
  id: string;
  productName: string;
  totalAmount: number;
  status: string;
  createdAt: string;
};

export const products: Product[] = [
  { id: "indigo-cotton-kurta", name: "Indigo Cotton Kurta", category: "Kurtas", price: 2490, image: "https://images.pexels.com/photos/1926769/pexels-photo-1926769.jpeg?auto=compress&cs=tinysrgb&w=900", description: "A relaxed, everyday kurta in breathable cotton with a hand-finished neckline." },
  { id: "marigold-anarkali-kurta", name: "Marigold Anarkali Kurta", category: "Kurtas", price: 3290, image: "https://images.pexels.com/photos/994523/pexels-photo-994523.jpeg?auto=compress&cs=tinysrgb&w=900", description: "A softly flared silhouette in a warm marigold weave, made for slow celebrations.", badge: "Bestseller" },
  { id: "rose-handloom-saree", name: "Rose Handloom Saree", category: "Sarees", price: 4890, image: "https://images.pexels.com/photos/985635/pexels-photo-985635.jpeg?auto=compress&cs=tinysrgb&w=900", description: "A lightweight handloom saree with a quiet border and an easy, elegant drape." },
  { id: "indigo-ikat-saree", name: "Indigo Ikat Saree", category: "Sarees", price: 5690, image: "https://images.pexels.com/photos/1043474/pexels-photo-1043474.jpeg?auto=compress&cs=tinysrgb&w=900", description: "Traditional ikat texture reimagined in deep indigo for everyday dressing.", badge: "New" },
  { id: "everyday-shell-top", name: "Everyday Shell Top", category: "Tops", price: 1890, image: "https://images.pexels.com/photos/1488463/pexels-photo-1488463.jpeg?auto=compress&cs=tinysrgb&w=900", description: "A versatile shell top cut from soft cotton with a clean, easy neckline." },
  { id: "clay-wrap-top", name: "Clay Wrap Top", category: "Tops", price: 2190, image: "https://images.pexels.com/photos/1755428/pexels-photo-1755428.jpeg?auto=compress&cs=tinysrgb&w=900", description: "A softly structured wrap top in a warm clay tone, finished with fabric ties." }
];

const productCategories: Product["category"][] = ["Kurtas", "Sarees", "Tops"];

const cartQuantityKey = "pebbles-cart-quantity";
const cartItemKey = "pebbles-cart-item";

export type CartItem = {
  productId: string;
  variantId: string;
  name: string;
  size: string;
  sku: string;
  price: number;
  quantity: number;
};

export function useCartCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const syncCount = () => setCount(Number(window.localStorage.getItem(cartQuantityKey) || 0));
    syncCount();
    window.addEventListener("storage", syncCount);
    window.addEventListener("pebbles-cart-updated", syncCount);
    return () => {
      window.removeEventListener("storage", syncCount);
      window.removeEventListener("pebbles-cart-updated", syncCount);
    };
  }, []);

  return count;
}

export function addToCart(quantity = 1) {
  const nextQuantity = Number(window.localStorage.getItem(cartQuantityKey) || 0) + quantity;
  window.localStorage.setItem(cartQuantityKey, String(nextQuantity));
  window.dispatchEvent(new Event("pebbles-cart-updated"));
}

export function setCartQuantity(quantity: number) {
  if (quantity > 0) window.localStorage.setItem(cartQuantityKey, String(quantity));
  else window.localStorage.removeItem(cartQuantityKey);
  window.dispatchEvent(new Event("pebbles-cart-updated"));
}

export function setCartItem(item: CartItem) {
  window.localStorage.setItem(cartItemKey, JSON.stringify(item));
  setCartQuantity(item.quantity);
}

export function CartIcon() {
  return <svg className="cart-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L21 8H6" /><circle cx="10" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></svg>;
}

export function useRequireAuth() {
  const { isLoaded, isSignedIn } = useAuth();
  const { redirectToSignIn } = useClerk();

  return useCallback(async () => {
    if (!isLoaded) return false;
    if (isSignedIn) return true;

    await redirectToSignIn({ redirectUrl: window.location.href });
    return false;
  }, [isLoaded, isSignedIn, redirectToSignIn]);
}

export function AccountLink({ className, children = "Account", "aria-label": ariaLabel }: { className?: string; children?: ReactNode; "aria-label"?: string }) {
  const { isLoaded, isSignedIn } = useAuth();
  const requireAuth = useRequireAuth();

  const openAccount = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();

    if (!(await requireAuth())) return;

    try {
      const response = await fetch("/api/profile");
      if (!response.ok) throw new Error(`Profile lookup failed with status ${response.status}`);
      const profile = await response.json() as { role?: string };
      window.location.href = profile.role === "vendor" ? "/admin" : "/profile";
    } catch (error) {
      console.error("Unable to resolve the signed-in account destination.", error);
      window.location.href = "/profile";
    }
  };

  return <Link className={className} href={isLoaded && isSignedIn ? "/profile" : "/login"} onClick={openAccount} aria-label={ariaLabel}>{children}</Link>;
}

export function SignOutButton() {
  const { signOut } = useClerk();

  return <button className="button dark-button" type="button" onClick={() => void signOut({ redirectUrl: "/" })}>Sign out <span>↗</span></button>;
}

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const count = useCartCount();
  return (
    <>
      <div className="announcement">Free shipping on orders over ₹1,999 <span>✦</span> Easy returns, always</div>
      <header className="site-header">
        <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Open menu">☰</button>
        <Link href="/" className="wordmark"><Image src="/images/pebbles-pebbles-wordmark-black-transparent.svg" alt="Pebbles" width={150} height={53} priority /></Link>
        <nav className={`nav-links ${menuOpen ? "nav-open" : ""}`}>
          <Link href="/products">Shop</Link><Link href="/products?category=Sarees">Collections</Link><Link href="/#story">Our story</Link><Link href="/contact">Contact</Link><AccountLink className="mobile-nav-account" />
        </nav>
        <div className="header-actions"><Link className="search-link" href="/products" aria-label="Search">⌕</Link><AccountLink className="account-link" aria-label="Account">♙</AccountLink><Link className="bag-button" href="/cart" aria-label={`Open cart with ${count} items`}><CartIcon />{count > 0 && <span className="bag-count">{count}</span>}</Link></div>
      </header>
    </>
  );
}

export function SiteFooter() {
  return <footer><div className="footer-top"><Image src="/images/pebbles-pebbles-wordmark-black-transparent.svg" alt="Pebbles" width={130} height={46} /><p>Small joys, thoughtfully made.</p><div className="socials"><a href="#instagram">Instagram</a><a href="#pinterest">Pinterest</a></div></div><div className="footer-bottom"><span>© 2025 Pebbles Studio</span><span>Made with intention in India</span><div><Link href="/contact">Contact</Link><Link href="/orders">Orders</Link><AccountLink /></div></div></footer>;
}

export function StoreShell({ children }: { children: ReactNode }) {
  return <><SiteHeader />{children}<SiteFooter /></>;
}

export function ProductCard({ product }: { product: Product }) {
  return <article className="product-card"><Link href={`/products/${product.id}`} className="product-image product-image-large">{product.badge && <span className="badge">{product.badge}</span>}<button className="heart" aria-label={`Save ${product.name}`} onClick={(event) => event.preventDefault()}>♡</button>{product.image && <img src={product.image} alt={product.name} />}</Link><div className="product-info"><div><p className="eyebrow">{product.category}</p><Link href={`/products/${product.id}`}><h3>{product.name}</h3></Link></div><strong>{money(product.price)}</strong></div></article>;
}

export function HomePage({ products: latestProducts, recentOrders = [] }: { products: Product[]; recentOrders?: HomeOrder[] }) {
  const [activeSlide, setActiveSlide] = useState(0);
  const carouselSlides = [
    { src: "/images/carousel-image-0.png", alt: "The Chanderi Blue Collection" },
    { src: "/images/carousel-image-1.png", alt: "Pebbles clothing and accessories collection" },
    { src: "/images/carousel-image-2.png", alt: "Pebbles new collection" }
  ];
  useEffect(() => {
    const timer = window.setInterval(() => setActiveSlide((slide) => (slide + 1) % carouselSlides.length), 5000);
    return () => window.clearInterval(timer);
  }, [carouselSlides.length]);
  return <><SiteHeader /><section className="hero-carousel" aria-label="Featured collection">{carouselSlides.map((slide, index) => <Image className={`hero-carousel-image ${index === activeSlide ? "active" : ""}`} key={slide.src} src={slide.src} alt={slide.alt} width={1744} height={608} priority={index === 0} />)}</section>{recentOrders.length > 0 && <section className="home-orders section-pad"><div className="section-heading"><div><p className="eyebrow">Your account</p><h2>Recent <em>orders.</em></h2></div><Link className="home-orders-more" href="/orders" aria-label="View all orders">View more <span aria-hidden="true">↗</span></Link></div><div className="home-order-list">{recentOrders.slice(0, 3).map((order) => <Link href={`/orders/${order.id}`} key={order.id}><span>#{order.id.slice(0, 8).toUpperCase()}</span><strong>{order.productName}</strong><span>{money(order.totalAmount)}</span><b className={`status ${order.status}`}>{order.status.replace("_", " ")}</b><span>→</span></Link>)}</div></section>}<section className="categories section-pad" id="collections"><div className="section-heading"><div><p className="eyebrow">Find your kind</p><h2>Explore our <em>world</em></h2></div></div><div className="category-grid"><Link className="category category-large" href="/products?category=Kurtas"><Image src="https://images.unsplash.com/photo-1523381294911-8d3cead13475?auto=format&fit=crop&w=1100&q=85" alt="Kurtas collection" fill sizes="50vw" /><span>Kurtas</span></Link><Link className="category" href="/products?category=Sarees"><Image src="https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=900&q=85" alt="Sarees collection" fill sizes="25vw" /><span>Sarees</span></Link><Link className="category" href="/products?category=Tops"><Image src="https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=900&q=85" alt="Tops collection" fill sizes="25vw" /><span>Tops</span></Link></div></section><section className="collection section-pad" id="shop"><div className="section-heading"><div><p className="eyebrow">Shop the edit</p><h2>Made for <em>every day</em></h2></div><Link className="text-link" href="/products">View all products</Link></div>{latestProducts.length ? <div className="product-grid">{latestProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <p className="empty-state">Products are coming soon.</p>}</section><section className="manifesto"><p className="eyebrow">The Pebbles promise</p><h2>Less, but <em>better.</em></h2><div className="promise-grid"><div><span>01</span><h3>Made to last</h3><p>Thoughtful materials and quiet details that get better with time.</p></div><div><span>02</span><h3>Mindful by default</h3><p>Small batches, responsible choices and no unnecessary extras.</p></div><div><span>03</span><h3>For real life</h3><p>Useful, tactile and made for the beautiful mess of everyday.</p></div></div></section><SiteFooter /></>;
}

export function PageIntro({ eyebrow, title, description }: { eyebrow: string; title: ReactNode; description?: string }) {
  return <section className="page-intro"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p>{description}</p>}</section>;
}

export function ProductListing({ products: listedProducts, category, query, page, totalPages }: { products: Product[]; category?: string; query?: string; page: number; totalPages: number }) {
  const activeCategory = category?.trim().toLowerCase();
  const params = (nextPage: number, nextCategory = category, nextQuery = query) => {
    const search = new URLSearchParams();
    if (nextCategory) search.set("category", nextCategory);
    if (nextQuery) search.set("query", nextQuery);
    if (nextPage > 1) search.set("page", String(nextPage));
    return `/products${search.toString() ? `?${search}` : ""}`;
  };
  return <StoreShell><PageIntro eyebrow="The collection" title={<>Dressed for <em>every day.</em></>} description="Kurtas, sarees and tops made with beautiful textiles and an easy point of view." /><section className="listing-section"><form className="listing-toolbar" action="/products"><div className="filter-buttons">{["All", "Kurtas", "Sarees", "Tops"].map((item) => <Link className={(activeCategory ?? "all") === item.toLowerCase() ? "active" : ""} key={item} href={params(1, item === "All" ? undefined : item)}>{item}</Link>)}</div><input name="query" defaultValue={query} placeholder="Search products..." aria-label="Search products" /><button className="listing-search-button" type="submit">Search</button></form><div className="product-grid product-grid-list">{listedProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div>{!listedProducts.length && <p className="empty-state">No pieces found. Try another search.</p>}{totalPages > 1 && <nav className="pagination" aria-label="Product pages">{Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => <Link className={number === page ? "active" : ""} href={params(number)} key={number}>{number}</Link>)}</nav>}</section></StoreShell>;
}

export function ProductDetail({ product }: { product: Product }) {
  const [added, setAdded] = useState(false);
  const variants = product.variants ?? [];
  const [selectedSize, setSelectedSize] = useState(variants[0]?.size ?? "");
  const selectedVariant = variants.find((variant) => variant.size === selectedSize);
  const requireAuth = useRequireAuth();
  const addProductToCart = async () => {
    if (!(await requireAuth())) return;
    if (!selectedSize || !variants.find((variant) => variant.size === selectedSize && variant.stockQuantity > 0)) return;
    setCartItem({
      productId: product.id,
      variantId: selectedVariant?.id ?? "",
      name: product.name,
      size: selectedSize,
      sku: selectedVariant?.sku ?? "",
      price: product.price,
      quantity: 1
    });
    setAdded(true);
  };
  const gallery = product.images?.length ? product.images : [{ imageUrl: product.image, altText: product.name, sortOrder: 0 }];
  const [selectedImage, setSelectedImage] = useState(gallery[0].imageUrl);
  return <StoreShell><div className="detail-page"><div className="detail-gallery"><div className="detail-image"><img src={selectedImage} alt={product.name} /></div><div className="detail-thumbnails">{gallery.map((image, index) => <button type="button" className={selectedImage === image.imageUrl ? "active" : ""} key={image.imageUrl} onClick={() => setSelectedImage(image.imageUrl)}><img src={image.imageUrl} alt={image.altText ?? `${product.name} image ${index + 1}`} /></button>)}</div></div><div className="detail-copy"><p className="eyebrow">{product.category}</p><h1>{product.name}</h1><p className="detail-price">{money(product.price)}</p><p className="detail-description">{product.description}</p><div className="size-label">Select size <span>Size guide</span></div><div className="size-options" role="radiogroup" aria-label="Available sizes">{variants.map((variant) => <button type="button" role="radio" aria-checked={selectedSize === variant.size} aria-label={`${variant.size}, ${variant.stockQuantity > 0 ? `${variant.stockQuantity} available` : "sold out"}`} key={variant.size} className={`${selectedSize === variant.size ? "active" : ""} ${variant.stockQuantity === 0 ? "sold-out" : ""}`} disabled={variant.stockQuantity === 0} onClick={() => setSelectedSize(variant.size)}><strong>{variant.size}</strong><small>{variant.stockQuantity > 0 ? `${variant.stockQuantity} left` : "Sold out"}</small></button>)}</div>{!variants.length && <p className="form-note">Sizes are currently unavailable.</p>}<button className="button dark-button add-button" disabled={!selectedSize || !variants.find((variant) => variant.size === selectedSize && variant.stockQuantity > 0)} onClick={addProductToCart}>{added ? "Added to cart ✓" : "Add to cart"} <span>↗</span></button><div className="detail-notes"><p><b>Material</b> 100% cotton, naturally dyed</p><p><b>Care</b> Gentle machine wash, dry in shade</p><p><b>Delivery</b> Ships within 2–4 business days</p></div></div></div></StoreShell>;
}

export function SimpleForm({ title, button, children, note }: { title: ReactNode; button: string; children: ReactNode; note?: string }) {
  const [submitted, setSubmitted] = useState(false);
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setSubmitted(true); };
  return <StoreShell><div className="form-page"><p className="eyebrow">Pebbles account</p><h1>{submitted ? "You're all set." : title}</h1>{submitted ? <p className="form-success">Thanks. We&apos;ve received your details.</p> : <form onSubmit={submit}>{children}<button className="button dark-button" type="submit">{button} <span>↗</span></button></form>}{note && <p className="form-note">{note}</p>}</div></StoreShell>;
}

export function Field({ label, name, type = "text", placeholder, defaultValue }: { label: string; name?: string; type?: string; placeholder?: string; defaultValue?: string }) {
  return <label className="field"><span>{label}</span><input name={name} type={type} placeholder={placeholder} defaultValue={defaultValue} required /></label>;
}

export function AdminShell({ children }: { children: ReactNode }) {
  return <div className="admin-layout"><aside className="admin-sidebar"><Link href="/admin" className="admin-brand"><Image src="/images/pebbles-pebbles-wordmark-white-transparent.svg" alt="Pebbles Studio" width={150} height={53} /></Link><nav><p>Overview</p><Link href="/admin">Dashboard</Link><p>Manage</p><Link href="/admin/products">Products</Link><Link href="/admin/categories">Categories</Link><Link href="/admin/orders">Orders</Link><Link href="/admin/customers">Customers</Link></nav><Link href="/" className="back-store">← View storefront</Link></aside><section className="admin-main"><header className="admin-header"><span>Tuesday, 20 October 2026</span><Link href="/login">Admin account ↗</Link></header>{children}</section></div>;
}

export function AdminTable({ type }: { type: "products" | "orders" | "customers" }) {
  const rows = type === "products" ? products.map((product) => [product.name, product.category, money(product.price), "In stock"]) : type === "orders" ? [["#PB-1048", "Ananya Mehta", money(5780), "Processing"], ["#PB-1047", "Riya Shah", money(2490), "Shipped"], ["#PB-1046", "Maya Iyer", money(4890), "Delivered"]] : [["Ananya Mehta", "ananya@example.com", "4 orders", money(12400)], ["Riya Shah", "riya@example.com", "2 orders", money(5780)], ["Maya Iyer", "maya@example.com", "1 order", money(4890)]];
  return <div className="admin-table-wrap"><table><thead><tr>{(type === "products" ? ["Product", "Category", "Price", "Status"] : type === "orders" ? ["Order", "Customer", "Total", "Status"] : ["Customer", "Email", "Orders", "Spent"]).map((heading) => <th key={heading}>{heading}</th>)}<th>Action</th></tr></thead><tbody>{rows.map((row) => <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}<td><button className="table-action">View →</button></td></tr>)}</tbody></table></div>;
}

type AdminProduct = {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: string | null;
  price: string;
  variants: Array<{ id?: string; size: string; sku: string; stockQuantity: number }>;
  images?: Array<{ imageUrl: string; altText: string | null; sortOrder: number }>;
  primaryImageUrl?: string | null;
};

export function ProductAdminTable({ page = 1 }: { page?: number }) {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`/api/admin/products?page=${page}`).then(async (response) => {
      if (!response.ok) throw new Error("Unable to load products");
      const result = await response.json() as { products: AdminProduct[]; totalPages: number };
      setProducts(result.products);
      setTotalPages(result.totalPages);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load products")).finally(() => setLoading(false));
  }, [page]);

  const remove = async (id: string) => {
    if (!window.confirm("Delete this product?")) return;
    const response = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Unable to delete product");
      return;
    }

    setProducts((current) => current.filter((product) => product.id !== id));
  };

  return <div className="admin-table-wrap">{error && <p className="form-error">{error}</p>}{loading ? <div className="table-loading" role="status" aria-live="polite"><div className="loading-mark" aria-hidden="true"><span /><span /><span /></div><p>Loading products...</p></div> : <><table><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Stock by size</th><th>Action</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><div className="admin-product-cell">{product.primaryImageUrl ? <img className="admin-product-thumb" src={product.primaryImageUrl} alt="" /> : <span className="admin-product-thumb admin-product-thumb-empty">—</span>}<span>{product.name}</span></div></td><td>{product.sku}</td><td>{product.category}</td><td>{money(Number(product.price))}</td><td>{product.variants.map((variant) => `${variant.size}: ${variant.stockQuantity}`).join(" · ") || "—"}</td><td><div className="admin-product-actions"><Link className="table-action table-action-edit" href={`/admin/products/${product.id}/edit`}>Edit</Link><button className="table-action table-action-delete" type="button" onClick={() => void remove(product.id)}>Delete</button></div></td></tr>)}</tbody></table>{!products.length && <p className="empty-state">No products yet.</p>}{products.length > 0 && totalPages > 1 && <nav className="pagination" aria-label="Product pages"><Link className={page === 1 ? "disabled" : ""} href={`/admin/products?page=${Math.max(1, page - 1)}`}>Previous</Link>{Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => <Link className={number === page ? "active" : ""} href={`/admin/products?page=${number}`} key={number}>{number}</Link>)}<Link className={page === totalPages ? "disabled" : ""} href={`/admin/products?page=${Math.min(totalPages, page + 1)}`}>Next</Link></nav>}</>}</div>;
}

type AdminOrder = {
  id: string;
  status: string;
  totalAmount: string;
  createdAt: string;
  items: Array<{ productName: string; size: string; quantity: number }>;
};

export function OrderAdminTable({ page = 1, status, from, to }: { page?: number; status?: string; from?: string; to?: string }) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page) });
    if (status) params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    setLoading(true);
    setError("");
    fetch(`/api/admin/orders?${params}`).then(async (response) => {
      if (!response.ok) throw new Error("Unable to load orders");
      const result = await response.json() as { orders: AdminOrder[]; totalPages: number };
      setOrders(result.orders);
      setTotalPages(result.totalPages);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load orders")).finally(() => setLoading(false));
  }, [page, status, from, to]);

  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (nextPage > 1) params.set("page", String(nextPage));
    return `/admin/orders?${params}`;
  };

  return <div className="admin-table-wrap">{error && <p className="form-error">{error}</p>}{loading ? <div className="table-loading" role="status" aria-live="polite"><div className="loading-mark" aria-hidden="true"><span /><span /><span /></div><p>Loading orders...</p></div> : <><table className="admin-orders-table"><thead><tr><th>Order</th><th>Items</th><th>Total</th><th>Status</th><th>Action</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td>#{order.id.slice(0, 8).toUpperCase()}<small className="admin-order-date">{new Date(order.createdAt).toLocaleDateString("en-IN")}</small></td><td>{order.items.map((item) => `${item.productName} · Size ${item.size} ×${item.quantity}`).join(", ")}</td><td>₹{Number(order.totalAmount).toLocaleString("en-IN")}</td><td><span className={`status ${order.status}`}>{order.status.replace("_", " ")}</span></td><td><Link className="table-action" href={`/admin/orders/${order.id}`}>View details →</Link></td></tr>)}</tbody></table>{!orders.length && <p className="empty-state">No orders match these filters.</p>}{orders.length > 0 && totalPages > 1 && <nav className="pagination" aria-label="Order pages"><Link className={page === 1 ? "disabled" : ""} href={pageHref(Math.max(1, page - 1))}>Previous</Link>{Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => <Link className={number === page ? "active" : ""} href={pageHref(number)} key={number}>{number}</Link>)}<Link className={page === totalPages ? "disabled" : ""} href={pageHref(Math.min(totalPages, page + 1))}>Next</Link></nav>}</>}</div>;
}

export function ProductForm({ title, button, product }: { title: string; button: string; product?: AdminProduct }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [variants, setVariants] = useState(() => product?.variants?.length ? product.variants.map(({ size, sku, stockQuantity }) => ({ size, sku, stockQuantity })) : ["S", "M", "L", "XL", "XXL"].map((size) => ({ size, sku: product?.sku ? `${product.sku}-${size}` : "", stockQuantity: 0 })));

  useEffect(() => {
    const nextPreviews = selectedFiles.map((file) => URL.createObjectURL(file));
    setPreviews(nextPreviews);
    return () => nextPreviews.forEach((preview) => URL.revokeObjectURL(preview));
  }, [selectedFiles]);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const validFiles = Array.from(files).filter((file) => file.type.startsWith("image/") && file.size <= 5 * 1024 * 1024);
    if (validFiles.length !== files.length) {
      setError("Images must be image files smaller than 5MB.");
    }
    if (validFiles.length) {
      setSelectedFiles((current) => [...current, ...validFiles]);
    }
  };

  const moveFile = (index: number, direction: -1 | 1) => {
    setSelectedFiles((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const removeFile = (index: number) => {
    setSelectedFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const formData = new FormData(event.currentTarget);
    formData.set("variants", JSON.stringify(variants.filter((variant) => variant.sku.trim())));
    formData.delete("images");
    selectedFiles.forEach((file) => formData.append("images", file));
    try {
      const response = await fetch(product ? `/api/admin/products/${product.id}` : "/api/admin/products", {
        method: product ? "PATCH" : "POST",
        body: formData
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? "Unable to save product");
        setSaving(false);
        return;
      }
      window.location.href = "/admin/products";
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Unable to save product");
      setSaving(false);
    }
  };

  return <div className="admin-content product-editor"><div><p className="eyebrow">Products</p><h1>{title}</h1>{error && <p className="form-error">{error}</p>}<form className="admin-form" onSubmit={submit}><Field name="name" label="Product name" defaultValue={product?.name} /><Field name="sku" label="SKU" defaultValue={product?.sku} /><div className="field-row"><label className="field"><span>Category</span><select name="category" defaultValue={product?.category ?? ""} required><option value="" disabled>Select a category</option>{productCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label><Field name="price" label="Price (₹)" defaultValue={product?.price} /></div><label className="field"><span>Description</span><textarea name="description" rows={5} defaultValue={product?.description} required /></label>{product?.images && product.images.length > 0 && <div className="image-order-list"><span className="image-order-label">Current image order</span>{product.images.map((image, index) => <div className="image-order-item" key={image.imageUrl}><span>{index + 1}</span><span>{image.altText || "Product image"}</span></div>)}</div>}<label className="upload-box" htmlFor="product-images">＋<span>Add product images</span><small>PNG or JPG up to 5MB; choose multiple files</small><input id="product-images" name="images" type="file" accept="image/*" multiple onChange={(event) => { addFiles(event.target.files); event.currentTarget.value = ""; }} /></label>{selectedFiles.length > 0 && <div className="selected-images"><span className="image-order-label">New image order</span><div className="image-preview-grid">{selectedFiles.map((file, index) => <div className="image-preview" key={`${file.name}-${file.lastModified}-${index}`}><img src={previews[index]} alt="" /><div className="image-preview-meta"><strong>{index + 1}. {file.name}</strong><div><button type="button" onClick={() => moveFile(index, -1)} disabled={index === 0} aria-label={`Move ${file.name} up`}>↑</button><button type="button" onClick={() => moveFile(index, 1)} disabled={index === selectedFiles.length - 1} aria-label={`Move ${file.name} down`}>↓</button><button type="button" onClick={() => removeFile(index)} aria-label={`Remove ${file.name}`}>×</button></div></div></div>)}</div></div>}<button className="admin-button" type="submit" disabled={saving}>{saving ? "Saving..." : button} →</button></form></div>  <aside className="stock-manager"><p className="eyebrow">Inventory</p><h2>Manage stocks</h2><p>Set independent stock and SKU values for each available size.</p>{variants.map((variant, index) => <div className="variant-row" key={variant.size}><strong>{variant.size}</strong><input aria-label={`${variant.size} SKU`} placeholder="Variant SKU" value={variant.sku} onChange={(event) => setVariants((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, sku: event.target.value } : item))} /><input aria-label={`${variant.size} stock quantity`} type="number" min="0" step="1" value={variant.stockQuantity} onChange={(event) => setVariants((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, stockQuantity: Math.max(0, Number(event.target.value) || 0) } : item))} /></div>)}<p className="form-note">Leave a SKU blank to omit that size. Customer pages show availability automatically.</p></aside></div>;
}
