"use client";

import { FormEvent, useState } from "react";

type Status = "pending_payment" | "confirmed" | "shipped" | "delivered" | "cancelled";

export function OrderStatusForm({ orderId, initialStatus }: { orderId: string; initialStatus: Status }) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Unable to update status");
      setMessage("Status updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update status");
    } finally {
      setSaving(false);
    }
  };

  return <form className="admin-form" onSubmit={submit}><h2>Update order status</h2><label className="field"><span>Order status</span><select value={status} onChange={(event) => setStatus(event.target.value as Status)}><option value="pending_payment">Pending payment</option><option value="confirmed">Confirmed</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option></select></label><button className="admin-button" type="submit" disabled={saving}>{saving ? "Saving..." : "Save status"} →</button>{message && <p className={message === "Status updated." ? "form-success" : "form-error"}>{message}</p>}</form>;
}
