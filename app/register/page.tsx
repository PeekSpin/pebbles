import { SignUp } from "@clerk/nextjs";

export default function RegisterPage() {
  return <main className="clerk-auth-page"><SignUp path="/register" routing="path" signInUrl="/login" fallbackRedirectUrl="/" /></main>;
}
