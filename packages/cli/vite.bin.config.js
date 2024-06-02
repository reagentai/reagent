import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: false,
    target: "node18",
    lib: {
      entry: {
        reagent: path.join(__dirname, "index.ts"),
      },
      fileName: "reagent.js",
      name: "reagent.js",
      formats: ["es"],
    },
    rollupOptions: {
      external: ["virtual:reagent-agent-module"],
      preserveEntrySignatures: "strict",
      output: {
        format: "cjs",
        name: "reagent",
      },
    },
    ssr: {
      noExternals: true,
    },
  },
});
