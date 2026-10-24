"use client";
import Link from "next/link";
import Image from "next/image";
import { products, setCartQuantity, SiteFooter, SiteHeader } from "../components/store";
import { money } from "../lib/format";
import { useEffect, useState } from "react";
export default function CartPage() {
  const [quantity, setQuantity] = useState(1);
  const [removed, setRemoved] = useState(false);
  const [cartLoaded, setCartLoaded] = useState(false);
  const product = products[1];
  useEffect(() => {
    const storedQuantity = window.localStorage.getItem("pebbles-cart-quantity");
    if (storedQuantity) {
      setQuantity(Math.max(1, Number(storedQuantity)));
    } else {
      setRemoved(true);
    }
    setCartLoaded(true);
  }, []);
  useEffect(() => {
    if (cartLoaded && !removed) setCartQuantity(quantity);
  }, [cartLoaded, quantity, removed]);
  const removeItem = () => {
    setRemoved(true);
    setCartQuantity(0);
  };
  const total = product.price * quantity;
  return <><SiteHeader /><div className="cart-page"><div className="cart-heading"><p className="eyebrow">Your selection</p><h1>Your <em>cart.</em></h1></div>{removed ? <div className="empty-cart"><h2>Your cart is waiting.</h2><p>There&apos;s nothing here yet. Find something beautiful for every day.</p><Link href="/products" className="button dark-button">Continue shopping <span>↗</span></Link></div> : <div className="cart-layout"><div className="cart-items"><div className="cart-item"><div className="cart-item-image"><Image src={product.image} alt={product.name} fill sizes="120px" /></div><div><p className="eyebrow">{product.category}</p><h3>{product.name}</h3><p>{money(product.price)}</p><div className="quantity"><button type="button" aria-label="Decrease quantity" onClick={() => setQuantity((current) => Math.max(1, current - 1))}>−</button><span>{quantity}</span><button type="button" aria-label="Increase quantity" onClick={() => setQuantity((current) => current + 1)}>+</button></div></div><button type="button" className="remove" onClick={removeItem}>Remove</button></div></div><aside className="order-summary"><p className="eyebrow">Summary</p><div><span>Subtotal</span><strong>{money(total)}</strong></div><div><span>Shipping</span><strong>Free</strong></div><hr /><div className="summary-total"><span>Total</span><strong>{money(total)}</strong></div><Link href="/checkout" className="button dark-button">Checkout <span>↗</span></Link></aside></div>}</div><SiteFooter /></>;
}
