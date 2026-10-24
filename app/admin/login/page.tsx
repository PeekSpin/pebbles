import { SignIn } from "@clerk/nextjs";

export default function AdminLoginPage() {
  return <main className="clerk-auth-page"><SignIn path="/admin/login" routing="path" signUpUrl="/register" fallbackRedirectUrl="/admin" /></main>;
}
