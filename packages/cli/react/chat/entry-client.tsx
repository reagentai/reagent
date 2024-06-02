import React from "react";
import * as ReactDOM from "react-dom/client";
import App from "./app";

window.React = React;

const root = ReactDOM.createRoot(document.getElementById("reagent-agent")!);
root.render(
  <React.StrictMode>
    <div className="h-screen w-screen">
      <App />
    </div>
  </React.StrictMode>
);
