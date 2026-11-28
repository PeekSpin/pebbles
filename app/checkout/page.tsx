"use client";

import Script from "next/script";
import { FormEvent, useState } from "react";

import { StoreShell, useRequireAuth } from "../components/store";
import {useQuotedCart} from "../lib/use-cart";
import {updateCart,subtractPurchased} from "../lib/cart";
import { money } from "../lib/format";

declare global {
  interface Window {
    Razorpay?: new (options: {
      key: string;
      amount: number;
      currency: string;
      name: string;
      description: string;
      order_id: string;
      handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
      modal: { ondismiss: () => void };
    }) => { open: () => void };
  }
}

export default function CheckoutPage() {
  const {lines,ready,error:quoteError}=useQuotedCart();
  const subtotal=lines.reduce((t,i)=>t+i.price*i.quantity,0);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const requireAuth = useRequireAuth();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!(await requireAuth())) return;
    if (!ready) {
      setError("Review current stock in your cart before paying.");
      return;
    }
    if (!window.Razorpay) {
      setError("Payment checkout is still loading. Please try again.");
      return;
    }
    setProcessing(true);
    setError("");
    try {
      const address={
        recipientName:[form.get("firstName"),form.get("lastName")].join(" ").trim(),
        phone:String(form.get("phone")).trim(),addressLine1:String(form.get("address")).trim(),
        city:String(form.get("city")).trim(),pincode:String(form.get("pincode")).trim()
      };
      const items=lines.map(i=>({productId:i.productId,variantId:i.variantId,quantity:i.quantity,unitPaise:Math.round(i.price*100)}));
      const fingerprint=JSON.stringify({items,address});
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(fingerprint))),n=>n.toString(16).padStart(2,"0")).join("");
      const sessionKey="pebbles-checkout-"+digest;
      const checkoutKey=sessionStorage.getItem(sessionKey) || crypto.randomUUID();
      sessionStorage.setItem(sessionKey,checkoutKey);
      const response=await fetch("/api/create-order",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({checkoutKey,items,address})});
      const order = await response.json() as { order_id?: string; key_id?: string; amount?: number; currency?: string; local_order_id?: string; error?: string };
      if (!response.ok || !order.order_id || !order.amount || !order.currency || !order.local_order_id) throw new Error(order.error ?? "Unable to start payment");
      const razorpay = new window.Razorpay({
        key: order.key_id ?? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "",
        amount: order.amount,
        currency: order.currency,
        name: "Pebbles",
        description: lines.map(i=>i.name+" ×"+i.quantity).join(", "),
        order_id: order.order_id,
        handler: async (payment) => {
          try {
          const verification = await fetch("/api/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payment, local_order_id: order.local_order_id })
          });
          const result = await verification.json() as { success?: boolean; order_id?: string; error?: string };
          if (!verification.ok || !result.success) {
            setError(result.error ?? "Payment verification failed. Please contact support.");
            setProcessing(false);
            return;
          }
          updateCart(current=>subtractPurchased(current,lines));
          sessionStorage.removeItem(sessionKey);
          window.location.href = `/orders/${result.order_id}`;
          } catch { setError("Payment status could not be loaded. Check your orders before paying again."); setProcessing(false); }
        },
        modal: { ondismiss: () => setProcessing(false) }
      });
      razorpay.open();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to start payment");
      setProcessing(false);
    }
  };

  return <><Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" /><StoreShell><div className="checkout-page"><div><p className="eyebrow">Almost yours</p><h1>Complete your <em>order.</em></h1>{error && <p className="form-error">{error}</p>}{quoteError && <p role="alert">{quoteError}</p>}{!lines.length ? <p className="empty-state">Your cart is empty. Add a product before checking out.</p> : <form onSubmit={submit}><h2>Delivery details</h2><div className="field-row"><label className="field"><span>First name</span><input name="firstName" required /></label><label className="field"><span>Last name</span><input name="lastName" required /></label></div><label className="field"><span>Phone</span><input name="phone" type="tel" required /></label><label className="field"><span>Address</span><input name="address" required /></label><div className="field-row"><label className="field"><span>City</span><input name="city" required /></label><label className="field"><span>Pincode</span><input name="pincode" inputMode="numeric" required /></label></div><h2>Payment method</h2><label className="payment-option"><input type="radio" defaultChecked name="payment" /> Razorpay secure checkout <span>Cards, UPI &amp; net banking</span></label><button className="button dark-button" type="submit" disabled={processing || !ready}>{processing ? "Opening payment..." : "Pay securely"} <span>↗</span></button></form>}</div>{lines.length>0 && <aside className="checkout-aside"><p className="eyebrow">Order summary</p>{lines.map(item=><section key={item.variantId}><h3>{item.name}</h3><p>{item.colorName} · {item.size} · {item.quantity} × {money(item.price)}</p></section>)}{!ready && <a href="/cart">Review availability in your cart</a>}<div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div><span>Shipping</span><strong>Free</strong></div><hr /><div><span>Total</span><strong>{money(subtotal)}</strong></div></aside>}</div></StoreShell></>;
}
