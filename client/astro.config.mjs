import { defineConfig } from "astro/config";
import node from "@astrojs/node";

export default defineConfig({
  output: "server",
  security: {
    checkOrigin: false
  },
  adapter: node({
    mode: "standalone"
  }),
  server: {
    proxy: {
      "/api": process.env.API_PROXY_TARGET ?? "http://localhost:8000"
    }
  }
});
