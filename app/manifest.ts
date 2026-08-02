import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LingoMind",
    short_name: "LingoMind",
    description: "Belajar bahasa asing dengan AI",
    start_url: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#14b8a6",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
