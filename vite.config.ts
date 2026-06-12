import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { APP_VERSION } from "./src/version";

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
});