import path from "path";
import { defineConfig } from "vite";
import builtins from "builtins";

export default defineConfig({
  build: {
    emptyOutDir: false,
    target: "node18",
    lib: {
      entry: {
        reagent: path.join(__dirname, "index.ts"),
      },
      fileName: "reagent",
      name: "reagent",
      formats: ["es"],
    },
    rollupOptions: {
      external: [
        "virtual:reagent-agent-module",
        "@reagentai/reagent",
        ...builtins(),
        /^node:.+/,
        "vite",
        /^@vite:*/,
        "tailwindcss",
      ],
      output: {
        format: "esm",
        name: "reagent",
      },
    },
  },
});
