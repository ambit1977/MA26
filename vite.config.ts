import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.BASE_PATH || (process.env.GITHUB_PAGES === "true" ? "/MA26/" : "/"),
  plugins: [react()],
});
