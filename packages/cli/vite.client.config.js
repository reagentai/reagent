import path from "path";
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: path.join(__dirname, "app/react/chat/entry-client.tsx"),
      fileName: "entry-client",
      formats: ["es"],
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "virtual:reagent-agent-module",
        "./reagent.css",
        /\@reagentai\/reagent*/,
        /\@reagentai\/client*/,
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
          src: "./app/react/chat/reagent.css",
          dest: "./",
        },
      ],
    }),
  ],
});
