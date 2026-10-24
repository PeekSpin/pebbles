"use client";

import Script from "next/script";
import { useState } from "react";

import { money } from "../../lib/format";

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

export default function PayPendingOrder({ orderId, amount, description }: { orderId: string; amount: number; description: string }) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const pay = async () => {
    if (!window.Razorpay) {
      setError("Payment checkout is still loading. Please try again.");
      return;
    }
    setProcessing(true);
    setError("");
    try {
      const response = await fetch(`/api/orders/${orderId}/payment`, { method: "POST" });
      const paymentOrder = await response.json() as { order_id?: string; amount?: number; currency?: string; error?: string };
      if (!response.ok || !paymentOrder.order_id || !paymentOrder.amount || !paymentOrder.currency) {
        throw new Error(paymentOrder.error ?? "Unable to start payment");
      }
      const razorpay = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "",
        amount: paymentOrder.amount,
        currency: paymentOrder.currency,
        name: "Pebbles",
        description,
        order_id: paymentOrder.order_id,
        handler: async (payment) => {
          try {
            const verification = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...payment, local_order_id: orderId })
            });
            const result = await verification.json() as { success?: boolean; order_id?: string; error?: string };
            if (!verification.ok || !result.success || !result.order_id) throw new Error(result.error ?? "Payment verification failed");
            window.location.reload();
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Payment verification failed. Please contact support.");
            setProcessing(false);
          }
        },
        modal: { ondismiss: () => setProcessing(false) }
      });
      razorpay.open();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to start payment");
      setProcessing(false);
    }
  };

  return <><Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" /><button className="button dark-button" type="button" onClick={pay} disabled={processing}>{processing ? "Opening payment..." : `Pay ${money(amount)}`} <span>↗</span></button>{error && <p className="form-error">{error}</p>}</>;
}
