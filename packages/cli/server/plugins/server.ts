import type { Plugin as VitePlugin } from "vite";
import { Hono } from "hono";
import { getRequestListener } from "@hono/node-server";
import { createChatAgentRouter } from "@reagentai/serve/chat";

const createRouter = () => {
  const app = new Hono();

  app.get("/", async (c) => {
    return c.html(`
      <html>
          <head>
              <script type="module" src="/@vite/client"></script>
              <script src="@reagent/serve/entry" type="module"></script>
          </head>
          <body><div id="reagent-agent" style="width: 100%; height: 100%"></div></body>
      </html>
    `);
  });

  return app;
};

export function devServer(): VitePlugin {
  const plugin: VitePlugin = {
    name: "reagent-dev-server",
    configureServer: async (server) => {
      let app: any;
      server.middlewares.use(async (req, res, next) => {
        if (!app) {
          app = createRouter();
          // need to load ssr modules after the server is ready
          // so, do it in the first request
          const agent = await server.ssrLoadModule(
            "virtual:reagent-agent-module"
          );
          const agents = new Map([["default", agent.default]]);
          app.route("/api/chat", createChatAgentRouter(agents as any));
        }
        const hasRoute = app.router.match(req.method!, req.url!)[0].length > 0;
        if (!hasRoute) {
          return next();
        }
        getRequestListener(
          async (request) => {
            const response = await app.fetch(request);
            if (!(response instanceof Response)) {
              throw response;
            }
            return response;
          },
          {
            overrideGlobalObjects: false,
            errorHandler: (e) => {
              let err: Error;
              if (e instanceof Error) {
                err = e;
                server.ssrFixStacktrace(err);
              } else if (typeof e === "string") {
                err = new Error(
                  `The response is not an instance of "Response", but: ${e}`
                );
              } else {
                err = new Error(`Unknown error: ${e}`);
              }
              next(err);
            },
          }
        )(req, res);
      });
    },
  };

  return plugin;
}