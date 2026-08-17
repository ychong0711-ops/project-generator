import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  server: {
    host: true,
    allowedHosts: true,
    port: 5173,
    open: true, // ← 이게 있어야 자동 오픈
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});