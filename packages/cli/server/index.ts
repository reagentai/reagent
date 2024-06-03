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
              darkMode: "class",
              content: [
                "**/*.{jsx,tsx,html,css}",
                "**/@reagentai/cli/entry-client.js",
              ],
            },
          }),
        ],
      },
    },
    plugins: [
      virtualFiles(),
      devServer(),
      react({
        // for now, only include current dir here to avoid
        //  @vitejs/plugin-react can't detect preamble error
        include: [process.cwd()],
      }),
    ],
    root: process.cwd(),
    server: {
      open: options.open,
      port: 1337,
    },
    resolve: {
      alias: {
        "/virtual:reagent-entry-client": "@reagentai/cli/entry-client",
        "virtual:reagent-agent-module": path.join(process.cwd(), options.file),
      },
    },
  });
  await server.listen();
};

export { serve };
