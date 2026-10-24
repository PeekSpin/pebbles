import { ensureUserProfile } from "../../server/services/user.service";
import Link from "next/link";
import { Field, SignOutButton, SimpleForm } from "../components/store";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const profile = await ensureUserProfile();

  return <SimpleForm title={<>Your <em>profile.</em></>} button="Save changes">
    <Field label="Full name" defaultValue={profile.name ?? ""} placeholder="Ananya Mehta" />
    <Field label="Email address" type="email" defaultValue={profile.email ?? ""} placeholder="ananya@example.com" />
    <Field label="Phone number" placeholder="+91 98765 43210" />
    <Field label="Address" placeholder="14 Palm Avenue, Bengaluru" />
    <Link className="account-orders-link" href="/orders"><span><b>My orders</b><small>Track your purchases and delivery status</small></span><strong>View orders →</strong></Link>
    <SignOutButton />
  </SimpleForm>;
}
