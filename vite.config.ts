import { resolve } from "path";
import { defineConfig } from "vitest/config";

// Served from https://yukileno.github.io/block/ (a project
// page, not a user page), so every asset URL needs this prefix in production.
export default defineConfig({
  base: process.env.GITHUB_PAGES ? "/block/" : "/",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        debug: resolve(__dirname, "debug.html"),
      },
    },
  },
  worker: {
    format: "es",
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
