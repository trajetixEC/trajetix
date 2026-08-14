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
            __html: `(function(){try{var a=localStorage.getItem('trajetix-appearance')||'LIGHT';var isLight=a==='LIGHT'||(a==='SYSTEM'&&matchMedia('(prefers-color-scheme: light)').matches);document.documentElement.dataset.theme=isLight?'light':'dark';if(isLight){document.documentElement.classList.remove('dark');document.documentElement.classList.add('light')}else{document.documentElement.classList.add('dark');document.documentElement.classList.remove('light')}}catch(e){document.documentElement.dataset.theme='light'}})()`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
