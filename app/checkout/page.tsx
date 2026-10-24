"use client";

import Script from "next/script";
import { FormEvent, useEffect, useState } from "react";

import { CartItem, StoreShell } from "../components/store";
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
  const [item, setItem] = useState<CartItem | null>(null);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("pebbles-cart-item");
    if (stored) {
      try {
        setItem(JSON.parse(stored) as CartItem);
      } catch {
        setError("Your cart could not be loaded. Please return to the product page.");
      }
    }
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!item) {
      setError("Your cart is empty.");
      return;
    }
    if (!window.Razorpay) {
      setError("Payment checkout is still loading. Please try again.");
      return;
    }
    setProcessing(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          address: {
            recipientName: `${String(form.get("firstName") ?? "").trim()} ${String(form.get("lastName") ?? "").trim()}`.trim(),
            phone: String(form.get("phone") ?? "").trim(),
            addressLine1: String(form.get("address") ?? "").trim(),
            city: String(form.get("city") ?? "").trim(),
            pincode: String(form.get("pincode") ?? "").trim()
          }
        })
      });
      const order = await response.json() as { order_id?: string; amount?: number; currency?: string; local_order_id?: string; error?: string };
      if (!response.ok || !order.order_id || !order.amount || !order.currency || !order.local_order_id) throw new Error(order.error ?? "Unable to start payment");
      const razorpay = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "",
        amount: order.amount,
        currency: order.currency,
        name: "Pebbles",
        description: `${item.name} · Size ${item.size}`,
        order_id: order.order_id,
        handler: async (payment) => {
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
          window.localStorage.removeItem("pebbles-cart-item");
          window.localStorage.removeItem("pebbles-cart-quantity");
          window.location.href = `/orders/${result.order_id}`;
        },
        modal: { ondismiss: () => setProcessing(false) }
      });
      razorpay.open();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to start payment");
      setProcessing(false);
    }
  };

  return <><Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" /><StoreShell><div className="checkout-page"><div><p className="eyebrow">Almost yours</p><h1>Complete your <em>order.</em></h1>{error && <p className="form-error">{error}</p>}{!item ? <p className="empty-state">Your cart is empty. Add a product before checking out.</p> : <form onSubmit={submit}><h2>Delivery details</h2><div className="field-row"><label className="field"><span>First name</span><input name="firstName" required /></label><label className="field"><span>Last name</span><input name="lastName" required /></label></div><label className="field"><span>Phone</span><input name="phone" type="tel" required /></label><label className="field"><span>Address</span><input name="address" required /></label><div className="field-row"><label className="field"><span>City</span><input name="city" required /></label><label className="field"><span>Pincode</span><input name="pincode" inputMode="numeric" required /></label></div><h2>Payment method</h2><label className="payment-option"><input type="radio" defaultChecked name="payment" /> Razorpay secure checkout <span>Cards, UPI &amp; net banking</span></label><button className="button dark-button" type="submit" disabled={processing}>{processing ? "Opening payment..." : "Pay securely"} <span>↗</span></button></form>}</div>{item && <aside className="checkout-aside"><p className="eyebrow">Order summary</p><h3>{item.name}</h3><p>Size {item.size} · Quantity {item.quantity}</p><div><span>Subtotal</span><strong>{money(item.price * item.quantity)}</strong></div><div><span>Shipping</span><strong>Free</strong></div><hr /><div><span>Total</span><strong>{money(item.price * item.quantity)}</strong></div></aside>}</div></StoreShell></>;
}
