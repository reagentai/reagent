import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import reagent from "@reagentai/reagent/vite";

export default defineConfig({
  plugins: [remix(), reagent({})],
});
