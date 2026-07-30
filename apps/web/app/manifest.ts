import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TrajetixERP",
    short_name: "TrajetixERP",
    description: "Software inteligente para gestión logística",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0d0b0b",
    theme_color: "#ef111a",
    icons: [{ src: "/brand/trajetix-app-icon.png", sizes: "1024x1024", type: "image/png" }],
  };
}
