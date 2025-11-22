import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MentorRotina - Calendário",
  description: "Organize sua rotina com o MentorRotina",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
