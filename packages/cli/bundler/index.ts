import path from "path";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import { reagent } from "@reagentai/reagent/dev/vite";

import virtualFiles from "./plugins/virtual";
import { devServer } from "./plugins/server";
import createAgentPlugin from "./plugins/agent";

type Options = { file: string; open: boolean };
const dev = async (options: Options) => {
  const inputFile = path.join(process.cwd(), options.file);
  const server = await createServer({
    configFile: false,
    build: {
      lib: {
        entry: {
          reagent: inputFile,
        },
        fileName: "out.js",
        name: "out.js",
        formats: ["es"],
      },
      rollupOptions: {
        external: ["virtual:reagent-agent-module", "reagent.css"],
        treeshake: true,
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
                "**/@reagentai/cli/**/*.{js,jsx,css}",
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
      reagent({}),
      createAgentPlugin(),
    ],
    root: process.cwd(),
    server: {
      open: options.open,
      port: 1337,
    },
    resolve: {
      alias: {
        "/virtual:reagent-entry-client": "@reagentai/cli/entry-client",
        "virtual:reagent-agent-module": inputFile,
      },
    },
  });
  await server.listen();
};

export { dev };
