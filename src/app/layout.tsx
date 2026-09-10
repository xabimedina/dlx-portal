import type { Metadata } from "next";
import { Kanit, Montserrat } from "next/font/google";
import "./globals.css";

const kanit = Kanit({
  variable: "--font-kanit",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tu obra, despejada — Portal de Clientes | Despeja la X",
  description: "Portal privado para clientes de Despeja la X. Realiza el seguimiento del desarrollo, decisiones, documentos y obra de tu proyecto de arquitectura e interiorismo.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${kanit.variable} ${montserrat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans selection:bg-jet selection:text-whitesmoke">
        {children}
      </body>
    </html>
  );
}
