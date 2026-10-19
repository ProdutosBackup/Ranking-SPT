import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

// Mesma família do site do SPT.
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Auditoria do Ranking — Suprema Poker Tour",
  description: "Confere a pontuação do ranking do Suprema Poker Tour e mostra onde ela não bate com a regra.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
