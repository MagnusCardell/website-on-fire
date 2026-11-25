import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sources = path.resolve(__dirname, "client");
const own = [
  path.resolve(__dirname, "client/solitaire"),
  path.resolve(__dirname, "client/public/solitaire"),
];
const inside = (dir: string, file: string) => file.startsWith(dir + path.sep);

// Fails the build when a site file feeds the game: an import that leaves the
// game's folder, or a Tailwind config that reads the site's markup. Asked of the
// bundler itself, which knows every file the script and the stylesheet were made from.
function ownSourcesOnly(): Plugin {
  return {
    name: "solitaire-own-sources-only",
    buildEnd(error) {
      if (error) return;
      const inputs = new Set(
        [...this.getModuleIds(), ...this.getWatchFiles()].map((id) => id.split("?")[0]),
      );
      const foreign = [...inputs]
        .filter((file) => inside(sources, file) && !own.some((dir) => inside(dir, file)))
        .sort();
      if (foreign.length > 0) {
        this.error(
          `the solitaire build reads site files, so a change to the site would change the game:\n  ${foreign.join("\n  ")}`,
        );
      }
    },
  };
}

// The solitaire is built apart from the site. Its script and stylesheet land in
// solitaire/assets/ and hold nothing of the site's, so a change to the site never
// changes a file the game's service worker caches. Runs after the site build,
// into the same folder.
export default defineConfig({
  plugins: [
    react(),
    ownSourcesOnly(),
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
