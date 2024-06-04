import path from "path";
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: path.join(__dirname, "react/chat/entry-client.tsx"),
      fileName: "entry-client",
      formats: ["es"],
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "virtual:reagent-agent-module",
        "./reagent.css",
        "@reagentai/reagent",
      ],
      preserveEntrySignatures: "strict",
      output: {
        format: "esm",
      },
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: "./react/chat/reagent.css",
          dest: "./",
        },
      ],
    }),
  ],
});
