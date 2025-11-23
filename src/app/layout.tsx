import type { Metadata } from "next";
import "./globals.css";
import { SettingsProvider } from "@/components/providers/SettingsProvider";

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
        <SettingsProvider>
          {children}
        </SettingsProvider>
      </body>
    </html>
  );
}
