import { Links, Meta, Outlet, Scripts } from "@remix-run/react";
import type { LinksFunction } from "@remix-run/node";
// @ts-expect-error
import styles from "./style.css?url";

export default function App() {
  return (
    <html>
      <head>
        <link rel="icon" href="data:image/x-icon;base64,AA" />
        <Meta />
        <Links />
      </head>
      <body>
        <div className="h-screen">
          <Outlet />
        </div>
        <Scripts />
      </body>
    </html>
  );
}
export const links: LinksFunction = () => [{ rel: "stylesheet", href: styles }];
