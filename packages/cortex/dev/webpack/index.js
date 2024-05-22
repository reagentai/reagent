import createVitePlugin from "../vite/plugin.js";

export default function (source) {
  const options = this.getOptions();
  const vitePlugin = createVitePlugin({
    tools: options.tools,
    presets: ["@babel/preset-typescript", "@babel/preset-react"],
  });

  const result = vitePlugin.transform(source, this.resourcePath, {
    ssr: options.ssr,
  });
  if (!result) {
    return source;
  }
  return result.code;
}
