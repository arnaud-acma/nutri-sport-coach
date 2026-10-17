import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Appli 100 % dynamique (données personnelles derrière auth) :
  // pas de cache de composants, chaque page lit la base à la demande.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
