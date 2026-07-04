import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/ask-database/" : "/",
  plugins: [react()],
  server: {
    port: 5174
  },
  preview: {
    port: 4174
  }
}));
