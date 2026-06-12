import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { APP_VERSION } from "./src/version";

function mansakuLandingPagesPlugin(): Plugin {
  return {
    name: "mansaku-landing-pages",
    closeBundle() {
      execFileSync(
        process.execPath,
        [path.resolve("scripts/generate-lp-language-pages.mjs"), "dist"],
        { stdio: "inherit" }
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), mansakuLandingPagesPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
});
