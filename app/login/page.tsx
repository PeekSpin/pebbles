import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return <main className="clerk-auth-page"><SignIn path="/login" routing="path" signUpUrl="/register" fallbackRedirectUrl="/" /></main>;
}
