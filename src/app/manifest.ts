import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Malam Pilihan Raya",
    short_name: "Pilihan Raya",
    description: "Build your power base, hold your seats and win Malaysia's election night.",
    start_url: "/",
    display: "standalone",
    background_color: "#141417",
    theme_color: "#141417",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
