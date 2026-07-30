import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: { default: "TrajetixERP", template: "%s · TrajetixERP" },
  description:
    "Plataforma de gestión logística, ecommerce y operaciones para Latinoamérica.",
  applicationName: "TrajetixERP",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "TrajetixERP",
    description: "Software inteligente para gestión logística",
    type: "website",
    images: [
      { url: "/brand/trajetix-app-icon.png", width: 1024, height: 1024 },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var a=localStorage.getItem('trajetix-appearance')||'DARK';var l=a==='LIGHT'||(a==='SYSTEM'&&matchMedia('(prefers-color-scheme: light)').matches);document.documentElement.dataset.theme=l?'light':'dark'}catch(e){document.documentElement.dataset.theme='dark'}})()`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
