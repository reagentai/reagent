import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import reagentPlugin from "@reagentai/reagent/vite";

import { devServer } from "./plugins/server";
import { virtualFiles } from "./plugins/virtual";

type Options = { file: string; open: boolean; port: number };
const dev = async (options: Options) => {
  // @ts-ignore
  const server = await createServer({
    configFile: false,
    build: {
      lib: {
        entry: {
          reagent: "virtual:reagent-agent-module",
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
          // @ts-ignore
          tailwindcss({
            config: {
              darkMode: "class",
              content: [
                "**/*.{js,ts,jsx,tsx,html,css}",
                "**/@reagentai/cli/**/*.{js,jsx,css}",
              ],
            },
          }),
        ],
      },
    },
    optimizeDeps: {
      exclude: ["virtual:reagent-agent-module"],
    },
    plugins: [
      virtualFiles({
        "virtual:reagent-agent-module": `export * from "${options.file}";
        export { default } from "${options.file}";`,
      }),
      devServer(),
      react({
        // for now, only include current dir here to avoid
        //  @vitejs/plugin-react can't detect preamble error
        include: [process.cwd()],
      }),
      reagentPlugin({
        include: ["**/@reagentai/**"],
        exclude: ["**/node_modules/**"],
      }),
    ],
    root: process.cwd(),
    server: {
      open: options.open,
      port: options.port,
    },
    resolve: {
      alias: {
        "/virtual:reagent-entry-client": "@reagentai/cli/entry-client",
      },
    },
  });
  await server.listen();
};

export { dev };
