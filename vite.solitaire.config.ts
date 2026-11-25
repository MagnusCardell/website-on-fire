import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The solitaire is built apart from the site. Its script and stylesheet land in
// solitaire/assets/ and hold nothing of the site's, so a change to the site never
// changes a file the game's service worker caches. Runs after the site build,
// into the same folder.
export default defineConfig({
  plugins: [
    react()
  ],
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: false,
    copyPublicDir: false,
    assetsDir: "solitaire/assets",
    manifest: true,
    rollupOptions: {
      input: {
        solitaire: path.resolve(__dirname, "client/solitaire/index.html"),
      },
    },
  },
});
