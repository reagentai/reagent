import path from "path";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";

import virtualFiles from "./plugins/virtual";
import { devServer } from "./plugins/server";

const serve = async (options: { file: string; open: boolean }) => {
  const server = await createServer({
    configFile: false,
    build: {
      rollupOptions: {
        external: ["virtual:reagent-agent-module", "reagent.css"],
      },
    },
    css: {
      postcss: {
        plugins: [
          tailwindcss({
            config: {
              content: [
                "**/*.{jsx,tsx,html,css}",
                "**/@reagent/cli/entry-client.js",
              ],
            },
          }),
        ],
      },
    },
    plugins: [virtualFiles(), devServer(), react()],
    root: process.cwd(),
    server: {
      open: options.open,
      port: 1337,
    },
    resolve: {
      alias: {
        "/@reagent/serve/entry": "@reagent/cli/entry-client",
        "virtual:reagent-agent-module": path.join(process.cwd(), options.file),
      },
    },
  });
  await server.listen();
};

export { serve };
