"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth, useClerk } from "@clerk/nextjs";
import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { mergeItem,updateCart } from "../lib/cart";
import {useCart} from "../lib/use-cart";
import {chooseColor, chooseSize} from "../lib/catalog-selection";
import { money } from "../lib/format";
import { normalizeProductCategory, productCategories } from "../lib/product-categories";

import { ScrollEditorial } from "./ScrollEditorial";
import { ShopByVideo } from "./ShopByVideo";
import { GoogleReviews } from "./GoogleReviews";
import { WearOurStory } from "./WearOurStory";
import { HeaderButterfly } from "./HeaderButterfly";

export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string;
  description: string;
  colorName?: string | null;
  colorHex?: string | null;
  isPreorder?: boolean;
  images?: Array<{ id?: string; imageUrl: string; storageKey?: string; altText: string | null; sortOrder: number }>;
  variants?: Array<{ id?: string; size: string; sku: string; stockQuantity: number }>;
  colors?: Array<{
    id: string;
    name: string;
    hex: string | null;
    images: NonNullable<Product["images"]>;
    variants: Array<{ id: string; sku: string; size: string; stockQuantity: number; priceOverride: string | null }>;
  }>;
  badge?: string;
};

export const products: Product[] = [
  { id: "indigo-cotton-kurta", name: "Indigo Cotton Kurta", category: "Kurtis", price: 2490, image: "https://images.pexels.com/photos/1926769/pexels-photo-1926769.jpeg?auto=compress&cs=tinysrgb&w=900", description: "A relaxed, everyday kurta in breathable cotton with a hand-finished neckline." },
  { id: "marigold-anarkali-kurta", name: "Marigold Anarkali Kurta", category: "Kurtis", price: 3290, image: "https://images.pexels.com/photos/994523/pexels-photo-994523.jpeg?auto=compress&cs=tinysrgb&w=900", description: "A softly flared silhouette in a warm marigold weave, made for slow celebrations.", badge: "Bestseller" },
  { id: "rose-handloom-saree", name: "Rose Handloom Saree", category: "Sarees", price: 4890, image: "https://images.pexels.com/photos/985635/pexels-photo-985635.jpeg?auto=compress&cs=tinysrgb&w=900", description: "A lightweight handloom saree with a quiet border and an easy, elegant drape." },
  { id: "indigo-ikat-saree", name: "Indigo Ikat Saree", category: "Sarees", price: 5690, image: "https://images.pexels.com/photos/1043474/pexels-photo-1043474.jpeg?auto=compress&cs=tinysrgb&w=900", description: "Traditional ikat texture reimagined in deep indigo for everyday dressing.", badge: "New" },
  { id: "everyday-shell-top", name: "Everyday Shell Top", category: "Tops", price: 1890, image: "https://images.pexels.com/photos/1488463/pexels-photo-1488463.jpeg?auto=compress&cs=tinysrgb&w=900", description: "A versatile shell top cut from soft cotton with a clean, easy neckline." },
  { id: "clay-wrap-top", name: "Clay Wrap Top", category: "Tops", price: 2190, image: "https://images.pexels.com/photos/1755428/pexels-photo-1755428.jpeg?auto=compress&cs=tinysrgb&w=900", description: "A softly structured wrap top in a warm clay tone, finished with fabric ties." }
];

function useCartCount() {
  return useCart().reduce((count,line)=>count+line.quantity,0);
}

export function CartIcon() {
  return <svg className="cart-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L21 8H6" /><circle cx="10" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></svg>;
}

function SearchIcon() {
  return <svg className="header-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>;
}

function AccountIcon() {
  return <svg className="header-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.7-3.5 3.1-5.3 7-5.3s6.3 1.8 7 5.3" /></svg>;
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
  const { redirectToSignIn } = useClerk();

  const openAccount = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isLoaded) return;
    event.preventDefault();

    if (!isSignedIn) {
      await redirectToSignIn({ redirectUrl: window.location.href });
      return;
    }

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

  return <Link className={className} href={isSignedIn ? "/profile" : "/login"} onClick={openAccount} aria-label={ariaLabel}>{children}</Link>;
}

export function SignOutButton() {
  const { signOut } = useClerk();

  return <button className="button dark-button" type="button" onClick={() => void signOut({ redirectUrl: "/" })}>Sign out <span>↗</span></button>;
}

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const count = useCartCount();
  const headerRef = useRef<HTMLElement>(null);
  const menuAnchorRef = useRef<HTMLSpanElement>(null);
  const cartAnchorRef = useRef<HTMLSpanElement>(null);
  return (
    <>
      <div className="announcement">Free shipping on orders over ₹1,999 <span>✦</span> Easy returns, always</div>
      <header className="site-header" ref={headerRef}>
        <div className="header-menu-zone"><button className="mobile-menu" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen}>☰</button><span className="butterfly-anchor" ref={menuAnchorRef} aria-hidden="true" /></div>
        <Link href="/" className="wordmark" aria-label="Pebbles Boutique home"><Image className="wordmark-name" src="/images/pebbles-pebbles-wordmark-black-transparent.svg" alt="Pebbles" width={150} height={53} priority /></Link>
        <nav className={`nav-links ${menuOpen ? "nav-open" : ""}`}>
          <Link href="/products">Shop</Link><Link href="/products?category=Sarees">Collections</Link><Link href="/about">About us</Link><Link href="/contact">Contact</Link><Link href="/orders">Orders</Link><AccountLink className="mobile-nav-account" />
        </nav>
        <div className="header-actions"><Link className="search-link" href="/products" aria-label="Search"><SearchIcon /></Link><AccountLink className="account-link" aria-label="Account"><AccountIcon /></AccountLink><span className="butterfly-anchor" ref={cartAnchorRef} aria-hidden="true" /><Link className="bag-button" href="/cart" aria-label={`Open cart with ${count} items`}><CartIcon />{count > 0 && <span className="bag-count">{count}</span>}</Link></div>
        <HeaderButterfly headerRef={headerRef} menuAnchorRef={menuAnchorRef} cartAnchorRef={cartAnchorRef} />
      </header>
    </>
  );
}

function BottomNavIcon({ type }: { type: "shop" | "search" | "orders" | "account" | "bag" }) {
  if (type === "shop") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h16v10H4zM3 10l2-6h14l2 6M8 14v6M16 14v6" /></svg>;
  if (type === "search") return <SearchIcon />;
  if (type === "orders") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" /></svg>;
  if (type === "account") return <AccountIcon />;
  return <CartIcon />;
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const count = useCartCount();
  const isProductsPage = pathname === "/products";
  const items = [
    { href: "/", label: "Shop", type: "shop" as const, active: pathname === "/" },
    { href: "/products", label: "Search", type: "search" as const, active: isProductsPage && !searchParams.has("category") },
    { href: "/orders", label: "Orders", type: "orders" as const, active: pathname.startsWith("/orders") },
    { href: "/profile", label: "Account", type: "account" as const, active: pathname.startsWith("/profile") },
    { href: "/cart", label: "Bag", type: "bag" as const, active: pathname.startsWith("/cart") }
  ];
  return <nav className="mobile-bottom-nav" aria-label="Primary navigation">{items.map((item) => <Link className={item.active ? "active" : ""} href={item.href} key={item.label} aria-current={item.active ? "page" : undefined}><span className="bottom-nav-icon"><BottomNavIcon type={item.type} />{item.type === "bag" && count > 0 && <b>{count}</b>}</span><span>{item.label}</span></Link>)}</nav>;
}

const footerPaymentMethods = [
  { name: "Visa", src: "/images/payment-methods/visa.svg" },
  { name: "UPI", src: "/images/payment-methods/upi.svg" },
  { name: "Mastercard", src: "/images/payment-methods/mastercard.svg" },
  { name: "Google Pay", src: "/images/payment-methods/google-pay.svg" }
];

function FooterPaymentMethods() {
  return <div className="footer-payments" role="group" aria-label="Accepted payment methods">{footerPaymentMethods.map((method) => <span className="footer-payment-mark" key={method.name}><Image src={method.src} alt={method.name} width={42} height={24} unoptimized /></span>)}</div>;
}

export function SiteFooter() {
  return <footer><div className="footer-top"><Image src="/images/pebbles-pebbles-wordmark-black-transparent.svg" alt="Pebbles" width={130} height={46} /><p>Small joys, thoughtfully made.</p><div className="socials"><a href="https://www.instagram.com/pebblesboutique2024" target="_blank" rel="noreferrer">Instagram</a><a href="https://www.facebook.com/share/1DsHE4o6HT/" target="_blank" rel="noreferrer">Facebook</a></div></div><div className="footer-bottom"><span>© 2025 Pebbles Boutique</span><div className="footer-links"><Link href="/contact">Contact</Link><Link href="/terms-and-conditions">Terms &amp; Conditions</Link><Link href="/orders">Orders</Link><AccountLink /></div><address className="footer-address"><strong className="footer-address-heading">Store Address</strong>Pebbles Boutique, laksham veedu junction, Kulakkada, Keralam 691521</address></div><FooterPaymentMethods /></footer>;
}

export function StoreShell({ children }: { children: ReactNode }) {
  return <><SiteHeader />{children}<SiteFooter /><MobileBottomNav /></>;
}

export function ProductCard({ product, color, size }: { product: Product; color?: string; size?: string }) {
  const swatch = chooseColor(product.colors ?? [], color, size);
  const variant = chooseSize(swatch?.variants ?? [], size);
  const image = swatch ? swatch.images[0]?.imageUrl : product.image;
  const price = Number(variant?.priceOverride ?? product.price);
  const query = new URLSearchParams();
  if (swatch && (color || size)) query.set("color", swatch.id);
  if (size && variant) query.set("size", variant.size);
  const href = "/products/" + product.id + (query.size ? "?" + query : "");
  return <article className="product-card"><div className="product-image product-image-large">{(product.isPreorder || product.badge) && <span className="badge">{product.isPreorder ? "Pre-order" : product.badge}</span>}<Link href={href} className="product-image-link" aria-label={`View ${product.name}`}>{image && <img src={image} alt={product.name} />}</Link><button className="heart" type="button" aria-label={`Save ${product.name}`} onClick={() => undefined}>♡</button></div><div className="product-info"><div><p className="eyebrow">{product.category}</p><Link href={href}><h3>{product.name}</h3></Link></div><strong>{money(price)}</strong></div></article>;
}

function PromiseIcon({ type }: { type: "returns" | "shipping" | "payment" }) {
  if (type === "returns") {
    return <svg className="promise-icon" viewBox="0 0 64 64" aria-hidden="true"><path d="M47 25a17 17 0 0 0-29-7l-5 5M13 14v9h9M17 39a17 17 0 0 0 29 7l5-5M51 50v-9h-9" /></svg>;
  }

  if (type === "shipping") {
    return <svg className="promise-icon" viewBox="0 0 64 64" aria-hidden="true"><path d="M7 19h32v24H7zM39 27h10l8 9v7H39" /><circle cx="19" cy="46" r="5" /><circle cx="48" cy="46" r="5" /></svg>;
  }

  return <svg className="promise-icon" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 7 50 14v16c0 13-7 21-18 27-11-6-18-14-18-27V14L32 7Z" /><rect x="25" y="28" width="14" height="13" rx="2" /><path d="M28 28v-4a4 4 0 0 1 8 0v4" /></svg>;
}

export function HomePage({ products: latestProducts }: { products: Product[] }) {
  const [activeSlide, setActiveSlide] = useState(0);
  const carouselSlides = [
    { src: "/images/carousel-image-0.png", alt: "The Chanderi Blue Collection", width: 1744, height: 608, fit: "cover" },
    { src: "/images/carousel-image-1.png", alt: "Pebbles clothing and accessories collection", width: 1744, height: 608, fit: "cover" },
    { src: "/images/carousel-image-2.png", alt: "Pebbles new collection", width: 1744, height: 608, fit: "cover" },
    { src: "/images/Pebbles_Boutique_Lavender_Fashion_Banner.png", alt: "Pebbles Boutique lavender fashion collection", width: 2138, height: 735, fit: "contain" }
  ] as const;
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActiveSlide((slide) => (slide + 1) % carouselSlides.length), 5000);
    return () => window.clearInterval(timer);
  }, [carouselSlides.length]);
  return <><SiteHeader /><section className="hero-carousel" aria-label="Featured collection">{carouselSlides.map((slide, index) => <Image className={`hero-carousel-image ${index === activeSlide ? "active" : ""}`} key={slide.src} src={slide.src} alt={slide.alt} width={slide.width} height={slide.height} sizes="100vw" style={{ objectFit: slide.fit, backgroundColor: "#fff" }} priority={index === 0} />)}</section><section className="categories section-pad" id="collections"><div className="section-heading"><div><p className="eyebrow">Find your kind</p><h2>Explore our <em>world</em></h2></div></div><div className="category-grid"><Link className="category category-large" href="/products?category=Kurtis"><Image src="/images/category-kurtas.jpg" alt="Model wearing a blue floral kurta beside peach flowers" fill sizes="(max-width: 800px) 100vw, 50vw" /><span>Kurtis</span></Link><Link className="category" href="/products?category=Sarees"><Image src="/images/category-sarees.jpg" alt="Model in a colourful floral saree against a deep red backdrop" fill sizes="(max-width: 800px) 50vw, 25vw" /><span>Sarees</span></Link><Link className="category" href="/products?category=Tops"><Image src="/images/category-tops-knit.jpg" alt="Model wearing a beige sleeveless knit top against a teal backdrop" fill sizes="(max-width: 800px) 50vw, 25vw" /><span>Tops</span></Link></div></section><section className="collection section-pad" id="shop"><div className="section-heading"><div><p className="eyebrow">Shop the edit</p><h2>Made for <em>every day</em></h2></div><Link className="text-link" href="/products">View all products</Link></div>{latestProducts.length ? <div className="product-grid">{latestProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <p className="empty-state">Products are coming soon.</p>}</section><ShopByVideo /><ScrollEditorial imageSrc="/images/editorial-saree.webp" imageAlt="Woman in a pink and gold saree by the sea" eyebrow="The collection" title="Wear Your Story." description="Timeless Indian styles, made for the woman you are." ctaHref="/products" ctaLabel="Shop Now" /><section className="story story-with-banner section-pad" id="story"><div><p className="eyebrow">About Pebbles Boutique</p><h2>Your <em>Style,</em> Your <em>Story.</em></h2></div><WearOurStory /><div className="story-copy"><p>At Pebbles Boutique, we bring together thoughtfully curated styles for everyday moments and special occasions. Discover pieces that celebrate your individuality, express your personality, and make every look uniquely yours.</p><p>Explore our latest collections and everyday inspirations on Instagram, or stay connected with us on Facebook.</p><div className="story-links"><a className="story-social-link" href="https://www.instagram.com/pebblesboutique2024" target="_blank" rel="noopener noreferrer" aria-label="Follow Pebbles Boutique on Instagram (opens in a new tab)"><Image className="story-social-icon" src="/images/social-instagram.svg" alt="" width={18} height={18} unoptimized /><span className="story-social-label">Follow on Instagram</span><span className="story-social-arrow" aria-hidden="true">↗</span></a><a className="story-social-link" href="https://www.facebook.com/share/1DsHE4o6HT/" target="_blank" rel="noopener noreferrer" aria-label="Connect with Pebbles Boutique on Facebook (opens in a new tab)"><Image className="story-social-icon" src="/images/social-facebook.svg" alt="" width={18} height={18} unoptimized /><span className="story-social-label">Connect on Facebook</span><span className="story-social-arrow" aria-hidden="true">↗</span></a></div></div></section><section className="manifesto promise-strip"><h2 className="promise-strip-title">The Pebbles promise</h2><div className="promise-grid"><div><PromiseIcon type="returns" /><h3>3–4 day returns &amp; exchanges</h3><p>Enjoy fast and easy returns and exchanges within 3–4 days.</p></div><div><PromiseIcon type="shipping" /><h3>Fast &amp; free shipping</h3><p>Your favourites arrive quickly with free shipping, made simple.</p></div><div><PromiseIcon type="payment" /><h3>Secure Online Payment</h3><p>Your payment is processed through Razorpay and verified before we confirm your order.</p></div></div></section><GoogleReviews /><SiteFooter /><MobileBottomNav /></>;
}

export function PageIntro({ eyebrow, title, description }: { eyebrow: string; title: ReactNode; description?: string }) {
  return <section className="page-intro"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p>{description}</p>}</section>;
}

export function ProductListing({ products: listedProducts, category, color, size, colors, query, page, totalPages }: { products: Product[]; category?: string; color?: string; size?: string; colors: Array<{ name: string | null; hex: string | null }>; query?: string; page: number; totalPages: number }) {
  const activeCategory = normalizeProductCategory(category).toLowerCase() || undefined;
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState(query ?? "");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(false);
  const params = (nextPage: number, nextCategory = category, nextColor = color, nextSize = size, nextQuery = query) => {
    const search = new URLSearchParams();
    if (nextCategory) search.set("category", nextCategory);
    if (nextColor) search.set("color", nextColor);
    if (nextSize) search.set("size", nextSize);
    if (nextQuery) search.set("query", nextQuery);
    if (nextPage > 1) search.set("page", String(nextPage));
    return `/products${search.toString() ? `?${search}` : ""}`;
  };
  useEffect(() => {
    setSearchTerm(query ?? "");
    setResultsLoading(false);
  }, [query, category, color, size]);
  useEffect(() => {
    setResultsLoading(false);
  }, [listedProducts]);
  const updateSearchTerm = (value: string) => {
    setSearchTerm(value);
    setResultsLoading(true);
  };
  useEffect(() => {
    const normalizedSearch = searchTerm.trim();
    if (normalizedSearch === (query ?? "").trim()) return;
    const timeout = window.setTimeout(() => {
      router.replace(params(1, category, color, size, normalizedSearch), { scroll: false });
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [searchTerm, query, category, color, size, router]);
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResultsLoading(true);
    router.replace(params(1, category, color, size, searchTerm.trim()), { scroll: false });
  };
  const activeFilterCount = [category, color, size].filter(Boolean).length;
  const clearFilters = () => {
    setFiltersOpen(false);
    setResultsLoading(true);
    const search = new URLSearchParams();
    if (query?.trim()) search.set("query", query.trim());
    router.push(`/products${search.toString() ? `?${search}` : ""}`, { scroll: false });
  };
  return <StoreShell><PageIntro eyebrow="The collection" title={<>Dressed for <em>every day.</em></>} description="Kurtas, sarees and tops made with beautiful textiles and an easy point of view." /><section className="listing-section"><form className="listing-toolbar" onSubmit={submitSearch}>  <div className="listing-search-field"><input name="query" value={searchTerm} onChange={(event) => updateSearchTerm(event.target.value)} placeholder="Search products..." aria-label="Search products" /><button className="listing-search-button" type="submit">Search</button></div><div className="listing-filter-actions"><button className={`filter-toggle${filtersOpen ? " active" : ""}`} type="button" aria-expanded={filtersOpen} aria-controls="product-filters" onClick={() => setFiltersOpen((open) => !open)}>Filter products{activeFilterCount > 0 && <span aria-label={`${activeFilterCount} active filters`}>{activeFilterCount}</span>}<span aria-hidden="true">⌄</span></button></div></form>{filtersOpen &&   <div className="product-filters" id="product-filters" aria-label="Product filters"><div className="product-filter-header"><span>Refine your results</span>{activeFilterCount > 0 && <button className="filter-clear" type="button" onClick={clearFilters}>Clear filters</button>}</div><div className="product-filter-group"><span className="product-filter-heading">Category</span><div className="filter-buttons">{["All", ...productCategories].map((item) =>   <Link scroll={false} onClick={() => setResultsLoading(true)} className={(activeCategory ?? "all") === item.toLowerCase() ? "active" : ""} key={item} href={params(1, item === "All" ? "" : item)}>{item}</Link>)}</div></div><label className="listing-filter"><span>Color</span>  <select value={color ?? ""} onChange={(event) => { setResultsLoading(true); router.push(params(1, category, event.target.value, size), { scroll: false }); }}><option value="">All colors</option>{colors.map((option) => <option value={option.name ?? ""} key={`${option.name}-${option.hex}`}>{option.name}</option>)}</select></label><label className="listing-filter"><span>Size</span>  <select value={size ?? ""} onChange={(event) => { setResultsLoading(true); router.push(params(1, category, color, event.target.value), { scroll: false }); }}><option value="">All sizes</option>{  ["M", "L", "XL", "XXL", "3XL", "One Size"].map((option) => <option value={option} key={option}>{option}</option>)}</select></label></div>}<div className={`product-results${resultsLoading ? " is-loading" : ""}`} aria-busy={resultsLoading}>{resultsLoading && <div className="product-results-loading" role="status" aria-live="polite"><div className="loading-mark" aria-hidden="true"><span /><span /><span /></div><span className="visually-hidden">Loading products</span></div>}<div className="product-grid product-grid-list">{listedProducts.map((product) => <ProductCard key={product.id} product={product} color={color} size={size} />)}</div>{!resultsLoading && !listedProducts.length && <p className="empty-state">No pieces found. Try another search.</p>}</div>{totalPages > 1 && <nav className="pagination" aria-label="Product pages">{Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => <Link className={number === page ? "active" : ""} href={params(number)} key={number}>{number}</Link>)}</nav>}</section></StoreShell>;
}

export function ProductDetail({ product, initialColor, initialSize }: { product: Product; initialColor?: string; initialSize?: string }) {
  const [added, setAdded] = useState(false);
  const colors=product.colors ?? [];
  const [colorId,setColorId]=useState(chooseColor(colors, initialColor, initialSize)?.id ?? "");
  const color=colors.find(c=>c.id===colorId);
  const variants=color?.variants ?? [];
  const [size,setSize]=useState(initialSize ?? "");
  const selectedVariant=chooseSize(variants,size);
  const selectedSize=selectedVariant?.size ?? "";
  const price=Number(selectedVariant?.priceOverride ?? product.price);
  const isSaree=variants.length===1 && variants[0].size==="One Size";
  const requireAuth=useRequireAuth();
  const addProductToCart=async ()=>{
    if(!selectedVariant || !color || !(await requireAuth())) return;
    updateCart(items=>mergeItem(items,{productId:product.id,variantId:selectedVariant.id,name:product.name,
      colorName:color.name,size:selectedSize,sku:selectedVariant.sku,price,quantity:1}));
    setAdded(true);
  };
  const gallery=color?.images ?? [];
  const [selectedImage, setSelectedImage] = useState(gallery[0]?.imageUrl ?? "");
  const currentImage = gallery.find((image) => image.imageUrl === selectedImage) ?? gallery[0];
  return <StoreShell><main className="detail-page"><div className="detail-gallery"><div className="detail-image">{currentImage ? <img src={currentImage.imageUrl} alt={currentImage.altText ?? product.name} /> : <span className="detail-image-empty">Image coming soon</span>}</div>{gallery.length > 1 && <div className="detail-thumbnails" aria-label="Product images">{gallery.map((image, index) => <button type="button" className={currentImage?.imageUrl === image.imageUrl ? "active" : ""} key={image.imageUrl} onClick={() => setSelectedImage(image.imageUrl)} aria-label={`View image ${index + 1}`}><img src={image.imageUrl} alt="" /></button>)}</div>}</div><div className="detail-copy"><p className="eyebrow">{product.category}</p><h1>{product.name}</h1><p className="detail-price">{money(price)}</p><p className="detail-description">{product.description}</p><div className="detail-divider" />{color && (
    <fieldset className="detail-colours">
      <legend>Colour: {color.name}</legend>
      <div className="detail-colour-options">
        {colors.map(option => (
          <label key={option.id} className="detail-colour-option" title={option.name}>
            <input
              className="visually-hidden"
              type="radio"
              name="product-colour"
              aria-label={option.name}
              value={option.id}
              checked={option.id === colorId}
              onChange={() => {
                setColorId(option.id);
                setSize("");
                setAdded(false);
                setSelectedImage("");
              }}
            />
            <span className="detail-colour-chip" style={{ backgroundColor: option.hex ?? undefined }} aria-hidden="true">
              {option.hex ? null : option.name.slice(0, 1).toUpperCase()}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )}
  {isSaree ? (
    <p className="form-note">One size · {variants[0]?.stockQuantity ?? 0} available</p>
  ) : (
    <>
      <div className="size-label"><span>Select size</span></div>
      <div className="size-options" role="radiogroup" aria-label="Available sizes">
        {variants.map((variant) => (
          <button
            type="button"
            role="radio"
            aria-checked={selectedSize === variant.size}
            aria-label={`${variant.size}, ${variant.stockQuantity > 0 ? `${variant.stockQuantity} available` : "sold out"}`}
            key={variant.size}
            className={`${selectedSize === variant.size ? "active" : ""} ${variant.stockQuantity === 0 ? "sold-out" : ""}`}
            disabled={variant.stockQuantity === 0}
            onClick={() => { setSize(variant.size); setAdded(false); }}
          >
            <strong>{variant.size}</strong>
            <small>{variant.stockQuantity > 0 ? `${variant.stockQuantity} left` : "Sold out"}</small>
          </button>
        ))}
      </div>
      {!variants.length && <p className="form-note">Sizes are currently unavailable.</p>}
    </>
  )}
  {product.isPreorder && (
    <section className="preorder-terms" aria-labelledby="preorder-terms-title">
      <h2 id="preorder-terms-title">⏳ PRE-ORDER TERMS</h2>
      <p>This saree is made to order with our weavers. Dispatch takes <strong>15–45 days</strong> depending on the weave.</p>
      <ul>
        <li>Our team will WhatsApp you the <strong>expected dispatch date within 24 hours</strong> of your order.</li>
        <li><strong>Cash on delivery booking is available</strong> for pre-orders — pay when your saree arrives.</li>
        <li><strong>Return and exchange are possible</strong>, as per our return &amp; cancellation guidelines below.</li>
        <li><strong>Cancellation</strong> is accepted within <strong>24 hours</strong> of placing the order.</li>
        <li>Colours and motifs may vary slightly from the photos, as every piece is handwoven.</li>
        <li>If we cannot deliver due to weaver delays, we will offer you a full refund.</li>
      </ul>
    </section>
  )}
  <button className="button dark-button add-button" disabled={!selectedVariant} onClick={addProductToCart}>
    {added ? "Added to bag ✓" : product.isPreorder ? "Pre-order" : "Add to bag"} <span>↗</span>
  </button>
  <div className="detail-notes">
    <p><b>Material</b><span>100% cotton, naturally dyed</span></p>
    <p><b>Care</b><span>Gentle machine wash, dry in shade</span></p>
    <p><b>Delivery</b><span>Ships within 2–4 business days</span></p>
  </div>
  </div></main></StoreShell>;
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
  const pathname = usePathname();
  const navLink = (href: string) => ({ "aria-current": pathname === href ? "page" as const : undefined });
  return <div className="admin-layout"><aside className="admin-sidebar"><Link href="/admin" className="admin-brand"><Image src="/images/pebbles-pebbles-wordmark-white-transparent.svg" alt="Pebbles Studio" width={150} height={53} /></Link><nav aria-label="Vendor navigation"><p>Overview</p><Link href="/admin" {...navLink("/admin")}>Dashboard</Link><p>Manage</p><Link href="/admin/products" {...navLink("/admin/products")}>Products</Link><Link href="/admin/categories" {...navLink("/admin/categories")}>Categories</Link><Link href="/admin/orders" {...navLink("/admin/orders")}>Orders</Link><Link href="/admin/customers" {...navLink("/admin/customers")}>Customers</Link></nav><Link href="/" className="back-store">← View storefront</Link></aside><main className="admin-main"><header className="admin-header"><span>Tuesday, 20 October 2026</span><Link href="/login">Admin account ↗</Link></header>{children}</main></div>;
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
  colorName: string | null;
  colorHex: string | null;
  price: string;
  isPreorder: boolean;
  variants: Array<{ id?: string; size: string; sku: string; stockQuantity: number; colorName?: string }>;
  images?: Array<{ id?: string; imageUrl: string; storageKey?: string; altText: string | null; sortOrder: number }>;
  primaryImageUrl?: string | null;
};

export function ProductAdminTable({ page = 1, initialQuery = "" }: { page?: number; initialQuery?: string }) {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(debouncedQuery ? 1 : page) });
    if (debouncedQuery) params.set("q", debouncedQuery);
    fetch(`/api/admin/products?${params}`, { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Unable to load products");
      const result = await response.json() as { products: AdminProduct[]; totalPages: number };
      setProducts(result.products);
      setTotalPages(result.totalPages);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load products")).finally(() => setLoading(false));
  }, [page, debouncedQuery]);

  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (nextPage > 1) params.set("page", String(nextPage));
    return `/admin/products?${params}`;
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this product?")) return;
    setError("");
    setMessage("");
    const response = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const result = await response.json().catch(() => null) as { error?: string } | null;
      setError(result?.error ?? "Unable to delete product");
      return;
    }

    const result = await response.json() as { message?: string };
    setProducts((current) => current.filter((product) => product.id !== id));
    setMessage(result.message ?? "Product removed from the storefront.");
  };

  const stockOut = async (product: AdminProduct) => {
    if (!product.variants.length || product.variants.every((variant) => variant.stockQuantity === 0)) return;
    if (!window.confirm(`Set every size of "${product.name}" to out of stock?`)) return;
    const response = await fetch(`/api/admin/products/${product.id}/stock-out`, { method: "POST", cache: "no-store" });
    if (!response.ok) {
      setError((await response.json().catch(()=>({}))).error ?? "Unable to update product stock");
      return;
    }
    setProducts((current) => current.map((item) => item.id === product.id ? { ...item, variants: item.variants.map((variant) => ({ ...variant, stockQuantity: 0 })) } : item));
  };

  return <div className="admin-table-wrap">{error && <p className="form-error">{error}</p>}{message && <p className="form-note" role="status">{message}</p>}<label className="admin-search"><span>Search products</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or SKU" aria-describedby="product-search-hint" /><small id="product-search-hint">Results update as you type</small></label>{loading ? <div className="table-loading" role="status" aria-live="polite"><div className="loading-mark" aria-hidden="true"><span /><span /><span /></div><p>Loading products...</p></div> : <><table><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Color</th><th>Price</th><th>Stock by size</th><th>Action</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><div className="admin-product-cell">{product.primaryImageUrl ? <img className="admin-product-thumb" src={product.primaryImageUrl} alt="" /> : <span className="admin-product-thumb admin-product-thumb-empty">—</span>}<span>{product.name}{product.isPreorder && <small className="admin-preorder-label">Pre-order</small>}</span></div></td><td>{product.sku}</td><td>{product.category}</td><td><span className="admin-color-swatch" style={{ backgroundColor: product.colorHex ?? "#D8D6CF" }} aria-label={product.colorName ?? "No color"} />{product.colorName ?? "—"}</td><td>{money(Number(product.price))}</td><td>{product.variants.map((variant) => `${variant.colorName ?? ""} ${variant.size}: ${variant.stockQuantity}`).join(" · ") || "—"}</td><td><div className="admin-product-actions"><Link className="table-action table-action-edit" href={`/admin/products/${product.id}/edit`}>Edit</Link><button className="table-action" type="button" disabled={!product.variants.some((variant) => variant.stockQuantity > 0)} onClick={() => void stockOut(product)}>Stock out</button><button className="table-action table-action-delete" type="button" onClick={() => void remove(product.id)}>Delete</button></div></td></tr>)}</tbody></table>{!products.length && <p className="empty-state">{debouncedQuery ? "No products match your search." : "No products yet."}</p>}{products.length > 0 && totalPages > 1 && <nav className="pagination" aria-label="Product pages"><Link className={page === 1 && !debouncedQuery ? "disabled" : ""} href={pageHref(Math.max(1, (debouncedQuery ? 1 : page) - 1))}>Previous</Link>{Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => <Link className={number === (debouncedQuery ? 1 : page) ? "active" : ""} href={pageHref(number)} key={number}>{number}</Link>)}<Link className={page === totalPages && !debouncedQuery ? "disabled" : ""} href={pageHref(Math.min(totalPages, (debouncedQuery ? 1 : page) + 1))}>Next</Link></nav>}</>}</div>;
}

type AdminOrder = {
  id: string;
  status: string;
  totalAmount: string;
  createdAt: string;
  items: Array<{ productName: string; size: string; quantity: number; colorName?: string | null }>;
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

  return <div className="admin-table-wrap">{error && <p className="form-error">{error}</p>}{loading ? <div className="table-loading" role="status" aria-live="polite"><div className="loading-mark" aria-hidden="true"><span /><span /><span /></div><p>Loading orders...</p></div> : <><table className="admin-orders-table"><thead><tr><th>Order</th><th>Items</th><th>Total</th><th>Status</th><th>Action</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td>#{order.id.slice(0, 8).toUpperCase()}<small className="admin-order-date">{new Date(order.createdAt).toLocaleDateString("en-IN")}</small></td><td>{order.items.map((item) => [item.productName,item.colorName,`${item.size} ×${item.quantity}`].filter(Boolean).join(" · ")).join(", ")}</td><td>₹{Number(order.totalAmount).toLocaleString("en-IN")}</td><td><span className={`status ${order.status}`}>{order.status.replace("_", " ")}</span></td><td><Link className="table-action" href={`/admin/orders/${order.id}`}>View details →</Link></td></tr>)}</tbody></table>{!orders.length && <p className="empty-state">No orders match these filters.</p>}{orders.length > 0 && totalPages > 1 && <nav className="pagination" aria-label="Order pages"><Link className={page === 1 ? "disabled" : ""} href={pageHref(Math.max(1, page - 1))}>Previous</Link>{Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => <Link className={number === page ? "active" : ""} href={pageHref(number)} key={number}>{number}</Link>)}<Link className={page === totalPages ? "disabled" : ""} href={pageHref(Math.min(totalPages, page + 1))}>Next</Link></nav>}</>}</div>;
}
