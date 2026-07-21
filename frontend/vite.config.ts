import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Build configuration: we support building the landing and the app separately.
// Mode can be 'landing' or 'app'.
export default defineConfig(({ mode }) => {
  const isApp = mode === "app";

  return {
    plugins: [
      react(),
      tailwindcss(),
      isApp && viteSingleFile()
    ].filter(Boolean),

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },

    build: {
      outDir: isApp ? "../public/app" : "../public",
      emptyOutDir: false,
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, "index.html"),
        },
      },
    },

    // Set base path appropriately
    base: isApp ? "/app/" : "/",
  };
});
