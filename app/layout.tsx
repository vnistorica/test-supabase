import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Supabase Test App",
  description: "A Next.js app connected to PostgreSQL (Supabase-compatible)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
        {children}
      </body>
    </html>
  );
}
