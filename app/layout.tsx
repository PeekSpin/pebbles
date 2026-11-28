import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pebbles — Everyday, elevated",
  description: "Thoughtful everyday essentials, designed to last.",
  icons: {
    icon: "/images/pebbles-mark-black-transparent.svg"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  // Some managed builds receive the Clerk key only when the release is served.
  if (!publishableKey) noStore();
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
